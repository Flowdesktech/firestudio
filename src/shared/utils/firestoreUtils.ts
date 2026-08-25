/**
 * Firestore Data Type Utilities
 * Handles type detection, formatting, and value parsing for Firestore documents
 */
import {
  formatDateForDisplay,
  isDateTimeLocalString,
  isFirestoreTimestamp,
  isIsoDateString,
  isUnixTimestampMs,
} from './dateUtils';

// Firestore value types
export type FirestoreValue =
  | null
  | undefined
  | string
  | number
  | boolean
  | Date
  | FirestoreTimestamp
  | FirestoreGeoPoint
  | FirestoreValue[]
  | { [key: string]: FirestoreValue };

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds?: number;
}

export interface FirestoreGeoPoint {
  _latitude: number;
  _longitude: number;
}

// Firestore REST API value types
export interface FirestoreRestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  geoPointValue?: { latitude: number; longitude: number };
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
  referenceValue?: string;
}

/**
 * Firestore REST API operator mapping
 */
export const FIRESTORE_OPERATORS: Record<string, string> = {
  '==': 'EQUAL',
  '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  'array-contains': 'ARRAY_CONTAINS',
  'array-contains-any': 'ARRAY_CONTAINS_ANY',
  in: 'IN',
  'not-in': 'NOT_IN',
};

/**
 * Detects the Firestore data type of a value
 */
export const getValueType = (value: FirestoreValue): string => {
  if (value === null) return 'Null';
  if (value === undefined) return 'Undefined';
  if (value instanceof Date) return 'Timestamp';
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object' && '_seconds' in value) return 'Timestamp';
  if (typeof value === 'object' && '_latitude' in value) return 'GeoPoint';
  if (typeof value === 'object') return 'Map';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'number') return Number.isInteger(value) ? 'Integer' : 'Number';
  if (typeof value === 'boolean') return 'Boolean';
  return typeof value;
};

/**
 * Formats a Firestore value for display
 */
export const formatDisplayValue = (value: FirestoreValue, type: string): string => {
  if (type === 'Null' || type === 'Undefined') return '';
  if (type === 'Timestamp' && value instanceof Date) {
    return value.toISOString();
  }
  if (type === 'Timestamp' && value && typeof value === 'object' && '_seconds' in value) {
    return new Date((value as FirestoreTimestamp)._seconds * 1000).toISOString();
  }
  if (type === 'GeoPoint' && value && typeof value === 'object' && '_latitude' in value) {
    const gp = value as FirestoreGeoPoint;
    return `(${gp._latitude}, ${gp._longitude})`;
  }
  if (type === 'Array' || type === 'Map') return '';
  if (type === 'String') return value as string;
  return String(value);
};

/**
 * Returns the display color for a given type
 */
export const getTypeColor = (type: string, isDark: boolean): string => {
  const lightColors: Record<string, string> = {
    String: '#0d47a1',
    Integer: '#0d47a1',
    Number: '#0d47a1',
    Boolean: '#0d47a1',
    Null: '#666',
    Undefined: '#666',
    Array: '#666',
    Map: '#666',
    Timestamp: '#0d47a1',
    GeoPoint: '#0d47a1',
    Collection: '#1976d2',
    Document: '#ff9800',
  };

  const darkColors: Record<string, string> = {
    String: '#9cdcfe',
    Integer: '#b5cea8',
    Number: '#b5cea8',
    Boolean: '#569cd6',
    Null: '#888',
    Undefined: '#888',
    Array: '#888',
    Map: '#888',
    Timestamp: '#ce9178',
    GeoPoint: '#ce9178',
    Collection: '#1976d2',
    Document: '#ff9800',
  };

  const colors = isDark ? darkColors : lightColors;
  return colors[type] || (isDark ? '#ccc' : '#333');
};

/**
 * Converts a JS operator to Firestore REST API operator
 */
export const convertToFirestoreOperator = (operator: string): string => {
  return FIRESTORE_OPERATORS[operator] || 'EQUAL';
};

/**
 * Converts a JS value to Firestore REST API value format
 */
export const convertToFirestoreValue = (value: FirestoreValue): FirestoreRestValue => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(convertToFirestoreValue) } };
  }
  return { stringValue: String(value) };
};

/**
 * Parses Firestore REST API response fields to JS objects
 */
export const parseFirestoreFields = (
  fields: Record<string, FirestoreRestValue> | undefined | null,
): Record<string, FirestoreValue> => {
  if (!fields) return {};

  const result: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
};

/**
 * Parses a single Firestore REST API value to JS value
 */
export const parseFirestoreValue = (value: FirestoreRestValue | null | undefined): FirestoreValue => {
  if (!value) return value as null | undefined;

  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;

  if (value.timestampValue !== undefined) {
    const date = new Date(value.timestampValue);
    return { _seconds: Math.floor(date.getTime() / 1000), _nanoseconds: 0 };
  }

  if (value.geoPointValue !== undefined) {
    return {
      _latitude: value.geoPointValue.latitude,
      _longitude: value.geoPointValue.longitude,
    };
  }

  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }

  if (value.mapValue !== undefined) {
    return parseFirestoreFields(value.mapValue.fields || {});
  }

  if (value.referenceValue !== undefined) return value.referenceValue;

  return null;
};

/**
 * Parses an edit value string and returns the appropriate typed value
 */
export const parseEditValue = (editValue: string): FirestoreValue => {
  try {
    return JSON.parse(editValue) as FirestoreValue;
  } catch {
    if (editValue === 'null') return null;
    if (editValue === 'undefined' || editValue === '') return undefined;
    if (editValue === 'true') return true;
    if (editValue === 'false') return false;
    if (!isNaN(Number(editValue)) && editValue !== '') return Number(editValue);
    return editValue;
  }
};

/**
 * Serializes a value for editing (converts to string representation)
 */
export const serializeForEdit = (value: FirestoreValue, type: string): string => {
  if (type === 'Array' || type === 'Map') {
    return JSON.stringify(value, null, 2);
  }
  if (type === 'Timestamp') {
    return formatDateForDisplay(value, 'iso');
  }
  if (value === undefined) return '';
  if (value === null) return 'null';
  return String(value);
};

/**
 * Preserves the original field type when an edited ISO date string is saved.
 * Only applies when the edited value is a valid ISO date string and the
 * original value was a Firestore timestamp or a Unix timestamp in ms.
 */
export const normalizeEditedValue = (newValue: FirestoreValue, oldValue: FirestoreValue): FirestoreValue => {
  if (typeof newValue === 'string' && (isIsoDateString(newValue) || isDateTimeLocalString(newValue))) {
    if (isFirestoreTimestamp(oldValue)) {
      const date = new Date(newValue);
      return { _seconds: Math.floor(date.getTime() / 1000), _nanoseconds: 0 };
    }
    if (isUnixTimestampMs(oldValue)) {
      return new Date(newValue).getTime();
    }
  }
  return newValue;
};
