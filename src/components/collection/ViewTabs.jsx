import React, { useRef, useEffect } from 'react';
import {
    Box,
    Button,
    IconButton,
    Tooltip,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    ViewList as TableIcon,
    AccountTree as TreeIcon,
    Code as JsonIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    FileDownload as ExportIcon,
    FileUpload as ImportIcon,
    Settings as SettingsIcon,
    ViewColumn as ColumnsIcon,
} from '@mui/icons-material';

function ViewTabs({
    viewMode,
    setViewMode,
    documentsCount,
    onRefresh,
    onExport,
    onImport,
    onAdd,
    allFields,
    visibleFields,
    hiddenColumns,
    setHiddenColumns,
    isDark,
    borderColor,
    textColor,
    mutedColor,
}) {
    const [columnsMenuAnchor, setColumnsMenuAnchor] = React.useState(null);
    const columnsMenuRef = useRef(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)) {
                setColumnsMenuAnchor(null);
            }
        };

        if (columnsMenuAnchor) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [columnsMenuAnchor]);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${borderColor}` }}>
            <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small" sx={{ m: 0.5 }}>
                <ToggleButton value="table" sx={{ textTransform: 'none', px: 1 }}><TableIcon sx={{ fontSize: 16, mr: 0.5 }} />Table</ToggleButton>
                <ToggleButton value="tree" sx={{ textTransform: 'none', px: 1 }}><TreeIcon sx={{ fontSize: 16, mr: 0.5 }} />Tree</ToggleButton>
                <ToggleButton value="json" sx={{ textTransform: 'none', px: 1 }}><JsonIcon sx={{ fontSize: 16, mr: 0.5 }} />JSON</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flexGrow: 1 }} />
            <Typography sx={{ fontSize: '0.75rem', color: mutedColor, mr: 1 }}>{documentsCount} doc{documentsCount !== 1 ? 's' : ''}</Typography>
            {viewMode === 'table' && (
                <Box sx={{ position: 'relative' }} ref={columnsMenuRef}>
                    <Tooltip title="Show/Hide Columns">
                        <Button
                            size="small"
                            onClick={(e) => setColumnsMenuAnchor(columnsMenuAnchor ? null : e.currentTarget)}
                            startIcon={<ColumnsIcon sx={{ fontSize: 16 }} />}
                            sx={{ textTransform: 'none', fontSize: '0.75rem', mr: 1 }}
                        >
                            Columns
                        </Button>
                    </Tooltip>
                    {columnsMenuAnchor && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                mt: 0.5,
                                backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                border: `1px solid ${borderColor}`,
                                borderRadius: 1,
                                boxShadow: 3,
                                zIndex: 1000,
                                minWidth: 200,
                                maxHeight: 300,
                                overflow: 'auto',
                                p: 1,
                            }}
                        >
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 1, color: mutedColor }}>
                                Toggle Columns ({visibleFields.length}/{allFields.length})
                            </Typography>
                            {allFields.map(field => (
                                <Box
                                    key={field}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        py: 0.5,
                                        px: 0.5,
                                        borderRadius: 0.5,
                                        cursor: 'pointer',
                                        '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' }
                                    }}
                                    onClick={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                                >
                                    <input
                                        type="checkbox"
                                        checked={!hiddenColumns[field]}
                                        onChange={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <Typography sx={{ fontSize: '0.8rem', color: textColor }}>{field}</Typography>
                                </Box>
                            ))}
                            {allFields.length === 0 && (
                                <Typography sx={{ fontSize: '0.75rem', color: mutedColor }}>No columns</Typography>
                            )}
                        </Box>
                    )}
                </Box>
            )}
            <Tooltip title="Refresh"><IconButton size="small" onClick={onRefresh}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="Export"><IconButton size="small" onClick={onExport}><ExportIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="Import"><IconButton size="small" onClick={onImport}><ImportIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="Add"><IconButton size="small" onClick={onAdd}><AddIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="Settings"><IconButton size="small"><SettingsIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
        </Box>
    );
}

export default ViewTabs;
