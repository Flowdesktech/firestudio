/**
 * Query Parsing and Building Utilities
 * Handles JS query parsing and Firestore structured query construction
 */

import { convertToFirestoreOperator, convertToFirestoreValue } from './firestoreUtils';

/**
 * Regular expressions for parsing JS query components
 */
const QUERY_PATTERNS = {
    collection: /\.collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/,
    limit: /\.limit\s*\(\s*(\d+)\s*\)/,
    select: /\.select\s*\(\s*([^)]+)\s*\)/,
    where: /\.where\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*,\s*([^)]+)\s*\)/g,
    orderBy: /\.orderBy\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*["'`]?(asc|desc)["'`]?)?\s*\)/i
};

/**
 * Parses a raw value string into a typed value
 * @param {string} rawValue - The raw value string from query
 * @returns {*} - Parsed typed value
 */
const parseQueryValue = (rawValue) => {
    const trimmed = rawValue.trim();

    // String values (quoted)
    if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('`')) {
        return trimmed.slice(1, -1);
    }

    // Boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Numeric values
    if (!isNaN(trimmed)) return Number(trimmed);

    return trimmed;
};

/**
 * Parses a JS query string and extracts query parameters
 * @param {string} queryString - The JS query string
 * @param {string} defaultCollection - Default collection path
 * @param {number} defaultLimit - Default document limit
 * @returns {Object} - Parsed query parameters
 */
export const parseJsQueryString = (queryString, defaultCollection = '', defaultLimit = 50) => {
    const params = {
        collection: defaultCollection,
        limit: defaultLimit,
        select: [],
        where: [],
        orderBy: null
    };

    // Extract collection
    const collectionMatch = queryString.match(QUERY_PATTERNS.collection);
    if (collectionMatch) {
        params.collection = collectionMatch[1];
    }

    // Extract limit
    const limitMatch = queryString.match(QUERY_PATTERNS.limit);
    if (limitMatch) {
        params.limit = parseInt(limitMatch[1], 10);
    }

    // Extract select fields
    const selectMatch = queryString.match(QUERY_PATTERNS.select);
    if (selectMatch) {
        const fieldsStr = selectMatch[1];
        const fieldMatches = fieldsStr.match(/["'`]([^"'`]+)["'`]/g);
        if (fieldMatches) {
            params.select = fieldMatches.map(f => f.replace(/["'`]/g, ''));
        }
    }

    // Extract where clauses
    let whereMatch;
    while ((whereMatch = QUERY_PATTERNS.where.exec(queryString)) !== null) {
        params.where.push({
            field: whereMatch[1],
            operator: whereMatch[2],
            value: parseQueryValue(whereMatch[3])
        });
    }

    // Extract orderBy
    const orderByMatch = queryString.match(QUERY_PATTERNS.orderBy);
    if (orderByMatch) {
        params.orderBy = {
            field: orderByMatch[1],
            direction: orderByMatch[2] || 'asc'
        };
    }

    return params;
};

/**
 * Builds a Firestore REST API structured query from parsed parameters
 * @param {Object} queryParams - Parsed query parameters
 * @returns {Object} - Firestore structured query object
 */
export const buildStructuredQuery = (queryParams) => {
    const { collection, limit, select, where, orderBy } = queryParams;

    // Get the collection ID (last segment of path)
    const collectionId = collection.split('/').pop();

    const structuredQuery = {
        from: [{ collectionId }],
        limit
    };

    // Add field projection if specified
    if (select.length > 0) {
        structuredQuery.select = {
            fields: select.map(fieldPath => ({ fieldPath }))
        };
    }

    // Add where filters
    if (where.length > 0) {
        structuredQuery.where = buildWhereClause(where);
    }

    // Add ordering
    if (orderBy) {
        structuredQuery.orderBy = [{
            field: { fieldPath: orderBy.field },
            direction: orderBy.direction.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING'
        }];
    }

    return structuredQuery;
};

/**
 * Builds the where clause for a structured query
 * @param {Array} whereConditions - Array of where conditions
 * @returns {Object} - Firestore where clause object
 */
const buildWhereClause = (whereConditions) => {
    if (whereConditions.length === 1) {
        return buildFieldFilter(whereConditions[0]);
    }

    // Multiple conditions - use composite filter
    return {
        compositeFilter: {
            op: 'AND',
            filters: whereConditions.map(buildFieldFilter)
        }
    };
};

/**
 * Builds a single field filter
 * @param {Object} condition - Where condition object
 * @returns {Object} - Firestore field filter object
 */
const buildFieldFilter = (condition) => ({
    fieldFilter: {
        field: { fieldPath: condition.field },
        op: convertToFirestoreOperator(condition.operator),
        value: convertToFirestoreValue(condition.value)
    }
});

/**
 * Parses a JS query and returns a complete structured query for Firestore REST API
 * @param {string} jsQuery - The JS query string
 * @param {string} collectionPath - The default collection path
 * @param {number} limit - The default document limit
 * @returns {Object} - Object containing parsed params and structured query
 */
export const getParsedStructuredQuery = (jsQuery, collectionPath, limit = 50) => {
    const queryParams = parseJsQueryString(jsQuery, collectionPath, limit);
    const structuredQuery = buildStructuredQuery(queryParams);

    return {
        params: queryParams,
        structuredQuery
    };
};

/**
 * Generates a default JS query template
 * @param {string} collectionPath - The collection path
 * @param {number} limit - The document limit
 * @returns {string} - JS query template string
 */
export const generateDefaultJsQuery = (collectionPath, limit = 50) => {
    return `// Query with JavaScript using the Firebase Admin SDK
// See examples at https://firefoo.app/go/firestore-js-query
async function run() {
    const query = await db.collection("${collectionPath}")
        .limit(${limit})
        .get();
    return query;
}`;
};

/**
 * Parses Firestore REST API query response into document array
 * @param {Array|Object} responseData - Response data from Firestore REST API
 * @param {string} collectionPath - The collection path for document paths
 * @param {Function} parseFields - Function to parse Firestore fields
 * @returns {Array} - Array of document objects
 */
export const parseQueryResponse = (responseData, collectionPath, parseFields) => {
    const items = Array.isArray(responseData) ? responseData : [responseData];

    return items
        .filter(item => item?.document)
        .map(item => {
            const doc = item.document;
            const pathParts = doc.name.split('/');
            const docId = pathParts[pathParts.length - 1];

            return {
                id: docId,
                data: parseFields(doc.fields || {}),
                path: `${collectionPath}/${docId}`
            };
        });
};
