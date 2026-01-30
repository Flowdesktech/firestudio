import React from 'react';
import {
    Box,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Drawer,
} from '@mui/material';
import {
    Close as CloseIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Storage as CollectionIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useFavorites } from '../context/FavoritesContext';

function FavoritesPanel({ open, onClose, onOpenFavorite }) {
    const { favorites, removeFavorite } = useFavorites();

    return (
        <Drawer
            anchor="left"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    width: 300,
                    bgcolor: 'background.paper',
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
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StarIcon sx={{ color: '#ffc107' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Favorites
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Favorites List */}
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                    {favorites.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center', color: 'text.disabled' }}>
                            <StarBorderIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                            <Typography variant="body2">
                                No favorites yet
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                Click the star icon on a collection to add it to favorites
                            </Typography>
                        </Box>
                    ) : (
                        <List dense>
                            {favorites.map((fav) => (
                                <ListItem
                                    key={fav.id}
                                    secondaryAction={
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={() => removeFavorite(fav.id)}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    }
                                    disablePadding
                                >
                                    <ListItemButton
                                        onClick={() => {
                                            onOpenFavorite(fav);
                                            onClose();
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <CollectionIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={fav.collectionPath}
                                            secondary={fav.projectName || fav.projectId}
                                            primaryTypographyProps={{
                                                fontSize: '0.85rem',
                                                noWrap: true,
                                            }}
                                            secondaryTypographyProps={{
                                                fontSize: '0.75rem',
                                                noWrap: true,
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}

export default FavoritesPanel;
