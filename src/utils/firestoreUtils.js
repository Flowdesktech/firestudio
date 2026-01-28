/**
 * Firestore Data Type Utilities
 * Handles type detection, formatting, and value parsing for Firestore documents
 */

/**
 * Firestore REST API operator mapping
 */
export const FIRESTORE_OPERATORS = {
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'array-contains': 'ARRAY_CONTAINS',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
    'in': 'IN',
    'not-in': 'NOT_IN'
};

/**
 * Detects the Firestore data type of a value
 * @param {*} value - The value to check
 * @returns {string} - The detected type name
 */
export const getValueType = (value) => {
    if (value === null) return 'Null';
    if (value === undefined) return 'Undefined';
    if (Array.isArray(value)) return 'Array';
    if (typeof value === 'object' && value._seconds !== undefined) return 'Timestamp';
    if (typeof value === 'object' && value._latitude !== undefined) return 'GeoPoint';
    if (typeof value === 'object') return 'Map';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Integer' : 'Number';
    if (typeof value === 'boolean') return 'Boolean';
    return typeof value;
};

/**
 * Formats a Firestore value for display
 * @param {*} value - The value to format
 * @param {string} type - The detected type
 * @returns {string} - Formatted display string
 */
export const formatDisplayValue = (value, type) => {
    if (type === 'Null' || type === 'Undefined') return '';
    if (type === 'Timestamp' && value?._seconds) {
        return new Date(value._seconds * 1000).toISOString();
    }
    if (type === 'GeoPoint' && value) {
        return `(${value._latitude}, ${value._longitude})`;
    }
    if (type === 'Array' || type === 'Map') return '';
    if (type === 'String') return value;
    return String(value);
};

/**
 * Returns the display color for a given type
 * @param {string} type - The data type
 * @param {boolean} isDark - Whether dark mode is enabled
 * @returns {string} - CSS color value
 */
export const getTypeColor = (type, isDark) => {
    const lightColors = {
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
        Document: '#ff9800'
    };

    const darkColors = {
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
        Document: '#ff9800'
    };

    const colors = isDark ? darkColors : lightColors;
    return colors[type] || (isDark ? '#ccc' : '#333');
};

/**
 * Converts a JS operator to Firestore REST API operator
 * @param {string} operator - JS comparison operator
 * @returns {string} - Firestore REST API operator
 */
export const convertToFirestoreOperator = (operator) => {
    return FIRESTORE_OPERATORS[operator] || 'EQUAL';
};

/**
 * Converts a JS value to Firestore REST API value format
 * @param {*} value - The value to convert
 * @returns {Object} - Firestore REST API value object
 */
export const convertToFirestoreValue = (value) => {
    if (value === null) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { integerValue: value.toString() }
            : { doubleValue: value };
    }
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(convertToFirestoreValue) } };
    }
    return { stringValue: String(value) };
};

/**
 * Parses Firestore REST API response fields to JS objects
 * @param {Object} fields - Firestore fields object
 * @returns {Object} - Parsed JS object
 */
export const parseFirestoreFields = (fields) => {
    if (!fields) return {};

    const result = {};
    for (const [key, value] of Object.entries(fields)) {
        result[key] = parseFirestoreValue(value);
    }
    return result;
};

/**
 * Parses a single Firestore REST API value to JS value
 * @param {Object} value - Firestore value object
 * @returns {*} - Parsed JS value
 */
export const parseFirestoreValue = (value) => {
    if (!value) return value;

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
            _longitude: value.geoPointValue.longitude
        };
    }

    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }

    if (value.mapValue !== undefined) {
        return parseFirestoreFields(value.mapValue.fields || {});
    }

    if (value.referenceValue !== undefined) return value.referenceValue;

    return value;
};

/**
 * Parses an edit value string and returns the appropriate typed value
 * @param {string} editValue - The string value to parse
 * @returns {*} - Parsed value with appropriate type
 */
export const parseEditValue = (editValue) => {
    try {
        return JSON.parse(editValue);
    } catch {
        if (editValue === 'null') return null;
        if (editValue === 'undefined' || editValue === '') return undefined;
        if (editValue === 'true') return true;
        if (editValue === 'false') return false;
        if (!isNaN(editValue) && editValue !== '') return Number(editValue);
        return editValue;
    }
};

/**
 * Serializes a value for editing (converts to string representation)
 * @param {*} value - The value to serialize
 * @param {string} type - The detected type
 * @returns {string} - String representation for editing
 */
export const serializeForEdit = (value, type) => {
    if (type === 'Array' || type === 'Map') {
        return JSON.stringify(value, null, 2);
    }
    if (value === undefined) return '';
    if (value === null) return 'null';
    return String(value);
};
