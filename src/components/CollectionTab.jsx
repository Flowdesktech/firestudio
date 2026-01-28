/**
 * CollectionTab Component
 * Main container for viewing and managing Firestore collection documents
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, TextField, CircularProgress, useTheme } from '@mui/material';
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

/**
 * Theme configuration for consistent styling
 */
const useThemeColors = (isDark) => ({
    borderColor: isDark ? '#333' : '#e0e0e0',
    bgColor: isDark ? '#1e1e1e' : '#fafafa',
    hoverBg: isDark ? '#333' : '#f5f5f5',
    textColor: isDark ? '#ccc' : '#333',
    mutedColor: isDark ? '#888' : '#666'
});

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
    const isDark = theme.palette.mode === 'dark';
    const colors = useThemeColors(isDark);

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

    // Type utility wrappers for child components
    const getType = useCallback((value) => getValueType(value), []);
    const formatValue = useCallback((value, type) => formatDisplayValue(value, type), []);
    const getColor = useCallback((type) => getTypeColor(type, isDark), [isDark]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: isDark ? '#1e1e1e' : '#fff'
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
                isDark={isDark}
                borderColor={colors.borderColor}
                bgColor={colors.bgColor}
            />

            {/* JS Query Editor */}
            {queryMode === 'js' && (
                <JsQueryEditor
                    jsQuery={jsQuery}
                    setJsQuery={setJsQuery}
                    isDark={isDark}
                    borderColor={colors.borderColor}
                />
            )}

            {/* Collection Path Bar */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderBottom: `1px solid ${colors.borderColor}`,
                gap: 1
            }}>
                <CollectionIcon sx={{ fontSize: 16, color: colors.mutedColor, ml: 1 }} />
                <Typography sx={{ fontSize: '0.8rem', color: colors.textColor }}>
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
                    isDark={isDark}
                    borderColor={colors.borderColor}
                    textColor={colors.textColor}
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
                allFields={allFields}
                visibleFields={visibleFields}
                hiddenColumns={hiddenColumns}
                setHiddenColumns={setHiddenColumns}
                isDark={isDark}
                borderColor={colors.borderColor}
                textColor={colors.textColor}
                mutedColor={colors.mutedColor}
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
                                isDark={isDark}
                                borderColor={colors.borderColor}
                                bgColor={colors.bgColor}
                                textColor={colors.textColor}
                                mutedColor={colors.mutedColor}
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
                                isDark={isDark}
                                borderColor={colors.borderColor}
                                bgColor={colors.bgColor}
                                textColor={colors.textColor}
                                mutedColor={colors.mutedColor}
                                hoverBg={colors.hoverBg}
                            />
                        )}

                        {viewMode === 'json' && (
                            <JsonView
                                jsonEditData={jsonEditData}
                                setJsonEditData={setJsonEditData}
                                jsonHasChanges={jsonHasChanges}
                                setJsonHasChanges={setJsonHasChanges}
                                onSave={handleJsonSave}
                                borderColor={colors.borderColor}
                                bgColor={colors.bgColor}
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
        </Box>
    );
}

export default CollectionTab;
