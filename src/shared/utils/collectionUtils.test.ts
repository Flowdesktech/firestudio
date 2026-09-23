import { describe, expect, it } from 'vitest';
import { extractQueryableFields, normalizeFirestorePath, resolveSimpleQueryPath } from './collectionUtils';

describe('extractQueryableFields', () => {
  it('includes top-level and nested map field paths', () => {
    expect(
      extractQueryableFields([
        {
          id: 'one',
          data: {
            active: true,
            profile: {
              displayName: 'Ada',
              address: { city: 'London' },
            },
          },
        },
      ]),
    ).toEqual(['active', 'profile', 'profile.address', 'profile.address.city', 'profile.displayName']);
  });

  it('does not expand arrays or special Firestore values', () => {
    expect(
      extractQueryableFields([
        {
          id: 'one',
          data: {
            tags: ['one', 'two'],
            createdAt: { _seconds: 123, _nanoseconds: 0 },
            location: { _latitude: 10, _longitude: 20 },
          },
        },
      ]),
    ).toEqual(['createdAt', 'location', 'tags']);
  });
});

describe('normalizeFirestorePath', () => {
  it('preserves a nested document path entered in Simple Query', () => {
    expect(normalizeFirestorePath(' /content-plans/plan-id/ads/ad-id/ ')).toBe('content-plans/plan-id/ads/ad-id');
  });

  it('rejects empty Firestore path segments', () => {
    expect(normalizeFirestorePath('content-plans//ads')).toBeNull();
  });

  it('opens the path currently entered in Simple Query instead of the tab collection', () => {
    expect(resolveSimpleQueryPath('content-plans/plan-id/ads/ad-id', 'content-plans')).toEqual({
      path: 'content-plans/plan-id/ads/ad-id',
      shouldOpenPath: true,
    });
  });

  it('refreshes the current tab when the entered path has not changed', () => {
    expect(resolveSimpleQueryPath(' content-plans ', 'content-plans')).toEqual({
      path: 'content-plans',
      shouldOpenPath: false,
    });
  });
});
