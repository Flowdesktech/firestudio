/**
 * CollectionTab Component
 * Main container for viewing and managing Firestore collection documents
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  CircularProgress,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { Storage as CollectionIcon } from '@mui/icons-material';

// Context
import { useSelector, useDispatch } from 'react-redux';
import { toggleFavorite, selectIsFavorite } from '../../../app/store/slices/favoritesSlice';
import { selectSettings, SettingsState } from '../../../app/store/slices/settingsSlice';
import {
  updateDocument,
  addDocument,
  deleteDocument,
  fetchDocuments,
  importCollection,
  exportCollection,
  initCollectionState,
  setCollectionLimit,
  setCollectionQueryMode,
  setCollectionJsQuery,
  setCollectionFilters,
  setCollectionSort,
  selectCollectionData,
  Document,
  DocumentData,
  Filter,
  SortConfig,
} from '../store/collectionSlice';
import { RootState, AppDispatch } from '../../../app/store';
import { Project } from '../../projects/store/projectsSlice';
import { FirestoreValue } from '../../../shared/utils/firestoreUtils';
import { isFirestoreTimestamp, isIsoDateString, isUnixTimestampMs } from '../../../shared/utils/dateUtils';

// Utilities
import {
  getValueType,
  formatDisplayValue,
  getTypeColor,
  parseEditValue,
  serializeForEdit,
  extractAllFields,
  processDocuments,
  getVisibleFields,
  documentsToJson,
  getErrorMessage,
} from '../../../shared/utils';
import { generateJsQueryFromSimpleParams } from '../../../shared/utils/queryUtils';

// Sub-components
import QueryBar from './QueryBar';
import JsQueryEditor from './JsQueryEditor';
import FilterSortToolbar from './FilterSortToolbar';
import ViewTabs from './ViewTabs';
import TableView from './TableView';
import TreeView from './TreeView';
import JsonView from './JsonView';
import CreateDocumentDialog from './CreateDocumentDialog';
import SettingsDialog from '../../../app/components/SettingsDialog';

type ViewMode = SettingsState['defaultViewType'];

interface EditingCell {
  docId: string;
  field: string;
  originalValue?: FirestoreValue;
  originalType?: string;
}

interface CollectionTabProps {
  project: Project;
  collectionPath: string;
  showMessage?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * CollectionTab - Main component for Firestore collection management
 */
const CollectionTab: React.FC<CollectionTabProps> = ({ project, collectionPath, showMessage }) => {
  // Theme
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  // Settings from Redux
  const settings = useSelector((state: RootState) => selectSettings(state));
  const defaultViewType = settings.defaultViewType || 'tree';
  const defaultDocLimit = settings.defaultDocLimit || 50;

  // Favorites
  const isCollectionFavorite = useSelector((state: RootState) =>
    selectIsFavorite(state, project.projectId, collectionPath),
  );

  // Collection Data (Redux)
  const collectionKey = `${project.projectId}:${collectionPath}`;
  const collectionData = useSelector((state: RootState) => selectCollectionData(state, collectionKey));
  const {
    documents = [],
    loading = false,
    limit = 50,
    jsQuery = '',
    filters = [],
    sortConfig = { field: null, direction: 'asc' },
    queryMode = 'simple',
  } = collectionData || {};

  const initialFetchRef = useRef<{ key: string; inFlight: boolean; done: boolean }>({
    key: '',
    inFlight: false,
    done: false,
  });

  useEffect(() => {
    if (initialFetchRef.current.key !== collectionKey) {
      initialFetchRef.current = { key: collectionKey, inFlight: false, done: false };
    }
  }, [collectionKey]);

  const showError = useCallback(
    (error: unknown) => {
      if (typeof error === 'string' && error === 'Aborted due to condition callback returning false.') return;
      if (error && typeof error === 'object') {
        const maybeName = (error as { name?: unknown }).name;
        const maybeMessage = (error as { message?: unknown }).message;
        if (maybeName === 'ConditionError') return;
        if (maybeMessage === 'Aborted due to condition callback returning false.') return;
      }
      showMessage?.(getErrorMessage(error), 'error');
    },
    [showMessage],
  );

  // Initialize state and load documents
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      dispatch(initCollectionState({ key: collectionKey, defaultLimit: defaultDocLimit }));
      if ((collectionData?.lastFetchedAt ?? 0) > 0) {
        initialFetchRef.current.done = true;
        return;
      }
      if (initialFetchRef.current.inFlight || initialFetchRef.current.done) return;
      initialFetchRef.current.inFlight = true;
      try {
        await dispatch(fetchDocuments({ project, collection: collectionPath, key: collectionKey })).unwrap();
        initialFetchRef.current.done = true;
      } catch (error: unknown) {
        if (!isMounted) return;
        showError(error);
      } finally {
        initialFetchRef.current.inFlight = false;
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [dispatch, collectionKey, project, collectionPath, defaultDocLimit, showError, collectionData?.lastFetchedAt]);

  // Wrapped Setters
  const setLimit = useCallback(
    (next: string | number) => {
      const parsed = typeof next === 'number' ? next : parseInt(next, 10);
      const safeLimit = Number.isFinite(parsed) ? parsed : 50;
      dispatch(setCollectionLimit({ key: collectionKey, limit: Math.max(1, safeLimit) }));
    },
    [dispatch, collectionKey],
  );

  const setJsQuery = useCallback(
    (query: string) => {
      dispatch(setCollectionJsQuery({ key: collectionKey, query }));
    },
    [dispatch, collectionKey],
  );

  const setQueryModeAction = useCallback(
    (mode: 'simple' | 'js') => {
      dispatch(setCollectionQueryMode({ key: collectionKey, mode }));
    },
    [dispatch, collectionKey],
  );

  const syncJsQuery = useCallback(
    (nextFilters: Filter[], nextSort: SortConfig) => {
      const query = generateJsQueryFromSimpleParams(collectionPath, nextFilters, nextSort, limit);
      dispatch(setCollectionJsQuery({ key: collectionKey, query }));
    },
    [dispatch, collectionKey, collectionPath, limit],
  );

  const setFilters = useCallback(
    (nextFilters: Filter[]) => {
      dispatch(setCollectionFilters({ key: collectionKey, filters: nextFilters }));
      syncJsQuery(nextFilters, sortConfig);
    },
    [dispatch, collectionKey, sortConfig, syncJsQuery],
  );

  const setSortConfig = useCallback(
    (config: SortConfig) => {
      dispatch(setCollectionSort({ key: collectionKey, config }));
      syncJsQuery(filters, config);
    },
    [dispatch, collectionKey, filters, syncJsQuery],
  );

  // Load Documents
  const loadDocuments = useCallback(async () => {
    try {
      await dispatch(fetchDocuments({ project, collection: collectionPath, key: collectionKey })).unwrap();
    } catch (error) {
      showError(error);
    }
  }, [dispatch, project, collectionPath, collectionKey, showError]);

  // Execute JS Query (Same thunk, just ensures state is ready)
  const executeJsQuery = useCallback(async () => {
    try {
      await dispatch(fetchDocuments({ project, collection: collectionPath, key: collectionKey })).unwrap();
    } catch (error) {
      showError(error);
    }
  }, [dispatch, project, collectionPath, collectionKey, showError]);

  // Import/Export Wrappers
  const saveDocumentsFromJson = useCallback(
    async (docsData: Record<string, DocumentData>) => {
      // We can use a thunk or loop updates. For now loop updates or importCollection if it supports overwrites?
      // importCollection does overwrite (setDocument).
      // Let's use importCollection
      const result = await dispatch(importCollection({ project, collection: collectionPath, data: docsData })).unwrap();
      if (result?.count != null) {
        showMessage?.(`Imported ${result.count} documents`, 'success');
      } else {
        showMessage?.('Import completed', 'success');
      }
      await loadDocuments();
    },
    [dispatch, project, collectionPath, loadDocuments, showMessage],
  );

  const handleExportCollection = useCallback(async () => {
    if (project.authMethod === 'google') {
      // Client-side export for Google
      if (documents.length === 0) {
        showMessage?.('No documents to export', 'warning');
        return { success: false };
      }
      const exportData: Record<string, DocumentData> = {};
      documents.forEach((doc: Document) => {
        exportData[doc.id] = doc.data;
      });
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${collectionPath.replace(/\//g, '_')}_export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showMessage?.(`Exported ${documents.length} documents`, 'success');
      return { success: true };
    } else {
      // SA Export
      const result = await dispatch(exportCollection({ project, collection: collectionPath })).unwrap();
      if (result?.filePath) {
        showMessage?.(`Exported to ${result.filePath}`, 'success');
      } else if (result?.success) {
        showMessage?.('Export completed', 'success');
      }
      return result;
    }
  }, [dispatch, project, collectionPath, documents, showMessage]);

  const handleImportDocuments = useCallback(async () => {
    if (project.authMethod === 'google') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event: Event) => {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) {
            resolve({ success: false });
            return;
          }
          try {
            const text = await file.text();
            const data = JSON.parse(text) as Record<string, DocumentData>;
            await dispatch(importCollection({ project, collection: collectionPath, data })).unwrap();
            await loadDocuments();
            resolve({ success: true });
          } catch (err: unknown) {
            const message = getErrorMessage(err, 'Invalid JSON');
            showMessage?.(`Invalid JSON: ${message}`, 'error');
            resolve({ success: false, error: message });
          }
        };
        input.click();
      });
    } else {
      const res = await dispatch(importCollection({ project, collection: collectionPath })).unwrap(); // SA import logic in thunk calls API which opens dialog?
      // Wait, SA import in thunk uses window.electronAPI.importDocuments which usually opens dialog in main process.
      // But thunk I wrote calls importDocuments(collection).
      await loadDocuments();
      return res;
    }
  }, [dispatch, project, collectionPath, loadDocuments, showMessage]);

  // Helper ref for shortcuts
  const queryModeRef = useRef(queryMode);

  // Sync query mode with ref for keyboard shortcuts
  useEffect(() => {
    queryModeRef.current = queryMode;
  }, [queryMode]);

  // Local UI State
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewType);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [filterText, setFilterText] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [jsonEditData, setJsonEditData] = useState('');
  const [jsonHasChanges, setJsonHasChanges] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDocId, setNewDocId] = useState('');
  const [newDocData, setNewDocData] = useState('{}');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>({});
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Initialize expanded nodes when documents load
  useEffect(() => {
    if (documents.length > 0) {
      setExpandedNodes({ [collectionPath]: true });
    }
  }, [documents, collectionPath]);

  // Update JSON edit data when switching to JSON view
  useEffect(() => {
    if (viewMode === 'json') {
      setJsonEditData(JSON.stringify(documentsToJson(documents), null, 2));
      setJsonHasChanges(false);
    }
  }, [viewMode, documents]);

  // F5 keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (queryModeRef.current === 'js') {
          executeJsQuery();
        } else {
          loadDocuments();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeJsQuery, loadDocuments]);

  // Computed values
  const allFields = useMemo(() => extractAllFields(documents), [documents]);

  const visibleFields = useMemo(() => getVisibleFields(allFields, hiddenColumns), [allFields, hiddenColumns]);

  // Only use searchText for local filtering - filters are applied server-side
  const filteredDocs = useMemo(
    () =>
      processDocuments(documents, {
        filters: [],
        searchText: filterText,
        sortConfig: { field: '', direction: 'asc' },
      }),
    [documents, filterText],
  );

  // Event Handlers
  const handleRunQuery = useCallback(async () => {
    if (queryMode === 'simple') {
      await loadDocuments();
    } else {
      await executeJsQuery();
    }
  }, [queryMode, loadDocuments, executeJsQuery]);

  const handleToggleFavorite = useCallback(() => {
    dispatch(
      toggleFavorite({
        projectId: project?.projectId,
        projectName: project?.projectId, // or name if available
        collectionPath,
      }),
    );

    // Optimistic UI update message
    // Ideally we check state, but toggle is straightforward
    showMessage?.(
      !isCollectionFavorite ? `Added ${collectionPath} to favorites` : `Removed ${collectionPath} from favorites`,
      'info',
    );
  }, [dispatch, project?.projectId, collectionPath, showMessage, isCollectionFavorite]);

  const toggleNode = useCallback((path: string) => {
    setExpandedNodes((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  // Cell Editing Handlers
  const handleCellEdit = useCallback((docId: string | null, field: string | null, value: FirestoreValue) => {
    // If called with null values, clear editing state (cancel operation)
    if (docId === null || field === null) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    const type = getValueType(value);
    // Store original value for type preservation when saving
    setEditingCell({ docId, field, originalValue: value, originalType: type });
    setEditValue(serializeForEdit(value, type));
  }, []);

  // Save cell - can pass explicit docId, field, value for direct saving (avoids stale closure issues)
  const handleCellSave = useCallback(
    async (explicitDocId?: string, explicitField?: string, explicitValue?: FirestoreValue) => {
      // Use explicit values if provided, otherwise use state
      const docId = explicitDocId || editingCell?.docId;
      const field = explicitField || editingCell?.field;

      if (!docId || !field) return;

      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;

      const oldValue = editingCell?.originalValue ?? doc.data?.[field];

      // Determine the new value - use explicit if provided, otherwise parse editValue
      let newValue: FirestoreValue;
      if (explicitValue !== undefined) {
        newValue = explicitValue;
      } else {
        newValue = parseEditValue(editValue);

        // Preserve original type for timestamps
        if (isFirestoreTimestamp(oldValue) && typeof newValue === 'string' && isIsoDateString(newValue)) {
          const date = new Date(newValue);
          newValue = {
            _seconds: Math.floor(date.getTime() / 1000),
            _nanoseconds: 0,
          };
        } else if (isUnixTimestampMs(oldValue) && typeof newValue === 'string' && isIsoDateString(newValue)) {
          const date = new Date(newValue);
          newValue = date.getTime();
        }
      }

      // Skip if unchanged
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        setEditingCell(null);
        return;
      }

      const newData = { ...doc.data, [field]: newValue };

      try {
        await dispatch(
          updateDocument({
            project,
            collection: collectionPath,
            docId,
            docData: newData, // The thunk expects docData... wait.
          }),
        ).unwrap();
        showMessage?.(`Updated document ${docId}`, 'success');
      } catch (error) {
        showError(error);
      }

      setEditingCell(null);
    },
    [editingCell, editValue, documents, dispatch, project, collectionPath, showMessage, showError],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCellSave();
      }
      if (e.key === 'Escape') {
        setEditingCell(null);
      }
    },
    [handleCellSave],
  );

  // JSON Save Handler
  const handleJsonSave = useCallback(async () => {
    try {
      const newDocsData = JSON.parse(jsonEditData);
      await saveDocumentsFromJson(newDocsData);
      setJsonHasChanges(false);
    } catch (error: unknown) {
      showError(error);
    }
  }, [jsonEditData, saveDocumentsFromJson, showError]);

  // Create Document Handler
  const handleCreateDocument = useCallback(async () => {
    try {
      // Validate JSON first
      JSON.parse(newDocData);

      // Dispatch thunk - addDocument expects JSON STRING
      const createdId = await dispatch(
        addDocument({
          project,
          collection: collectionPath,
          docId: newDocId,
          docData: newDocData, // string
        }),
      ).unwrap();

      setCreateDialogOpen(false);
      setNewDocId('');
      setNewDocData('{}');
      if (createdId) {
        showMessage?.(`Created document ${createdId}`, 'success');
      } else {
        showMessage?.('Created document', 'success');
      }
    } catch (error: unknown) {
      showError(error);
    }
  }, [newDocId, newDocData, dispatch, project, collectionPath, showMessage, showError]);

  // Delete Selected Documents Handler
  const handleDeleteSelected = useCallback(async () => {
    if (selectedRows.length === 0) return;

    setDeleteLoading(true);
    showMessage?.(`Deleting ${selectedRows.length} document(s)...`, 'info');

    try {
      let successCount = 0;
      let failCount = 0;

      for (const docId of selectedRows) {
        try {
          await dispatch(
            deleteDocument({
              project,
              collection: collectionPath,
              docId,
            }),
          ).unwrap();
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        showMessage?.(
          `Deleted ${successCount} document(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
          successCount === selectedRows.length ? 'success' : 'warning',
        );
      } else {
        showMessage?.('Failed to delete documents', 'error');
      }

      // Clear selection (refresh handled by event listener)
      setSelectedRows([]);
      setDeleteDialogOpen(false);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedRows, project, collectionPath, showMessage, dispatch, showError]);

  // Type utility wrappers for child components
  const getType = useCallback((value: FirestoreValue) => getValueType(value), []);
  const formatValue = useCallback((value: FirestoreValue, type: string) => formatDisplayValue(value, type), []);
  const getColor = useCallback(
    (type: string) => getTypeColor(type, theme.palette.mode === 'dark'),
    [theme.palette.mode],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* Query Bar */}
      <QueryBar
        queryMode={queryMode}
        setQueryMode={setQueryModeAction}
        project={project}
        isCollectionFavorite={isCollectionFavorite}
        onToggleFavorite={handleToggleFavorite}
        onRunQuery={handleRunQuery}
        limit={limit}
        setLimit={setLimit}
      />

      {/* JS Query Editor */}
      {queryMode === 'js' && (
        <JsQueryEditor
          jsQuery={jsQuery}
          setJsQuery={setJsQuery}
          projectId={project?.projectId}
          collectionPath={collectionPath}
          fieldNames={allFields}
        />
      )}

      {/* Collection Path Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          gap: 1,
        }}
      >
        <CollectionIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
        <Typography sx={{ fontSize: '0.8rem', color: 'text.primary' }}>{collectionPath}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          sx={{ width: 150 }}
          InputProps={{ sx: { fontSize: '0.8rem', height: 28 } }}
        />
      </Box>

      {/* Filter and Sort Toolbar */}
      {queryMode === 'simple' && (
        <FilterSortToolbar
          filters={filters}
          setFilters={setFilters}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          allFields={allFields}
          onApply={executeJsQuery}
        />
      )}

      {/* View Tabs */}
      <ViewTabs
        viewMode={viewMode}
        setViewMode={setViewMode}
        documentsCount={documents.length}
        onRefresh={loadDocuments}
        onExport={handleExportCollection}
        onImport={handleImportDocuments}
        onAdd={() => setCreateDialogOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
        allFields={allFields}
        visibleFields={visibleFields}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
        selectedRowsCount={selectedRows.length}
      />

      {/* Content Area */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {viewMode === 'table' && (
              <TableView
                documents={filteredDocs}
                visibleFields={visibleFields}
                editingCell={editingCell}
                editValue={editValue}
                setEditValue={setEditValue}
                onCellEdit={handleCellEdit}
                onCellSave={handleCellSave}
                onCellKeyDown={handleCellKeyDown}
                columnWidths={columnWidths}
                setColumnWidths={setColumnWidths}
                getType={getType}
                getTypeColor={getColor}
                formatValue={formatValue}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
              />
            )}

            {viewMode === 'tree' && (
              <TreeView
                collectionPath={collectionPath}
                documents={documents}
                expandedNodes={expandedNodes}
                toggleNode={toggleNode}
                editingCell={editingCell}
                editValue={editValue}
                setEditValue={setEditValue}
                onCellEdit={handleCellEdit}
                onCellSave={() => {
                  handleCellSave();
                }} // Explicitly call handleCellSave
                onCellKeyDown={handleCellKeyDown}
                getType={getType}
                getTypeColor={getColor}
                formatValue={formatValue}
              />
            )}

            {viewMode === 'json' && (
              <JsonView
                jsonEditData={jsonEditData}
                setJsonEditData={setJsonEditData}
                jsonHasChanges={jsonHasChanges}
                setJsonHasChanges={setJsonHasChanges}
                onSave={handleJsonSave}
              />
            )}
          </>
        )}
      </Box>

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        newDocId={newDocId}
        setNewDocId={setNewDocId}
        newDocData={newDocData}
        setNewDocData={setNewDocData}
        onCreate={handleCreateDocument}
      />

      {/* Settings Dialog */}
      <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleteLoading && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ color: 'error.main' }}>
          Delete {selectedRows.length} Document{selectedRows.length > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedRows.length} selected document
            {selectedRows.length > 1 ? 's' : ''}? This action cannot be undone.
          </DialogContentText>
          {selectedRows.length <= 10 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Documents to be deleted:
              </Typography>
              {selectedRows.map((docId) => (
                <Typography key={docId} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  • {docId}
                </Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSelected}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CollectionTab;
