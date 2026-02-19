// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

// ─── Setup CJS mocks via require cache ───────────────────────────────────────
const require_ = createRequire(import.meta.url);
const readFileSyncMock = vi.fn();
const handleMock = vi.fn();
const mockAppDelete = vi.fn().mockResolvedValue(undefined);
const mockSettings = vi.fn();

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

// Inject firebase-admin mock
const firebaseAdminPath = require_.resolve('firebase-admin');
require_.cache[firebaseAdminPath] = {
  id: 'firebase-admin',
  filename: firebaseAdminPath,
  loaded: true,
  exports: {
    initializeApp: vi.fn(),
    credential: { cert: vi.fn().mockReturnValue('mock-credential') },
    firestore: vi.fn().mockReturnValue({ settings: mockSettings }),
    app: vi.fn().mockReturnValue({ delete: mockAppDelete }),
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
  beforeEach(() => {
    readFileSyncMock.mockReset();
    mockAppDelete.mockClear();
  });

  it('connects with a valid service account path', async () => {
    const serviceAccount = { project_id: 'test-project' };
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    const result = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/path/to/sa.json',
    });

    expect(result).toEqual({ success: true, projectId: 'test-project', databaseId: undefined });
    expect(readFileSyncMock).toHaveBeenCalledWith('/path/to/sa.json', 'utf8');
  });

  it('connects with databaseId', async () => {
    const serviceAccount = { project_id: 'test-project' };
    readFileSyncMock.mockReturnValue(JSON.stringify(serviceAccount));

    const result = await handlers['firebase:connect'](null, {
      serviceAccountPath: '/path/to/sa.json',
      databaseId: 'my-database',
    });

    expect(result).toEqual({ success: true, projectId: 'test-project', databaseId: 'my-database' });
  });

  it('supports backward compat with string param', async () => {
    const serviceAccount = { project_id: 'legacy-project' };
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
