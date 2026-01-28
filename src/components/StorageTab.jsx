import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Breadcrumbs,
    Link,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    Chip,
    useTheme,
    FormControl,
    InputLabel,
    Select,
} from '@mui/material';
import {
    Folder as FolderIcon,
    InsertDriveFile as FileIcon,
    CloudUpload as UploadIcon,
    CloudDownload as DownloadIcon,
    Delete as DeleteIcon,
    CreateNewFolder as NewFolderIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    Link as LinkIcon,
    MoreVert as MoreVertIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Image as ImageIcon,
    VideoFile as VideoIcon,
    AudioFile as AudioIcon,
    Description as DocIcon,
    Code as CodeIcon,
    Archive as ArchiveIcon,
} from '@mui/icons-material';

function StorageTab({ project, addLog, showMessage }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [urlExpiration, setUrlExpiration] = useState('7d');
    const [urlLoading, setUrlLoading] = useState(false);
    const [urlFileItem, setUrlFileItem] = useState(null);

    // Theme colors
    const borderColor = isDark ? '#333' : '#e0e0e0';
    const bgColor = isDark ? '#1e1e1e' : '#fafafa';
    const hoverBg = isDark ? '#333' : '#f5f5f5';
    const textColor = isDark ? '#ccc' : '#333';
    const mutedColor = isDark ? '#888' : '#666';

    useEffect(() => {
        if (project) {
            loadFiles();
        }
    }, [project, currentPath]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            let result;

            if (project?.authMethod === 'google') {
                // Use Google OAuth REST API
                result = await window.electronAPI.googleStorageListFiles({
                    projectId: project.projectId,
                    path: currentPath
                });
            } else {
                // Use Service Account (Admin SDK)
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                result = await window.electronAPI.storageListFiles({ path: currentPath });
            }

            if (result.success) {
                setItems(result.items || []);
                addLog?.('success', `Loaded ${result.items?.length || 0} items from storage`);
            } else {
                showMessage?.(result.error, 'error');
                setItems([]);
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const navigateToFolder = (folderPath) => {
        setCurrentPath(folderPath.replace(/\/$/, ''));
    };

    const navigateUp = () => {
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const navigateToBreadcrumb = (index) => {
        const parts = currentPath.split('/').filter(Boolean);
        setCurrentPath(parts.slice(0, index + 1).join('/'));
    };

    const handleItemClick = (item) => {
        if (item.type === 'folder') {
            navigateToFolder(item.path);
        } else {
            setSelectedItem(item);
        }
    };

    const handleContextMenu = (event, item) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedItem(item);
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleUpload = async () => {
        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleStorageUploadFile({
                    projectId: project.projectId,
                    storagePath: currentPath
                });
            } else {
                result = await window.electronAPI.storageUploadFile({ storagePath: currentPath });
            }

            if (result.success) {
                addLog?.('success', `Uploaded ${result.fileName}`);
                showMessage?.(`Uploaded ${result.fileName}`, 'success');
                loadFiles();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleDownload = async (item) => {
        handleCloseMenu();
        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleStorageDownloadFile({
                    projectId: project.projectId,
                    filePath: item.path
                });
            } else {
                result = await window.electronAPI.storageDownloadFile({ filePath: item.path });
            }

            if (result.success) {
                addLog?.('success', `Downloaded to ${result.savedTo}`);
                showMessage?.(`Downloaded to ${result.savedTo}`, 'success');
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleGetUrl = (item) => {
        handleCloseMenu();
        // Open dialog to select expiration
        setUrlFileItem(item);
        setDownloadUrl('');
        setUrlExpiration('7d');
        setUrlDialogOpen(true);
    };

    const generateSignedUrl = async () => {
        if (!urlFileItem) return;

        setUrlLoading(true);
        try {
            // Convert expiration to milliseconds
            const expirationMap = {
                '1h': 60 * 60 * 1000,
                '6h': 6 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '3d': 3 * 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000,
                '1y': 365 * 24 * 60 * 60 * 1000,
                'never': 100 * 365 * 24 * 60 * 60 * 1000, // 100 years (effectively never)
            };
            const expiresInMs = expirationMap[urlExpiration] || expirationMap['7d'];

            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleStorageGetDownloadUrl({
                    projectId: project.projectId,
                    filePath: urlFileItem.path,
                    expiresInMs
                });
            } else {
                result = await window.electronAPI.storageGetDownloadUrl({
                    filePath: urlFileItem.path,
                    expiresInMs
                });
            }

            if (result.success) {
                setDownloadUrl(result.url);
                addLog?.('success', `Generated signed URL for ${urlFileItem.name}`);
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        } finally {
            setUrlLoading(false);
        }
    };

    const handleDelete = async (item) => {
        handleCloseMenu();
        if (!window.confirm(`Delete "${item.name}"?`)) return;

        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleStorageDeleteFile({
                    projectId: project.projectId,
                    filePath: item.path
                });
            } else {
                result = await window.electronAPI.storageDeleteFile({ filePath: item.path });
            }

            if (result.success) {
                addLog?.('success', `Deleted ${item.name}`);
                showMessage?.(`Deleted ${item.name}`, 'success');
                loadFiles();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            const folderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleStorageCreateFolder({
                    projectId: project.projectId,
                    folderPath
                });
            } else {
                result = await window.electronAPI.storageCreateFolder({ folderPath });
            }

            if (result.success) {
                addLog?.('success', `Created folder ${newFolderName}`);
                showMessage?.(`Created folder ${newFolderName}`, 'success');
                setCreateFolderOpen(false);
                setNewFolderName('');
                loadFiles();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showMessage?.('Copied to clipboard', 'info');
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '—';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString();
    };

    const getFileIcon = (item) => {
        if (item.type === 'folder') {
            return <FolderIcon sx={{ color: '#ffc107' }} />;
        }

        const contentType = item.contentType || '';
        if (contentType.startsWith('image/')) return <ImageIcon sx={{ color: '#4caf50' }} />;
        if (contentType.startsWith('video/')) return <VideoIcon sx={{ color: '#f44336' }} />;
        if (contentType.startsWith('audio/')) return <AudioIcon sx={{ color: '#9c27b0' }} />;
        if (contentType.includes('pdf') || contentType.includes('document')) return <DocIcon sx={{ color: '#ff9800' }} />;
        if (contentType.includes('zip') || contentType.includes('archive')) return <ArchiveIcon sx={{ color: '#795548' }} />;
        if (contentType.includes('json') || contentType.includes('javascript') || contentType.includes('text')) return <CodeIcon sx={{ color: '#2196f3' }} />;
        return <FileIcon sx={{ color: mutedColor }} />;
    };

    const pathParts = currentPath.split('/').filter(Boolean);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: bgColor }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
                <Chip label={project?.projectId} size="small" sx={{ backgroundColor: isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd' }} />
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="New Folder">
                    <IconButton size="small" onClick={() => setCreateFolderOpen(true)}>
                        <NewFolderIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Upload File">
                    <IconButton size="small" onClick={handleUpload}>
                        <UploadIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={loadFiles}>
                        <RefreshIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Breadcrumbs */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ fontSize: '0.85rem' }}>
                    <Link
                        component="button"
                        underline="hover"
                        onClick={() => setCurrentPath('')}
                        sx={{ display: 'flex', alignItems: 'center', color: textColor, cursor: 'pointer' }}
                    >
                        <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        Storage
                    </Link>
                    {pathParts.map((part, index) => (
                        <Link
                            key={index}
                            component="button"
                            underline="hover"
                            onClick={() => navigateToBreadcrumb(index)}
                            sx={{ color: index === pathParts.length - 1 ? 'primary.main' : textColor, cursor: 'pointer' }}
                        >
                            {part}
                        </Link>
                    ))}
                </Breadcrumbs>
            </Box>

            {/* File List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                    </Box>
                ) : items.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: mutedColor }}>
                        <FolderIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                        <Typography>No files in this folder</Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<UploadIcon />}
                            onClick={handleUpload}
                            sx={{ mt: 2 }}
                        >
                            Upload File
                        </Button>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 100 }}>Size</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 150 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 120 }}>Modified</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 50 }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow
                                        key={item.path || index}
                                        onClick={() => handleItemClick(item)}
                                        sx={{
                                            cursor: 'pointer',
                                            '&:hover': { backgroundColor: hoverBg },
                                            backgroundColor: selectedItem?.path === item.path ? (isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd') : 'transparent'
                                        }}
                                    >
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getFileIcon(item)}
                                                <Typography sx={{ fontSize: '0.85rem', color: textColor }}>{item.name}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {formatSize(item.size)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {item.type === 'folder' ? 'Folder' : (item.contentType || '—')}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {formatDate(item.updated)}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            {item.type === 'file' && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleContextMenu(e, item)}
                                                >
                                                    <MoreVertIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderTop: `1px solid ${borderColor}`, fontSize: '0.75rem', color: mutedColor }}>
                <Typography variant="caption">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                    {items.filter(i => i.type === 'folder').length > 0 && ` (${items.filter(i => i.type === 'folder').length} folder${items.filter(i => i.type === 'folder').length !== 1 ? 's' : ''})`}
                </Typography>
            </Box>

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
            >
                <MenuItem onClick={() => handleDownload(selectedItem)}>
                    <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                    Download
                </MenuItem>
                <MenuItem onClick={() => handleGetUrl(selectedItem)}>
                    <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                    Get Download URL
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleDelete(selectedItem)} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                    Delete
                </MenuItem>
            </Menu>

            {/* Create Folder Dialog */}
            <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create Folder</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Folder Name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        size="small"
                        sx={{ mt: 1 }}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateFolder}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Download URL Dialog */}
            <Dialog open={urlDialogOpen} onClose={() => setUrlDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Generate Signed URL</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        File: <strong>{urlFileItem?.name}</strong>
                    </Typography>

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>URL Expiration</InputLabel>
                        <Select
                            value={urlExpiration}
                            label="URL Expiration"
                            onChange={(e) => setUrlExpiration(e.target.value)}
                        >
                            <MenuItem value="1h">1 Hour</MenuItem>
                            <MenuItem value="6h">6 Hours</MenuItem>
                            <MenuItem value="24h">24 Hours (1 Day)</MenuItem>
                            <MenuItem value="3d">3 Days</MenuItem>
                            <MenuItem value="7d">7 Days</MenuItem>
                            <MenuItem value="30d">30 Days (1 Month)</MenuItem>
                            <MenuItem value="1y">1 Year</MenuItem>
                            <MenuItem value="never">Never Expire</MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        onClick={generateSignedUrl}
                        disabled={urlLoading}
                        fullWidth
                        sx={{ mb: 2 }}
                    >
                        {urlLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                        {urlLoading ? 'Generating...' : 'Generate Signed URL'}
                    </Button>

                    {downloadUrl && (
                        <>
                            <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mb: 1 }}>
                                ✓ URL generated (expires in {
                                    urlExpiration === '1h' ? '1 hour' :
                                        urlExpiration === '6h' ? '6 hours' :
                                            urlExpiration === '24h' ? '1 day' :
                                                urlExpiration === '3d' ? '3 days' :
                                                    urlExpiration === '7d' ? '7 days' :
                                                        urlExpiration === '30d' ? '30 days' :
                                                            urlExpiration === '1y' ? '1 year' :
                                                                urlExpiration === 'never' ? 'never (100 years)' : '7 days'
                                })
                            </Typography>
                            <TextField
                                fullWidth
                                value={downloadUrl}
                                size="small"
                                multiline
                                rows={3}
                                InputProps={{
                                    readOnly: true,
                                    sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
                                }}
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    {downloadUrl && (
                        <Button onClick={() => copyToClipboard(downloadUrl)} startIcon={<CopyIcon />}>
                            Copy URL
                        </Button>
                    )}
                    <Button onClick={() => setUrlDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default StorageTab;
