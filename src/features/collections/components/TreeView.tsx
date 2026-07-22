import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from '@mui/material';
import { FirestoreValue } from '../../../shared/utils/firestoreUtils';
import { Document } from '../store/collectionSlice';
import { Project } from '../../projects/store/projectsSlice';
import { useTreeSubcollections } from '../hooks/useTreeSubcollections';
import TreeNodeRow from './tree/TreeNodeRow';
import { TreeContext, TreeContextValue } from './tree/TreeContext';

interface TreeViewProps {
  project: Project;
  firestoreDatabaseId?: string;
  collectionPath: string;
  documents: Document[];
  expandedNodes: Record<string, boolean>;
  toggleNode: (path: string) => void;
  editingCell: { docId: string; field: string } | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onCellEdit: (docId: string | null, field: string | null, value: FirestoreValue) => void;
  onCellSave: () => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  getType: (value: FirestoreValue) => string;
  getTypeColor: (type: string, isDark: boolean) => string;
  formatValue: (value: FirestoreValue, type: string) => string;
}

const TreeView: React.FC<TreeViewProps> = ({
  project,
  firestoreDatabaseId,
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
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { subcollectionsByDocPath, documentsByPath, ensureSubcollections, ensureDocuments } = useTreeSubcollections(
    project,
    firestoreDatabaseId,
  );

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
