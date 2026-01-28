/**
 * CollectionViewer Component
 * Displays and manages documents in a Firestore collection with table, tree, and JSON views
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Tooltip,
    CircularProgress,
    Chip,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Menu,
    MenuItem,
    ListItemIcon,
} from '@mui/material';
import {
    Save as SaveIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    ViewList as TableIcon,
    AccountTree as TreeIcon,
    Code as JsonIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    MoreVert as MoreVertIcon,
    FileDownload as ExportIcon,
    FileUpload as ImportIcon,
} from '@mui/icons-material';

// Utilities
import {
    getValueType,
    formatDisplayValue,
    parseEditValue,
    extractAllFields,
    documentsToJson
} from '../utils';

/**
 * Theme colors for field types
 */
const TYPE_COLORS = {
    String: '#4caf50',
    Integer: '#2196f3',
    Number: '#2196f3',
    Boolean: '#ff9800',
    Null: '#9e9e9e',
    Undefined: '#9e9e9e',
    Array: '#e91e63',
    Map: '#9c27b0',
    Timestamp: '#00bcd4',
    GeoPoint: '#ff5722',
};

const getFieldColor = (type) => TYPE_COLORS[type] || '#fff';

function CollectionViewer({
    collectionPath,
    documents,
    onRefresh,
    onUpdateDocument,
    onDeleteDocument,
    onCreateDocument,
    onExport,
    onImport,
    loading,
    addLog,
}) {
    // State
    const [activeTab, setActiveTab] = useState(0);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [expandedDocs, setExpandedDocs] = useState({});
    const [jsonEditData, setJsonEditData] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newDocId, setNewDocId] = useState('');
    const [newDocData, setNewDocData] = useState('{\n  \n}');
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null);

    // Computed values
    const allFields = useMemo(() => extractAllFields(documents), [documents]);

    // Initialize JSON edit data when switching to JSON tab
    useEffect(() => {
        if (activeTab === 2) {
            setJsonEditData(JSON.stringify(documentsToJson(documents), null, 2));
            setJsonError('');
        }
    }, [activeTab, documents]);

    // Format value for display
    const formatValue = useCallback((value, type) => {
        if (type === 'Array' || type === 'Map') return JSON.stringify(value);
        return formatDisplayValue(value, type);
    }, []);

    // Cell editing handlers
    const handleCellEdit = useCallback((docId, field, value) => {
        const type = getValueType(value);
        setEditingCell({ docId, field });
        setEditValue(formatValue(value, type));
    }, [formatValue]);

    const handleCellSave = useCallback(async () => {
        if (!editingCell) return;

        const doc = documents.find(d => d.id === editingCell.docId);
        if (!doc) return;

        const newValue = parseEditValue(editValue);
        const newData = { ...doc.data, [editingCell.field]: newValue };

        await onUpdateDocument(doc.path, newData);
        setEditingCell(null);
        addLog?.('success', `Updated ${editingCell.docId}.${editingCell.field}`);
    }, [editingCell, editValue, documents, onUpdateDocument, addLog]);

    const handleCellKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCellSave();
        }
        if (e.key === 'Escape') {
            setEditingCell(null);
        }
    }, [handleCellSave]);

    // JSON handlers
    const handleJsonSave = useCallback(async () => {
        if (jsonError) return;

        try {
            const newDocsData = JSON.parse(jsonEditData);

            for (const [docId, data] of Object.entries(newDocsData)) {
                const doc = documents.find(d => d.id === docId);
                if (doc) {
                    await onUpdateDocument(doc.path, data);
                }
            }

            addLog?.('success', 'JSON changes saved');
            onRefresh();
        } catch (err) {
            addLog?.('error', 'Failed to save JSON: ' + err.message);
        }
    }, [jsonError, jsonEditData, documents, onUpdateDocument, onRefresh, addLog]);

    const handleJsonChange = useCallback((value) => {
        setJsonEditData(value);
        try {
            JSON.parse(value);
            setJsonError('');
        } catch (err) {
            setJsonError(err.message);
        }
    }, []);

    // Document handlers
    const handleCreateDocument = useCallback(async () => {
        try {
            const data = JSON.parse(newDocData);
            await onCreateDocument(collectionPath, newDocId, data);
            setCreateDialogOpen(false);
            setNewDocId('');
            setNewDocData('{\n  \n}');
            addLog?.('success', `Created document ${newDocId || '(auto-id)'}`);
        } catch (err) {
            addLog?.('error', 'Invalid JSON: ' + err.message);
        }
    }, [newDocData, newDocId, collectionPath, onCreateDocument, addLog]);

    const handleDeleteDocument = useCallback(async () => {
        if (docToDelete) {
            await onDeleteDocument(docToDelete.path);
            setDeleteDialogOpen(false);
            setDocToDelete(null);
            addLog?.('success', `Deleted document ${docToDelete.id}`);
        }
    }, [docToDelete, onDeleteDocument, addLog]);

    const toggleDocExpand = useCallback((docId) => {
        setExpandedDocs(prev => ({ ...prev, [docId]: !prev[docId] }));
    }, []);

    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
        addLog?.('info', `Copied: ${text}`);
    }, [addLog]);

    // Render Tree Node
    const renderTreeNode = (key, value, path, docId, depth = 0) => {
        const type = getValueType(value);
        const color = getFieldColor(type);
        const isExpandable = type === 'Map' || type === 'Array';
        const nodePath = `${docId}.${path}`;
        const isExpanded = expandedDocs[nodePath];
        const isEditing = editingCell?.docId === docId && editingCell?.field === path;

        return (
            <Box key={nodePath}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 0.5,
                        pl: depth * 2,
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                    }}
                >
                    {isExpandable ? (
                        <IconButton
                            size="small"
                            onClick={() => toggleDocExpand(nodePath)}
                            sx={{ p: 0, mr: 0.5 }}
                        >
                            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                    ) : (
                        <Box sx={{ width: 24, mr: 0.5 }} />
                    )}
                    <Typography
                        component="span"
                        sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#888', mr: 1, minWidth: 100 }}
                    >
                        {key}
                    </Typography>
                    <Chip
                        label={type}
                        size="small"
                        sx={{
                            backgroundColor: `${color}20`,
                            color: color,
                            fontSize: '0.6rem',
                            height: 16,
                            mr: 1,
                        }}
                    />
                    {!isExpandable && (
                        isEditing ? (
                            <TextField
                                size="small"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={handleCellKeyDown}
                                autoFocus
                                sx={{
                                    flexGrow: 1,
                                    '& .MuiInputBase-input': {
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        py: 0.5,
                                        color: color,
                                    },
                                }}
                            />
                        ) : (
                            <Typography
                                component="span"
                                onClick={() => handleCellEdit(docId, path, value)}
                                sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    color: color,
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                    flexGrow: 1,
                                }}
                            >
                                {formatValue(value, type)}
                            </Typography>
                        )
                    )}
                </Box>
                {isExpandable && isExpanded && value && (
                    <Box>
                        {Object.entries(value).map(([k, v]) =>
                            renderTreeNode(k, v, `${path}.${k}`, docId, depth + 1)
                        )}
                    </Box>
                )}
            </Box>
        );
    };

    // Table View
    const renderTableView = () => (
        <TableContainer sx={{ maxHeight: '100%', flexGrow: 1 }}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <TableCell
                            sx={{
                                backgroundColor: '#0f1729',
                                color: '#ff9800',
                                fontWeight: 600,
                                minWidth: 150,
                                position: 'sticky',
                                left: 0,
                                zIndex: 3,
                            }}
                        >
                            Document ID
                        </TableCell>
                        {allFields.map(field => (
                            <TableCell
                                key={field}
                                sx={{
                                    backgroundColor: '#0f1729',
                                    color: '#ff9800',
                                    fontWeight: 600,
                                    minWidth: 120,
                                }}
                            >
                                {field}
                            </TableCell>
                        ))}
                        <TableCell
                            sx={{
                                backgroundColor: '#0f1729',
                                color: '#ff9800',
                                fontWeight: 600,
                                width: 80,
                            }}
                        >
                            Actions
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {documents.map((doc) => (
                        <TableRow
                            key={doc.id}
                            sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' } }}
                        >
                            <TableCell
                                sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    borderBottom: '1px solid #1e3a5f',
                                    backgroundColor: '#0f1729',
                                    position: 'sticky',
                                    left: 0,
                                    color: '#2196f3',
                                    fontWeight: 600,
                                }}
                            >
                                <Tooltip title="Copy ID">
                                    <Box
                                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                        onClick={() => copyToClipboard(doc.id)}
                                    >
                                        {doc.id}
                                    </Box>
                                </Tooltip>
                            </TableCell>
                            {allFields.map(field => {
                                const value = doc.data?.[field];
                                const type = getValueType(value);
                                const color = getFieldColor(type);
                                const isEditing = editingCell?.docId === doc.id && editingCell?.field === field;

                                return (
                                    <TableCell
                                        key={field}
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                            borderBottom: '1px solid #1e3a5f',
                                            color: color,
                                            maxWidth: 200,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {isEditing ? (
                                            <TextField
                                                size="small"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleCellKeyDown}
                                                autoFocus
                                                fullWidth
                                                multiline={type === 'Map' || type === 'Array'}
                                                maxRows={4}
                                                sx={{
                                                    '& .MuiInputBase-input': {
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.8rem',
                                                        py: 0.5,
                                                    },
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                onClick={() => handleCellEdit(doc.id, field, value)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1 },
                                                    p: 0.5,
                                                    minHeight: 24,
                                                }}
                                            >
                                                {value === undefined ? (
                                                    <Typography sx={{ color: '#444', fontStyle: 'italic' }}>—</Typography>
                                                ) : (
                                                    formatValue(value, type)
                                                )}
                                            </Box>
                                        )}
                                    </TableCell>
                                );
                            })}
                            <TableCell sx={{ borderBottom: '1px solid #1e3a5f' }}>
                                <Tooltip title="Delete">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setDocToDelete(doc);
                                            setDeleteDialogOpen(true);
                                        }}
                                        sx={{ color: '#f44336' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    // Tree View
    const renderTreeView = () => (
        <Box sx={{ p: 2, overflow: 'auto', flexGrow: 1 }}>
            {documents.map((doc) => (
                <Paper
                    key={doc.id}
                    sx={{
                        mb: 2,
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #1e3a5f',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: 1,
                            borderBottom: '1px solid #1e3a5f',
                            backgroundColor: '#0f1729',
                        }}
                    >
                        <IconButton
                            size="small"
                            onClick={() => toggleDocExpand(doc.id)}
                            sx={{ mr: 1 }}
                        >
                            {expandedDocs[doc.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                        <Typography
                            sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                color: '#2196f3',
                                fontWeight: 600,
                                flexGrow: 1,
                            }}
                        >
                            {doc.id}
                        </Typography>
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setDocToDelete(doc);
                                    setDeleteDialogOpen(true);
                                }}
                                sx={{ color: '#666' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {expandedDocs[doc.id] && doc.data && (
                        <Box sx={{ p: 1 }}>
                            {Object.entries(doc.data).map(([key, value]) =>
                                renderTreeNode(key, value, key, doc.id)
                            )}
                        </Box>
                    )}
                </Paper>
            ))}
        </Box>
    );

    // JSON View
    const renderJsonView = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 1, borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleJsonSave}
                    disabled={!!jsonError || loading}
                >
                    Save Changes
                </Button>
            </Box>
            <textarea
                value={jsonEditData}
                onChange={(e) => handleJsonChange(e.target.value)}
                disabled={loading}
                style={{
                    flexGrow: 1,
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#1a1a2e',
                    color: '#fff',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    resize: 'none',
                }}
            />
            {jsonError && (
                <Box sx={{ p: 1, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderTop: '1px solid #f44336' }}>
                    <Typography variant="caption" sx={{ color: '#f44336' }}>
                        {jsonError}
                    </Typography>
                </Box>
            )}
        </Box>
    );

    // Empty state
    if (!collectionPath) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    color: '#666',
                }}
            >
                <Typography variant="h6" sx={{ opacity: 0.5 }}>
                    Select a collection to view documents
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box
                sx={{
                    p: 1.5,
                    borderBottom: '1px solid #1e3a5f',
                    backgroundColor: '#0f1729',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', color: '#ff9800' }}>
                        {collectionPath}
                    </Typography>
                    <Chip
                        label={`${documents.length} docs`}
                        size="small"
                        sx={{ ml: 2, backgroundColor: 'rgba(33, 150, 243, 0.2)', color: '#2196f3' }}
                    />
                </Box>
                <Box>
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={onRefresh} disabled={loading}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Add Document">
                        <IconButton size="small" onClick={() => setCreateDialogOpen(true)} disabled={loading}>
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="More">
                        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #1e3a5f' }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{
                        minHeight: 36,
                        '& .MuiTab-root': { textTransform: 'none', minHeight: 36, minWidth: 80, py: 0 },
                    }}
                >
                    <Tab icon={<TableIcon fontSize="small" />} iconPosition="start" label="Table" />
                    <Tab icon={<TreeIcon fontSize="small" />} iconPosition="start" label="Tree" />
                    <Tab icon={<JsonIcon fontSize="small" />} iconPosition="start" label="JSON" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {loading && documents.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                        <CircularProgress />
                    </Box>
                ) : documents.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                        <Typography sx={{ color: '#666', mb: 2 }}>No documents in this collection</Typography>
                        <Button startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                            Add Document
                        </Button>
                    </Box>
                ) : (
                    <>
                        {activeTab === 0 && renderTableView()}
                        {activeTab === 1 && renderTreeView()}
                        {activeTab === 2 && renderJsonView()}
                    </>
                )}
            </Box>

            {/* Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{ sx: { backgroundColor: '#1a1a2e' } }}
            >
                <MenuItem onClick={() => { setMenuAnchor(null); onExport(); }}>
                    <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
                    Export Collection
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); onImport(); }}>
                    <ListItemIcon><ImportIcon fontSize="small" /></ListItemIcon>
                    Import Documents
                </MenuItem>
            </Menu>

            {/* Create Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { backgroundColor: '#16213e', backgroundImage: 'none' } }}
            >
                <DialogTitle>Create New Document</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Document ID (optional)"
                        value={newDocId}
                        onChange={(e) => setNewDocId(e.target.value)}
                        placeholder="Auto-generated if left empty"
                        size="small"
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="Document Data (JSON)"
                        value={newDocData}
                        onChange={(e) => setNewDocData(e.target.value)}
                        multiline
                        rows={10}
                        sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateDocument}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#16213e', backgroundImage: 'none' } }}
            >
                <DialogTitle>Delete Document?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: '#aaa' }}>
                        Are you sure you want to delete "{docToDelete?.id}"? This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteDocument} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default CollectionViewer;
