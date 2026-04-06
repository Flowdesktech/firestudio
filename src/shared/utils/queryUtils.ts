/**
 * Query Parsing and Building Utilities
 * Handles JS query parsing and Firestore structured query construction
 */

import {
  convertToFirestoreOperator,
  convertToFirestoreValue,
  FirestoreValue,
  FirestoreRestValue,
} from './firestoreUtils';

/**
 * Regular expressions for parsing JS query components
 */
const QUERY_PATTERNS = {
  collection: /\.collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/,
  limit: /\.limit\s*\(\s*(\d+)\s*\)/,
  select: /\.select\s*\(\s*([^)]+)\s*\)/,
  where: /\.where\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*,\s*([^)]+)\s*\)/g,
  orderBy: /\.orderBy\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*["'`]?(asc|desc)["'`]?)?\s*\)/i,
};

/**
 * Parses a raw value string into a typed value
 */
const parseQueryValue = (rawValue: string): string | number | boolean => {
  const trimmed = rawValue.trim();

  // String values (quoted)
  if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('`')) {
    return trimmed.slice(1, -1);
  }

  // Boolean values
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Numeric values
  if (!isNaN(Number(trimmed))) return Number(trimmed);

  return trimmed;
};

export interface WhereCondition {
  field: string;
  operator: string;
  value: FirestoreValue;
}

export interface OrderByConfig {
  field: string;
  direction: string;
}

export interface QueryParams {
  collection: string;
  limit: number;
  select: string[];
  where: WhereCondition[];
  orderBy: OrderByConfig | null;
}

export interface FieldFilter {
  fieldFilter: {
    field: { fieldPath: string };
    op: string;
    value: FirestoreRestValue;
  };
}

export interface CompositeFilter {
  compositeFilter: {
    op: string;
    filters: FieldFilter[];
  };
}

export interface StructuredQuery {
  from: Array<{ collectionId: string }>;
  limit: number;
  select?: { fields: Array<{ fieldPath: string }> };
  where?: FieldFilter | CompositeFilter;
  orderBy?: Array<{ field: { fieldPath: string }; direction: string }>;
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

export interface ParsedDocument {
  id: string;
  data: Record<string, FirestoreValue>;
  path: string;
}

export interface QueryResponseItem {
  document?: {
    name: string;
    fields?: Record<string, FirestoreRestValue>;
  };
}

/**
 * Parses a JS query string and extracts query parameters
 */
export const parseJsQueryString = (
  queryString: string,
  defaultCollection: string = '',
  defaultLimit: number = 50,
): QueryParams => {
  const params: QueryParams = {
    collection: defaultCollection,
    limit: defaultLimit,
    select: [],
    where: [],
    orderBy: null,
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
      params.select = fieldMatches.map((f) => f.replace(/["'`]/g, ''));
    }
  }

  // Extract where clauses
  let whereMatch;
  while ((whereMatch = QUERY_PATTERNS.where.exec(queryString)) !== null) {
    params.where.push({
      field: whereMatch[1],
      operator: whereMatch[2],
      value: parseQueryValue(whereMatch[3]),
    });
  }

  // Extract orderBy
  const orderByMatch = queryString.match(QUERY_PATTERNS.orderBy);
  if (orderByMatch) {
    params.orderBy = {
      field: orderByMatch[1],
      direction: orderByMatch[2] || 'asc',
    };
  }

  return params;
};

/**
 * Builds a Firestore REST API structured query from parsed parameters
 */
export const buildStructuredQuery = (queryParams: QueryParams): StructuredQuery => {
  const { collection, limit, select, where, orderBy } = queryParams;

  // Get the collection ID (last segment of path)
  const collectionId = collection.split('/').pop() || collection;

  const structuredQuery: StructuredQuery = {
    from: [{ collectionId }],
    limit,
  };

  // Add field projection if specified
  if (select.length > 0) {
    structuredQuery.select = {
      fields: select.map((fieldPath) => ({ fieldPath })),
    };
  }

  // Add where filters
  if (where.length > 0) {
    structuredQuery.where = buildWhereClause(where);
  }

  // Add ordering
  if (orderBy) {
    structuredQuery.orderBy = [
      {
        field: { fieldPath: orderBy.field },
        direction: orderBy.direction.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING',
      },
    ];
  }

  return structuredQuery;
};

/**
 * Builds the where clause for a structured query
 */
const buildWhereClause = (whereConditions: WhereCondition[]): FieldFilter | CompositeFilter => {
  if (whereConditions.length === 1) {
    return buildFieldFilter(whereConditions[0]);
  }

  // Multiple conditions - use composite filter
  return {
    compositeFilter: {
      op: 'AND',
      filters: whereConditions.map(buildFieldFilter),
    },
  };
};

/**
 * Builds a single field filter
 */
const buildFieldFilter = (condition: WhereCondition): FieldFilter => ({
  fieldFilter: {
    field: { fieldPath: condition.field },
    op: convertToFirestoreOperator(condition.operator),
    value: convertToFirestoreValue(condition.value),
  },
});

/**
 * Parses a JS query and returns a complete structured query for Firestore REST API
 */
export const getParsedStructuredQuery = (
  jsQuery: string,
  collectionPath: string,
  limit: number = 50,
): { params: QueryParams; structuredQuery: StructuredQuery } => {
  const queryParams = parseJsQueryString(jsQuery, collectionPath, limit);
  const structuredQuery = buildStructuredQuery(queryParams);

  return {
    params: queryParams,
    structuredQuery,
  };
};

/**
 * Generates a default JS query template
 */
export const generateDefaultJsQuery = (collectionPath: string, limit: number = 50): string => {
  return `// Query with JavaScript using the Firebase Admin SDK
// See examples at https://firefoo.app/go/firestore-js-query
async function run() {
    const query = await db.collection("${collectionPath}")
        .limit(${limit})
        .get();
    return query;
}`;
};

interface SimpleFilter {
  field: string;
  operator: string;
  value: FirestoreValue;
}

interface SimpleSortConfig {
  field: string | null;
  direction: 'asc' | 'desc';
}

const formatFilterValue = (value: FirestoreValue): string => {
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return 'null';
  return `'${String(value)}'`;
};

/**
 * Generates a JS query string from simple mode parameters (filters, sort, limit)
 */
export const generateJsQueryFromSimpleParams = (
  collectionPath: string,
  filters: SimpleFilter[],
  sortConfig: SimpleSortConfig,
  limit: number = 50,
): string => {
  const lines: string[] = [];
  lines.push(`async function run() {`);
  lines.push(`    const snapshot = await db`);
  lines.push(`        .collection('${collectionPath}')`);

  const activeFilters = filters.filter((f) => f.field && f.value !== '');
  for (const f of activeFilters) {
    lines.push(`        .where('${f.field}', '${f.operator}', ${formatFilterValue(f.value)})`);
  }

  if (sortConfig.field) {
    lines.push(`        .orderBy('${sortConfig.field}', '${sortConfig.direction}')`);
  }

  lines.push(`        .limit(${limit})`);
  lines.push(`        .get();`);
  lines.push(``);
  lines.push(`    return snapshot;`);
  lines.push(`}`);
  return lines.join('\n');
};

/**
 * Parses Firestore REST API query response into document array
 */
export const parseQueryResponse = (
  responseData: QueryResponseItem | QueryResponseItem[],
  collectionPath: string,
  parseFields: (fields: Record<string, FirestoreRestValue>) => Record<string, FirestoreValue>,
): ParsedDocument[] => {
  const items = Array.isArray(responseData) ? responseData : [responseData];

  return items
    .filter(
      (item): item is QueryResponseItem & { document: NonNullable<QueryResponseItem['document']> } => !!item?.document,
    )
    .map((item) => {
      const doc = item.document;
      const pathParts = doc.name.split('/');
      const docId = pathParts[pathParts.length - 1];

      return {
        id: docId,
        data: parseFields(doc.fields || {}),
        path: `${collectionPath}/${docId}`,
      };
    });
};
