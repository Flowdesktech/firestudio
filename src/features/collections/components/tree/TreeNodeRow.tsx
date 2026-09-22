import React, { useContext, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Storage as CollectionIcon,
  Description as DocumentIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import {
  isFirestoreTimestamp,
  isUnixTimestampMs,
  formatDateForDateTimeLocal,
} from '../../../../shared/utils/dateUtils';
import { DocumentData } from '../../store/collectionSlice';
import { TreeContext } from './TreeContext';
import { singleLineTruncation } from '../../../../shared/ui/textStyles';
import { MONOSPACE_FONT_FAMILY } from '../../../../shared/utils/constants';

interface TreeNodeRowProps {
  nodeKey: string;
  value: FirestoreValue;
  path: string;
  docId?: string;
  docData?: DocumentData;
  docCollectionPath?: string;
  depth?: number;
  isDoc?: boolean;
  isCollection?: boolean;
  missing?: boolean;
  /**
   * Document-relative dot path of this field (e.g. "profile.displayName").
   * Omitted for documents, collections and array elements — those are not
   * deletable fields, and their presence disables the delete affordance.
   */
  fieldPath?: string;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  nodeKey,
  value,
  path,
  docId,
  docData,
  docCollectionPath,
  depth = 0,
  isDoc = false,
  isCollection = false,
  missing = false,
  fieldPath,
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
    onDeleteField,
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
  // Only real fields (top-level keys and map keys) are deletable. `fieldPath` is
  // deliberately omitted for documents, collections and array elements.
  const canDeleteField = Boolean(fieldPath && docId && docData && !isDoc && !isCollection);
  const isExpanded = expandedNodes[path];
  const displayValue = isExpandable ? '' : formatValue(value, nodeType);
  const isEditing =
    !isCollection &&
    !isDoc &&
    !isExpandable &&
    editingCell?.docId === docId &&
    editingCell?.field === nodeKey &&
    (editingCell?.docCollectionPath ?? docCollectionPath) === docCollectionPath;
  const isDateLike = nodeType === 'Timestamp' || isFirestoreTimestamp(value) || isUnixTimestampMs(value);

  const [dateValue, setDateValue] = React.useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && isDateLike) {
      setDateValue(formatDateForDateTimeLocal(value));
    }
  }, [isEditing, isDateLike, value]);

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
      <TableRow
        sx={{ '&:hover': { bgcolor: 'action.hover' }, '&:hover .tree-delete-field': { visibility: 'visible' } }}
      >
        <TableCell
          sx={{
            py: 0.25,
            pl: depth * 2 + 1,
            borderBottom: 1,
            borderRight: 1,
            borderColor: 'divider',
            cursor: isExpandable ? 'pointer' : 'default',
            color: 'text.primary',
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
              title={missing ? 'Document has no fields; it exists as a parent of subcollections' : nodeKey}
              sx={{
                ...singleLineTruncation,
                flex: 1,
                fontSize: '0.8rem',
                color: missing ? 'text.disabled' : 'text.primary',
                fontStyle: missing ? 'italic' : 'normal',
              }}
            >
              {nodeKey}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ py: 0.25, borderBottom: 1, borderRight: 1, borderColor: 'divider' }}>
          {!isCollection && !isDoc && !isExpandable ? (
            isEditing ? (
              isDateLike ? (
                <TextField
                  type="datetime-local"
                  size="small"
                  value={dateValue}
                  onChange={(e) => {
                    setDateValue(e.target.value);
                    setEditValue(e.target.value);
                  }}
                  onBlur={onCellSave}
                  onKeyDown={onCellKeyDown}
                  autoFocus
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      py: 0.5,
                    },
                  }}
                />
              ) : (
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
              )
            ) : (
              <Typography
                title={displayValue}
                onClick={() => docId && onCellEdit(docId, nodeKey, value, docData, docCollectionPath)}
                sx={{
                  ...singleLineTruncation,
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
            <Typography
              title={displayValue}
              sx={{ ...singleLineTruncation, fontSize: '0.8rem', color: 'text.primary' }}
            >
              {displayValue}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={{ py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              title={nodeType}
              sx={{ ...singleLineTruncation, flex: 1, fontSize: '0.75rem', color: getTypeColor(nodeType, isDark) }}
            >
              {nodeType}
            </Typography>
            {/* Fixed-width slot so the row does not shift when the button appears on hover. */}
            <Box sx={{ width: 20, height: 20, flexShrink: 0 }}>
              {canDeleteField && (
                <IconButton
                  size="small"
                  className="tree-delete-field"
                  aria-label={`Delete field ${fieldPath}`}
                  title={`Delete field ${fieldPath}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (fieldPath) setPendingDelete(fieldPath);
                  }}
                  sx={{ p: 0.25, width: 20, height: 20, visibility: 'hidden', color: 'error.main' }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          </Box>
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
                docId={doc.id}
                docData={doc.data}
                docCollectionPath={path}
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
                docData={docData}
                docCollectionPath={docCollectionPath}
                depth={depth + 1}
                // Array children are index elements, not fields: deleting one would
                // be a splice, so they get no fieldPath and no delete affordance.
                fieldPath={fieldPath && !Array.isArray(value) ? `${fieldPath}.${k}` : undefined}
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
                    docData={docData}
                    docCollectionPath={docCollectionPath}
                    depth={depth + 1}
                    fieldPath={k}
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

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete field?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This permanently removes the field{' '}
            <Box component="span" sx={{ fontFamily: MONOSPACE_FONT_FAMILY, fontWeight: 600 }}>
              {pendingDelete}
            </Box>{' '}
            from document{' '}
            <Box component="span" sx={{ fontFamily: MONOSPACE_FONT_FAMILY, fontWeight: 600 }}>
              {docId}
            </Box>
            . This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            onClick={() => {
              const toDelete = pendingDelete;
              setPendingDelete(null);
              if (toDelete && docId && docData) {
                onDeleteField(docId, toDelete, docData, docCollectionPath);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TreeNodeRow;
