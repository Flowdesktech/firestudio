import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from '@mui/material';
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
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', width: '40%', color: 'text.primary' }}>
              Key
            </TableCell>
            <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', width: '40%', color: 'text.primary' }}>
              Value
            </TableCell>
            <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default', width: '20%', color: 'text.primary' }}>
              Type
            </TableCell>
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
