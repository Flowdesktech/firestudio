/**
 * Document Service
 * Business logic for document value transformation and type handling
 * Extracted from CollectionTab.jsx
 */

import { FirestoreValue, FirestoreTimestamp as SharedFirestoreTimestamp } from '../../../shared/utils/firestoreUtils';

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
   * Prepare document data with a new field added at a nested dot-path.
   * @param docData - Current document fields
   * @param parentPath - Dot-path of the parent object relative to the doc ("" for doc root)
   * @param fieldName - New field name (single segment, no dots)
   * @param value - Value for the new field
   * @returns { data } on success or { error } describing why the add was rejected
   */
  prepareAddData(
    docData: Record<string, FirestoreValue>,
    parentPath: string,
    fieldName: string,
    value: FirestoreValue,
  ): { data: Record<string, FirestoreValue> } | { error: string } {
    const name = fieldName.trim();
    if (!name) return { error: 'Field name is required' };
    if (name.includes('.')) return { error: 'Field name cannot contain dots' };

    let cloned: Record<string, FirestoreValue>;
    try {
      cloned =
        typeof structuredClone === 'function'
          ? (structuredClone(docData ?? {}) as Record<string, FirestoreValue>)
          : (JSON.parse(JSON.stringify(docData ?? {})) as Record<string, FirestoreValue>);
    } catch {
      try {
        cloned = JSON.parse(JSON.stringify(docData ?? {})) as Record<string, FirestoreValue>;
      } catch {
        return { error: 'Document data is not plain serializable data' };
      }
    }

    let parent: unknown = cloned;
    if (parentPath) {
      for (const segment of parentPath.split('.')) {
        if (Array.isArray(parent)) return { error: 'Cannot add fields inside an Array' };
        if (parent === null || typeof parent !== 'object') return { error: 'Parent path does not exist' };
        parent = (parent as Record<string, FirestoreValue>)[segment];
      }
    }
    if (Array.isArray(parent)) return { error: 'Cannot add fields inside an Array' };
    if (parent === null || typeof parent !== 'object') return { error: 'Parent path does not exist' };
    const parentObj = parent as Record<string, FirestoreValue>;
    if (Object.prototype.hasOwnProperty.call(parentObj, name)) return { error: 'Field already exists' };
    parentObj[name] = value;
    return { data: cloned };
  },
};

export default documentService;
