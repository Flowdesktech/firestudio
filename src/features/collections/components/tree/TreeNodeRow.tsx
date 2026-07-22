import React, { useContext, useEffect } from 'react';
import { Box, IconButton, TableCell, TableRow, TextField, Typography } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Storage as CollectionIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import { TreeContext } from './TreeContext';

interface TreeNodeRowProps {
  nodeKey: string;
  value: FirestoreValue;
  path: string;
  docId?: string;
  depth?: number;
  isDoc?: boolean;
  isCollection?: boolean;
  missing?: boolean;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  nodeKey,
  value,
  path,
  docId,
  depth = 0,
  isDoc = false,
  isCollection = false,
  missing = false,
}) => {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('TreeNodeRow must be rendered inside a TreeContext provider');
  const {
    rootPath,
    rootDocuments,
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
  } = ctx;

  const nodeType = isCollection ? 'Collection' : isDoc ? 'Document' : getType(value);
  const isExpandable = isCollection || isDoc || nodeType === 'Array' || nodeType === 'Map';
  const isExpanded = expandedNodes[path];
  const displayValue = isExpandable ? '' : formatValue(value, nodeType);
  const isEditing =
    !isCollection && !isDoc && !isExpandable && editingCell?.docId === docId && editingCell?.field === nodeKey;

  const isRoot = isCollection && path === rootPath;
  const collectionDocs = isCollection ? (isRoot ? rootDocuments : documentsByPath[path]) : undefined;
  const subcollectionIds = isDoc ? subcollectionsByDocPath[path] : undefined;

  useEffect(() => {
    if (!isExpanded) return;
    if (isDoc) ensureSubcollections(path);
    if (isCollection && !isRoot) ensureDocuments(path);
  }, [isExpanded, isDoc, isCollection, isRoot, path, ensureSubcollections, ensureDocuments]);

  const isLoadingChildren =
    Boolean(isExpanded) && ((isDoc && !subcollectionIds) || (isCollection && !isRoot && !collectionDocs));

  return (
    <>
      <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
        <TableCell
          sx={{
            py: 0.25,
            pl: depth * 2 + 1,
            borderBottom: 1,
            borderColor: 'divider',
            cursor: isExpandable ? 'pointer' : 'default',
            color: 'text.primary',
            width: '40%',
          }}
          onClick={() => isExpandable && toggleNode(path)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isExpandable ? (
              <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.secondary' }}>
                {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            ) : (
              <Box sx={{ width: 20, mr: 0.5 }} />
            )}
            {isCollection && <CollectionIcon sx={{ fontSize: 14, color: '#1976d2', mr: 0.5 }} />}
            {isDoc && <DocumentIcon sx={{ fontSize: 14, color: '#ff9800', mr: 0.5 }} />}
            <Typography
              title={missing ? 'Document has no fields; it exists as a parent of subcollections' : undefined}
              sx={{
                fontSize: '0.8rem',
                color: missing ? 'text.disabled' : 'text.primary',
                fontStyle: missing ? 'italic' : 'normal',
              }}
            >
              {nodeKey}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ py: 0.25, borderBottom: 1, borderColor: 'divider', width: '40%' }}>
          {!isCollection && !isDoc && !isExpandable ? (
            isEditing ? (
              <TextField
                size="small"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={onCellSave}
                onKeyDown={onCellKeyDown}
                autoFocus
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    py: 0.5,
                  },
                }}
              />
            ) : (
              <Typography
                onClick={() => docId && onCellEdit(docId, nodeKey, value)}
                sx={{
                  fontSize: '0.8rem',
                  color: getTypeColor(nodeType, isDark),
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover', borderRadius: 0.5 },
                  p: 0.5,
                }}
              >
                {displayValue}
              </Typography>
            )
          ) : (
            <Typography sx={{ fontSize: '0.8rem', color: 'text.primary' }}>{displayValue}</Typography>
          )}
        </TableCell>
        <TableCell sx={{ py: 0.25, borderBottom: 1, borderColor: 'divider', width: '20%' }}>
          <Typography sx={{ fontSize: '0.75rem', color: getTypeColor(nodeType, isDark) }}>{nodeType}</Typography>
        </TableCell>
      </TableRow>

      {isLoadingChildren && (
        <TableRow>
          <TableCell colSpan={3} sx={{ py: 0.25, pl: (depth + 1) * 2 + 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>Loading…</Typography>
          </TableCell>
        </TableRow>
      )}

      {isExpanded && (
        <>
          {isCollection &&
            (collectionDocs ?? []).map((doc) => (
              <TreeNodeRow
                key={doc.id}
                nodeKey={doc.id}
                value={doc.data}
                path={`${path}/${doc.id}`}
                docId={isRoot ? doc.id : undefined}
                isDoc
                depth={depth + 1}
                missing={doc.missing}
              />
            ))}

          {!isCollection &&
            !isDoc &&
            isExpandable &&
            value &&
            typeof value === 'object' &&
            Object.entries(value as Record<string, FirestoreValue>).map(([k, v]) => (
              <TreeNodeRow
                key={`${path}.${k}`}
                nodeKey={k}
                value={v}
                path={`${path}.${k}`}
                docId={docId}
                depth={depth + 1}
              />
            ))}

          {isDoc && (
            <>
              {value &&
                typeof value === 'object' &&
                Object.entries(value as Record<string, FirestoreValue>).map(([k, v]) => (
                  <TreeNodeRow
                    key={`${path}.${k}`}
                    nodeKey={k}
                    value={v}
                    path={`${path}.${k}`}
                    docId={docId}
                    depth={depth + 1}
                  />
                ))}
              {(subcollectionIds ?? []).map((id) => (
                <TreeNodeRow
                  key={`${path}/${id}`}
                  nodeKey={id}
                  value={null}
                  path={`${path}/${id}`}
                  isCollection
                  depth={depth + 1}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
};

export default TreeNodeRow;
