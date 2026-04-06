import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { refreshCollections, Project } from '../../projects/store/projectsSlice';
import { closeTab, addTab } from '../../../app/store/slices/uiSlice';
import { getParsedStructuredQuery, parseQueryResponse, QueryResponseItem } from '../../../shared/utils/queryUtils';
import { parseFirestoreFields, FirestoreValue } from '../../../shared/utils/firestoreUtils';
import { downloadJson } from '../../../shared/utils/commonUtils';
import { RootState } from '../../../app/store';
import { ThunkExtra } from '../../../app/store/thunkTypes';
import {
  getServiceAccountConnectDatabaseId,
  getActiveFirestoreDatabase,
  getFirestoreDatabaseDisplay,
  buildCollectionStateKey,
  getGoogleApiDatabaseId,
} from '../../projects/utils/firestoreDatabaseUtils';

// Types
export interface DocumentData {
  [key: string]: FirestoreValue;
}

export interface Document {
  id: string;
  data: DocumentData;
}

export interface Filter {
  field: string;
  operator: string; // '==' | '<' | '<=' | '>' | '>=' | 'array-contains'
  value: FirestoreValue;
}

export interface SortConfig {
  field: string | null;
  direction: 'asc' | 'desc';
}

export interface CollectionParams {
  limit: number;
  queryMode: 'simple' | 'js';
  jsQuery: string;
  filters: Filter[];
  sortConfig: SortConfig;
  // Runtime state
  documents: Document[];
  loading: boolean;
  error: string | null;
  lastFetchedAt?: number;
}

export interface CollectionState {
  cache: { [key: string]: CollectionParams };
}

const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  extra: ThunkExtra;
}>();

// Thunks

interface ImportResult {
  count?: number;
  success?: boolean;
  error?: string;
}

export const importCollection = createAppAsyncThunk<
  ImportResult,
  { project: Project; collection: string; data?: Record<string, DocumentData>; firestoreDatabaseId?: string }
>('collection/import', async ({ project, collection, data, firestoreDatabaseId }, { rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    if (project.authMethod === 'google') {
      if (!data) return rejectWithValue('No data provided');
      let count = 0;
      for (const [docId, docData] of Object.entries(data)) {
        await electron.googleSetDocument({
          projectId: project.projectId,
          collectionPath: collection,
          documentId: docId,
          data: docData,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
        count++;
      }
      return { count };
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(project, firestoreDatabaseId),
      });

      const result = await electron.importDocuments(collection);
      if (!result.success && result.error !== 'Import cancelled') throw new Error(result.error);

      return result;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

interface ExportResult {
  success?: boolean;
  filePath?: string;
  error?: string;
}

export const exportCollection = createAppAsyncThunk<
  ExportResult,
  { project: Project; collection: string; firestoreDatabaseId?: string }
>('collection/export', async ({ project, collection, firestoreDatabaseId }, { rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    if (project.authMethod === 'google') {
      // Return success, verify logic handled in component for browser download?
      // Or handle download here? Using blob here is fine.
      // But we need the data first.
      // We should pass documents or fetch them?
      // Better: Component handles Google export (since it's client side).
      // Component handles SA export (since it's server side, but initiated here).
      return rejectWithValue('Google export handled by component');
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(project, firestoreDatabaseId),
      });
      const result = await electron.exportCollection(collection);

      if (!result.success && result.error !== 'Export cancelled') {
        throw new Error(result.error);
      }
      return result;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

interface QueryOptions {
  limit: number;
  where?: Array<{ field: string; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

export const fetchDocuments = createAppAsyncThunk<
  { documents: Document[] },
  { project: Project; collection: string; key: string; firestoreDatabaseId?: string }
>(
  'collection/fetchDocuments',
  async ({ project, collection, key, firestoreDatabaseId }, { rejectWithValue, getState, extra }) => {
    const electron = extra.electron.api;
    try {
      const state = getState().collection.cache[key];
      if (!state) return rejectWithValue('State not initialized for this collection view');

      const { limit, queryMode, jsQuery, filters, sortConfig } = state;

      let documents: Document[] = [];
      const parsedLimit = typeof limit === 'number' ? limit : parseInt(String(limit), 10) || 50;

      if (queryMode === 'js' && jsQuery) {
        // JS Query Mode
        if (project.authMethod === 'google') {
          // Google JS Query logic
          const { params, structuredQuery } = getParsedStructuredQuery(jsQuery, collection, parsedLimit);

          const result = await electron.googleExecuteStructuredQuery({
            projectId: project.projectId,
            structuredQuery,
            databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
          });

          if (!result.success) throw new Error(result.error);

          documents = parseQueryResponse(
            (result.data || []) as QueryResponseItem[],
            params.collection,
            parseFirestoreFields,
          ) as unknown as Document[];
        } else {
          // Service Account JS Query
          await electron.disconnectFirebase();
          await electron.connectFirebase({
            serviceAccountPath: project.serviceAccountPath!,
            databaseId: getServiceAccountConnectDatabaseId(project, firestoreDatabaseId),
          });

          const result = await electron.executeJsQuery({ collectionPath: collection, jsQuery });
          if (!result.success) throw new Error(result.error);

          documents = (result.documents || []) as Document[];
        }
      } else {
        // Simple Mode
        const options: QueryOptions = {
          limit: parsedLimit,
        };

        // Filters
        if (filters && filters.length > 0) {
          options.where = filters
            .filter((f) => f.field && f.value !== '')
            .map((f) => {
              let value = f.value;
              if (value === 'true') value = true;
              else if (value === 'false') value = false;
              else if (!isNaN(Number(value)) && value !== '' && typeof value === 'string') value = Number(value);

              return {
                field: f.field,
                op: f.operator,
                value: value,
              };
            });
        }

        // Sort
        if (sortConfig && sortConfig.field) {
          options.orderBy = [
            {
              field: sortConfig.field,
              direction: sortConfig.direction || 'asc',
            },
          ];
        }

        if (project.authMethod === 'google') {
          const res = await electron.googleGetDocuments({
            projectId: project.projectId,
            collectionPath: collection,
            ...options,
            databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
          });
          if (!res.success) throw new Error(res.error);
          documents = (res.documents || []) as Document[];
          // Google documents might need parsing if raw? checks suggest they are usually parsed by main process or clean.
          // googleGetDocuments usually returns formatted docs.
        } else {
          await electron.disconnectFirebase();
          await electron.connectFirebase({
            serviceAccountPath: project.serviceAccountPath!,
            databaseId: getServiceAccountConnectDatabaseId(project, firestoreDatabaseId),
          });

          const res = await electron.getDocuments({
            collectionPath: collection,
            ...options,
          });
          if (!res.success) throw new Error(res.error);
          documents = (res.documents || []) as Document[];
        }
      }

      return { documents };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

export const createCollection = createAppAsyncThunk<
  string | undefined,
  { project: Project; name: string; docId: string; docData: string; firestoreDatabaseId?: string }
>(
  'collection/create',
  async ({ project, name, docId, docData, firestoreDatabaseId }, { dispatch, rejectWithValue, extra }) => {
    const electron = extra.electron.api;
    const trimmedName = name.trim();
    if (!project || !trimmedName) return rejectWithValue('Invalid project or name');

    if (trimmedName.includes('/') || trimmedName.startsWith('_')) {
      return rejectWithValue('Invalid collection name');
    }

    let data;
    try {
      data = JSON.parse(docData.trim() || '{}');
    } catch {
      return rejectWithValue('Invalid JSON data');
    }

    try {
      const finalDocId = docId.trim() || `auto_${Date.now()}`;
      let result;

      if (project.authMethod === 'google') {
        result = await electron.googleSetDocument({
          projectId: project.projectId,
          collectionPath: trimmedName,
          documentId: finalDocId,
          data,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
      } else {
        await electron.disconnectFirebase();
        await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath!,
          databaseId: getServiceAccountConnectDatabaseId(
            project,
            firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          ),
        });
        result = await electron.createDocument({
          collectionPath: trimmedName,
          documentId: finalDocId,
          data,
        });
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Unknown error');
      }

      const fdId = firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id;
      dispatch(
        refreshCollections({
          project,
          refreshToken: project.refreshToken,
          ...(fdId ? { firestoreDatabaseId: fdId } : {}),
        }),
      );
      return trimmedName;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

export const addDocument = createAppAsyncThunk<
  string | undefined,
  { project: Project; collection: string; docId?: string | null; docData: string; firestoreDatabaseId?: string }
>(
  'collection/addDocument',
  async (
    { project, collection, docId, docData, firestoreDatabaseId },
    { dispatch, rejectWithValue, getState, extra },
  ) => {
    const electron = extra.electron.api;
    let data;
    try {
      data = JSON.parse(docData.trim() || '{}');
    } catch {
      return rejectWithValue('Invalid JSON');
    }

    const finalDocId = (docId ?? '').trim() || `auto_${Date.now()}`;

    try {
      let result;
      if (project.authMethod === 'google') {
        result = await electron.googleSetDocument({
          projectId: project.projectId,
          collectionPath: collection,
          documentId: finalDocId,
          data,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
      } else {
        await electron.disconnectFirebase();
        await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath!,
          databaseId: getServiceAccountConnectDatabaseId(
            project,
            firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          ),
        });
        result = await electron.createDocument({
          collectionPath: collection,
          documentId: finalDocId,
          data,
        });
      }

      if (!result?.success) throw new Error(result?.error);

      const key = buildCollectionStateKey(
        project,
        collection,
        firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
      );
      if (getState().collection.cache[key]) {
        dispatch(
          fetchDocuments({
            project,
            collection,
            key,
            firestoreDatabaseId: firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          }),
        );
      }

      return finalDocId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

export const updateDocument = createAppAsyncThunk<
  { docId: string; docData: DocumentData },
  { project: Project; collection: string; docId: string; docData: DocumentData; firestoreDatabaseId?: string }
>(
  'collection/updateDocument',
  async ({ project, collection, docId, docData, firestoreDatabaseId }, { rejectWithValue, extra }) => {
    const electron = extra.electron.api;
    try {
      let result;
      if (project.authMethod === 'google') {
        result = await electron.googleSetDocument({
          projectId: project.projectId,
          collectionPath: collection,
          documentId: docId,
          data: docData,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
      } else {
        await electron.disconnectFirebase();
        await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath!,
          databaseId: getServiceAccountConnectDatabaseId(
            project,
            firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          ),
        });
        result = await electron.setDocument({
          documentPath: `${collection}/${docId}`,
          data: docData,
        });
      }

      if (!result?.success) throw new Error(result?.error);

      return { docId, docData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

export const deleteDocument = createAppAsyncThunk<
  string,
  { project: Project; collection: string; docId: string; firestoreDatabaseId?: string }
>(
  'collection/deleteDocument',
  async ({ project, collection, docId, firestoreDatabaseId }, { rejectWithValue, extra }) => {
    const electron = extra.electron.api;
    try {
      let result;
      if (project.authMethod === 'google') {
        result = await electron.googleDeleteDocument({
          projectId: project.projectId,
          collectionPath: collection,
          documentId: docId,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
      } else {
        await electron.disconnectFirebase();
        await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath!,
          databaseId: getServiceAccountConnectDatabaseId(
            project,
            firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          ),
        });
        result = await electron.deleteDocument(`${collection}/${docId}`);
      }

      if (!result?.success) throw new Error(result?.error);

      return docId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

export const renameCollection = createAppAsyncThunk<
  void,
  { project: Project; currentPath: string; targetPath: string; firestoreDatabaseId?: string }
>(
  'collection/rename',
  async ({ project, currentPath, targetPath, firestoreDatabaseId }, { dispatch, rejectWithValue, extra }) => {
    const electron = extra.electron.api;
    if (!targetPath.trim() || targetPath === currentPath) return;
    const trimmedTarget = targetPath.trim();

    try {
      // 1. Get Docs
      let documents: Document[] = [];
      if (project.authMethod === 'google') {
        const res = await electron.googleGetDocuments({
          projectId: project.projectId,
          collectionPath: currentPath,
          limit: 10000,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
        documents = res.success ? ((res.documents || []) as Document[]) : [];
      } else {
        await electron.disconnectFirebase();
        await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath!,
          databaseId: getServiceAccountConnectDatabaseId(
            project,
            firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
          ),
        });
        const res = await electron.getDocuments({
          collectionPath: currentPath,
          limit: 10000,
        });
        documents = res.success ? ((res.documents || []) as Document[]) : [];
      }

      // 2. Copy Docs
      for (const doc of documents) {
        if (project.authMethod === 'google') {
          await electron.googleSetDocument({
            projectId: project.projectId,
            collectionPath: trimmedTarget,
            documentId: doc.id,
            data: doc.data,
            databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
          });
        } else {
          await electron.createDocument({
            collectionPath: trimmedTarget,
            documentId: doc.id,
            data: doc.data,
          });
        }
      }

      // 3. Delete Originals
      for (const doc of documents) {
        if (project.authMethod === 'google') {
          await electron.googleDeleteDocument({
            projectId: project.projectId,
            collectionPath: currentPath,
            documentId: doc.id,
            databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
          });
        } else {
          await electron.deleteDocument(`${currentPath}/${doc.id}`);
        }
      }

      const fdId = firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id;
      dispatch(
        refreshCollections({
          project,
          refreshToken: project.refreshToken,
          ...(fdId ? { firestoreDatabaseId: fdId } : {}),
        }),
      );

      const fd = fdId ? project.firestoreDatabases?.find((d) => d.id === fdId) : null;
      const dbLabel = fd ? getFirestoreDatabaseDisplay(fd) : undefined;
      const oldTabId = fdId ? `${project.id}-${fdId}-${currentPath}` : `${project.id}-${currentPath}`;
      dispatch(closeTab(oldTabId));

      dispatch(
        addTab({
          id: fdId ? `${project.id}-${fdId}-${trimmedTarget}` : `${project.id}-${trimmedTarget}`,
          projectId: project.id,
          projectName: project.projectId,
          collectionPath: trimmedTarget,
          label: dbLabel ? `${dbLabel} · ${trimmedTarget}` : trimmedTarget,
          type: 'collection',
          firestoreDatabaseId: fdId,
          databaseLabel: dbLabel,
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return rejectWithValue(errorMessage);
    }
  },
);

// Query response item type for estimateDocCount
interface QueryDataItem {
  document?: unknown;
}

// Estimate document count
export const estimateDocCount = createAppAsyncThunk<
  { count: number },
  { project: Project; collection: string; firestoreDatabaseId?: string }
>('collection/estimateDocCount', async ({ project, collection, firestoreDatabaseId }, { rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    let count = 0;

    if (project.authMethod === 'google') {
      // Use Google's aggregation query API (efficient count without fetching data)
      const res = await electron.googleCountDocuments({
        projectId: project.projectId,
        collectionPath: collection,
        databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
      });

      if (res.success) {
        count = res.count;
      } else {
        // Fallback: use structured query with select to only get document names (no field data)
        const structuredQuery = {
          from: [{ collectionId: collection }],
          select: { fields: [] },
        };
        const queryRes = await electron.googleExecuteStructuredQuery({
          projectId: project.projectId,
          structuredQuery,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
        if (queryRes.success && Array.isArray(queryRes.data)) {
          count = (queryRes.data as QueryDataItem[]).filter((item) => item.document).length;
        } else {
          throw new Error(queryRes.error || 'Failed to count documents');
        }
      }
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(
          project,
          firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
        ),
      });
      const res = await electron.query({
        collectionPath: collection,
        limit: 100000,
      });
      if (res.success) {
        count = (res.documents || []).length;
      } else {
        throw new Error(res.error || 'Failed to count documents');
      }
    }

    return { count };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

// Export result types
interface SingleExportResult {
  count?: number;
  success?: boolean;
  filePath?: string;
  error?: string;
}

interface AllExportResult {
  collectionsCount?: number;
  success?: boolean;
  filePath?: string;
  error?: string;
}

// Export single collection (Google uses browser download, SA uses native dialog)
export const exportSingleCollection = createAppAsyncThunk<
  SingleExportResult,
  { project: Project; collection: string; firestoreDatabaseId?: string }
>('collection/exportSingle', async ({ project, collection, firestoreDatabaseId }, { rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    if (project.authMethod === 'google') {
      const res = await electron.googleExportCollection({
        projectId: project.projectId,
        collectionPath: collection,
        databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to export collection');
      }

      if (!res.documents || Object.keys(res.documents).length === 0) {
        return { count: 0 };
      }

      downloadJson(res.documents, `${collection.replace(/\//g, '_')}_export.json`);
      return { count: res.count };
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(
          project,
          firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
        ),
      });
      const res = await electron.exportCollection(collection);
      if (!res.success) throw new Error(res.error || 'Export failed');
      return res;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

// Export all collections
export const exportAllCollections = createAppAsyncThunk<
  AllExportResult,
  { project: Project; firestoreDatabaseId?: string }
>('collection/exportAll', async ({ project, firestoreDatabaseId }, { rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    if (project.authMethod === 'google') {
      const res = await electron.googleExportCollections({
        projectId: project.projectId,
        databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to export collections');
      }

      if (!res.data || Object.keys(res.data).length === 0) {
        return { collectionsCount: 0 };
      }

      downloadJson(res.data, `${project.projectId}_firestore_export.json`);
      return { collectionsCount: res.collectionsCount };
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(
          project,
          firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
        ),
      });
      const res = await electron.exportCollections();
      if (!res.success) throw new Error(res.error || 'Export failed');
      return res;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

export const deleteCollection = createAppAsyncThunk<
  void,
  { project: Project; collection: string; firestoreDatabaseId?: string }
>('collection/delete', async ({ project, collection, firestoreDatabaseId }, { dispatch, rejectWithValue, extra }) => {
  const electron = extra.electron.api;
  try {
    let documents: Document[] = [];
    if (project.authMethod === 'google') {
      const res = await electron.googleGetDocuments({
        projectId: project.projectId,
        collectionPath: collection,
        limit: 10000,
        databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
      });
      documents = res.success ? ((res.documents || []) as Document[]) : [];
    } else {
      await electron.disconnectFirebase();
      await electron.connectFirebase({
        serviceAccountPath: project.serviceAccountPath!,
        databaseId: getServiceAccountConnectDatabaseId(
          project,
          firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
        ),
      });
      const res = await electron.getDocuments({
        collectionPath: collection,
        limit: 10000,
      });
      documents = res.success ? ((res.documents || []) as Document[]) : [];
    }

    for (const doc of documents) {
      if (project.authMethod === 'google') {
        await electron.googleDeleteDocument({
          projectId: project.projectId,
          collectionPath: collection,
          documentId: doc.id,
          databaseId: getGoogleApiDatabaseId(project, firestoreDatabaseId),
        });
      } else {
        await electron.deleteDocument(`${collection}/${doc.id}`);
      }
    }

    const fdId = firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id;
    dispatch(
      refreshCollections({
        project,
        refreshToken: project.refreshToken,
        ...(fdId ? { firestoreDatabaseId: fdId } : {}),
      }),
    );

    const tabId = fdId ? `${project.id}-${fdId}-${collection}` : `${project.id}-${collection}`;
    dispatch(closeTab(tabId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return rejectWithValue(errorMessage);
  }
});

const collectionSlice = createSlice({
  name: 'collection',
  initialState: {
    cache: {},
  } as CollectionState,
  reducers: {
    initCollectionState: (state, action: PayloadAction<{ key: string; defaultLimit?: number }>) => {
      const { key, defaultLimit = 50 } = action.payload;
      if (!state.cache[key]) {
        state.cache[key] = {
          documents: [],
          loading: false,
          error: null,
          queryMode: 'simple',
          jsQuery: '',
          limit: defaultLimit,
          filters: [],
          sortConfig: { field: null, direction: 'asc' },
          lastFetchedAt: 0,
        };
      }
    },
    setCollectionLimit: (state, action: PayloadAction<{ key: string; limit: number }>) => {
      const { key, limit } = action.payload;
      if (state.cache[key]) state.cache[key].limit = limit;
    },
    setCollectionQueryMode: (state, action: PayloadAction<{ key: string; mode: 'simple' | 'js' }>) => {
      const { key, mode } = action.payload;
      if (state.cache[key]) state.cache[key].queryMode = mode;
    },
    setCollectionJsQuery: (state, action: PayloadAction<{ key: string; query: string }>) => {
      const { key, query } = action.payload;
      if (state.cache[key]) state.cache[key].jsQuery = query;
    },
    setCollectionFilters: (state, action: PayloadAction<{ key: string; filters: Filter[] }>) => {
      const { key, filters } = action.payload;
      if (state.cache[key]) state.cache[key].filters = filters;
    },
    setCollectionSort: (state, action: PayloadAction<{ key: string; config: SortConfig }>) => {
      const { key, config } = action.payload;
      if (state.cache[key]) state.cache[key].sortConfig = config;
    },
  },
  extraReducers: (builder) => {
    builder
      // Import
      .addCase(importCollection.fulfilled, () => {
        // Optionally refresh or invalidate cache
      })

      // Fetch Documents
      .addCase(fetchDocuments.pending, (state, action) => {
        const key = action.meta.arg.key;
        if (!state.cache[key]) {
          return;
        }
        state.cache[key].loading = true;
        state.cache[key].error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        const key = action.meta.arg.key;
        if (state.cache[key]) {
          state.cache[key].loading = false;
          state.cache[key].documents = action.payload.documents;
          state.cache[key].lastFetchedAt = Date.now();
        }
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        const key = action.meta.arg.key;
        if (state.cache[key]) {
          state.cache[key].loading = false;
          state.cache[key].error = action.payload as string;
        }
      })

      // Create Collection
      .addCase(createCollection.fulfilled, () => {
        // Handled by refreshCollections
      })

      // Add Document
      .addCase(addDocument.fulfilled, () => {
        // Component usually listens for refresh or we could optimally update cache.
        // For now, simple.
      })

      // Update Document
      .addCase(updateDocument.fulfilled, (state, action) => {
        const { docId, docData } = action.payload;
        // Update in all caches that contain this document
        Object.values(state.cache).forEach((params) => {
          const docIndex = params.documents.findIndex((d) => d.id === docId);
          if (docIndex !== -1) {
            // Merge data
            params.documents[docIndex].data = { ...params.documents[docIndex].data, ...docData };
          }
        });
      })

      // Delete Document
      .addCase(deleteDocument.fulfilled, (state, action) => {
        const docId = action.payload;
        Object.values(state.cache).forEach((params) => {
          params.documents = params.documents.filter((d) => d.id !== docId);
        });
      })

      // Rename Collection
      .addCase(renameCollection.fulfilled, () => {
        // Handled by refresh and tab management
      })

      // Delete Collection
      .addCase(deleteCollection.fulfilled, () => {
        // Remove from cache logic or just ignore
      });
  },
});

export const {
  initCollectionState,
  setCollectionLimit,
  setCollectionQueryMode,
  setCollectionJsQuery,
  setCollectionFilters,
  setCollectionSort,
} = collectionSlice.actions;

const defaultCollectionState: CollectionParams = {
  documents: [],
  loading: false,
  error: null,
  queryMode: 'simple',
  jsQuery: '',
  limit: 50,
  filters: [],
  sortConfig: { field: null, direction: 'asc' },
};

export const selectCollectionState = (state: RootState, key: string): CollectionParams =>
  state.collection.cache[key] || defaultCollectionState;

export const selectCollectionData = (state: RootState, key: string | null): CollectionParams => {
  if (!key) return defaultCollectionState;
  return state.collection.cache[key] || defaultCollectionState;
};

export default collectionSlice.reducer;
