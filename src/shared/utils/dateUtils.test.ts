import { describe, it, expect } from 'vitest';
import { isDateTimeLocalString, formatDateForDateTimeLocal } from './dateUtils';

const toLocalDateTimeString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

describe('isDateTimeLocalString', () => {
  it('accepts datetime-local strings with and without seconds', () => {
    expect(isDateTimeLocalString('2024-01-15T10:30')).toBe(true);
    expect(isDateTimeLocalString('2024-01-15T10:30:00')).toBe(true);
  });

  it('rejects ISO strings with timezone and non-dates', () => {
    expect(isDateTimeLocalString('2024-01-15T10:30:00.000Z')).toBe(false);
    expect(isDateTimeLocalString('2024-01-15')).toBe(false);
    expect(isDateTimeLocalString('not a date')).toBe(false);
    expect(isDateTimeLocalString(123)).toBe(false);
  });
});

describe('formatDateForDateTimeLocal', () => {
  it('formats a Firestore timestamp in local time', () => {
    const expected = toLocalDateTimeString(new Date(1767225600 * 1000));
    expect(formatDateForDateTimeLocal({ _seconds: 1767225600, _nanoseconds: 0 })).toBe(expected);
  });

  it('formats a Unix timestamp in ms and an ISO string', () => {
    expect(formatDateForDateTimeLocal(1767225600000)).toBe(toLocalDateTimeString(new Date(1767225600000)));
    expect(formatDateForDateTimeLocal('2024-01-15T10:30:00.000Z')).toBe(
      toLocalDateTimeString(new Date('2024-01-15T10:30:00.000Z')),
    );
  });

  it('round-trips through new Date without an offset shift', () => {
    const formatted = formatDateForDateTimeLocal({ _seconds: 1767225600, _nanoseconds: 0 });
    expect(new Date(formatted).getTime()).toBe(1767225600 * 1000);
  });

  it('returns an empty string for invalid values', () => {
    expect(formatDateForDateTimeLocal('garbage')).toBe('');
    expect(formatDateForDateTimeLocal(null)).toBe('');
  });
});
