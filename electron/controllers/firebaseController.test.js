// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

// ─── Setup CJS mocks via require cache ───────────────────────────────────────
const require_ = createRequire(import.meta.url);
const readFileSyncMock = vi.fn();
const handleMock = vi.fn();
const mockAppDelete = vi.fn().mockResolvedValue(undefined);
const mockSettings = vi.fn();
/** Simulates firebase-admin apps after initializeApp (v14: getApps() returns an array) */
const mockAppsList = [];
const TEST_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nmock-private-key\n-----END PRIVATE KEY-----\n';
const createServiceAccount = (projectId) => ({
  project_id: projectId,
  client_email: 'firebase-adminsdk@test-project.iam.gserviceaccount.com',
  private_key: TEST_PRIVATE_KEY,
});

// Inject electron mock into require cache
require_.cache[require_.resolve('electron')] = {
  id: 'electron',
  filename: require_.resolve('electron'),
  loaded: true,
  exports: {
    ipcMain: { handle: handleMock },
    dialog: { showOpenDialog: vi.fn() },
  },
};

// Inject fs mock
require_.cache[require_.resolve('fs')] = {
  id: 'fs',
  filename: require_.resolve('fs'),
  loaded: true,
  exports: {
    readFileSync: readFileSyncMock,
  },
};

// Inject firebase-admin mock (v14 modular API)
const firebaseAdminPath = require_.resolve('firebase-admin');
require_.cache[firebaseAdminPath] = {
  id: 'firebase-admin',
  filename: firebaseAdminPath,
  loaded: true,
  exports: {
    initializeApp: vi.fn(() => {
      const app = { options: {}, delete: mockAppDelete };
      mockAppsList.push(app);
      return app;
    }),
    cert: vi.fn().mockReturnValue('mock-credential'),
    getApps: () => mockAppsList,
    deleteApp: mockAppDelete,
  },
};

// Inject firebase-admin/app mock because the compatibility facade imports the v14 modular API.
const firebaseAdminAppModulePath = require_.resolve('firebase-admin/app');
require_.cache[firebaseAdminAppModulePath] = {
  id: 'firebase-admin/app',
  filename: firebaseAdminAppModulePath,
  loaded: true,
  exports: {
    cert: vi.fn().mockReturnValue('mock-credential'),
    getApp: vi.fn(),
    getApps: () => mockAppsList,
  },
};

// Inject firebase-admin/firestore mock (v14 modular API)
const firestoreModulePath = require_.resolve('firebase-admin/firestore');
require_.cache[firestoreModulePath] = {
  id: 'firebase-admin/firestore',
  filename: firestoreModulePath,
  loaded: true,
  exports: {
    getFirestore: vi.fn().mockReturnValue({ settings: mockSettings }),
  },
};

// Now load the controller — it will pick up our cached mocks
// We must delete any cached version first
const controllerPath = require_.resolve('./firebaseController');
delete require_.cache[controllerPath];
const { registerHandlers } = require_(controllerPath);
registerHandlers();

// Capture the handler functions
const handlers = {};
for (const [channel, handler] of handleMock.mock.calls) {
  handlers[channel] = handler;
}

describe('firebaseController', () => {
  beforeEach(async () => {
    readFileSyncMock.mockReset();
    mockAppDelete.mockClear();
    mockAppsList.length = 0;
    if (handlers['firebase:disconnect']) {
      await handlers['firebase:disconnect']();
    }
  });

  it('connects with a valid service account path', async () => {
    const serviceAccount = createServiceAccount('test-project');
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    const result = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/path/to/sa.json',
    });

    expect(result).toEqual({ success: true, projectId: 'test-project', databaseId: undefined });
    expect(readFileSyncMock).toHaveBeenCalledWith('/path/to/sa.json', 'utf8');
  });

  it('connects with databaseId', async () => {
    const serviceAccount = createServiceAccount('test-project');
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    const result = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/path/to/sa.json',
      databaseId: 'my-database',
    });

    expect(result).toEqual({ success: true, projectId: 'test-project', databaseId: 'my-database' });
  });

  it('supports backward compat with string param', async () => {
    const serviceAccount = createServiceAccount('legacy-project');
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    const result = await handlers['firebase:connect'](null, '/legacy/path.json');

    expect(result.success).toBe(true);
    expect(result.projectId).toBe('legacy-project');
    expect(result.databaseId).toBeUndefined();
  });

  it('returns error for invalid file', async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    const result = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/bad/path.json',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });

  it('connect succeeds after a prior failed connect (no phantom app().delete)', async () => {
    readFileSyncMock.mockImplementationOnce(() => {
      throw new Error('ENOENT first');
    });
    const failResult = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/missing.json',
    });
    expect(failResult.success).toBe(false);

    const serviceAccount = createServiceAccount('recovery-project');
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));
    const okResult = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/path/to/sa.json',
    });
    expect(okResult).toEqual({ success: true, projectId: 'recovery-project', databaseId: undefined });
  });

  it('disconnects when connected', async () => {
    const serviceAccount = { project_id: 'test-project' };
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    await handlers['firebase:connect'](null, { serviceAccountPath: '/path/to/sa.json' });
    const result = await handlers['firebase:disconnect']();

    expect(result).toEqual({ success: true });
  });

  it('disconnects gracefully when not connected', async () => {
    const result = await handlers['firebase:disconnect']();

    expect(result).toEqual({ success: true });
  });
});
