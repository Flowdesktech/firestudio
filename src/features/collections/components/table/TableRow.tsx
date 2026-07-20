import React from 'react';
import { useTheme } from '@mui/material';
import { MONOSPACE_FONT_FAMILY } from '../../../../shared/utils/constants';
import CellRenderer from './CellRenderer';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import { Document } from '../../store/collectionSlice';
import { TableThemeColors } from '../../../../app/theme';

interface TableRowProps {
  doc: Document; // Firestore document with id and data
  rowIndex: number;
  visibleFields: string[];
  selectedRows: string[];
  editingCell: { docId: string; field: string } | null;
  selectedCell: { docId: string; field: string } | null;
  editValue: string;
  setEditValue: (val: string) => void;
  onSelectRow: (e: React.ChangeEvent<HTMLInputElement>, docId: string) => void;
  onCellEdit: (docId: string | null, field: string | null, value: FirestoreValue, selectOnly?: boolean) => void;
  onCellSave: (docId?: string, field?: string, value?: FirestoreValue) => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onCellDoubleClick: (docId: string, field: string, value: FirestoreValue) => void;
  getType: (val: FirestoreValue) => string;
  getTypeColor: (type: string, isDark: boolean) => string;
  formatValue: (val: FirestoreValue, type: string) => string;
  tableColors: TableThemeColors;
  cellBorder: string;
  // Popover setters
  setBoolMenuAnchor: (el: HTMLElement | null) => void;
  setBoolMenuData: (data: { docId: string; field: string; value: FirestoreValue }) => void;
  setDateMenuAnchor: (el: HTMLElement | null) => void;
  setDateMenuData: (data: {
    docId: string;
    field: string;
    value: FirestoreValue;
    originalValue: FirestoreValue;
  }) => void;
  setTempDateValue: (value: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({
  doc,
  rowIndex,
  visibleFields,
  selectedRows,
  editingCell,
  selectedCell,
  editValue,
  setEditValue,
  onSelectRow,
  onCellEdit,
  onCellSave,
  onCellKeyDown,
  onCellDoubleClick,
  getType,
  getTypeColor,
  formatValue,
  tableColors,
  cellBorder,
  // Popover setters
  setBoolMenuAnchor,
  setBoolMenuData,
  setDateMenuAnchor,
  setDateMenuData,
  setTempDateValue,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isRowSelected = selectedRows?.includes(doc.id);
  const rowBg = isRowSelected ? tableColors.rowSelected : rowIndex % 2 === 0 ? tableColors.rowBg : tableColors.rowAltBg;

  return (
    <React.Fragment>
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
        onMouseEnter={(e) => {
          if (!isRowSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover;
        }}
        onMouseLeave={(e) => {
          if (!isRowSelected) e.currentTarget.style.backgroundColor = rowBg;
        }}
      >
        <input
          type="checkbox"
          checked={isRowSelected}
          onChange={(e) => onSelectRow(e, doc.id)}
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
        title={doc.missing ? `${doc.id} — no fields; exists as a parent of subcollections` : doc.id}
        style={{
          padding: '6px 8px',
          color: doc.missing ? theme.palette.text.disabled : theme.palette.primary.main,
          fontWeight: 500,
          fontStyle: doc.missing ? 'italic' : 'normal',
          fontFamily: MONOSPACE_FONT_FAMILY,
          fontSize: '0.75rem',
          borderBottom: cellBorder,
          borderRight: cellBorder,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          backgroundColor: rowBg,
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          if (!isRowSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover;
        }}
        onMouseLeave={(e) => {
          if (!isRowSelected) e.currentTarget.style.backgroundColor = rowBg;
        }}
      >
        {doc.id}
      </div>

      {/* Field cells */}
      {visibleFields.map((f) => {
        const value = doc.data?.[f];
        const type = getType(value);
        // Use formatValue unless it's an Array/Map which we stringify
        const displayValue =
          value === undefined
            ? '—'
            : type === 'Array' || type === 'Map'
              ? JSON.stringify(value)
              : formatValue(value, type);

        const isEditing = editingCell?.docId === doc.id && editingCell?.field === f;
        const isSelected = selectedCell?.docId === doc.id && selectedCell?.field === f;

        return (
          <CellRenderer
            key={f}
            docId={doc.id}
            field={f}
            value={value}
            type={type}
            displayValue={displayValue}
            isEditing={isEditing}
            isSelected={isSelected}
            isRowSelected={isRowSelected}
            editValue={editValue}
            setEditValue={setEditValue}
            // Handlers
            onEdit={(id, field, val, selectOnly) => {
              // If selectOnly is true, we just highlight it, unless we double click or press enter
              // But here we might want to unify selection vs editing
              // The original code passed (docId, field) to setSelectedCell
              // And (docId, field, value) to setEditingCell, etc.
              // We'll let TableView handle "Selection" vs "Editing"
              onCellEdit(id, field, val, selectOnly);
            }}
            onSave={onCellSave}
            onKeyDown={onCellKeyDown}
            onDoubleClick={onCellDoubleClick}
            getTypeColor={getTypeColor}
            isDark={isDark}
            rowBg={rowBg}
            tableColors={tableColors}
            cellBorder={cellBorder}
            // Popover Controls
            setBoolMenuAnchor={setBoolMenuAnchor}
            setBoolMenuData={setBoolMenuData}
            setDateMenuAnchor={setDateMenuAnchor}
            setDateMenuData={setDateMenuData}
            setTempDateValue={setTempDateValue}
          />
        );
      })}
    </React.Fragment>
  );
};

export default React.memo(TableRow);
