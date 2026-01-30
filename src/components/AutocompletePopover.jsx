/**
 * Autocomplete Popover Component
 * Reusable dropdown for code completion suggestions
 */

import React from 'react';
import { Paper, List, ListItem, ListItemText, Box, Typography } from '@mui/material';

function AutocompletePopover({
    show,
    items,
    selectedIndex,
    position,
    onSelect,
    maxWidth = 400,
}) {
    if (!show || items.length === 0) return null;

    return (
        <Paper
            elevation={16}
            sx={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                minWidth: 280,
                maxWidth: maxWidth,
                maxHeight: 220,
                overflow: 'auto',
                zIndex: 99999,
                border: 1,
                borderColor: 'divider',
                boxShadow: 8,
            }}
        >
            <List dense sx={{ py: 0.5 }}>
                {items.map((item, index) => (
                    <ListItem
                        key={`${item.trigger}-${index}`}
                        onClick={() => onSelect(item)}
                        sx={{
                            py: 0.5,
                            px: 1,
                            cursor: 'pointer',
                            bgcolor: index === selectedIndex ? 'action.selected' : 'transparent',
                            '&:hover': {
                                bgcolor: 'action.hover',
                            },
                        }}
                    >
                        <ListItemText
                            primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontFamily: '"Cascadia Code", monospace',
                                            fontSize: '0.8rem',
                                            color: 'primary.main',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {item.trigger}
                                    </Typography>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontFamily: '"Cascadia Code", monospace',
                                            fontSize: '0.75rem',
                                            color: 'text.disabled',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {item.suggestion}
                                    </Typography>
                                </Box>
                            }
                            secondary={item.description}
                            secondaryTypographyProps={{
                                sx: { fontSize: '0.7rem', color: 'text.secondary' }
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
}

export default AutocompletePopover;
