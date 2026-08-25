import React from 'react';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import { Document, DocumentData } from '../../store/collectionSlice';

export interface TreeEditingCell {
  docId: string;
  field: string;
  originalValue?: FirestoreValue;
  originalType?: string;
  docData?: DocumentData;
  docCollectionPath?: string;
}

export interface TreeContextValue {
  rootPath: string;
  rootDocuments: Document[];
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
  isDark: boolean;
  subcollectionsByDocPath: Record<string, string[]>;
  documentsByPath: Record<string, Document[]>;
  ensureSubcollections: (docPath: string) => void;
  ensureDocuments: (collectionPath: string) => void;
  refreshDocuments: (collectionPath: string) => void;
}

export const TreeContext = React.createContext<TreeContextValue | null>(null);
