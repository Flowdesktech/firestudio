import React, { useState, useEffect } from 'react';
import {
    Box, Typography, IconButton, Tooltip, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress, Breadcrumbs, Link,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Menu, MenuItem,
    ListItemIcon, Divider, Chip, FormControl, InputLabel, Select,
} from '@mui/material';
import {
    Folder as FolderIcon, InsertDriveFile as FileIcon, CloudUpload as UploadIcon,
    CloudDownload as DownloadIcon, Delete as DeleteIcon, CreateNewFolder as NewFolderIcon,
    Refresh as RefreshIcon, ContentCopy as CopyIcon, Link as LinkIcon,
    MoreVert as MoreVertIcon, Home as HomeIcon, NavigateNext as NavigateNextIcon,
    Image as ImageIcon, VideoFile as VideoIcon, AudioFile as AudioIcon,
    Description as DocIcon, Code as CodeIcon, Archive as ArchiveIcon,
} from '@mui/icons-material';
import { useThemeColors } from '../hooks';
import { formatFileSize, formatDate, copyToClipboard } from '../utils/commonUtils';

// File icon component
const FileTypeIcon = ({ item, mutedColor }) => {
    if (item.type === 'folder') return <FolderIcon sx={{ color: '#ffc107' }} />;
    const ct = item.contentType || '';
    if (ct.startsWith('image/')) return <ImageIcon sx={{ color: '#4caf50' }} />;
    if (ct.startsWith('video/')) return <VideoIcon sx={{ color: '#f44336' }} />;
    if (ct.startsWith('audio/')) return <AudioIcon sx={{ color: '#9c27b0' }} />;
    if (ct.includes('pdf') || ct.includes('document')) return <DocIcon sx={{ color: '#ff9800' }} />;
    if (ct.includes('zip') || ct.includes('archive')) return <ArchiveIcon sx={{ color: '#795548' }} />;
    if (ct.includes('json') || ct.includes('javascript') || ct.includes('text')) return <CodeIcon sx={{ color: '#2196f3' }} />;
    return <FileIcon sx={{ color: mutedColor }} />;
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
    const { isDark, borderColor, bgColor, hoverBg, textColor, mutedColor, selectedBg, chipBg } = useThemeColors();

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

    const isGoogle = project?.authMethod === 'google';

    useEffect(() => {
        if (project) loadFiles();
    }, [project, currentPath]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const result = isGoogle
                ? await window.electronAPI.googleStorageListFiles({ projectId: project.projectId, path: currentPath })
                : (await window.electronAPI.disconnectFirebase(), await window.electronAPI.connectFirebase(project.serviceAccountPath), await window.electronAPI.storageListFiles({ path: currentPath }));

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
        if (!window.confirm(`Delete "${item.name}"?`)) return;
        try {
            const result = isGoogle
                ? await window.electronAPI.googleStorageDeleteFile({ projectId: project.projectId, filePath: item.path })
                : await window.electronAPI.storageDeleteFile({ filePath: item.path });
            if (result.success) {
                addLog?.('success', `Deleted ${item.name}`);
                showMessage?.(`Deleted ${item.name}`, 'success');
                loadFiles();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
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
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: bgColor }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
                <Chip label={project?.projectId} size="small" sx={{ backgroundColor: chipBg }} />
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="New Folder"><IconButton size="small" onClick={() => setCreateFolderOpen(true)}><NewFolderIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
                <Tooltip title="Upload File"><IconButton size="small" onClick={handleUpload}><UploadIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadFiles}><RefreshIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
            </Box>

            {/* Breadcrumbs */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}` }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ fontSize: '0.85rem' }}>
                    <Link component="button" underline="hover" onClick={() => setCurrentPath('')} sx={{ display: 'flex', alignItems: 'center', color: textColor, cursor: 'pointer' }}>
                        <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />Storage
                    </Link>
                    {pathParts.map((part, i) => (
                        <Link key={i} component="button" underline="hover" onClick={() => navigateToBreadcrumb(i)} sx={{ color: i === pathParts.length - 1 ? 'primary.main' : textColor, cursor: 'pointer' }}>{part}</Link>
                    ))}
                </Breadcrumbs>
            </Box>

            {/* File List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                ) : items.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: mutedColor }}>
                        <FolderIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                        <Typography>No files in this folder</Typography>
                        <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={handleUpload} sx={{ mt: 2 }}>Upload File</Button>
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
                                {items.map((item, i) => (
                                    <TableRow key={item.path || i} onClick={() => handleItemClick(item)}
                                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: hoverBg }, backgroundColor: selectedItem?.path === item.path ? selectedBg : 'transparent' }}>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FileTypeIcon item={item} mutedColor={mutedColor} />
                                                <Typography sx={{ fontSize: '0.85rem', color: textColor }}>{item.name}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>{item.size === 0 ? '—' : formatFileSize(item.size)}</TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>{item.type === 'folder' ? 'Folder' : (item.contentType || '—')}</TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>{item.updated ? new Date(item.updated).toLocaleDateString() : '—'}</TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
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
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderTop: `1px solid ${borderColor}`, fontSize: '0.75rem', color: mutedColor }}>
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
