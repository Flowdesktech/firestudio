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

    const mockAdmin = {
      firestore: {
        FieldValue: { serverTimestamp: vi.fn() },
        Filter: { where: vi.fn() },
        Timestamp: { now: vi.fn() },
        GeoPoint: vi.fn(),
      },
    };

    setRefs(mockAdmin, mockDb);

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
});
