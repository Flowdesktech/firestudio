// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const handleMock = vi.fn();
const resolveAdminBucketMock = vi.fn();
const clearBucketCacheMock = vi.fn();

require_.cache[require_.resolve('electron')] = {
  id: 'electron',
  filename: require_.resolve('electron'),
  loaded: true,
  exports: {
    ipcMain: { handle: handleMock },
    dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  },
};

require_.cache[require_.resolve('node-fetch')] = {
  id: 'node-fetch',
  filename: require_.resolve('node-fetch'),
  loaded: true,
  exports: vi.fn(),
};

require_.cache[require_.resolve('./googleController')] = {
  id: 'googleController',
  filename: require_.resolve('./googleController'),
  loaded: true,
  exports: { getAccessToken: vi.fn() },
};

require_.cache[require_.resolve('./storage/bucketResolver')] = {
  id: 'bucketResolver',
  filename: require_.resolve('./storage/bucketResolver'),
  loaded: true,
  exports: {
    resolveAdminBucket: resolveAdminBucketMock,
    resolveOauthBucket: vi.fn(),
    resolveEmulatorBucket: vi.fn(),
    clearBucketCache: clearBucketCacheMock,
  },
};

const controllerPath = require_.resolve('./storageController');
delete require_.cache[controllerPath];
const { registerHandlers, setAdminRef, setStorageEmulatorHost } = require_(controllerPath);
registerHandlers();

const handlers = {};
for (const [channel, handler] of handleMock.mock.calls) {
  handlers[channel] = handler;
}

function adminRefForProject(projectId, bucketImpl) {
  return {
    apps: [{}],
    app: () => ({ options: { projectId } }),
    storage: () => ({ bucket: bucketImpl }),
  };
}

describe('storageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStorageEmulatorHost(null);
    setAdminRef(null);
  });

  it('listFiles returns error when not connected', async () => {
    const result = await handlers['storage:listFiles'](null, { path: '' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Not connected');
  });

  it('listFiles targets the resolved bucket instead of a hardcoded one', async () => {
    resolveAdminBucketMock.mockResolvedValue('p1.firebasestorage.app');
    const getFilesMock = vi.fn().mockResolvedValue([[], null, { prefixes: [] }]);
    const bucketMock = vi.fn(() => ({ getFiles: getFilesMock }));
    setAdminRef(adminRefForProject('p1', bucketMock));

    const result = await handlers['storage:listFiles'](null, { path: '' });

    expect(result.success).toBe(true);
    expect(resolveAdminBucketMock).toHaveBeenCalledWith(expect.anything(), 'p1');
    expect(bucketMock).toHaveBeenCalledWith('p1.firebasestorage.app');
  });

  it('listFiles surfaces bucket-not-found errors', async () => {
    resolveAdminBucketMock.mockResolvedValue('p1.firebasestorage.app');
    const bucketMock = vi.fn(() => ({
      getFiles: vi.fn().mockRejectedValue(new Error('The specified bucket does not exist')),
    }));
    setAdminRef(adminRefForProject('p1', bucketMock));

    const result = await handlers['storage:listFiles'](null, { path: '' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('disconnect clears admin and emulator bucket caches', () => {
    setAdminRef(null);

    expect(clearBucketCacheMock).toHaveBeenCalledWith('admin:', 'emulator:');
  });
});
