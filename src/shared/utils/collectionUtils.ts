/**
 * Collection Utilities
 * Handles document filtering, sorting, and field extraction
 */

import { FirestoreValue } from './firestoreUtils';

/**
 * Filter operators and their comparison functions
 */
const FILTER_COMPARATORS: Record<string, (a: FirestoreValue, b: FirestoreValue) => boolean> = {
  '==': (a, b) => String(a) === String(b),
  '!=': (a, b) => String(a) !== String(b),
  '<': (a, b) => (a as number) < (b as number),
  '>': (a, b) => (a as number) > (b as number),
  '<=': (a, b) => (a as number) <= (b as number),
  '>=': (a, b) => (a as number) >= (b as number),
};

export interface Document {
  id: string;
  data: Record<string, FirestoreValue>;
}

export interface Filter {
  field: string;
  operator: string;
  value: FirestoreValue;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ProcessOptions {
  filters?: Filter[];
  searchText?: string;
  sortConfig?: SortConfig | null;
}

/**
 * Extracts all unique field names from a list of documents
 */
export const extractAllFields = (documents: Document[]): string[] => {
  const fields = new Set<string>();

  documents.forEach((doc) => {
    if (doc.data) {
      Object.keys(doc.data).forEach((key) => fields.add(key));
    }
  });

  return Array.from(fields).sort();
};

/**
 * Extracts Firestore field paths for query autocomplete, including nested map
 * fields in dot notation (for example, "profile.displayName").
 */
export const extractQueryableFields = (documents: Document[]): string[] => {
  const fields = new Set<string>();

  const visitMap = (value: Record<string, FirestoreValue>, prefix = '', depth = 0) => {
    if (depth > 10) return;

    Object.entries(value).forEach(([key, childValue]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      fields.add(fieldPath);

      const isSpecialFirestoreValue =
        childValue instanceof Date ||
        (typeof childValue === 'object' &&
          childValue !== null &&
          ('_seconds' in childValue || '_latitude' in childValue));

      if (childValue && typeof childValue === 'object' && !Array.isArray(childValue) && !isSpecialFirestoreValue) {
        visitMap(childValue as Record<string, FirestoreValue>, fieldPath, depth + 1);
      }
    });
  };

  documents.forEach((doc) => {
    if (doc.data) visitMap(doc.data);
  });

  return Array.from(fields).sort();
};

/**
 * Filters documents based on an array of filter conditions
 */
export const filterDocumentsByConditions = (documents: Document[], filters: Filter[]): Document[] => {
  if (!filters || filters.length === 0) return documents;

  return documents.filter((doc) => {
    return filters.every((filter) => {
      // Skip incomplete filters
      if (!filter.field || filter.value === undefined || filter.value === '') {
        return true;
      }

      const docValue = doc.data?.[filter.field];
      let compareValue: FirestoreValue = filter.value;

      // Auto-convert filter value to number if document value is numeric
      if (typeof docValue === 'number' && typeof filter.value === 'string') {
        const parsed = parseFloat(filter.value);
        if (!isNaN(parsed)) {
          compareValue = parsed;
        }
      }

      const comparator = FILTER_COMPARATORS[filter.operator];
      return comparator ? comparator(docValue, compareValue) : true;
    });
  });
};

/**
 * Filters documents by text search across all fields
 */
export const filterDocumentsByText = (documents: Document[], searchText: string): Document[] => {
  if (!searchText || !searchText.trim()) return documents;

  const search = searchText.toLowerCase().trim();

  return documents.filter((doc) => {
    // Check document ID
    if (doc.id.toLowerCase().includes(search)) return true;

    // Check all field values
    if (doc.data) {
      for (const [key, value] of Object.entries(doc.data)) {
        const keyLower = key.toLowerCase();
        const valueLower = String(value).toLowerCase();

        if (keyLower.includes(search) || valueLower.includes(search)) {
          return true;
        }
      }
    }

    return false;
  });
};

/**
 * Sorts documents by a specified field
 */
export const sortDocuments = (documents: Document[], sortConfig: SortConfig | null): Document[] => {
  if (!sortConfig?.field) return documents;

  const { field, direction } = sortConfig;
  const isDescending = direction === 'desc';

  return [...documents].sort((a, b) => {
    const aVal = a.data?.[field];
    const bVal = b.data?.[field];

    // Handle null/undefined values (push to end)
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison =
      typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));

    return isDescending ? -comparison : comparison;
  });
};

/**
 * Applies all filtering and sorting to documents
 */
export const processDocuments = (documents: Document[], options: ProcessOptions = {}): Document[] => {
  const { filters = [], searchText = '', sortConfig = null } = options;

  let result = documents;

  // Apply field filters
  result = filterDocumentsByConditions(result, filters);

  // Apply text search
  result = filterDocumentsByText(result, searchText);

  // Apply sorting
  result = sortDocuments(result, sortConfig);

  return result;
};

/**
 * Filters visible fields based on hidden columns configuration
 */
export const getVisibleFields = (allFields: string[], hiddenColumns: Record<string, boolean>): string[] => {
  return allFields.filter((field) => !hiddenColumns[field]);
};

/**
 * Converts documents to a JSON object keyed by document ID
 */
export const documentsToJson = (documents: Document[]): Record<string, Record<string, FirestoreValue>> => {
  const result: Record<string, Record<string, FirestoreValue>> = {};
  documents.forEach((doc) => {
    result[doc.id] = doc.data;
  });
  return result;
};

/**
 * Creates a new filter object with default values
 */
export const createEmptyFilter = (): Filter => ({
  field: '',
  operator: '==',
  value: '',
});

/**
 * Creates default sort configuration
 */
export const createDefaultSortConfig = (): SortConfig => ({
  field: '',
  direction: 'asc',
});
