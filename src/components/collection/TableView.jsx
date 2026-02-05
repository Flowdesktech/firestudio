import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Popover,
} from '@mui/material';

const MAX_VISIBLE_ROWS = 100;
const LONG_TEXT_THRESHOLD = 50; // Open dialog if text is longer than this

function TableView({
    documents,
    visibleFields,
    editingCell,
    editValue,
    setEditValue,
    onCellEdit,
    onCellSave,
    onCellKeyDown,
    columnWidths,
    setColumnWidths,
    getType,
    getTypeColor,
    formatValue,
    selectedRowsCount,
    selectedRows,
    setSelectedRows,
}) {
    const theme = useTheme();
    const resizingRef = useRef(null);
    const [selectedCell, setSelectedCell] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState({ docId: '', field: '', value: '' });
    const [boolMenuAnchor, setBoolMenuAnchor] = useState(null);
    const [boolMenuData, setBoolMenuData] = useState({ docId: '', field: '', value: false });
    const [boolPopoverShown, setBoolPopoverShown] = useState(false);
    const boolAnchorRef = useRef(null);

    // Date picker state
    const [dateMenuAnchor, setDateMenuAnchor] = useState(null);
    const [dateMenuData, setDateMenuData] = useState({ docId: '', field: '', value: '', originalValue: null });
    const [tempDateValue, setTempDateValue] = useState('');

    const isDark = theme.palette.mode === 'dark';

    // Use custom table colors from theme, or fallback
    const tableColors = theme.custom.table;

    // Check if value is an ISO date string
    const isIsoDateString = (value) => {
        if (typeof value !== 'string') return false;
        // Match ISO 8601 format: 2024-01-15T10:30:00.000Z
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value);
    };

    // Check if value is a unix timestamp number (milliseconds)
    const isUnixTimestampMs = (value) => {
        if (typeof value !== 'number') return false;
        // Reasonable range for millisecond timestamps (year 2000 to 2100)
        return value > 946684800000 && value < 4102444800000;
    };

    // Check if value is a Firestore timestamp object
    const isFirestoreTimestamp = (value) => {
        return value && typeof value === 'object' &&
            (value._seconds !== undefined || value.seconds !== undefined);
    };

    // Get the date-time type for a value
    const getDateTimeType = (value) => {
        if (isFirestoreTimestamp(value)) return 'firestore-timestamp';
        if (isUnixTimestampMs(value)) return 'unix-ms';
        if (isIsoDateString(value)) return 'iso-string';
        return null;
    };

    // Convert any date value to Date object
    const toDate = (value, dateType) => {
        if (dateType === 'firestore-timestamp') {
            const seconds = value._seconds ?? value.seconds;
            return new Date(seconds * 1000);
        }
        if (dateType === 'unix-ms') {
            return new Date(value);
        }
        if (dateType === 'iso-string') {
            return new Date(value);
        }
        return null;
    };

    // Check if value should use dialog editor (multi-line, long text, or complex types)
    const shouldUseDialogEditor = (value) => {
        // Arrays and Objects should use dialog
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return true;
        }
        // Strings: check for multi-line or long text
        if (typeof value === 'string') {
            return value.includes('\n') || value.length > LONG_TEXT_THRESHOLD;
        }
        return false;
    };

    // Format value for dialog editing
    const formatValueForDialog = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'number') return value.toString();

        // Handle Firestore Timestamp (has _seconds and _nanoseconds or seconds and nanoseconds)
        if (value && (value._seconds !== undefined || value.seconds !== undefined)) {
            const seconds = value._seconds ?? value.seconds;
            const date = new Date(seconds * 1000);
            return date.toISOString();
        }

        // Handle Date objects
        if (value instanceof Date) {
            return value.toISOString();
        }

        // Handle arrays and objects
        return JSON.stringify(value, null, 2);
    };

    // Handle cell double-click - open dialog for long/multiline text
    const handleCellDoubleClick = (docId, field, value) => {
        if (shouldUseDialogEditor(value)) {
            setEditDialogData({
                docId,
                field,
                value: formatValueForDialog(value),
                originalType: typeof value === 'object' && value !== null
                    ? (value._seconds !== undefined || value.seconds !== undefined ? 'timestamp' : (Array.isArray(value) ? 'array' : 'object'))
                    : typeof value
            });
            setEditDialogOpen(true);
        } else {
            onCellEdit(docId, field, value);
        }
    };

    // Handle dialog save
    const handleDialogSave = () => {
        // Parse the value based on original type
        let parsedValue = editDialogData.value;

        // Try to parse JSON for arrays and objects
        if (editDialogData.originalType === 'array' || editDialogData.originalType === 'object') {
            try {
                parsedValue = JSON.parse(editDialogData.value);
            } catch (e) {
                // If JSON parse fails, keep as string
                console.warn('Failed to parse JSON:', e);
            }
        } else if (editDialogData.originalType === 'timestamp') {
            // Keep as ISO string - the save handler will convert it
            parsedValue = editDialogData.value;
        }

        // Save directly with explicit values to avoid stale closure issues
        onCellSave(editDialogData.docId, editDialogData.field, parsedValue);

        // Close dialog and clear selected cell
        setEditDialogOpen(false);
        setSelectedCell(null);
    };

    // Handle dialog close (cancel)
    const handleDialogClose = () => {
        setEditDialogOpen(false);
        setSelectedCell(null);
    };

    const displayedDocs = documents.slice(0, MAX_VISIBLE_ROWS);
    const allSelected = displayedDocs.length > 0 && displayedDocs.every(doc => selectedRows?.includes(doc.id));
    const someSelected = displayedDocs.some(doc => selectedRows?.includes(doc.id)) && !allSelected;

    const handleSelectAll = (e) => {
        e.stopPropagation();
        if (allSelected) {
            setSelectedRows?.([]);
        } else {
            setSelectedRows?.(displayedDocs.map(doc => doc.id));
        }
    };

    const handleSelectRow = (e, docId) => {
        e.stopPropagation();
        setSelectedRows?.(prev => {
            if (prev?.includes(docId)) {
                return prev.filter(id => id !== docId);
            } else {
                return [...(prev || []), docId];
            }
        });
    };

    const getColWidth = (field) => columnWidths[field] || 150;

    const handleResizeStart = (e, field) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = columnWidths[field] || 150;
        resizingRef.current = { field, startX, startWidth };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    // Reset boolean and date menu state when editing cell changes
    useEffect(() => {
        if (!editingCell) {
            setBoolMenuAnchor(null);
            setBoolPopoverShown(false);
            setDateMenuAnchor(null);
        }
    }, [editingCell]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizingRef.current) return;
            const { field, startX, startWidth } = resizingRef.current;
            const diff = e.clientX - startX;
            const newWidth = Math.max(60, startWidth + diff);
            setColumnWidths(prev => ({ ...prev, [field]: newWidth }));
        };

        const handleMouseUp = () => {
            if (!resizingRef.current) return;
            resizingRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setColumnWidths]);

    const gridColumns = `40px ${getColWidth('__docId__')}px ${visibleFields.map(f => `${getColWidth(f)}px`).join(' ')}`;

    // Cell styling helper
    const cellBorder = `1px solid ${tableColors.border}`;

    return (
        <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative', bgcolor: tableColors.rowBg }}>
            {documents.length > MAX_VISIBLE_ROWS && (
                <Box sx={{
                    p: 0.5,
                    backgroundColor: theme.palette.warning.main,
                    color: theme.palette.warning.contrastText || '#000',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    fontWeight: 500,
                }}>
                    Showing first {MAX_VISIBLE_ROWS} of {documents.length} rows for performance
                </Box>
            )}
            <div style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                fontSize: '0.8rem',
                minWidth: 'max-content',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
                {/* Header Row */}
                {/* Checkbox header */}
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: tableColors.headerBg,
                        padding: '8px',
                        borderBottom: cellBorder,
                        borderRight: cellBorder,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={handleSelectAll}
                        style={{
                            cursor: 'pointer',
                            width: 16,
                            height: 16,
                            accentColor: theme.palette.primary.main,
                        }}
                    />
                </div>
                <div
                    title="Document ID"
                    style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: tableColors.headerBg,
                        padding: '8px 12px',
                        fontWeight: 600,
                        color: tableColors.headerText,
                        fontStyle: 'italic',
                        borderBottom: cellBorder,
                        borderRight: cellBorder,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                    }}
                >
                    <span style={{ opacity: 0.8 }}>Document ID</span>
                    <div
                        onMouseDown={(e) => handleResizeStart(e, '__docId__')}
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            cursor: 'col-resize',
                            zIndex: 20,
                            background: 'transparent',
                        }}
                        onMouseEnter={(e) => e.target.style.background = theme.palette.primary.main + '40'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    />
                </div>
                {visibleFields.map((f) => (
                    <div
                        key={f}
                        title={f}
                        style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: tableColors.headerBg,
                            padding: '8px 12px',
                            fontWeight: 600,
                            color: tableColors.headerText,
                            borderBottom: cellBorder,
                            borderRight: cellBorder,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                        }}
                    >
                        {f}
                        <div
                            onMouseDown={(e) => handleResizeStart(e, f)}
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: 'col-resize',
                                zIndex: 20,
                                background: 'transparent',
                            }}
                            onMouseEnter={(e) => e.target.style.background = theme.palette.primary.main + '40'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        />
                    </div>
                ))}

                {/* Data Rows */}
                {displayedDocs.map((doc, rowIndex) => {
                    const isRowSelected = selectedRows?.includes(doc.id);
                    const rowBg = isRowSelected
                        ? tableColors.rowSelected
                        : rowIndex % 2 === 0
                            ? tableColors.rowBg
                            : tableColors.rowAltBg;

                    return (
                        <React.Fragment key={doc.id}>
                            {/* Row checkbox */}
                            <div
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: cellBorder,
                                    borderRight: cellBorder,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: rowBg,
                                    transition: 'background-color 0.1s ease',
                                }}
                                onMouseEnter={(e) => { if (!isRowSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover; }}
                                onMouseLeave={(e) => { if (!isRowSelected) e.currentTarget.style.backgroundColor = rowBg; }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isRowSelected}
                                    onChange={(e) => handleSelectRow(e, doc.id)}
                                    style={{
                                        cursor: 'pointer',
                                        width: 16,
                                        height: 16,
                                        accentColor: theme.palette.primary.main,
                                    }}
                                />
                            </div>
                            {/* Document ID */}
                            <div
                                title={doc.id}
                                style={{
                                    padding: '6px 8px',
                                    color: theme.palette.primary.main,
                                    fontWeight: 500,
                                    fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                    fontSize: '0.75rem',
                                    borderBottom: cellBorder,
                                    borderRight: cellBorder,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    backgroundColor: rowBg,
                                    transition: 'background-color 0.1s ease',
                                }}
                                onMouseEnter={(e) => { if (!isRowSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover; }}
                                onMouseLeave={(e) => { if (!isRowSelected) e.currentTarget.style.backgroundColor = rowBg; }}
                            >
                                {doc.id}
                            </div>
                            {/* Field cells */}
                            {visibleFields.map(f => {
                                const value = doc.data?.[f];
                                const type = getType(value);
                                const displayValue = value === undefined ? '—' :
                                    (type === 'Array' || type === 'Map') ? JSON.stringify(value) : formatValue(value, type);
                                const isEditing = editingCell?.docId === doc.id && editingCell?.field === f;
                                const isSelected = selectedCell?.docId === doc.id && selectedCell?.field === f;

                                return (
                                    <div
                                        key={f}
                                        title={typeof displayValue === 'string' ? displayValue : String(displayValue)}
                                        onClick={() => setSelectedCell({ docId: doc.id, field: f })}
                                        onDoubleClick={() => !isEditing && handleCellDoubleClick(doc.id, f, value)}
                                        style={{
                                            padding: '6px 8px',
                                            borderBottom: cellBorder,
                                            borderRight: cellBorder,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            color: value === undefined
                                                ? (isDark ? '#6b6b6b' : '#a0a0a0')
                                                : getTypeColor(type, isDark),
                                            fontStyle: value === undefined ? 'italic' : 'normal',
                                            fontFamily: (type === 'Array' || type === 'Map' || type === 'String')
                                                ? '"Cascadia Code", "Fira Code", Consolas, monospace'
                                                : 'inherit',
                                            fontSize: '0.8rem',
                                            cursor: 'default',
                                            outline: isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
                                            outlineOffset: '-2px',
                                            backgroundColor: isSelected ? (isDark ? '#264f78' : '#cce5ff') : rowBg,
                                            transition: 'background-color 0.1s ease',
                                        }}
                                        onMouseEnter={(e) => { if (!isRowSelected && !isSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover; }}
                                        onMouseLeave={(e) => { if (!isRowSelected && !isSelected) e.currentTarget.style.backgroundColor = rowBg; }}
                                    >
                                        {isEditing ? (
                                            // Boolean: show MUI Menu
                                            type === 'Boolean' ? (
                                                <Box
                                                    id={`bool-anchor-${doc.id}-${f}`}
                                                    ref={(el) => {
                                                        // Only set anchor once when element is mounted, no anchor exists, and popover hasn't been shown yet
                                                        if (el && !boolMenuAnchor && !boolPopoverShown) {
                                                            setBoolMenuAnchor(el);
                                                            setBoolMenuData({ docId: doc.id, field: f, value: value });
                                                            setBoolPopoverShown(true);
                                                        }
                                                    }}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        fontSize: '0.8rem',
                                                        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                                        color: editValue === 'true' ? '#4caf50' : '#f44336',
                                                    }}
                                                >
                                                    {editValue} ▾
                                                </Box>
                                            ) : (isFirestoreTimestamp(value) || isUnixTimestampMs(value) || isIsoDateString(value) || type === 'Timestamp') ? (
                                                // Timestamp/Date: show popover trigger
                                                <Box
                                                    id={`date-anchor-${doc.id}-${f}`}
                                                    ref={(el) => {
                                                        // Set anchor when element mounts and no anchor exists
                                                        if (el && !dateMenuAnchor) {
                                                            setDateMenuAnchor(el);

                                                            // Convert value to datetime-local format based on type
                                                            let dateValue;
                                                            if (isFirestoreTimestamp(value)) {
                                                                const seconds = value._seconds ?? value.seconds;
                                                                dateValue = new Date(seconds * 1000);
                                                            } else if (isUnixTimestampMs(value)) {
                                                                dateValue = new Date(value);
                                                            } else if (isIsoDateString(value) || typeof value === 'string') {
                                                                dateValue = new Date(value);
                                                            } else {
                                                                dateValue = new Date(editValue);
                                                            }

                                                            if (!isNaN(dateValue.getTime())) {
                                                                setTempDateValue(dateValue.toISOString().slice(0, 19));
                                                            }

                                                            setDateMenuData({ docId: doc.id, field: f, value: editValue, originalValue: value });
                                                        }
                                                    }}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                        fontSize: '0.75rem',
                                                        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                                        color: theme.palette.primary.main,
                                                    }}
                                                >
                                                    {(() => {
                                                        let dateValue;
                                                        if (isFirestoreTimestamp(value)) {
                                                            const seconds = value._seconds ?? value.seconds;
                                                            dateValue = new Date(seconds * 1000);
                                                        } else if (isUnixTimestampMs(value)) {
                                                            dateValue = new Date(value);
                                                        } else {
                                                            dateValue = new Date(editValue);
                                                        }

                                                        if (!isNaN(dateValue.getTime())) {
                                                            return dateValue.toLocaleString();
                                                        }
                                                        return editValue;
                                                    })()} 📅
                                                </Box>
                                            ) : (
                                                // Default: text input
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={onCellSave}
                                                    onKeyDown={onCellKeyDown}
                                                    autoFocus
                                                    style={{
                                                        width: '100%',
                                                        border: 'none',
                                                        outline: 'none',
                                                        padding: 0,
                                                        margin: 0,
                                                        fontSize: '0.8rem',
                                                        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                                        backgroundColor: 'transparent',
                                                        color: theme.palette.text.primary,
                                                    }}
                                                />
                                            )
                                        ) : displayValue}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </div>
            {documents.length === 0 && (
                <Box sx={{
                    p: 4,
                    textAlign: 'center',
                    color: 'text.secondary',
                }}>
                    No documents found
                </Box>
            )}

            {/* Edit Dialog for Multi-line/Long Text */}
            <Dialog
                open={editDialogOpen}
                onClose={handleDialogClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1 }}>
                    Edit Field
                    <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        {editDialogData.docId} → {editDialogData.field}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {editDialogData.originalType && (
                        <Typography variant="caption" sx={{
                            display: 'inline-block',
                            bgcolor: 'action.hover',
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            color: 'text.secondary',
                            mb: 1,
                        }}>
                            Type: {editDialogData.originalType}
                            {editDialogData.originalType === 'timestamp' && ' (ISO 8601 format)'}
                        </Typography>
                    )}
                    <TextField
                        autoFocus
                        multiline
                        fullWidth
                        minRows={6}
                        maxRows={20}
                        value={editDialogData.value}
                        onChange={(e) => setEditDialogData(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => {
                            // Ctrl/Cmd + Enter to save
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleDialogSave();
                            }
                            // Escape to close
                            if (e.key === 'Escape') {
                                handleDialogClose();
                            }
                        }}
                        sx={{
                            mt: 1,
                            '& .MuiInputBase-input': {
                                fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                            },
                        }}
                        placeholder={editDialogData.originalType === 'timestamp'
                            ? '2024-01-15T10:30:00.000Z'
                            : editDialogData.originalType === 'array'
                                ? '["item1", "item2"]'
                                : editDialogData.originalType === 'object'
                                    ? '{"key": "value"}'
                                    : 'Enter value...'}
                    />
                    <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
                        Press Ctrl+Enter to save, Escape to cancel
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDialogClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleDialogSave} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Boolean Selector Popover */}
            <Popover
                open={Boolean(boolMenuAnchor)}
                anchorEl={boolMenuAnchor}
                onClose={() => {
                    setBoolMenuAnchor(null);
                    // Cancel - clear editing state to restore original value
                    onCellEdit(null, null, null);
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            boxShadow: 3,
                            borderRadius: 1,
                        }
                    }
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', p: 0.5 }}>
                    <Box
                        onClick={() => {
                            setBoolMenuAnchor(null);
                            // Save directly with explicit values to avoid stale closure issues
                            onCellSave(boolMenuData.docId, boolMenuData.field, true);
                        }}
                        sx={{
                            px: 2,
                            py: 0.75,
                            cursor: 'pointer',
                            borderRadius: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: editValue === 'true' ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                        }}
                    >
                        <Box sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#4caf50',
                        }} />
                        <Typography sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: '#4caf50',
                            fontWeight: editValue === 'true' ? 600 : 400,
                        }}>
                            true
                        </Typography>
                    </Box>
                    <Box
                        onClick={() => {
                            setBoolMenuAnchor(null);
                            // Save directly with explicit values to avoid stale closure issues
                            onCellSave(boolMenuData.docId, boolMenuData.field, false);
                        }}
                        sx={{
                            px: 2,
                            py: 0.75,
                            cursor: 'pointer',
                            borderRadius: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: editValue === 'false' ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                        }}
                    >
                        <Box sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#f44336',
                        }} />
                        <Typography sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: '#f44336',
                            fontWeight: editValue === 'false' ? 600 : 400,
                        }}>
                            false
                        </Typography>
                    </Box>
                </Box>
            </Popover>

            {/* Date Picker Popover */}
            <Popover
                open={Boolean(dateMenuAnchor)}
                anchorEl={dateMenuAnchor}
                onClose={() => {
                    setDateMenuAnchor(null);
                    // Cancel - clear editing state
                    onCellEdit(null, null, null);
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            boxShadow: 3,
                            borderRadius: 1,
                            p: 2,
                        }
                    }
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
                        Select Date & Time
                    </Typography>
                    <input
                        type="datetime-local"
                        step="1"
                        value={tempDateValue}
                        onChange={(e) => setTempDateValue(e.target.value)}
                        autoFocus
                        style={{
                            padding: '8px',
                            fontSize: '0.9rem',
                            fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '4px',
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            colorScheme: isDark ? 'dark' : 'light',
                        }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                            size="small"
                            onClick={() => {
                                setDateMenuAnchor(null);
                                // Cancel - clear editing state to restore original value
                                onCellEdit(null, null, null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                                setDateMenuAnchor(null);
                                // Convert datetime-local value back to original format
                                const date = new Date(tempDateValue);
                                const originalValue = dateMenuData.originalValue;

                                let finalValue;
                                if (isFirestoreTimestamp(originalValue)) {
                                    // Save as Firestore timestamp
                                    finalValue = {
                                        _seconds: Math.floor(date.getTime() / 1000),
                                        _nanoseconds: 0
                                    };
                                } else if (isUnixTimestampMs(originalValue)) {
                                    // Save as unix timestamp (milliseconds)
                                    finalValue = date.getTime();
                                } else {
                                    // Save as ISO string
                                    finalValue = date.toISOString();
                                }

                                onCellSave(dateMenuData.docId, dateMenuData.field, finalValue);
                            }}
                        >
                            OK
                        </Button>
                    </Box>
                </Box>
            </Popover>
        </Box>
    );
}

export default TableView;
