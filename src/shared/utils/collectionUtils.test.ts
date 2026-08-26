import { describe, expect, it } from 'vitest';
import { extractQueryableFields } from './collectionUtils';

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
