import { describe, it, expect } from 'vitest';
import { serializeForEdit, normalizeEditedValue } from './firestoreUtils';

describe('serializeForEdit', () => {
  it('serializes a Firestore timestamp to an ISO date string', () => {
    expect(serializeForEdit({ _seconds: 1767225600, _nanoseconds: 0 }, 'Timestamp')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('serializes a Date instance to an ISO date string', () => {
    expect(serializeForEdit(new Date('2026-01-01T00:00:00.000Z'), 'Timestamp')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not stringify objects to [object Object]', () => {
    expect(serializeForEdit({ _seconds: 1767225600 }, 'Timestamp')).not.toContain('[object Object]');
  });

  it('keeps arrays and maps as JSON', () => {
    expect(serializeForEdit({ a: 1 }, 'Map')).toBe('{\n  "a": 1\n}');
    expect(serializeForEdit([1, 2], 'Array')).toBe('[\n  1,\n  2\n]');
  });

  it('keeps null and undefined', () => {
    expect(serializeForEdit(null, 'Null')).toBe('null');
    expect(serializeForEdit(undefined, 'Undefined')).toBe('');
  });
});

describe('normalizeEditedValue', () => {
  it('converts an ISO string back to a timestamp when the original was a Firestore timestamp', () => {
    const result = normalizeEditedValue('2026-01-01T00:00:00.000Z', { _seconds: 1767225600, _nanoseconds: 0 });
    expect(result).toEqual({ _seconds: 1767225600, _nanoseconds: 0 });
  });

  it('converts an ISO string back to a Unix timestamp in ms when the original was one', () => {
    expect(normalizeEditedValue('2026-01-01T00:00:00.000Z', 1767225600000)).toBe(1767225600000);
  });

  it('leaves an ISO string unchanged when the original was a string', () => {
    expect(normalizeEditedValue('2026-01-01T00:00:00.000Z', 'hello')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('leaves a non-ISO string unchanged when the original was a timestamp', () => {
    expect(normalizeEditedValue('hello', { _seconds: 1767225600, _nanoseconds: 0 })).toBe('hello');
  });

  it('converts a datetime-local string back to a timestamp when the original was a Firestore timestamp', () => {
    const date = new Date('2024-01-15T10:30');
    expect(normalizeEditedValue('2024-01-15T10:30', { _seconds: 1767225600, _nanoseconds: 0 })).toEqual({
      _seconds: Math.floor(date.getTime() / 1000),
      _nanoseconds: 0,
    });
  });

  it('converts a datetime-local string back to Unix ms when the original was one', () => {
    expect(normalizeEditedValue('2024-01-15T10:30:00', 1767225600000)).toBe(new Date('2024-01-15T10:30:00').getTime());
  });

  it('leaves a datetime-local string unchanged when the original was a string', () => {
    expect(normalizeEditedValue('2024-01-15T10:30', 'hello')).toBe('2024-01-15T10:30');
  });

  it('passes explicit timestamp objects through unchanged', () => {
    const value = { _seconds: 1767225600, _nanoseconds: 0 };
    expect(normalizeEditedValue(value, value)).toBe(value);
  });
});
