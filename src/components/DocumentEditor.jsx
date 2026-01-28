/**
 * DocumentEditor Component
 * Displays and edits a single Firestore document with multiple view modes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Tooltip,
    CircularProgress,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import {
    Save as SaveIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    Description as DocumentIcon,
    Folder as FolderIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ViewList as TableIcon,
    AccountTree as TreeIcon,
    GridView as GridIcon,
    Code as JsonIcon,
} from '@mui/icons-material';

// Utilities
import { getValueType, formatDisplayValue, copyToClipboard, validateJson } from '../utils';

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

function DocumentEditor({ document, onUpdate, onDelete, loading }) {
    // State
    const [editedData, setEditedData] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [expandedNodes, setExpandedNodes] = useState({});

    // Initialize editor when document changes
    useEffect(() => {
        if (document?.data) {
            const formatted = JSON.stringify(document.data, null, 2);
            setEditedData(formatted);
            setJsonError('');
            setHasChanges(false);
            setExpandedNodes({});
        }
    }, [document]);

    // Format value for display
    const renderFieldValue = useCallback((value, type) => {
        if (type === 'Null') return 'null';
        if (type === 'String') return `"${value}"`;
        if (type === 'Boolean') return value ? 'true' : 'false';
        if (type === 'Array') return `[${value.length} items]`;
        if (type === 'Map') return `{${Object.keys(value).length} fields}`;
        return formatDisplayValue(value, type);
    }, []);

    // Event handlers
    const handleDataChange = useCallback((e) => {
        const value = e.target.value;
        setEditedData(value);
        setHasChanges(true);

        const { error } = validateJson(value);
        setJsonError(error || '');
    }, []);

    const handleSave = useCallback(() => {
        if (jsonError || !document) return;

        const { valid, data } = validateJson(editedData);
        if (valid) {
            onUpdate(document.path, data);
            setHasChanges(false);
        }
    }, [jsonError, document, editedData, onUpdate]);

    const handleDelete = useCallback(() => {
        if (document) {
            onDelete(document.path);
            setDeleteDialogOpen(false);
        }
    }, [document, onDelete]);

    const handleCopyPath = useCallback(() => {
        if (document?.path) {
            copyToClipboard(document.path);
        }
    }, [document]);

    const handleCopyData = useCallback(() => {
        copyToClipboard(editedData);
    }, [editedData]);

    const handleReset = useCallback(() => {
        if (document?.data) {
            setEditedData(JSON.stringify(document.data, null, 2));
            setJsonError('');
            setHasChanges(false);
        }
    }, [document]);

    const toggleNode = useCallback((path) => {
        setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
    }, []);

    // Tree View Renderer
    const renderTreeNode = (key, value, path = '', depth = 0) => {
        const type = getValueType(value);
        const color = getFieldColor(type);
        const isExpandable = type === 'Map' || type === 'Array';
        const nodePath = path ? `${path}.${key}` : key;
        const isExpanded = expandedNodes[nodePath];

        return (
            <Box key={nodePath}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 0.5,
                        pl: depth * 2,
                        cursor: isExpandable ? 'pointer' : 'default',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }
                    }}
                    onClick={() => isExpandable && toggleNode(nodePath)}
                >
                    {isExpandable && (
                        <IconButton size="small" sx={{ p: 0, mr: 0.5 }}>
                            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                    )}
                    {!isExpandable && <Box sx={{ width: 24, mr: 0.5 }} />}
                    <Typography
                        component="span"
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', mr: 1 }}
                    >
                        {key}:
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
                        <Typography
                            component="span"
                            sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: color }}
                        >
                            {renderFieldValue(value, type)}
                        </Typography>
                    )}
                </Box>
                {isExpandable && isExpanded && value && (
                    <Box>
                        {Object.entries(value).map(([k, v]) =>
                            renderTreeNode(k, v, nodePath, depth + 1)
                        )}
                    </Box>
                )}
            </Box>
        );
    };

    // Grid View Renderer
    const renderGridView = () => {
        if (!document?.data) return null;

        return (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 2,
                    p: 2,
                }}
            >
                {Object.entries(document.data).map(([key, value]) => {
                    const type = getValueType(value);
                    const color = getFieldColor(type);

                    return (
                        <Paper
                            key={key}
                            sx={{
                                p: 2,
                                backgroundColor: '#1a1a2e',
                                border: '1px solid #1e3a5f',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Typography
                                    sx={{
                                        fontFamily: 'monospace',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: '#fff',
                                        flexGrow: 1,
                                    }}
                                >
                                    {key}
                                </Typography>
                                <Chip
                                    label={type}
                                    size="small"
                                    sx={{
                                        backgroundColor: `${color}20`,
                                        color: color,
                                        fontSize: '0.65rem',
                                        height: 18,
                                    }}
                                />
                            </Box>
                            <Box
                                sx={{
                                    backgroundColor: '#0f1729',
                                    p: 1,
                                    borderRadius: 1,
                                    maxHeight: 100,
                                    overflow: 'auto',
                                }}
                            >
                                {type === 'Map' || type === 'Array' ? (
                                    <pre
                                        style={{
                                            margin: 0,
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            color: '#aaa',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {JSON.stringify(value, null, 2)}
                                    </pre>
                                ) : (
                                    <Typography
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem',
                                            color: color,
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {renderFieldValue(value, type)}
                                    </Typography>
                                )}
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        );
    };

    // Table View Renderer
    const renderTableView = () => {
        if (!document?.data) return null;

        return (
            <TableContainer sx={{ maxHeight: '100%' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ backgroundColor: '#0f1729', color: '#ff9800', fontWeight: 600, width: 200 }}>
                                Field
                            </TableCell>
                            <TableCell sx={{ backgroundColor: '#0f1729', color: '#ff9800', fontWeight: 600, width: 100 }}>
                                Type
                            </TableCell>
                            <TableCell sx={{ backgroundColor: '#0f1729', color: '#ff9800', fontWeight: 600 }}>
                                Value
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.entries(document.data).map(([key, value]) => {
                            const type = getValueType(value);
                            const color = getFieldColor(type);

                            return (
                                <TableRow key={key} sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' } }}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', borderBottom: '1px solid #1e3a5f' }}>
                                        {key}
                                    </TableCell>
                                    <TableCell sx={{ borderBottom: '1px solid #1e3a5f' }}>
                                        <Chip
                                            label={type}
                                            size="small"
                                            sx={{
                                                backgroundColor: `${color}20`,
                                                color: color,
                                                fontSize: '0.65rem',
                                                height: 20,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: color, borderBottom: '1px solid #1e3a5f' }}>
                                        {type === 'Map' || type === 'Array' ? (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                {JSON.stringify(value, null, 2)}
                                            </pre>
                                        ) : (
                                            renderFieldValue(value, type)
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    // Empty state
    if (!document) {
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
                <DocumentIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                <Typography variant="body1" sx={{ opacity: 0.5 }}>
                    Select a document to view and edit
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #1e3a5f', backgroundColor: '#0f1729' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DocumentIcon sx={{ mr: 1, color: '#2196f3' }} />
                        <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                            {document.id}
                        </Typography>
                        <Tooltip title="Copy document path">
                            <IconButton size="small" onClick={handleCopyPath} sx={{ ml: 1 }}>
                                <CopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box>
                        {hasChanges && (
                            <Tooltip title="Reset changes">
                                <IconButton size="small" onClick={handleReset} disabled={loading}>
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Copy JSON">
                            <IconButton size="small" onClick={handleCopyData} disabled={loading}>
                                <CopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                            onClick={handleSave}
                            disabled={!!jsonError || !hasChanges || loading}
                            sx={{ mx: 1 }}
                        >
                            Save
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={loading}
                        >
                            Delete
                        </Button>
                    </Box>
                </Box>

                <Typography variant="caption" sx={{ color: '#666', fontFamily: 'monospace' }}>
                    {document.path}
                </Typography>

                {/* Subcollections */}
                {document.subcollections?.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon sx={{ fontSize: 16, color: '#666' }} />
                        <Typography variant="caption" sx={{ color: '#666' }}>
                            Subcollections:
                        </Typography>
                        {document.subcollections.map((sub) => (
                            <Chip
                                key={sub}
                                label={sub}
                                size="small"
                                sx={{
                                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                                    color: '#ff9800',
                                    fontSize: '0.7rem'
                                }}
                            />
                        ))}
                    </Box>
                )}
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #1e3a5f' }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{ '& .MuiTab-root': { textTransform: 'none', minHeight: 40, minWidth: 80 } }}
                >
                    <Tab icon={<JsonIcon fontSize="small" />} iconPosition="start" label="JSON" />
                    <Tab icon={<TableIcon fontSize="small" />} iconPosition="start" label="Table" />
                    <Tab icon={<TreeIcon fontSize="small" />} iconPosition="start" label="Tree" />
                    <Tab icon={<GridIcon fontSize="small" />} iconPosition="start" label="Grid" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
                {activeTab === 0 && (
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <textarea
                            value={editedData}
                            onChange={handleDataChange}
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
                                fontSize: '14px',
                                lineHeight: '1.6',
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
                )}

                {activeTab === 1 && renderTableView()}

                {activeTab === 2 && (
                    <Box sx={{ p: 2 }}>
                        {document.data && Object.entries(document.data).map(([key, value]) =>
                            renderTreeNode(key, value)
                        )}
                        {(!document.data || Object.keys(document.data).length === 0) && (
                            <Typography sx={{ color: '#666', textAlign: 'center', py: 4 }}>
                                Document has no fields
                            </Typography>
                        )}
                    </Box>
                )}

                {activeTab === 3 && renderGridView()}
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#16213e', backgroundImage: 'none' } }}
            >
                <DialogTitle>Delete Document?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: '#aaa' }}>
                        Are you sure you want to delete the document "{document.id}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default DocumentEditor;
