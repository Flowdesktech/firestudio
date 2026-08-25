import React, { useRef, useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import {
  isFirestoreTimestamp,
  isUnixTimestampMs,
  isIsoDateString,
  formatDateForDisplay,
  formatDateForDateTimeLocal,
} from '../../../../shared/utils/dateUtils';
import { MONOSPACE_FONT_FAMILY } from '../../../../shared/utils/constants';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import { TableThemeColors } from '../../../../app/theme';

interface CellRendererProps {
  docId: string;
  field: string;
  value: FirestoreValue;
  type: string;
  displayValue: string;
  isEditing: boolean;
  isSelected: boolean;
  isRowSelected: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onEdit: (docId: string | null, field: string | null, value: FirestoreValue, selectOnly?: boolean) => void;
  onSave: (docId?: string, field?: string, value?: FirestoreValue) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick: (docId: string, field: string, value: FirestoreValue) => void;
  getTypeColor: (type: string, isDark: boolean) => string;
  isDark: boolean;
  rowBg: string;
  tableColors: TableThemeColors;
  cellBorder: string;
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

const CellRenderer: React.FC<CellRendererProps> = ({
  docId,
  field,
  value,
  type,
  displayValue,
  isEditing,
  isSelected,
  isRowSelected,
  editValue,
  setEditValue,
  onEdit,
  onSave,
  onKeyDown,
  onDoubleClick,
  getTypeColor,
  isDark,
  rowBg,
  tableColors,
  cellBorder,
  setBoolMenuAnchor,
  setBoolMenuData,
  setDateMenuAnchor,
  setDateMenuData,
  setTempDateValue,
}) => {
  const theme = useTheme();
  const cellRef = useRef<HTMLDivElement>(null);

  // Handle initial mount of editing components that need anchors
  useEffect(() => {
    if (isEditing) {
      if (type === 'Boolean' && cellRef.current) {
        setBoolMenuAnchor(cellRef.current);
        setBoolMenuData({ docId, field, value });
      } else if (
        (isFirestoreTimestamp(value) || isUnixTimestampMs(value) || isIsoDateString(value) || type === 'Timestamp') &&
        cellRef.current
      ) {
        // Date handling logic for anchor
        setDateMenuAnchor(cellRef.current);
        setDateMenuData({ docId, field, value, originalValue: value });

        // Initialize temp date value
        let dateValue: Date;
        if (isFirestoreTimestamp(value)) {
          const seconds = value._seconds ?? value.seconds ?? 0;
          dateValue = new Date(seconds * 1000);
        } else if (isUnixTimestampMs(value)) {
          dateValue = new Date(value);
        } else if (isIsoDateString(value) || typeof value === 'string') {
          dateValue = new Date(value);
        } else {
          dateValue = new Date(editValue);
        }

        if (!isNaN(dateValue.getTime())) {
          setTempDateValue(formatDateForDateTimeLocal(dateValue));
        }
      }
    }
  }, [
    isEditing,
    type,
    value,
    docId,
    field,
    editValue,
    setBoolMenuAnchor,
    setBoolMenuData,
    setDateMenuAnchor,
    setDateMenuData,
    setTempDateValue,
  ]);

  return (
    <div
      title={typeof displayValue === 'string' ? displayValue : String(displayValue)}
      onClick={() => onEdit(docId, field, value, true)} // Select cell
      onDoubleClick={() => !isEditing && onDoubleClick(docId, field, value)}
      style={{
        padding: '6px 8px',
        borderBottom: cellBorder,
        borderRight: cellBorder,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: value === undefined ? (isDark ? '#6b6b6b' : '#a0a0a0') : getTypeColor(type, isDark),
        fontStyle: value === undefined ? 'italic' : 'normal',
        fontFamily: type === 'Array' || type === 'Map' || type === 'String' ? MONOSPACE_FONT_FAMILY : 'inherit',
        fontSize: '0.8rem',
        cursor: 'default',
        outline: isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
        outlineOffset: '-2px',
        backgroundColor: isSelected ? (isDark ? '#264f78' : '#cce5ff') : rowBg,
        transition: 'background-color 0.1s ease',
      }}
      onMouseEnter={(e) => {
        if (!isRowSelected && !isSelected) e.currentTarget.style.backgroundColor = tableColors.rowHover;
      }}
      onMouseLeave={(e) => {
        if (!isRowSelected && !isSelected) e.currentTarget.style.backgroundColor = rowBg;
      }}
    >
      {isEditing ? (
        // Boolean: show Trigger (Popover handled by parent)
        type === 'Boolean' ? (
          <Box
            ref={cellRef}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              fontSize: '0.8rem',
              fontFamily: MONOSPACE_FONT_FAMILY,
              color: editValue === 'true' ? '#4caf50' : '#f44336',
            }}
          >
            {editValue} ▾
          </Box>
        ) : isFirestoreTimestamp(value) ||
          isUnixTimestampMs(value) ||
          isIsoDateString(value) ||
          type === 'Timestamp' ? (
          // Timestamp/Date: show Trigger
          <Box
            ref={cellRef}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              fontSize: '0.75rem',
              fontFamily: MONOSPACE_FONT_FAMILY,
              color: theme.palette.primary.main,
            }}
          >
            {formatDateForDisplay(editValue) || editValue} 📅
          </Box>
        ) : (
          // Default: text input
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              // Delay blur save to allow clicks on other elements (like popovers if they were here, but they are not)
              // But importantly, simpler text inputs just save on blur
              onSave();
            }}
            onKeyDown={onKeyDown}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.8rem',
              fontFamily: MONOSPACE_FONT_FAMILY,
              backgroundColor: 'transparent',
              color: theme.palette.text.primary,
            }}
          />
        )
      ) : (
        displayValue
      )}
    </div>
  );
};

export default React.memo(CellRenderer);
