/**
 * CollectionTab Component
 * Main container for viewing and managing Firestore collection documents
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Button
} from '@mui/material';
import { Storage as CollectionIcon } from '@mui/icons-material';

// Context
import { useFavorites } from '../context/FavoritesContext';

// Custom Hooks
import { useCollectionData } from '../hooks';

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
    createDefaultSortConfig
} from '../utils';

// Sub-components
import {
    QueryBar,
    JsQueryEditor,
    FilterSortToolbar,
    ViewTabs,
    TableView,
    TreeView,
    JsonView,
    CreateDocumentDialog,
} from './collection';
import SettingsDialog from './SettingsDialog';

/**
 * Theme configuration for consistent styling
 */
// Theme configuration removed - using MUI theme directly

/**
 * CollectionTab - Main component for Firestore collection management
 */
function CollectionTab({
    project,
    collectionPath,
    addLog,
    showMessage,
    defaultViewType = 'tree',
    defaultDocLimit = 50
}) {
    // Theme
    const theme = useTheme();

    // Favorites
    const { isFavorite, toggleFavorite } = useFavorites();
    const isCollectionFavorite = isFavorite(project?.projectId, collectionPath);

    // Collection Data Hook
    const {
        documents,
        loading,
        limit,
        jsQuery,
        setLimit,
        setJsQuery,
        setQueryModeRef,
        loadDocuments,
        executeJsQuery,
        updateDocument,
        createDocument,
        saveDocumentsFromJson,
        exportCollection,
        importDocuments,
        queryModeRef
    } = useCollectionData(project, collectionPath, {
        defaultLimit: defaultDocLimit,
        addLog,
        showMessage
    });

    // Local UI State
    const [viewMode, setViewMode] = useState(defaultViewType);
    const [queryMode, setQueryMode] = useState('simple');
    const [expandedNodes, setExpandedNodes] = useState({});
    const [filterText, setFilterText] = useState('');
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [jsonEditData, setJsonEditData] = useState('');
    const [jsonHasChanges, setJsonHasChanges] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newDocId, setNewDocId] = useState('');
    const [newDocData, setNewDocData] = useState('{}');
    const [columnWidths, setColumnWidths] = useState({});
    const [hiddenColumns, setHiddenColumns] = useState({});
    const [sortConfig, setSortConfig] = useState(createDefaultSortConfig());
    const [filters, setFilters] = useState([]);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Sync query mode with ref for keyboard shortcuts
    useEffect(() => {
        setQueryModeRef(queryMode);
    }, [queryMode, setQueryModeRef]);

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
        const handleKeyDown = (e) => {
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
    }, [executeJsQuery, loadDocuments, queryModeRef]);

    // Listen for refresh-collection events from App
    useEffect(() => {
        const handleRefreshCollection = (e) => {
            const { projectId, collectionPath: eventCollectionPath } = e.detail || {};
            // Only refresh if this is the collection being refreshed
            if (projectId === project?.projectId && eventCollectionPath === collectionPath) {
                loadDocuments();
            }
        };

        window.addEventListener('refresh-collection', handleRefreshCollection);
        return () => window.removeEventListener('refresh-collection', handleRefreshCollection);
    }, [project?.projectId, collectionPath, loadDocuments]);

    // Listen for load-query events to load saved queries
    useEffect(() => {
        const handleLoadQuery = (e) => {
            const { query } = e.detail || {};
            if (query) {
                // Switch to JS query mode and load the query
                setQueryMode('js');
                setJsQuery(query);
            }
        };

        window.addEventListener('load-query', handleLoadQuery);
        return () => window.removeEventListener('load-query', handleLoadQuery);
    }, [setJsQuery]);

    // Computed values
    const allFields = useMemo(() => extractAllFields(documents), [documents]);

    const visibleFields = useMemo(
        () => getVisibleFields(allFields, hiddenColumns),
        [allFields, hiddenColumns]
    );

    const filteredDocs = useMemo(
        () => processDocuments(documents, { filters, searchText: filterText, sortConfig }),
        [documents, filters, filterText, sortConfig]
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
        const added = toggleFavorite(project?.projectId, project?.projectId, collectionPath);
        showMessage?.(
            added ? `Added ${collectionPath} to favorites` : `Removed ${collectionPath} from favorites`,
            'info'
        );
    }, [toggleFavorite, project?.projectId, collectionPath, showMessage]);

    const toggleNode = useCallback((path) => {
        setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
    }, []);

    // Cell Editing Handlers
    const handleCellEdit = useCallback((docId, field, value) => {
        const type = getValueType(value);
        setEditingCell({ docId, field });
        setEditValue(serializeForEdit(value, type));
    }, []);

    const handleCellSave = useCallback(async () => {
        if (!editingCell) return;

        const doc = documents.find(d => d.id === editingCell.docId);
        if (!doc) return;

        const newValue = parseEditValue(editValue);
        const oldValue = doc.data?.[editingCell.field];

        // Skip if unchanged
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
            setEditingCell(null);
            return;
        }

        const newData = { ...doc.data, [editingCell.field]: newValue };
        const result = await updateDocument(editingCell.docId, newData);

        if (result.success) {
            addLog?.('success', `Updated ${doc.id}.${editingCell.field}`);
        }

        setEditingCell(null);
    }, [editingCell, editValue, documents, updateDocument, addLog]);

    const handleCellKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCellSave();
        }
        if (e.key === 'Escape') {
            setEditingCell(null);
        }
    }, [handleCellSave]);

    // JSON Save Handler
    const handleJsonSave = useCallback(async () => {
        try {
            const newDocsData = JSON.parse(jsonEditData);
            await saveDocumentsFromJson(newDocsData);
            setJsonHasChanges(false);
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    }, [jsonEditData, saveDocumentsFromJson, showMessage]);

    // Create Document Handler
    const handleCreateDocument = useCallback(async () => {
        try {
            const data = JSON.parse(newDocData);
            const result = await createDocument(newDocId || null, data);

            if (result.success) {
                setCreateDialogOpen(false);
                setNewDocId('');
                setNewDocData('{}');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    }, [newDocId, newDocData, createDocument, showMessage]);

    // Delete Selected Documents Handler
    const handleDeleteSelected = useCallback(async () => {
        if (selectedRows.length === 0) return;

        setDeleteLoading(true);
        addLog?.('info', `Deleting ${selectedRows.length} document(s)...`);

        try {
            let successCount = 0;
            let failCount = 0;

            for (const docId of selectedRows) {
                try {
                    if (project?.authMethod === 'google') {
                        const result = await window.electronAPI.googleDeleteDocument({
                            projectId: project.projectId,
                            collectionPath,
                            documentId: docId
                        });
                        if (result?.success) {
                            successCount++;
                        } else {
                            failCount++;
                            addLog?.('error', `Failed to delete ${docId}: ${result?.error}`);
                        }
                    } else {
                        const result = await window.electronAPI.deleteDocument({
                            collectionPath,
                            documentId: docId
                        });
                        if (result?.success) {
                            successCount++;
                        } else {
                            failCount++;
                            addLog?.('error', `Failed to delete ${docId}: ${result?.error}`);
                        }
                    }
                } catch (error) {
                    failCount++;
                    addLog?.('error', `Error deleting ${docId}: ${error.message}`);
                }
            }

            if (successCount > 0) {
                showMessage?.(`Deleted ${successCount} document(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, successCount === selectedRows.length ? 'success' : 'warning');
            } else {
                showMessage?.('Failed to delete documents', 'error');
            }

            // Clear selection and refresh
            setSelectedRows([]);
            setDeleteDialogOpen(false);
            await loadDocuments();
        } catch (error) {
            showMessage?.(error.message, 'error');
        } finally {
            setDeleteLoading(false);
        }
    }, [selectedRows, project, collectionPath, addLog, showMessage, loadDocuments]);

    // Type utility wrappers for child components
    const getType = useCallback((value) => getValueType(value), []);
    const formatValue = useCallback((value, type) => formatDisplayValue(value, type), []);
    const getColor = useCallback((type) => getTypeColor(type, theme.palette.mode === 'dark'), [theme.palette.mode]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            bgcolor: 'background.default'
        }}>
            {/* Query Bar */}
            <QueryBar
                queryMode={queryMode}
                setQueryMode={setQueryMode}
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
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderBottom: 1,
                borderColor: 'divider',
                gap: 1
            }}>
                <CollectionIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                    {collectionPath}
                </Typography>
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
                />
            )}

            {/* View Tabs */}
            <ViewTabs
                viewMode={viewMode}
                setViewMode={setViewMode}
                documentsCount={documents.length}
                onRefresh={loadDocuments}
                onExport={exportCollection}
                onImport={importDocuments}
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
                                onCellSave={handleCellSave}
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
            <SettingsDialog
                open={settingsDialogOpen}
                onClose={() => setSettingsDialogOpen(false)}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
            >
                <DialogTitle sx={{ color: 'error.main' }}>
                    Delete {selectedRows.length} Document{selectedRows.length > 1 ? 's' : ''}?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete {selectedRows.length} selected document{selectedRows.length > 1 ? 's' : ''}?
                        This action cannot be undone.
                    </DialogContentText>
                    {selectedRows.length <= 10 && (
                        <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Documents to be deleted:
                            </Typography>
                            {selectedRows.map(docId => (
                                <Typography key={docId} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    • {docId}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        disabled={deleteLoading}
                    >
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
}

export default CollectionTab;
