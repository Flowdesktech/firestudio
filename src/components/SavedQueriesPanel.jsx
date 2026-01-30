import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Drawer,
    List,
    ListItem,
    useTheme,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
} from '@mui/material';
import {
    Close as CloseIcon,
    Delete as DeleteIcon,
    Code as CodeIcon,
    ContentCopy as CopyIcon,
    OpenInNew as OpenIcon,
    Folder as FolderIcon,
} from '@mui/icons-material';

const STORAGE_KEY = 'firestudio-saved-queries';

function SavedQueriesPanel({ open, onClose, onOpenQuery }) {
    const theme = useTheme();
    const editorColors = theme.custom?.editor || {};

    const [savedQueries, setSavedQueries] = useState([]);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [newQueryName, setNewQueryName] = useState('');
    const [pendingQuery, setPendingQuery] = useState(null);

    // Load saved queries from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setSavedQueries(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load saved queries:', error);
        }
    }, [open]);

    // Save to localStorage
    const saveToStorage = (queries) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
            setSavedQueries(queries);
        } catch (error) {
            console.error('Failed to save queries:', error);
        }
    };

    // Add a new query
    const handleSaveQuery = (queryData, name) => {
        const newQuery = {
            id: `query-${Date.now()}`,
            name: name || `Query ${savedQueries.length + 1}`,
            code: queryData.query,
            projectId: queryData.projectId,
            collectionPath: queryData.collectionPath,
            createdAt: new Date().toISOString(),
        };
        saveToStorage([newQuery, ...savedQueries]);
    };

    // Delete a query
    const handleDeleteQuery = (queryId) => {
        saveToStorage(savedQueries.filter(q => q.id !== queryId));
    };

    // Copy to clipboard
    const handleCopyQuery = (code) => {
        navigator.clipboard.writeText(code);
    };

    // Expose save function via window event
    useEffect(() => {
        const handleSaveEvent = (e) => {
            const { query, projectId, collectionPath } = e.detail;
            if (query?.trim()) {
                setPendingQuery({ query, projectId, collectionPath });
                setNewQueryName('');
                setSaveDialogOpen(true);
            }
        };

        window.addEventListener('save-query', handleSaveEvent);
        return () => window.removeEventListener('save-query', handleSaveEvent);
    }, []);

    const confirmSave = () => {
        if (pendingQuery) {
            handleSaveQuery(pendingQuery, newQueryName);
            setSaveDialogOpen(false);
            setPendingQuery(null);
            setNewQueryName('');
        }
    };

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 400,
                        bgcolor: 'background.paper',
                        backgroundImage: 'none',
                    },
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.default',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CodeIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                Saved Queries
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                ({savedQueries.length})
                            </Typography>
                        </Box>
                        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Queries List */}
                    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                        {savedQueries.length === 0 ? (
                            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                                <CodeIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                                <Typography sx={{ fontSize: '0.85rem' }}>
                                    No saved queries yet
                                </Typography>
                                <Typography sx={{ fontSize: '0.75rem', mt: 1 }}>
                                    Click the save icon in the JS Query Editor to save queries
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ py: 0 }}>
                                {savedQueries.map((query) => (
                                    <ListItem
                                        key={query.id}
                                        sx={{
                                            borderBottom: 1,
                                            borderColor: 'divider',
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                            py: 1.5,
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                                {query.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                                                {new Date(query.createdAt).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                        {/* Project/Collection info */}
                                        {(query.projectId || query.collectionPath) && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                <FolderIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                                                    {query.projectId}{query.collectionPath ? ` / ${query.collectionPath}` : ''}
                                                </Typography>
                                            </Box>
                                        )}
                                        <Box
                                            sx={{
                                                bgcolor: editorColors.bg || 'background.default',
                                                p: 1,
                                                borderRadius: 1,
                                                fontFamily: '"Cascadia Code", "Fira Code", monospace',
                                                fontSize: '0.7rem',
                                                lineHeight: 1.5,
                                                color: 'text.primary',
                                                overflow: 'auto',
                                                whiteSpace: 'pre',
                                                maxHeight: 120,
                                                mb: 1,
                                                border: 1,
                                                borderColor: 'divider',
                                            }}
                                        >
                                            {query.code}
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                            <Tooltip title="Copy to clipboard">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCopyQuery(query.code)}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    <CopyIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Open collection & load query">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        onOpenQuery?.(query);
                                                        onClose();
                                                    }}
                                                    sx={{ color: 'primary.main' }}
                                                >
                                                    <OpenIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteQuery(query.id)}
                                                    sx={{ color: 'error.main' }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                </Box>
            </Drawer>

            {/* Save Query Dialog */}
            <Dialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Save Query</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Query Name"
                        value={newQueryName}
                        onChange={(e) => setNewQueryName(e.target.value)}
                        placeholder="My Query"
                        sx={{ mt: 1 }}
                    />
                    {pendingQuery?.projectId && (
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                {pendingQuery.projectId}{pendingQuery.collectionPath ? ` / ${pendingQuery.collectionPath}` : ''}
                            </Typography>
                        </Box>
                    )}
                    <Box
                        sx={{
                            mt: 2,
                            p: 1.5,
                            bgcolor: editorColors.bg || 'background.default',
                            borderRadius: 1,
                            fontFamily: '"Cascadia Code", "Fira Code", monospace',
                            fontSize: '0.75rem',
                            maxHeight: 200,
                            overflow: 'auto',
                            whiteSpace: 'pre',
                            color: 'text.primary',
                            border: 1,
                            borderColor: 'divider',
                        }}
                    >
                        {pendingQuery?.query}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmSave} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default SavedQueriesPanel;
