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
    serializeForEdit
} from './firestoreUtils';

// Query parsing and building utilities
export {
    parseJsQueryString,
    buildStructuredQuery,
    getParsedStructuredQuery,
    generateDefaultJsQuery,
    parseQueryResponse
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
    createDefaultSortConfig
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
    truncateString
} from './commonUtils';

// Auto-completion utilities
export {
    firestoreCompletions,
    jsBoilerplateCompletions,
    consoleCompletions,
    jsEditorCompletions,
    findCompletion,
    getMatchingCompletions
} from './completions';
