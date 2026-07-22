const fetch = require('node-fetch');

const cache = new Map();

function bucketCandidates(projectId) {
  return [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`];
}

async function resolveWithProbe(cacheKey, candidates, probe) {
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  for (const bucketName of candidates) {
    if (await probe(bucketName)) {
      cache.set(cacheKey, bucketName);
      return bucketName;
    }
  }
  return candidates[0];
}

function resolveAdminBucket(adminRef, projectId) {
  return resolveWithProbe(`admin:${projectId}`, bucketCandidates(projectId), async (bucketName) => {
    try {
      const [exists] = await adminRef.storage().bucket(bucketName).exists();
      return exists;
    } catch {
      return false;
    }
  });
}

function resolveOauthBucket(projectId, accessToken) {
  return resolveWithProbe(`oauth:${projectId}`, bucketCandidates(projectId), async (bucketName) => {
    try {
      const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucketName}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return !data.error;
    } catch {
      return false;
    }
  });
}

function resolveEmulatorBucket(baseUrl, projectId) {
  return resolveWithProbe(`emulator:${projectId}`, bucketCandidates(projectId), async (bucketName) => {
    try {
      const response = await fetch(`${baseUrl}/b/${bucketName}/o?maxResults=1`, {
        headers: { Authorization: 'Bearer owner' },
      });
      return response.ok;
    } catch {
      return false;
    }
  });
}

function clearBucketCache(...prefixes) {
  if (!prefixes.length) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) cache.delete(key);
  }
}

module.exports = { resolveAdminBucket, resolveOauthBucket, resolveEmulatorBucket, clearBucketCache };
