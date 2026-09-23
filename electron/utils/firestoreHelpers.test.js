// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const { toFirestoreAdminValue } = require_('./firestoreHelpers');

class FakeTimestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
}

class FakeGeoPoint {
  constructor(latitude, longitude) {
    this.latitude = latitude;
    this.longitude = longitude;
  }
}

class FakeFieldValue {}

const opts = () => ({ Timestamp: FakeTimestamp, GeoPoint: FakeGeoPoint, FieldValue: FakeFieldValue });

describe('toFirestoreAdminValue', () => {
  it('converts a Date into a Timestamp with second and nanosecond parts', () => {
    const result = toFirestoreAdminValue(new Date('2026-01-01T00:00:00.000Z'), opts());

    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result).toEqual({ seconds: 1767225600, nanoseconds: 0 });
  });

  it('preserves sub-second milliseconds as nanoseconds', () => {
    const result = toFirestoreAdminValue(new Date(1500), opts());

    expect(result).toEqual({ seconds: 1, nanoseconds: 500000000 });
  });

  it('converts the { _seconds, _nanoseconds } shape', () => {
    const result = toFirestoreAdminValue({ _seconds: 1767225600, _nanoseconds: 42 }, opts());

    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result).toEqual({ seconds: 1767225600, nanoseconds: 42 });
  });

  it('converts the { seconds, nanoseconds } shape', () => {
    const result = toFirestoreAdminValue({ seconds: 1767225600, nanoseconds: 7 }, opts());

    expect(result).toBeInstanceOf(FakeTimestamp);
    expect(result).toEqual({ seconds: 1767225600, nanoseconds: 7 });
  });

  it('defaults missing nanos to zero for the seconds shape', () => {
    const result = toFirestoreAdminValue({ seconds: 10, nanos: 3 }, opts());

    expect(result).toEqual({ seconds: 10, nanoseconds: 3 });
  });

  it('converts { _latitude, _longitude } geopoints', () => {
    const result = toFirestoreAdminValue({ _latitude: 1.5, _longitude: -2.5 }, opts());

    expect(result).toBeInstanceOf(FakeGeoPoint);
    expect(result).toEqual({ latitude: 1.5, longitude: -2.5 });
  });

  it('converts { latitude, longitude } geopoints', () => {
    const result = toFirestoreAdminValue({ latitude: 40.7, longitude: -74 }, opts());

    expect(result).toEqual({ latitude: 40.7, longitude: -74 });
  });

  it('converts values nested inside arrays and plain maps', () => {
    const input = {
      tags: [{ _seconds: 1, _nanoseconds: 0 }, 'plain', 5],
      meta: { place: { _latitude: 1, _longitude: 2 } },
    };

    const result = toFirestoreAdminValue(input, opts());

    expect(result.tags[0]).toBeInstanceOf(FakeTimestamp);
    expect(result).toEqual({
      tags: [{ seconds: 1, nanoseconds: 0 }, 'plain', 5],
      meta: { place: { latitude: 1, longitude: 2 } },
    });
  });

  it('passes primitives through unchanged', () => {
    expect(toFirestoreAdminValue(null, opts())).toBeNull();
    expect(toFirestoreAdminValue(undefined, opts())).toBeUndefined();
    expect(toFirestoreAdminValue('text', opts())).toBe('text');
    expect(toFirestoreAdminValue(3, opts())).toBe(3);
    expect(toFirestoreAdminValue(true, opts())).toBe(true);
  });

  it('returns FieldValue sentinels unchanged', () => {
    const sentinel = new FakeFieldValue();

    expect(toFirestoreAdminValue(sentinel, opts())).toBe(sentinel);
  });

  it('does not mutate the input object and rebuilds plain maps', () => {
    const input = { createdAt: { _seconds: 5, _nanoseconds: 0 }, nested: { a: 1 } };

    const result = toFirestoreAdminValue(input, opts());

    expect(result).not.toBe(input);
    expect(result.nested).not.toBe(input.nested);
    expect(input.createdAt).toEqual({ _seconds: 5, _nanoseconds: 0 });
    expect(input.nested).toEqual({ a: 1 });
  });
});
