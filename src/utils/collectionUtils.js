/**
 * Collection Utilities
 * Handles document filtering, sorting, and field extraction
 */

/**
 * Filter operators and their comparison functions
 */
const FILTER_COMPARATORS = {
    '==': (a, b) => String(a) === String(b),
    '!=': (a, b) => String(a) !== String(b),
    '<': (a, b) => a < b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b
};

/**
 * Extracts all unique field names from a list of documents
 * @param {Array} documents - Array of document objects
 * @returns {Array} - Sorted array of unique field names
 */
export const extractAllFields = (documents) => {
    const fields = new Set();

    documents.forEach(doc => {
        if (doc.data) {
            Object.keys(doc.data).forEach(key => fields.add(key));
        }
    });

    return Array.from(fields).sort();
};

/**
 * Filters documents based on an array of filter conditions
 * @param {Array} documents - Array of document objects
 * @param {Array} filters - Array of filter objects { field, operator, value }
 * @returns {Array} - Filtered documents
 */
export const filterDocumentsByConditions = (documents, filters) => {
    if (!filters || filters.length === 0) return documents;

    return documents.filter(doc => {
        return filters.every(filter => {
            // Skip incomplete filters
            if (!filter.field || filter.value === undefined || filter.value === '') {
                return true;
            }

            const docValue = doc.data?.[filter.field];
            let compareValue = filter.value;

            // Auto-convert filter value to number if document value is numeric
            if (typeof docValue === 'number') {
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
 * @param {Array} documents - Array of document objects
 * @param {string} searchText - Text to search for
 * @returns {Array} - Filtered documents
 */
export const filterDocumentsByText = (documents, searchText) => {
    if (!searchText || !searchText.trim()) return documents;

    const search = searchText.toLowerCase().trim();

    return documents.filter(doc => {
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
 * @param {Array} documents - Array of document objects
 * @param {Object} sortConfig - Sort configuration { field, direction }
 * @returns {Array} - Sorted documents
 */
export const sortDocuments = (documents, sortConfig) => {
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

        // Compare values
        let comparison = 0;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else {
            comparison = String(aVal).localeCompare(String(bVal));
        }

        return isDescending ? -comparison : comparison;
    });
};

/**
 * Applies all filtering and sorting to documents
 * @param {Array} documents - Array of document objects
 * @param {Object} options - Filter and sort options
 * @param {Array} options.filters - Array of filter conditions
 * @param {string} options.searchText - Text search string
 * @param {Object} options.sortConfig - Sort configuration
 * @returns {Array} - Filtered and sorted documents
 */
export const processDocuments = (documents, options = {}) => {
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
 * @param {Array} allFields - Array of all field names
 * @param {Object} hiddenColumns - Object mapping field names to hidden state
 * @returns {Array} - Array of visible field names
 */
export const getVisibleFields = (allFields, hiddenColumns) => {
    return allFields.filter(field => !hiddenColumns[field]);
};

/**
 * Converts documents to a JSON object keyed by document ID
 * @param {Array} documents - Array of document objects
 * @returns {Object} - Object with document IDs as keys and data as values
 */
export const documentsToJson = (documents) => {
    const result = {};
    documents.forEach(doc => {
        result[doc.id] = doc.data;
    });
    return result;
};

/**
 * Creates a new filter object with default values
 * @returns {Object} - New filter object
 */
export const createEmptyFilter = () => ({
    field: '',
    operator: '==',
    value: ''
});

/**
 * Creates default sort configuration
 * @returns {Object} - Default sort config object
 */
export const createDefaultSortConfig = () => ({
    field: '',
    direction: 'asc'
});
