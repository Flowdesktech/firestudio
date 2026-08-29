import React from 'react';
import { useTheme } from '@mui/material';
import { TableThemeColors } from '../../../../app/theme';
import { singleLineTruncation } from '../../../../shared/ui/textStyles';

interface TableHeadersProps {
  visibleFields: string[];
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResizeStart: (e: React.MouseEvent, field: string) => void;
  cellBorder: string;
  tableColors: TableThemeColors;
}

/**
 * TableHeaders Component
 * Renders the sticky header row for the collection table
 */
const TableHeaders: React.FC<TableHeadersProps> = ({
  visibleFields,
  allSelected,
  someSelected,
  onSelectAll,
  onResizeStart,
  cellBorder,
  tableColors,
}) => {
  const theme = useTheme();

  return (
    <React.Fragment>
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
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={onSelectAll}
          style={{
            cursor: 'pointer',
            width: 16,
            height: 16,
            accentColor: theme.palette.primary.main,
          }}
        />
      </div>

      {/* Document ID Header */}
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
          ...singleLineTruncation,
          zIndex: 10,
        }}
      >
        <span style={{ opacity: 0.8 }}>Document ID</span>
        <div
          onMouseDown={(e) => onResizeStart(e, '__docId__')}
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
          onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) =>
            ((e.target as HTMLDivElement).style.background = theme.palette.primary.main + '40')
          }
          onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) =>
            ((e.target as HTMLDivElement).style.background = 'transparent')
          }
        />
      </div>

      {/* Field Headers */}
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
            ...singleLineTruncation,
            zIndex: 10,
          }}
        >
          {f}
          <div
            onMouseDown={(e) => onResizeStart(e, f)}
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
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) =>
              ((e.target as HTMLDivElement).style.background = theme.palette.primary.main + '40')
            }
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) =>
              ((e.target as HTMLDivElement).style.background = 'transparent')
            }
          />
        </div>
      ))}
    </React.Fragment>
  );
};

export default TableHeaders;
