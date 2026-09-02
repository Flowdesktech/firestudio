import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from '@mui/material';
import { FirestoreValue } from '../../../shared/utils/firestoreUtils';
import { Document, DocumentData } from '../store/collectionSlice';
import TreeNodeRow from './tree/TreeNodeRow';
import { TreeContext, TreeContextValue, TreeEditingCell } from './tree/TreeContext';

interface TreeViewProps {
  collectionPath: string;
  documents: Document[];
  expandedNodes: Record<string, boolean>;
  toggleNode: (path: string) => void;
  editingCell: TreeEditingCell | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onCellEdit: (
    docId: string | null,
    field: string | null,
    value: FirestoreValue,
    docData?: DocumentData | boolean,
    docCollectionPath?: string,
  ) => void;
  onCellSave: () => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  getType: (value: FirestoreValue) => string;
  getTypeColor: (type: string, isDark: boolean) => string;
  formatValue: (value: FirestoreValue, type: string) => string;
  subcollectionsByDocPath: Record<string, string[]>;
  documentsByPath: Record<string, Document[]>;
  ensureSubcollections: (docPath: string) => void;
  ensureDocuments: (collectionPath: string) => void;
  refreshDocuments: (collectionPath: string) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  collectionPath,
  documents,
  expandedNodes,
  toggleNode,
  editingCell,
  editValue,
  setEditValue,
  onCellEdit,
  onCellSave,
  onCellKeyDown,
  getType,
  getTypeColor,
  formatValue,
  subcollectionsByDocPath,
  documentsByPath,
  ensureSubcollections,
  ensureDocuments,
  refreshDocuments,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tableRef = useRef<HTMLTableElement>(null);
  const resizeRef = useRef<{ index: number; startX: number; widths: number[] } | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const minimumWidths = [180, 180, 100];
      const nextWidths = [...resize.widths];
      const leftIndex = resize.index;
      const rightIndex = leftIndex + 1;
      const totalWidth = resize.widths[leftIndex] + resize.widths[rightIndex];
      const desiredLeftWidth = resize.widths[leftIndex] + event.clientX - resize.startX;
      const leftWidth = Math.max(
        minimumWidths[leftIndex],
        Math.min(desiredLeftWidth, totalWidth - minimumWidths[rightIndex]),
      );

      nextWidths[leftIndex] = leftWidth;
      nextWidths[rightIndex] = totalWidth - leftWidth;
      setColumnWidths(nextWidths);
    };

    const handleMouseUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const headerCells = tableRef.current?.querySelectorAll('thead th');
    if (!headerCells || headerCells.length !== 3) return;

    resizeRef.current = {
      index,
      startX: event.clientX,
      widths: Array.from(headerCells, (cell) => cell.getBoundingClientRect().width),
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const contextValue = useMemo<TreeContextValue>(
    () => ({
      rootPath: collectionPath,
      rootDocuments: documents,
      expandedNodes,
      toggleNode,
      editingCell,
      editValue,
      setEditValue,
      onCellEdit,
      onCellSave,
      onCellKeyDown,
      getType,
      getTypeColor,
      formatValue,
      isDark,
      subcollectionsByDocPath,
      documentsByPath,
      ensureSubcollections,
      ensureDocuments,
      refreshDocuments,
    }),
    [
      collectionPath,
      documents,
      expandedNodes,
      toggleNode,
      editingCell,
      editValue,
      setEditValue,
      onCellEdit,
      onCellSave,
      onCellKeyDown,
      getType,
      getTypeColor,
      formatValue,
      isDark,
      subcollectionsByDocPath,
      documentsByPath,
      ensureSubcollections,
      ensureDocuments,
      refreshDocuments,
    ],
  );

  return (
    <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
      <Table ref={tableRef} size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 600 }}>
        <colgroup>
          <col style={{ width: columnWidths ? `${columnWidths[0]}px` : '40%' }} />
          <col style={{ width: columnWidths ? `${columnWidths[1]}px` : '40%' }} />
          <col style={{ width: columnWidths ? `${columnWidths[2]}px` : '20%' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 600,
                bgcolor: 'background.default',
                color: 'text.primary',
                borderRight: 1,
                borderColor: 'divider',
                position: 'relative',
              }}
            >
              Key
              <Box
                onMouseDown={(event) => handleResizeStart(event, 0)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = theme.palette.primary.main + '40';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  zIndex: 20,
                  bgcolor: 'transparent',
                }}
              />
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 600,
                bgcolor: 'background.default',
                color: 'text.primary',
                borderRight: 1,
                borderColor: 'divider',
                position: 'relative',
              }}
            >
              Value
              <Box
                onMouseDown={(event) => handleResizeStart(event, 1)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = theme.palette.primary.main + '40';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  zIndex: 20,
                  bgcolor: 'transparent',
                }}
              />
            </TableCell>
            <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', color: 'text.primary' }}>Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TreeContext.Provider value={contextValue}>
            <TreeNodeRow nodeKey={collectionPath} value={null} path={collectionPath} isCollection depth={0} />
          </TreeContext.Provider>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TreeView;
