import React from 'react';
import {
    Box,
    Button,
    IconButton,
    Tooltip,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Chip,
} from '@mui/material';
import {
    FilterList as FilterIcon,
    PlayArrow as RunIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
} from '@mui/icons-material';

function QueryBar({
    queryMode,
    setQueryMode,
    project,
    isCollectionFavorite,
    onToggleFavorite,
    onRunQuery,
    limit,
    setLimit,
}) {
    // const theme = useTheme(); // If complex logic needed, but here we use system props
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider', gap: 1, bgcolor: 'background.default' }}>
            <ToggleButtonGroup value={queryMode} exclusive onChange={(_, v) => v && setQueryMode(v)} size="small">
                <ToggleButton value="simple" sx={{ textTransform: 'none', px: 1.5 }}>
                    <FilterIcon sx={{ fontSize: 16, mr: 0.5 }} /> Simple
                </ToggleButton>
                <ToggleButton value="js" sx={{ textTransform: 'none', px: 1.5, fontFamily: 'monospace' }}>
                    JS Query
                </ToggleButton>
            </ToggleButtonGroup>

            <Chip label={project?.projectId} size="small" sx={{ bgcolor: 'action.selected', ml: 1 }} />

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title={isCollectionFavorite ? "Remove from favorites" : "Add to favorites"}>
                <IconButton size="small" onClick={onToggleFavorite}>
                    {isCollectionFavorite ? (
                        <StarIcon sx={{ fontSize: 18, color: '#ffc107' }} />
                    ) : (
                        <StarBorderIcon sx={{ fontSize: 18 }} />
                    )}
                </IconButton>
            </Tooltip>
            <Tooltip title={`Run Query (F5)\n${queryMode === 'js' ? 'Executes JS Query' : 'Executes Simple Query'}`}>
                <Button variant="contained" size="small" onClick={onRunQuery} startIcon={<RunIcon />} sx={{ ml: 1 }}>
                    Run (F5)
                </Button>
            </Tooltip>
            <TextField
                size="small"
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                label="#"
                sx={{ width: 60, ml: 1 }}
                inputProps={{ min: 1, max: 500 }}
            />
        </Box>
    );
}

export default QueryBar;
