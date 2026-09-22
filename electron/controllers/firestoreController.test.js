// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

// ─── Setup CJS mocks via require cache ───────────────────────────────────────
const require_ = createRequire(import.meta.url);
const handleMock = vi.fn();

// Inject electron mock
require_.cache[require_.resolve('electron')] = {
  id: 'electron',
  filename: require_.resolve('electron'),
  loaded: true,
  exports: {
    ipcMain: { handle: handleMock },
    dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  },
};

// Inject fs mock
require_.cache[require_.resolve('fs')] = {
  id: 'fs',
  filename: require_.resolve('fs'),
  loaded: true,
  exports: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
};

// firestoreController (v14) imports FieldValue/Filter/Timestamp/GeoPoint from firebase-admin/firestore
require_.cache[require_.resolve('firebase-admin/firestore')] = {
  id: 'firebase-admin/firestore',
  filename: require_.resolve('firebase-admin/firestore'),
  loaded: true,
  exports: {
    FieldValue: { serverTimestamp: vi.fn() },
    Filter: { where: vi.fn() },
    Timestamp: vi.fn(function (seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }),
    GeoPoint: vi.fn(function (latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }),
  },
};

const firestoreMock = require_('firebase-admin/firestore');
const electronMock = require_('electron');
const fsMock = require_('fs');

// Load controller with mocked deps
const controllerPath = require_.resolve('./firestoreController');
delete require_.cache[controllerPath];
const { registerHandlers, setRefs } = require_(controllerPath);
registerHandlers();

// Capture the handler functions
const handlers = {};
for (const [channel, handler] of handleMock.mock.calls) {
  handlers[channel] = handler;
}

describe('firestoreController', () => {
  beforeEach(() => {
    setRefs(null, null);
  });

  // ─── getCollections ──────────────────────────────────────────────────────

  it('getCollections returns error when not connected', async () => {
    const result = await handlers['firestore:getCollections']();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Not connected');
  });

  it('getCollections returns collection list when connected', async () => {
    const mockDb = {
      listCollections: vi.fn().mockResolvedValue([{ id: 'users' }, { id: 'orders' }]),
    };
    setRefs(null, mockDb);

    const result = await handlers['firestore:getCollections']();

    expect(result.success).toBe(true);
    expect(result.collections).toEqual(['users', 'orders']);
  });

  // ─── normalizeFirestoreError (tested via behavior) ───────────────────────

  it('normalizes NOT_FOUND error', async () => {
    const mockDb = {
      listCollections: vi.fn().mockRejectedValue(new Error('5 NOT_FOUND: database not found')),
    };
    setRefs(null, mockDb);

    const result = await handlers['firestore:getCollections']();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Firestore database not found');
  });

  it('normalizes PERMISSION_DENIED error', async () => {
    const mockDb = {
      listCollections: vi.fn().mockRejectedValue(new Error('PERMISSION_DENIED: insufficient permissions')),
    };
    setRefs(null, mockDb);

    const result = await handlers['firestore:getCollections']();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });

  // ─── getDocuments ────────────────────────────────────────────────────────

  it('getDocuments includes phantom documents alongside query results', async () => {
    const snapshot = {
      docs: [
        { id: 'a', data: () => ({ n: 1 }), ref: { path: 'col/a' } },
        { id: 'c', data: () => ({ n: 3 }), ref: { path: 'col/c' } },
      ],
      size: 2,
    };
    const mockCollection = {
      limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(snapshot) }),
      listDocuments: vi.fn().mockResolvedValue([
        { id: 'a', path: 'col/a' },
        { id: 'b', path: 'col/b' },
        { id: 'c', path: 'col/c' },
      ]),
    };
    setRefs(null, { collection: vi.fn().mockReturnValue(mockCollection) });

    const result = await handlers['firestore:getDocuments'](null, { collectionPath: 'col' });

    expect(result.success).toBe(true);
    expect(result.documents.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(result.documents[1]).toEqual({ id: 'b', data: {}, path: 'col/b', missing: true });
  });

  it('getDocuments falls back to query results when listDocuments fails', async () => {
    const snapshot = { docs: [{ id: 'a', data: () => ({}), ref: { path: 'col/a' } }], size: 1 };
    const mockCollection = {
      limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(snapshot) }),
      listDocuments: vi.fn().mockRejectedValue(new Error('unavailable')),
    };
    setRefs(null, { collection: vi.fn().mockReturnValue(mockCollection) });

    const result = await handlers['firestore:getDocuments'](null, { collectionPath: 'col' });

    expect(result.success).toBe(true);
    expect(result.documents.map((d) => d.id)).toEqual(['a']);
  });

  it('getDocuments decodes reference fields into plain strings (IPC-cloneable)', async () => {
    const snapshot = {
      docs: [
        {
          id: 'a',
          ref: { path: 'col/a' },
          _fieldsProto: {
            name: { stringValue: 'test', valueType: 'stringValue' },
            owner: {
              referenceValue: 'projects/p/databases/(default)/documents/users/1',
              valueType: 'referenceValue',
            },
            ts: {
              timestampValue: { seconds: 1767225600, nanos: 0 },
              valueType: 'timestampValue',
            },
          },
        },
      ],
      size: 1,
    };
    const mockCollection = {
      limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(snapshot) }),
      listDocuments: vi.fn().mockResolvedValue([]),
    };
    setRefs(null, { collection: vi.fn().mockReturnValue(mockCollection) });

    const result = await handlers['firestore:getDocuments'](null, { collectionPath: 'col' });

    expect(result.success).toBe(true);
    expect(result.documents[0].data.owner).toBe('projects/p/databases/(default)/documents/users/1');
    expect(result.documents[0].data.ts).toEqual({ _seconds: 1767225600, _nanoseconds: 0 });
  });

  it('getDocuments decodes RFC3339 string timestamps as the REST path does', async () => {
    const snapshot = {
      docs: [
        {
          id: 'a',
          ref: { path: 'col/a' },
          _fieldsProto: {
            ts: { timestampValue: '2026-01-01T00:00:00.000Z', valueType: 'timestampValue' },
          },
        },
      ],
      size: 1,
    };
    const mockCollection = {
      limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(snapshot) }),
      listDocuments: vi.fn().mockResolvedValue([]),
    };
    setRefs(null, { collection: vi.fn().mockReturnValue(mockCollection) });

    const result = await handlers['firestore:getDocuments'](null, { collectionPath: 'col' });

    expect(result.success).toBe(true);
    expect(result.documents[0].data.ts).toEqual({ _seconds: 1767225600, _nanoseconds: 0 });
  });

  // ─── listSubcollections ──────────────────────────────────────────────────

  it('listSubcollections returns subcollection ids for a document path', async () => {
    const listCollections = vi.fn().mockResolvedValue([{ id: 'sub1' }, { id: 'sub2' }]);
    setRefs(null, { doc: vi.fn().mockReturnValue({ listCollections }) });

    const result = await handlers['firestore:listSubcollections'](null, 'col/doc1');

    expect(result.success).toBe(true);
    expect(result.collections).toEqual(['sub1', 'sub2']);
  });

  // ─── recursive deletes ───────────────────────────────────────────────────

  it('deleteDocument deletes the document tree recursively', async () => {
    const docRef = { path: 'col/doc1' };
    const recursiveDelete = vi.fn().mockResolvedValue(undefined);
    setRefs(null, { doc: vi.fn().mockReturnValue(docRef), recursiveDelete });

    const result = await handlers['firestore:deleteDocument'](null, 'col/doc1');

    expect(result.success).toBe(true);
    expect(recursiveDelete).toHaveBeenCalledWith(docRef);
  });

  it('deleteDocument performs a shallow delete when recursive is false', async () => {
    const shallowDelete = vi.fn().mockResolvedValue(undefined);
    const recursiveDelete = vi.fn();
    setRefs(null, { doc: vi.fn().mockReturnValue({ delete: shallowDelete }), recursiveDelete });

    const result = await handlers['firestore:deleteDocument'](null, { documentPath: 'col/doc1', recursive: false });

    expect(result.success).toBe(true);
    expect(shallowDelete).toHaveBeenCalled();
    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it('deleteCollection deletes the collection tree recursively', async () => {
    const collectionRef = { path: 'col' };
    const recursiveDelete = vi.fn().mockResolvedValue(undefined);
    setRefs(null, { collection: vi.fn().mockReturnValue(collectionRef), recursiveDelete });

    const result = await handlers['firestore:deleteCollection'](null, 'col');

    expect(result.success).toBe(true);
    expect(recursiveDelete).toHaveBeenCalledWith(collectionRef);
  });

  // ─── executeJsQuery ──────────────────────────────────────────────────────

  it('executeJsQuery has Firestore types in sandbox', async () => {
    const mockSnapshot = {
      forEach: vi.fn((cb) => {
        cb({ id: 'doc1', data: () => ({ name: 'test' }), ref: { path: 'col/doc1' } });
      }),
    };
    const mockCollection = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(mockSnapshot),
    });
    const mockDb = { collection: mockCollection };

    // v14: FieldValue/Filter/Timestamp/GeoPoint come from firebase-admin/firestore (mocked above),
    // not from adminRef — so adminRef is no longer needed here.
    setRefs(null, mockDb);

    const jsQuery = `
      function run() {
        return db.collection('users').get();
      }
    `;

    const result = await handlers['firestore:executeJsQuery'](null, {
      collectionPath: 'users',
      jsQuery,
    });

    expect(result.success).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe('doc1');
  });

  it('executeJsQuery returns error when not connected', async () => {
    const result = await handlers['firestore:executeJsQuery'](null, {
      collectionPath: 'users',
      jsQuery: 'function run() { return db.collection("users").get(); }',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Not connected');
  });

  // ─── admin write paths convert app-shaped values ─────────────────────────

  const appShapedData = () => ({
    name: 'test',
    count: 3,
    active: true,
    createdAt: { _seconds: 1767225600, _nanoseconds: 500 },
    location: { _latitude: 1.5, _longitude: -2.5 },
    tags: [{ _seconds: 10, _nanoseconds: 0 }, 'plain'],
    meta: { nested: { _seconds: 20, _nanoseconds: 1 } },
  });

  const convertedData = () => ({
    name: 'test',
    count: 3,
    active: true,
    createdAt: { seconds: 1767225600, nanoseconds: 500 },
    location: { latitude: 1.5, longitude: -2.5 },
    tags: [{ seconds: 10, nanoseconds: 0 }, 'plain'],
    meta: { nested: { seconds: 20, nanoseconds: 1 } },
  });

  it('setDocument converts timestamps and geopoints before writing', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    setRefs(null, { doc: vi.fn().mockReturnValue({ set }) });
    const data = appShapedData();

    const result = await handlers['firestore:setDocument'](null, { documentPath: 'col/doc', data });

    expect(result.success).toBe(true);
    expect(firestoreMock.Timestamp).toHaveBeenCalled();
    expect(firestoreMock.GeoPoint).toHaveBeenCalled();
    expect(set.mock.calls[0][0]).toEqual(convertedData());
    // The incoming payload must not be mutated.
    expect(data.createdAt).toEqual({ _seconds: 1767225600, _nanoseconds: 500 });
    expect(data.location).toEqual({ _latitude: 1.5, _longitude: -2.5 });
  });

  it('updateDocument converts timestamps and geopoints before writing', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    setRefs(null, { doc: vi.fn().mockReturnValue({ update }) });
    const data = appShapedData();

    const result = await handlers['firestore:updateDocument'](null, { documentPath: 'col/doc', data });

    expect(result.success).toBe(true);
    expect(update.mock.calls[0][0]).toEqual(convertedData());
    expect(data.createdAt).toEqual({ _seconds: 1767225600, _nanoseconds: 500 });
  });

  it('createDocument converts timestamps and geopoints before writing', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const docRef = { id: 'new-id', set };
    const mockCollection = { doc: vi.fn().mockReturnValue(docRef) };
    setRefs(null, { collection: vi.fn().mockReturnValue(mockCollection) });
    const data = appShapedData();

    const result = await handlers['firestore:createDocument'](null, {
      collectionPath: 'col',
      documentId: 'new-id',
      data,
    });

    expect(result.success).toBe(true);
    expect(result.documentId).toBe('new-id');
    expect(set.mock.calls[0][0]).toEqual(convertedData());
  });

  it('importDocuments converts timestamps and geopoints for each batch set', async () => {
    const batchSet = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn().mockReturnValue({});
    setRefs(null, {
      collection: vi.fn().mockReturnValue({ doc }),
      batch: vi.fn().mockReturnValue({ set: batchSet, commit }),
    });
    electronMock.dialog.showOpenDialog.mockResolvedValue({ filePaths: ['/tmp/import.json'] });
    fsMock.readFileSync.mockReturnValue(JSON.stringify({ doc1: appShapedData(), doc2: { plain: 'value' } }));

    const result = await handlers['firestore:importDocuments'](null, 'col');

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(batchSet.mock.calls[0][1]).toEqual(convertedData());
    expect(batchSet.mock.calls[1][1]).toEqual({ plain: 'value' });
    expect(commit).toHaveBeenCalled();
  });
});
