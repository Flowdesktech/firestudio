const BATCH_SIZE = 500;

function toRestError(result) {
  if (!result.ok) {
    const error = new Error(result.error?.error || 'Authentication failed');
    error.ipcResult = result.error;
    return error;
  }
  const apiError = result.data.error;
  const error = new Error(apiError.message);
  error.ipcResult = { success: false, error: apiError.message, requiresReauth: apiError.code === 401 };
  return error;
}

async function fetchJson(authenticatedFetch, url, options = {}) {
  const result = await authenticatedFetch(url, options);
  if (!result.ok || result.data?.error) throw toRestError(result);
  return result.data || {};
}

function postJson(authenticatedFetch, url, body) {
  return fetchJson(authenticatedFetch, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function relativeDocPath(resourceName) {
  return resourceName.split('/documents/')[1];
}

async function listCollectionIds({ authenticatedFetch, urlRoot }, docPath) {
  const ids = [];
  let pageToken;
  do {
    const data = await postJson(
      authenticatedFetch,
      `${urlRoot}/${docPath}:listCollectionIds`,
      pageToken ? { pageToken } : {},
    );
    ids.push(...(data.collectionIds || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function listDocumentPaths({ authenticatedFetch, urlRoot }, collectionPath) {
  const paths = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ pageSize: '300', showMissing: 'true' });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await fetchJson(authenticatedFetch, `${urlRoot}/${collectionPath}?${query}`);
    paths.push(...(data.documents || []).map((doc) => relativeDocPath(doc.name)));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return paths;
}

async function collectTreePaths(ctx, docPath, acc) {
  for (const collectionId of await listCollectionIds(ctx, docPath)) {
    for (const childPath of await listDocumentPaths(ctx, `${docPath}/${collectionId}`)) {
      await collectTreePaths(ctx, childPath, acc);
    }
  }
  acc.push(docPath);
  return acc;
}

async function deleteDocumentTree({ authenticatedFetch, urlRoot, nameRoot, docPath }) {
  const paths = await collectTreePaths({ authenticatedFetch, urlRoot }, docPath, []);
  for (let start = 0; start < paths.length; start += BATCH_SIZE) {
    const writes = paths.slice(start, start + BATCH_SIZE).map((path) => ({ delete: `${nameRoot}/${path}` }));
    await postJson(authenticatedFetch, `${urlRoot}:commit`, { writes });
  }
}

module.exports = { deleteDocumentTree, listCollectionIds };
