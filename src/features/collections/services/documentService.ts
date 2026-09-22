/**
 * Document Service
 * Business logic for document value transformation and type handling
 * Extracted from CollectionTab.jsx
 */

import {
  FirestoreValue,
  FirestoreTimestamp as SharedFirestoreTimestamp,
  getValueType,
} from '../../../shared/utils/firestoreUtils';

interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface DocumentData {
  id: string;
  data?: Record<string, FirestoreValue>;
}

export const documentService = {
  /**
   * Check if value is a Firestore timestamp object
   * @param value - Value to check
   * @returns {boolean}
   */
  isFirestoreTimestamp(value: unknown): value is FirestoreTimestamp {
    return (
      value !== null &&
      typeof value === 'object' &&
      ('_seconds' in value || 'seconds' in (value as Record<string, unknown>))
    );
  },

  /**
   * Check if value is a Unix timestamp in milliseconds
   * @param value - Value to check
   * @returns {boolean}
   */
  isUnixTimestampMs(value: unknown): value is number {
    // Range: 2000-01-01 to 2100-01-01
    return typeof value === 'number' && value > 946684800000 && value < 4102444800000;
  },

  /**
   * Check if value is an ISO date string
   * @param value - Value to check
   * @returns {boolean}
   */
  isIsoDateString(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  },

  /**
   * Convert a Date to Firestore timestamp format
   * @param date - Date object
   * @returns Firestore timestamp object
   */
  toFirestoreTimestamp(date: Date): FirestoreTimestamp {
    return {
      _seconds: Math.floor(date.getTime() / 1000),
      _nanoseconds: 0,
    };
  },

  /**
   * Convert a Date to Unix timestamp in milliseconds
   * @param date - Date object
   * @returns {number}
   */
  toUnixTimestampMs(date: Date): number {
    return date.getTime();
  },

  /**
   * Transform a value for saving, preserving original type when appropriate
   * @param oldValue - Original value (used to detect type)
   * @param newValue - New value to transform
   * @returns Transformed value
   */
  transformValueForSave(oldValue: FirestoreValue, newValue: FirestoreValue): FirestoreValue {
    // If old was Firestore timestamp and new is ISO string, convert to timestamp
    if (this.isFirestoreTimestamp(oldValue) && typeof newValue === 'string' && this.isIsoDateString(newValue)) {
      return this.toFirestoreTimestamp(new Date(newValue)) as unknown as SharedFirestoreTimestamp;
    }

    // If old was Unix ms and new is ISO string, convert to Unix ms
    if (this.isUnixTimestampMs(oldValue) && typeof newValue === 'string' && this.isIsoDateString(newValue)) {
      return this.toUnixTimestampMs(new Date(newValue));
    }

    return newValue;
  },

  /**
   * Check if two values are equal (deep comparison for objects)
   * @param a - First value
   * @param b - Second value
   * @returns {boolean}
   */
  valuesEqual(a: FirestoreValue, b: FirestoreValue): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  },

  /**
   * Prepare document data for update
   * @param doc - Original document
   * @param field - Field to update
   * @param newValue - New value
   * @returns Updated document data
   */
  prepareUpdateData(doc: DocumentData, field: string, newValue: FirestoreValue): Record<string, FirestoreValue> {
    const oldValue = doc.data?.[field];
    const transformedValue = this.transformValueForSave(oldValue as FirestoreValue, newValue);
    return { ...doc.data, [field]: transformedValue };
  },

  /**
   * Prepare document data after removing a field
   * @param doc - Original document
   * @param fieldPath - Dot notation path of the field to remove, relative to doc.data
   * @returns New document data with the field removed. A missing intermediate path,
   *          or a non-Map intermediate (array/primitive), is a no-op returning the
   *          data unchanged
   */
  prepareDeleteData(doc: DocumentData, fieldPath: string): Record<string, FirestoreValue> {
    const data: Record<string, FirestoreValue> = { ...doc.data };
    const segments = fieldPath.split('.');
    let target = data;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const child = target[segments[i]];
      if (getValueType(child) !== 'Map') {
        return data;
      }
      const childCopy = { ...(child as Record<string, FirestoreValue>) };
      target[segments[i]] = childCopy;
      target = childCopy;
    }
    delete target[segments[segments.length - 1]];
    return data;
  },
};

export default documentService;
