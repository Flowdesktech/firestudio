import React, { useEffect, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';

const MAX_VISIBLE_ROWS = 100;

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
    const isDark = theme.palette.mode === 'dark';

    // Use custom table colors from theme, or fallback
    const tableColors = theme.custom.table;

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
                                        onDoubleClick={() => !isEditing && onCellEdit(doc.id, f, value)}
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
        </Box>
    );
}

export default TableView;
