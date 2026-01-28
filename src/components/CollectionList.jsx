import React from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    CircularProgress,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Refresh as RefreshIcon,
    CloudOff as CloudOffIcon,
} from '@mui/icons-material';

function CollectionList({
    collections,
    selectedCollection,
    onSelectCollection,
    onRefresh,
    isConnected,
    loading
}) {
    if (!isConnected) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: 3,
                    color: '#666'
                }}
            >
                <CloudOffIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.7 }}>
                    Not connected to Firebase
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ff9800' }}>
                    Collections
                </Typography>
                <Tooltip title="Refresh collections">
                    <IconButton
                        size="small"
                        onClick={onRefresh}
                        disabled={loading}
                        sx={{ color: '#aaa' }}
                    >
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Collection List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading && collections.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : collections.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: '#666' }}>
                        <Typography variant="body2">
                            No collections found
                        </Typography>
                    </Box>
                ) : (
                    <List dense disablePadding>
                        {collections.map((collection) => {
                            const isSelected = selectedCollection?.path === collection.path;

                            return (
                                <ListItem key={collection.path} disablePadding>
                                    <ListItemButton
                                        selected={isSelected}
                                        onClick={() => onSelectCollection(collection)}
                                        sx={{
                                            py: 1,
                                            '&.Mui-selected': {
                                                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255, 152, 0, 0.25)',
                                                }
                                            },
                                            '&:hover': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            {isSelected ? (
                                                <FolderOpenIcon sx={{ color: '#ff9800' }} />
                                            ) : (
                                                <FolderIcon sx={{ color: '#aaa' }} />
                                            )}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={collection.id}
                                            primaryTypographyProps={{
                                                sx: {
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.85rem',
                                                    color: isSelected ? '#ff9800' : 'inherit',
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

            {/* Footer with count */}
            {collections.length > 0 && (
                <Box
                    sx={{
                        p: 1,
                        borderTop: '1px solid #1e3a5f',
                        backgroundColor: '#0f1729'
                    }}
                >
                    <Typography variant="caption" sx={{ color: '#666' }}>
                        {collections.length} collection{collections.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}

export default CollectionList;
