/**
 * Utility Modules Index
 * Central export point for all utility functions
 */

// Firestore data utilities
export {
  FIRESTORE_OPERATORS,
  getValueType,
  formatDisplayValue,
  getTypeColor,
  convertToFirestoreOperator,
  convertToFirestoreValue,
  parseFirestoreFields,
  parseFirestoreValue,
  parseEditValue,
  serializeForEdit,
  normalizeEditedValue,
} from './firestoreUtils';

// Query parsing and building utilities
export {
  parseJsQueryString,
  buildStructuredQuery,
  getParsedStructuredQuery,
  generateDefaultJsQuery,
  parseQueryResponse,
} from './queryUtils';

// Collection document utilities
export {
  extractAllFields,
  filterDocumentsByConditions,
  filterDocumentsByText,
  sortDocuments,
  processDocuments,
  getVisibleFields,
  documentsToJson,
  createEmptyFilter,
  createDefaultSortConfig,
} from './collectionUtils';

// Common utilities
export {
  copyToClipboard,
  formatDate,
  formatTimestamp,
  formatFileSize,
  validateJson,
  debounce,
  generateId,
  truncateString,
  getErrorMessage,
} from './commonUtils';

// Auto-completion utilities
export {
  firestoreCompletions,
  jsBoilerplateCompletions,
  consoleCompletions,
  jsEditorCompletions,
  findCompletion,
  getMatchingCompletions,
} from './completions';

// Date utilities
export { isIsoDateString, isUnixTimestampMs, isFirestoreTimestamp, toDate, formatDateForDisplay } from './dateUtils';

// Constants
export { MONOSPACE_FONT_FAMILY, EDITOR_FONT_FAMILY, DEFAULT_FONT_SIZE } from './constants';
