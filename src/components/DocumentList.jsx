import React, { useState } from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Typography,
    CircularProgress,
    IconButton,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
} from '@mui/material';
import {
    Description as DocumentIcon,
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    FileDownload as ExportIcon,
    FileUpload as ImportIcon,
} from '@mui/icons-material';

function DocumentList({
    documents,
    selectedDocument,
    onSelectDocument,
    collectionPath,
    onCreateDocument,
    onExport,
    onImport,
    loading
}) {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newDocId, setNewDocId] = useState('');
    const [newDocData, setNewDocData] = useState('{\n  \n}');
    const [jsonError, setJsonError] = useState('');

    const handleCreateClick = () => {
        setMenuAnchor(null);
        setCreateDialogOpen(true);
        setNewDocId('');
        setNewDocData('{\n  \n}');
        setJsonError('');
    };

    const handleCreateDocument = () => {
        try {
            const data = JSON.parse(newDocData);
            onCreateDocument(collectionPath, newDocId, data);
            setCreateDialogOpen(false);
        } catch (e) {
            setJsonError('Invalid JSON: ' + e.message);
        }
    };

    const validateJson = (value) => {
        setNewDocData(value);
        try {
            JSON.parse(value);
            setJsonError('');
        } catch (e) {
            setJsonError('Invalid JSON: ' + e.message);
        }
    };

    const getDocumentPreview = (data) => {
        if (!data) return '';
        const keys = Object.keys(data);
        if (keys.length === 0) return '(empty)';
        const preview = keys.slice(0, 3).map(key => {
            const value = data[key];
            let displayValue;
            if (value === null) displayValue = 'null';
            else if (typeof value === 'object') displayValue = Array.isArray(value) ? '[...]' : '{...}';
            else if (typeof value === 'string') displayValue = `"${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`;
            else displayValue = String(value);
            return `${key}: ${displayValue}`;
        }).join(', ');
        return keys.length > 3 ? `${preview}, ...` : preview;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
            {/* Header */}
            <Box
                sx={{
                    p: 1.5,
                    borderBottom: '1px solid #1e3a5f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#0f1729'
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Documents
                    {collectionPath && (
                        <Typography component="span" sx={{ ml: 1, color: '#666', fontSize: '0.75rem' }}>
                            ({collectionPath})
                        </Typography>
                    )}
                </Typography>
                <Box>
                    <Tooltip title="Add document">
                        <IconButton
                            size="small"
                            onClick={handleCreateClick}
                            disabled={loading}
                            sx={{ color: '#aaa' }}
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="More options">
                        <IconButton
                            size="small"
                            onClick={(e) => setMenuAnchor(e.currentTarget)}
                            disabled={loading}
                            sx={{ color: '#aaa' }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Document List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading && documents.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : documents.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: '#666' }}>
                        <Typography variant="body2">
                            No documents found
                        </Typography>
                        <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleCreateClick}
                            sx={{ mt: 1 }}
                        >
                            Add Document
                        </Button>
                    </Box>
                ) : (
                    <List dense disablePadding>
                        {documents.map((doc) => {
                            const isSelected = selectedDocument?.path === doc.path;

                            return (
                                <ListItem key={doc.path} disablePadding>
                                    <ListItemButton
                                        selected={isSelected}
                                        onClick={() => onSelectDocument(doc)}
                                        sx={{
                                            py: 1,
                                            '&.Mui-selected': {
                                                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(33, 150, 243, 0.25)',
                                                }
                                            },
                                            '&:hover': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            }
                                        }}
                                    >
                                        <DocumentIcon
                                            sx={{
                                                mr: 1.5,
                                                fontSize: 18,
                                                color: isSelected ? '#2196f3' : '#666'
                                            }}
                                        />
                                        <ListItemText
                                            primary={doc.id}
                                            secondary={getDocumentPreview(doc.data)}
                                            primaryTypographyProps={{
                                                sx: {
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.85rem',
                                                    color: isSelected ? '#2196f3' : 'inherit',
                                                }
                                            }}
                                            secondaryTypographyProps={{
                                                sx: {
                                                    fontSize: '0.7rem',
                                                    color: '#666',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>

            {/* Footer */}
            {documents.length > 0 && (
                <Box
                    sx={{
                        p: 1,
                        borderTop: '1px solid #1e3a5f',
                        backgroundColor: '#0f1729'
                    }}
                >
                    <Typography variant="caption" sx={{ color: '#666' }}>
                        {documents.length} document{documents.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            )}

            {/* Options Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{
                    sx: { backgroundColor: '#1a1a2e' }
                }}
            >
                <MenuItem onClick={handleCreateClick}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    Add Document
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setMenuAnchor(null); onExport(); }}>
                    <ListItemIcon>
                        <ExportIcon fontSize="small" />
                    </ListItemIcon>
                    Export Collection
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); onImport(); }}>
                    <ListItemIcon>
                        <ImportIcon fontSize="small" />
                    </ListItemIcon>
                    Import Documents
                </MenuItem>
            </Menu>

            {/* Create Document Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: '#16213e',
                        backgroundImage: 'none',
                    }
                }}
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
                        onChange={(e) => validateJson(e.target.value)}
                        multiline
                        rows={10}
                        error={!!jsonError}
                        helperText={jsonError}
                        sx={{
                            '& .MuiInputBase-input': {
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateDocument}
                        disabled={!!jsonError || !newDocData.trim()}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default DocumentList;
