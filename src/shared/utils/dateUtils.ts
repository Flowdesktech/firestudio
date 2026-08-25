/**
 * Date and Time Utilities
 * Shared logic for parsing, formatting, and handling dates across the application
 */

/**
 * Checks if a value is an ISO 8601 date string
 * Example: 2024-01-15T10:30:00.000Z
 */
export const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value);
};

/**
 * Checks if a value is a valid Unix timestamp in milliseconds
 * Rough range check: Year 2000 to 2100
 */
export const isUnixTimestampMs = (value: unknown): value is number => {
  if (typeof value !== 'number') return false;
  return value > 946684800000 && value < 4102444800000;
};

/**
 * Checks if a value is a datetime-local string (no timezone, as emitted by
 * <input type="datetime-local">). Example: 2024-01-15T10:30 or 2024-01-15T10:30:00
 */
export const isDateTimeLocalString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
};

interface FirestoreTimestamp {
  _seconds?: number;
  seconds?: number;
  nanoseconds?: number;
}

/**
 * Checks if a value is a Firestore Timestamp object
 */
export const isFirestoreTimestamp = (value: unknown): value is FirestoreTimestamp => {
  return (
    !!value &&
    typeof value === 'object' &&
    ((value as FirestoreTimestamp)._seconds !== undefined || (value as FirestoreTimestamp).seconds !== undefined)
  );
};

/**
 * Converts various date formats to a native Date object
 */
export const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (isFirestoreTimestamp(value)) {
    const seconds = value._seconds ?? value.seconds ?? 0;
    return new Date(seconds * 1000);
  }

  if (typeof value === 'number' && isUnixTimestampMs(value)) {
    return new Date(value);
  }

  if (typeof value === 'string' && isIsoDateString(value)) {
    return new Date(value);
  }

  // Try parsing as generic string if it looks like a date
  if (typeof value === 'string' && !isNaN(Date.parse(value))) {
    return new Date(value);
  }

  return null;
};

/**
 * Formats a date value for display in the table/UI
 */
export const formatDateForDisplay = (value: unknown, format: 'locale' | 'iso' | 'time' = 'locale'): string => {
  const date = toDate(value);
  if (!date || isNaN(date.getTime())) return '';

  if (format === 'iso') return date.toISOString();
  if (format === 'time') return date.toLocaleTimeString();

  return date.toLocaleString();
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a date value for a <input type="datetime-local"> field.
 * Uses LOCAL time: datetime-local strings are parsed back as local time,
 * so this round-trips without a timezone offset shift.
 */
export const formatDateForDateTimeLocal = (value: unknown): string => {
  const date = toDate(value);
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};
