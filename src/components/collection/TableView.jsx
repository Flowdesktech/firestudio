import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

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
    isDark,
    borderColor,
    bgColor,
    textColor,
    mutedColor,
}) {
    const resizingRef = useRef(null);

    const getColWidth = (field) => columnWidths[field] || 120;

    const handleResizeStart = (e, field) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = columnWidths[field] || 100;
        resizingRef.current = { field, startX, startWidth };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizingRef.current) return;
            const { field, startX, startWidth } = resizingRef.current;
            const diff = e.clientX - startX;
            const newWidth = Math.max(50, startWidth + diff);
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

    const displayedDocs = documents.slice(0, MAX_VISIBLE_ROWS);
    const gridColumns = `${getColWidth('__docId__')}px ${visibleFields.map(f => `${getColWidth(f)}px`).join(' ')}`;

    return (
        <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
            {documents.length > MAX_VISIBLE_ROWS && (
                <Box sx={{ p: 0.5, backgroundColor: '#ff9800', color: '#000', fontSize: '0.75rem', textAlign: 'center' }}>
                    Showing first {MAX_VISIBLE_ROWS} of {documents.length} rows for performance
                </Box>
            )}
            <div style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                fontSize: '0.8rem',
                minWidth: 'max-content',
            }}>
                {/* Header Row */}
                <div
                    title="Doc ID"
                    style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: bgColor,
                        padding: '8px 12px',
                        fontWeight: 600,
                        color: mutedColor,
                        fontStyle: 'italic',
                        borderBottom: `1px solid ${borderColor}`,
                        borderRight: `1px solid ${borderColor}`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                    }}
                >
                    Doc ID
                    <div
                        onMouseDown={(e) => handleResizeStart(e, '__docId__')}
                        style={{
                            position: 'absolute',
                            right: -3,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            cursor: 'col-resize',
                            zIndex: 20,
                        }}
                    />
                </div>
                {visibleFields.map((f) => (
                    <div
                        key={f}
                        title={f}
                        style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: bgColor,
                            padding: '8px 12px',
                            fontWeight: 600,
                            color: textColor,
                            borderBottom: `1px solid ${borderColor}`,
                            borderRight: `1px solid ${borderColor}`,
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
                                right: -3,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: 'col-resize',
                                zIndex: 20,
                            }}
                        />
                    </div>
                ))}

                {/* Data Rows */}
                {displayedDocs.map(doc => (
                    <React.Fragment key={doc.id}>
                        <div
                            title={doc.id}
                            style={{
                                padding: '6px 4px',
                                color: '#1976d2',
                                fontWeight: 500,
                                borderBottom: `1px solid ${borderColor}`,
                                borderRight: `1px solid ${borderColor}`,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {doc.id}
                        </div>
                        {visibleFields.map(f => {
                            const value = doc.data?.[f];
                            const type = getType(value);
                            const displayValue = value === undefined ? '—' :
                                (type === 'Array' || type === 'Map') ? JSON.stringify(value) : formatValue(value, type);
                            const isEditing = editingCell?.docId === doc.id && editingCell?.field === f;

                            return (
                                <div
                                    key={f}
                                    title={displayValue}
                                    onClick={() => !isEditing && onCellEdit(doc.id, f, value)}
                                    style={{
                                        padding: '6px 4px',
                                        borderBottom: `1px solid ${borderColor}`,
                                        borderRight: `1px solid ${borderColor}`,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: value === undefined ? mutedColor : getTypeColor(type),
                                        fontStyle: value === undefined ? 'italic' : 'normal',
                                        cursor: 'pointer',
                                    }}
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
                                                border: '1px solid #1976d2',
                                                outline: 'none',
                                                padding: '2px 4px',
                                                fontSize: '0.8rem',
                                                fontFamily: 'monospace',
                                                backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                                color: isDark ? '#fff' : '#000',
                                            }}
                                        />
                                    ) : displayValue}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </Box>
    );
}

export default TableView;
