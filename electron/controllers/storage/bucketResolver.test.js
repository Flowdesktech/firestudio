// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const fetchMock = vi.fn();

require_.cache[require_.resolve('node-fetch')] = {
  id: 'node-fetch',
  filename: require_.resolve('node-fetch'),
  loaded: true,
  exports: fetchMock,
};

const resolverPath = require_.resolve('./bucketResolver');
delete require_.cache[resolverPath];
const { resolveAdminBucket, resolveOauthBucket, resolveEmulatorBucket, clearBucketCache } = require_(resolverPath);

function adminRefWithBuckets(existingBuckets) {
  const existsMock = vi.fn();
  const bucketMock = vi.fn((name) => ({
    exists: () => {
      existsMock(name);
      return Promise.resolve([existingBuckets.includes(name)]);
    },
  }));
  return { adminRef: { storage: () => ({ bucket: bucketMock }) }, existsMock };
}

describe('bucketResolver', () => {
  beforeEach(() => {
    clearBucketCache();
    fetchMock.mockReset();
  });

  it('resolveAdminBucket prefers firebasestorage.app', async () => {
    const { adminRef } = adminRefWithBuckets(['p1.firebasestorage.app', 'p1.appspot.com']);

    expect(await resolveAdminBucket(adminRef, 'p1')).toBe('p1.firebasestorage.app');
  });

  it('resolveAdminBucket falls back to appspot.com for legacy projects', async () => {
    const { adminRef } = adminRefWithBuckets(['p1.appspot.com']);

    expect(await resolveAdminBucket(adminRef, 'p1')).toBe('p1.appspot.com');
  });

  it('resolveAdminBucket caches successful probes', async () => {
    const { adminRef, existsMock } = adminRefWithBuckets(['p1.firebasestorage.app']);

    await resolveAdminBucket(adminRef, 'p1');
    await resolveAdminBucket(adminRef, 'p1');

    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('resolveAdminBucket does not cache the fallback when no bucket exists', async () => {
    const { adminRef, existsMock } = adminRefWithBuckets([]);

    expect(await resolveAdminBucket(adminRef, 'p1')).toBe('p1.firebasestorage.app');
    await resolveAdminBucket(adminRef, 'p1');

    expect(existsMock).toHaveBeenCalledTimes(4);
  });

  it('resolveAdminBucket treats probe errors as missing buckets', async () => {
    const adminRef = {
      storage: () => ({
        bucket: () => ({ exists: () => Promise.reject(new Error('network')) }),
      }),
    };

    expect(await resolveAdminBucket(adminRef, 'p1')).toBe('p1.firebasestorage.app');
  });

  it('clearBucketCache forces a re-probe', async () => {
    const { adminRef, existsMock } = adminRefWithBuckets(['p1.firebasestorage.app']);

    await resolveAdminBucket(adminRef, 'p1');
    clearBucketCache('admin:');
    await resolveAdminBucket(adminRef, 'p1');

    expect(existsMock).toHaveBeenCalledTimes(2);
  });

  it('clearBucketCache with prefixes leaves other scopes cached', async () => {
    const { adminRef, existsMock } = adminRefWithBuckets(['p1.firebasestorage.app']);
    await resolveAdminBucket(adminRef, 'p1');

    clearBucketCache('oauth:', 'emulator:');
    await resolveAdminBucket(adminRef, 'p1');

    expect(existsMock).toHaveBeenCalledTimes(1);
  });

  it('resolveOauthBucket probes firebasestorage.app first', async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({}) });

    expect(await resolveOauthBucket('p1', 'token')).toBe('p1.firebasestorage.app');
    expect(fetchMock).toHaveBeenCalledWith('https://storage.googleapis.com/storage/v1/b/p1.firebasestorage.app', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('resolveOauthBucket falls through to appspot.com when first probe errors', async () => {
    fetchMock
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: { code: 404 } }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({}) });

    expect(await resolveOauthBucket('p1', 'token')).toBe('p1.appspot.com');
  });

  it('resolveEmulatorBucket resolves via response.ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });

    expect(await resolveEmulatorBucket('http://localhost:9199/v0', 'p1')).toBe('p1.appspot.com');
  });
});
