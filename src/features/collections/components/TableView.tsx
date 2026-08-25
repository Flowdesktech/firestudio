import React, { useEffect, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { isFirestoreTimestamp, isUnixTimestampMs } from '../../../shared/utils/dateUtils';
import { FirestoreValue } from '../../../shared/utils/firestoreUtils';
import { Document } from '../store/collectionSlice';
import { TableThemeColors } from '../../../app/theme';

// Sub-components
import TableHeaders from './table/TableHeaders';
import TableRow from './table/TableRow';
import EditDialog from './table/EditDialog';
import BooleanPopover from './table/BooleanPopover';
import DatePopover from './table/DatePopover';

const MAX_VISIBLE_ROWS = 100;
const LONG_TEXT_THRESHOLD = 50;

interface TableViewProps {
  documents: Document[];
  visibleFields: string[];
  editingCell: { docId: string; field: string } | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onCellEdit: (docId: string | null, field: string | null, value: FirestoreValue, selectOnly?: boolean) => void;
  onCellSave: (docId?: string, field?: string, value?: FirestoreValue) => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  columnWidths: Record<string, number>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  getType: (value: FirestoreValue) => string;
  getTypeColor: (type: string, isDark: boolean) => string;
  formatValue: (value: FirestoreValue, type: string) => string;
  selectedRows: string[];
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>;
}

const TableView: React.FC<TableViewProps> = ({
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
  selectedRows,
  setSelectedRows,
}) => {
  const theme = useTheme();
  const resizingRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ docId: string; field: string } | null>(null);

  // Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogData, setEditDialogData] = useState<{
    docId: string;
    field: string;
    value: string;
    originalType?: string;
  }>({ docId: '', field: '', value: '' });

  // Popover States
  const [boolMenuAnchor, setBoolMenuAnchor] = useState<HTMLElement | null>(null);
  const [boolMenuData, setBoolMenuData] = useState<{ docId: string; field: string; value: FirestoreValue }>({
    docId: '',
    field: '',
    value: false,
  });

  const [dateMenuAnchor, setDateMenuAnchor] = useState<HTMLElement | null>(null);
  const [dateMenuData, setDateMenuData] = useState<{
    docId: string;
    field: string;
    value: FirestoreValue;
    originalValue: FirestoreValue;
  }>({ docId: '', field: '', value: '', originalValue: null });
  const [tempDateValue, setTempDateValue] = useState('');

  const tableColors: TableThemeColors = theme.custom.table;
  const cellBorder = `1px solid ${tableColors.border}`;

  // --- Helpers ---

  const shouldUseDialogEditor = (value: FirestoreValue) => {
    if (isFirestoreTimestamp(value) || value instanceof Date) return false;
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return true;
    if (typeof value === 'string') {
      return value.includes('\n') || value.length > LONG_TEXT_THRESHOLD;
    }
    return false;
  };

  const formatValueForDialog = (value: FirestoreValue) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();

    if (isFirestoreTimestamp(value)) {
      const seconds = value._seconds ?? value.seconds ?? 0;
      const date = new Date(seconds * 1000);
      return date.toISOString();
    }

    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value, null, 2);
  };

  // --- Handlers ---

  const handleSelectCell = (
    docId: string | null,
    field: string | null,
    value: FirestoreValue,
    selectOnly?: boolean,
  ) => {
    if (selectOnly) {
      if (docId && field) {
        setSelectedCell({ docId, field });
      } else {
        setSelectedCell(null);
      }
      // If we were editing another cell, save it? handled by blur usually
    } else {
      // Start Editing
      // (Logic passed from parent usually handles setEditingCell)
      onCellEdit(docId, field, value);
    }
  };

  const handleCellDoubleClick = (docId: string, field: string, value: FirestoreValue) => {
    if (shouldUseDialogEditor(value)) {
      setEditDialogData({
        docId,
        field,
        value: formatValueForDialog(value),
        originalType:
          typeof value === 'object' && value !== null
            ? isFirestoreTimestamp(value)
              ? 'timestamp'
              : Array.isArray(value)
                ? 'array'
                : 'object'
            : typeof value,
      });
      setEditDialogOpen(true);
    } else {
      // Start inline edit
      onCellEdit(docId, field, value);
    }
  };

  const handleDialogSave = () => {
    let parsedValue: FirestoreValue = editDialogData.value;
    if (editDialogData.originalType === 'array' || editDialogData.originalType === 'object') {
      try {
        parsedValue = JSON.parse(editDialogData.value);
      } catch (e) {
        console.warn('Failed to parse JSON:', e);
      }
    } else if (editDialogData.originalType === 'timestamp') {
      parsedValue = editDialogData.value;
    }
    onCellSave(editDialogData.docId, editDialogData.field, parsedValue);
    setEditDialogOpen(false);
    setSelectedCell(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const displayedDocs = documents.slice(0, MAX_VISIBLE_ROWS);
    const allSelected = displayedDocs.length > 0 && displayedDocs.every((doc) => selectedRows?.includes(doc.id));
    if (allSelected) {
      setSelectedRows?.([]);
    } else {
      setSelectedRows?.(displayedDocs.map((doc) => doc.id));
    }
  };

  const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    e.stopPropagation();
    setSelectedRows?.((prev) => {
      if (prev?.includes(docId)) return prev.filter((id) => id !== docId);
      return [...(prev || []), docId];
    });
  };

  // --- Resizing ---
  const getColWidth = (field: string) => columnWidths[field] || 150;

  const handleResizeStart = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[field] || 150;
    resizingRef.current = { field, startX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { field, startX, startWidth } = resizingRef.current;
      const diff = e.clientX - startX;
      setColumnWidths((prev) => ({ ...prev, [field]: Math.max(60, startWidth + diff) }));
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

  // Reset editing state
  useEffect(() => {
    if (!editingCell) {
      setBoolMenuAnchor(null);
      setDateMenuAnchor(null);
    }
  }, [editingCell]);

  const displayedDocs = documents.slice(0, MAX_VISIBLE_ROWS);
  const allSelected = displayedDocs.length > 0 && displayedDocs.every((doc) => selectedRows?.includes(doc.id));
  const someSelected = displayedDocs.some((doc) => selectedRows?.includes(doc.id)) && !allSelected;
  const gridColumns = `40px ${getColWidth('__docId__')}px ${visibleFields.map((f) => `${getColWidth(f)}px`).join(' ')}`;

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative', bgcolor: tableColors.rowBg }}>
      {documents.length > MAX_VISIBLE_ROWS && (
        <Box
          sx={{
            p: 0.5,
            backgroundColor: theme.palette.warning.main,
            color: theme.palette.warning.contrastText || '#000',
            fontSize: '0.75rem',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          Showing first {MAX_VISIBLE_ROWS} of {documents.length} rows for performance
        </Box>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          fontSize: '0.8rem',
          minWidth: 'max-content',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <TableHeaders
          visibleFields={visibleFields}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={handleSelectAll}
          onResizeStart={handleResizeStart}
          cellBorder={cellBorder}
          tableColors={tableColors}
        />

        {displayedDocs.map((doc, rowIndex) => (
          <TableRow
            key={doc.id}
            doc={doc}
            rowIndex={rowIndex}
            visibleFields={visibleFields}
            selectedRows={selectedRows}
            editingCell={editingCell}
            selectedCell={selectedCell}
            editValue={editValue}
            setEditValue={setEditValue}
            onSelectRow={handleSelectRow}
            onCellEdit={handleSelectCell}
            onCellSave={onCellSave}
            onCellKeyDown={onCellKeyDown}
            onCellDoubleClick={handleCellDoubleClick}
            getType={getType}
            getTypeColor={getTypeColor}
            formatValue={formatValue}
            tableColors={tableColors}
            cellBorder={cellBorder}
            setBoolMenuAnchor={setBoolMenuAnchor}
            setBoolMenuData={setBoolMenuData}
            setDateMenuAnchor={setDateMenuAnchor}
            setDateMenuData={setDateMenuData}
            setTempDateValue={setTempDateValue}
          />
        ))}
      </div>

      {documents.length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No documents found</Box>
      )}

      <EditDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedCell(null);
        }}
        onSave={handleDialogSave}
        data={editDialogData}
        setData={setEditDialogData}
      />

      <BooleanPopover
        anchorEl={boolMenuAnchor}
        onClose={() => {
          setBoolMenuAnchor(null);
          onCellEdit(null, null, null); // Cancel
        }}
        onSelect={(val) => {
          setBoolMenuAnchor(null);
          onCellSave(boolMenuData.docId, boolMenuData.field, val);
        }}
        currentValue={editValue}
      />

      <DatePopover
        anchorEl={dateMenuAnchor}
        onClose={() => {
          setDateMenuAnchor(null);
          onCellEdit(null, null, null);
        }}
        onSelect={(val) => {
          let finalValue: FirestoreValue = val;
          const dateObj = new Date(val);

          if (!isNaN(dateObj.getTime())) {
            const original = dateMenuData.originalValue;
            if (isFirestoreTimestamp(original)) {
              const seconds = Math.floor(dateObj.getTime() / 1000);
              const nanoseconds = (dateObj.getTime() % 1000) * 1000000;
              if (original._seconds !== undefined) {
                finalValue = { _seconds: seconds, _nanoseconds: nanoseconds };
              } else {
                finalValue = { seconds: seconds, nanoseconds: nanoseconds };
              }
            } else if (isUnixTimestampMs(original)) {
              finalValue = dateObj.getTime();
            } else if (original instanceof Date) {
              finalValue = dateObj;
            }
          }

          setDateMenuAnchor(null);
          onCellSave(dateMenuData.docId, dateMenuData.field, finalValue);
        }}
        initialValue={tempDateValue}
        originalValue={dateMenuData.originalValue}
      />
    </Box>
  );
};

export default TableView;
