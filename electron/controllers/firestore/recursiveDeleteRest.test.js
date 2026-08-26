// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const { deleteDocumentTree, listCollectionIds } = require_('./recursiveDeleteRest');

const URL_ROOT = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';
const NAME_ROOT = 'projects/p/databases/(default)/documents';

function fakeFirestore(tree) {
  const commits = [];
  const authenticatedFetch = vi.fn(async (url, options = {}) => {
    if (url === `${URL_ROOT}:commit`) {
      commits.push(JSON.parse(options.body).writes.map((w) => w.delete));
      return { ok: true, data: {} };
    }
    const listMatch = url.match(/\/documents\/(.+):listCollectionIds$/);
    if (listMatch) {
      const node = tree[listMatch[1]] || {};
      return { ok: true, data: { collectionIds: Object.keys(node) } };
    }
    const collectionPath = url.replace(`${URL_ROOT}/`, '').split('?')[0];
    const segments = collectionPath.split('/');
    const docPath = segments.slice(0, -1).join('/');
    const collectionId = segments[segments.length - 1];
    const childIds = docPath ? (tree[docPath]?.[collectionId] ?? []) : (tree['']?.[collectionId] ?? []);
    return {
      ok: true,
      data: { documents: childIds.map((id) => ({ name: `${NAME_ROOT}/${collectionPath}/${id}` })) },
    };
  });
  return { authenticatedFetch, commits };
}

describe('deleteDocumentTree', () => {
  it('deletes descendants before the root document', async () => {
    const { authenticatedFetch, commits } = fakeFirestore({
      'col/doc1': { sub: ['child1', 'child2'] },
      'col/doc1/sub/child1': {},
      'col/doc1/sub/child2': {},
    });

    await deleteDocumentTree({ authenticatedFetch, urlRoot: URL_ROOT, nameRoot: NAME_ROOT, docPath: 'col/doc1' });

    expect(commits.flat()).toEqual([
      `${NAME_ROOT}/col/doc1/sub/child1`,
      `${NAME_ROOT}/col/doc1/sub/child2`,
      `${NAME_ROOT}/col/doc1`,
    ]);
  });

  it('deletes a leaf document without subcollections', async () => {
    const { authenticatedFetch, commits } = fakeFirestore({ 'col/doc1': {} });

    await deleteDocumentTree({ authenticatedFetch, urlRoot: URL_ROOT, nameRoot: NAME_ROOT, docPath: 'col/doc1' });

    expect(commits.flat()).toEqual([`${NAME_ROOT}/col/doc1`]);
  });

  it('surfaces API errors with reauth metadata', async () => {
    const authenticatedFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { error: { code: 401, message: 'Unauthenticated' } } });

    await expect(
      deleteDocumentTree({ authenticatedFetch, urlRoot: URL_ROOT, nameRoot: NAME_ROOT, docPath: 'col/doc1' }),
    ).rejects.toMatchObject({
      message: 'Unauthenticated',
      ipcResult: { success: false, error: 'Unauthenticated', requiresReauth: true },
    });
  });
});

describe('listCollectionIds', () => {
  it('fetches root collections across multiple pages with pagination tokens', async () => {
    const authenticatedFetch = vi.fn(async (url, options) => {
      expect(url).toBe(`${URL_ROOT}:listCollectionIds`);
      const body = JSON.parse(options.body);
      expect(body.pageSize).toBe(300);

      if (!body.pageToken) {
        return {
          ok: true,
          data: {
            collectionIds: ['users', 'products'],
            nextPageToken: 'page-2-token',
          },
        };
      }
      if (body.pageToken === 'page-2-token') {
        return {
          ok: true,
          data: {
            collectionIds: ['orders', 'settings'],
          },
        };
      }
      return { ok: true, data: { collectionIds: [] } };
    });

    const result = await listCollectionIds({ authenticatedFetch, urlRoot: URL_ROOT });
    expect(result).toEqual(['users', 'products', 'orders', 'settings']);
    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it('fetches subcollections for a specified document path', async () => {
    const authenticatedFetch = vi.fn(async (url, options) => {
      expect(url).toBe(`${URL_ROOT}/users/u1:listCollectionIds`);
      const body = JSON.parse(options.body);
      expect(body.pageSize).toBe(300);
      return {
        ok: true,
        data: {
          collectionIds: ['messages', 'notifications'],
        },
      };
    });

    const result = await listCollectionIds({ authenticatedFetch, urlRoot: URL_ROOT }, 'users/u1');
    expect(result).toEqual(['messages', 'notifications']);
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });
});
