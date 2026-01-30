import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, IconButton, Tooltip, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress, Breadcrumbs, Link,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Menu, MenuItem,
    ListItemIcon, Divider, Chip, FormControl, InputLabel, Select, useTheme,
} from '@mui/material';
import {
    Folder as FolderIcon, InsertDriveFile as FileIcon, CloudUpload as UploadIcon,
    CloudDownload as DownloadIcon, Delete as DeleteIcon, CreateNewFolder as NewFolderIcon,
    Refresh as RefreshIcon, ContentCopy as CopyIcon, Link as LinkIcon,
    MoreVert as MoreVertIcon, Home as HomeIcon, NavigateNext as NavigateNextIcon,
    Image as ImageIcon, VideoFile as VideoIcon, AudioFile as AudioIcon,
    Description as DocIcon, Code as CodeIcon, Archive as ArchiveIcon,
    OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { formatFileSize, formatDate, copyToClipboard, confirmAction } from '../utils/commonUtils';

// File icon component
const FileTypeIcon = ({ item }) => {
    if (item.type === 'folder') return <FolderIcon sx={{ color: '#ffc107' }} />;
    const ct = item.contentType || '';
    if (ct.startsWith('image/')) return <ImageIcon sx={{ color: '#4caf50' }} />;
    if (ct.startsWith('video/')) return <VideoIcon sx={{ color: '#f44336' }} />;
    if (ct.startsWith('audio/')) return <AudioIcon sx={{ color: '#9c27b0' }} />;
    if (ct.includes('pdf') || ct.includes('document')) return <DocIcon sx={{ color: '#ff9800' }} />;
    if (ct.includes('zip') || ct.includes('archive')) return <ArchiveIcon sx={{ color: '#795548' }} />;
    if (ct.includes('json') || ct.includes('javascript') || ct.includes('text')) return <CodeIcon sx={{ color: '#2196f3' }} />;
    return <FileIcon sx={{ color: 'text.secondary' }} />;
};

// Expiration options for signed URLs
const EXPIRATION_OPTIONS = [
    { value: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
    { value: '6h', label: '6 Hours', ms: 6 * 60 * 60 * 1000 },
    { value: '24h', label: '24 Hours (1 Day)', ms: 24 * 60 * 60 * 1000 },
    { value: '3d', label: '3 Days', ms: 3 * 24 * 60 * 60 * 1000 },
    { value: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { value: '30d', label: '30 Days (1 Month)', ms: 30 * 24 * 60 * 60 * 1000 },
    { value: '1y', label: '1 Year', ms: 365 * 24 * 60 * 60 * 1000 },
    { value: 'never', label: 'Never Expire', ms: 100 * 365 * 24 * 60 * 60 * 1000 },
];

function StorageTab({ project, addLog, showMessage }) {
    const theme = useTheme();

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
    const [bucketError, setBucketError] = useState(null);

    const isGoogle = project?.authMethod === 'google';
    const loadingRef = useRef(false);

    useEffect(() => {
        if (project) loadFiles();
    }, [project?.projectId, currentPath]);

    const loadFiles = async () => {
        // Prevent duplicate calls
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setBucketError(null);
        try {
            const result = isGoogle
                ? await window.electronAPI.googleStorageListFiles({ projectId: project.projectId, path: currentPath })
                : (await window.electronAPI.disconnectFirebase(), await window.electronAPI.connectFirebase(project.serviceAccountPath), await window.electronAPI.storageListFiles({ path: currentPath }));

            if (result.success) {
                setItems(result.items || []);
                setBucketError(null);
                addLog?.('success', `Loaded ${result.items?.length || 0} items from storage`);
            } else {
                // Check if this is a bucket not found error
                if (result.error?.includes('Storage bucket not found') || result.error?.includes('does not exist')) {
                    setBucketError(result.error);
                } else {
                    showMessage?.(result.error, 'error');
                }
                setItems([]);
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            setItems([]);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    };

    const openFirebaseConsole = () => {
        const url = `https://console.firebase.google.com/project/${project.projectId}/storage`;
        window.electronAPI.openExternal(url);
    };

    const navigateToBreadcrumb = (index) => {
        const parts = currentPath.split('/').filter(Boolean);
        setCurrentPath(parts.slice(0, index + 1).join('/'));
    };

    const handleItemClick = (item) => {
        if (item.type === 'folder') setCurrentPath(item.path.replace(/\/$/, ''));
        else setSelectedItem(item);
    };

    const handleContextMenu = (e, item) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedItem(item);
        setMenuAnchor(e.currentTarget);
    };

    const closeMenu = () => setMenuAnchor(null);

    const handleUpload = async () => {
        try {
            const result = isGoogle
                ? await window.electronAPI.googleStorageUploadFile({ projectId: project.projectId, storagePath: currentPath })
                : await window.electronAPI.storageUploadFile({ storagePath: currentPath });
            if (result.success) {
                addLog?.('success', `Uploaded ${result.fileName}`);
                showMessage?.(`Uploaded ${result.fileName}`, 'success');
                loadFiles();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const handleDownload = async (item) => {
        closeMenu();
        try {
            const result = isGoogle
                ? await window.electronAPI.googleStorageDownloadFile({ projectId: project.projectId, filePath: item.path })
                : await window.electronAPI.storageDownloadFile({ filePath: item.path });
            if (result.success) {
                addLog?.('success', `Downloaded to ${result.savedTo}`);
                showMessage?.(`Downloaded to ${result.savedTo}`, 'success');
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const handleGetUrl = (item) => {
        closeMenu();
        setUrlFileItem(item);
        setDownloadUrl('');
        setUrlExpiration('7d');
        setUrlDialogOpen(true);
    };

    const generateSignedUrl = async () => {
        if (!urlFileItem) return;
        setUrlLoading(true);
        try {
            const expiresInMs = EXPIRATION_OPTIONS.find(o => o.value === urlExpiration)?.ms || EXPIRATION_OPTIONS[4].ms;
            const result = isGoogle
                ? await window.electronAPI.googleStorageGetDownloadUrl({ projectId: project.projectId, filePath: urlFileItem.path, expiresInMs })
                : await window.electronAPI.storageGetDownloadUrl({ filePath: urlFileItem.path, expiresInMs });
            if (result.success) {
                setDownloadUrl(result.url);
                addLog?.('success', `Generated signed URL for ${urlFileItem.name}`);
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
        finally { setUrlLoading(false); }
    };

    const handleDelete = async (item) => {
        closeMenu();
        const confirmed = await confirmAction(
            'Delete File?',
            `Are you sure you want to delete <strong>"${item.name}"</strong>?<br><small style="color: #888;">This action cannot be undone.</small>`,
            { confirmText: 'Delete', isDark: theme.palette.mode === 'dark' }
        );

        if (confirmed) {
            try {
                const deleteResult = isGoogle
                    ? await window.electronAPI.googleStorageDeleteFile({ projectId: project.projectId, filePath: item.path })
                    : await window.electronAPI.storageDeleteFile({ filePath: item.path });
                if (deleteResult.success) {
                    addLog?.('success', `Deleted ${item.name}`);
                    showMessage?.(`Deleted ${item.name}`, 'success');
                    loadFiles();
                } else showMessage?.(deleteResult.error, 'error');
            } catch (error) { showMessage?.(error.message, 'error'); }
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const folderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
            const result = isGoogle
                ? await window.electronAPI.googleStorageCreateFolder({ projectId: project.projectId, folderPath })
                : await window.electronAPI.storageCreateFolder({ folderPath });
            if (result.success) {
                addLog?.('success', `Created folder ${newFolderName}`);
                showMessage?.(`Created folder ${newFolderName}`, 'success');
                setCreateFolderOpen(false);
                setNewFolderName('');
                loadFiles();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const handleCopy = (text) => copyToClipboard(text, () => showMessage?.('Copied to clipboard', 'info'));
    const pathParts = currentPath.split('/').filter(Boolean);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
                <Chip label={project?.projectId} size="small" sx={{ bgcolor: 'action.selected' }} />
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="New Folder"><IconButton size="small" onClick={() => setCreateFolderOpen(true)}><NewFolderIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
                <Tooltip title="Upload File"><IconButton size="small" onClick={handleUpload}><UploadIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadFiles}><RefreshIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
            </Box>

            {/* Breadcrumbs */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ fontSize: '0.85rem' }}>
                    <Link component="button" underline="hover" onClick={() => setCurrentPath('')} sx={{ display: 'flex', alignItems: 'center', color: 'text.primary', cursor: 'pointer' }}>
                        <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />Storage
                    </Link>
                    {pathParts.map((part, i) => (
                        <Link key={i} component="button" underline="hover" onClick={() => navigateToBreadcrumb(i)} sx={{ color: i === pathParts.length - 1 ? 'primary.main' : 'text.primary', cursor: 'pointer' }}>{part}</Link>
                    ))}
                </Breadcrumbs>
            </Box>

            {/* File List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                ) : bucketError ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', p: 4 }}>
                        <FolderIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2, color: '#f44336' }} />
                        <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>Storage Not Enabled</Typography>
                        <Typography sx={{ textAlign: 'center', maxWidth: 450, mb: 3 }}>
                            Firebase Storage is not enabled for this project. Enable it in the Firebase Console to start uploading files.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={openFirebaseConsole}
                            startIcon={<OpenInNewIcon />}
                        >
                            Open Firebase Console
                        </Button>
                        <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary' }}>
                            After enabling Storage, click Refresh to reload.
                        </Typography>
                        <Button variant="text" size="small" onClick={loadFiles} sx={{ mt: 1 }}>
                            <RefreshIcon sx={{ fontSize: 16, mr: 0.5 }} /> Refresh
                        </Button>
                    </Box>
                ) : items.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                        <FolderIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                        <Typography>No files in this folder</Typography>
                        <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={handleUpload} sx={{ mt: 2 }}>Upload File</Button>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary' }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary', width: 100 }}>Size</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary', width: 150 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary', width: 120 }}>Modified</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary', width: 50 }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item, i) => (
                                    <TableRow key={item.path || i} onClick={() => handleItemClick(item)}
                                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, bgcolor: selectedItem?.path === item.path ? 'action.selected' : 'transparent' }}>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FileTypeIcon item={item} />
                                                <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>{item.name}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{item.size === 0 ? '—' : formatFileSize(item.size)}</TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{item.type === 'folder' ? 'Folder' : (item.contentType || '—')}</TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{item.updated ? new Date(item.updated).toLocaleDateString() : '—'}</TableCell>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            {item.type === 'file' && <IconButton size="small" onClick={(e) => handleContextMenu(e, item)}><MoreVertIcon sx={{ fontSize: 16 }} /></IconButton>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderTop: 1, borderColor: 'divider', fontSize: '0.75rem', color: 'text.secondary' }}>
                <Typography variant="caption">{items.length} item{items.length !== 1 ? 's' : ''}{items.filter(i => i.type === 'folder').length > 0 && ` (${items.filter(i => i.type === 'folder').length} folder${items.filter(i => i.type === 'folder').length !== 1 ? 's' : ''})`}</Typography>
            </Box>

            {/* Context Menu */}
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem onClick={() => handleDownload(selectedItem)}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Download</MenuItem>
                <MenuItem onClick={() => handleGetUrl(selectedItem)}><ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>Get Download URL</MenuItem>
                <Divider />
                <MenuItem onClick={() => handleDelete(selectedItem)} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>Delete</MenuItem>
            </Menu>

            {/* Create Folder Dialog */}
            <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create Folder</DialogTitle>
                <DialogContent>
                    <TextField autoFocus fullWidth label="Folder Name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} size="small" sx={{ mt: 1 }} onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateFolder}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* URL Dialog */}
            <Dialog open={urlDialogOpen} onClose={() => setUrlDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Generate Signed URL</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>File: <strong>{urlFileItem?.name}</strong></Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>URL Expiration</InputLabel>
                        <Select value={urlExpiration} label="URL Expiration" onChange={(e) => setUrlExpiration(e.target.value)}>
                            {EXPIRATION_OPTIONS.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="contained" onClick={generateSignedUrl} disabled={urlLoading} fullWidth sx={{ mb: 2 }}>
                        {urlLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}{urlLoading ? 'Generating...' : 'Generate Signed URL'}
                    </Button>
                    {downloadUrl && (
                        <>
                            <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mb: 1 }}>✓ URL generated (expires in {EXPIRATION_OPTIONS.find(o => o.value === urlExpiration)?.label || '7 days'})</Typography>
                            <TextField fullWidth value={downloadUrl} size="small" multiline rows={3} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    {downloadUrl && <Button onClick={() => handleCopy(downloadUrl)} startIcon={<CopyIcon />}>Copy URL</Button>}
                    <Button onClick={() => setUrlDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}

export default StorageTab;
