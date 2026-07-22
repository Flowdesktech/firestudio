import { useCallback, useRef, useState } from 'react';
import { electronService } from '../../../shared/services/electronService';
import { Project } from '../../projects/store/projectsSlice';
import { getGoogleApiDatabaseId } from '../../projects/utils/firestoreDatabaseUtils';
import { Document } from '../store/collectionSlice';

const NESTED_PAGE_LIMIT = 50;

export interface TreeSubcollections {
  subcollectionsByDocPath: Record<string, string[]>;
  documentsByPath: Record<string, Document[]>;
  ensureSubcollections: (docPath: string) => void;
  ensureDocuments: (collectionPath: string) => void;
}

export function useTreeSubcollections(project: Project, firestoreDatabaseId?: string): TreeSubcollections {
  const [subcollectionsByDocPath, setSubcollectionsByDocPath] = useState<Record<string, string[]>>({});
  const [documentsByPath, setDocumentsByPath] = useState<Record<string, Document[]>>({});
  const requestedPaths = useRef(new Set<string>());

  const isGoogle = project.authMethod === 'google';
  const databaseId = getGoogleApiDatabaseId(project, firestoreDatabaseId);

  const ensureSubcollections = useCallback(
    async (docPath: string) => {
      const requestKey = `doc:${docPath}`;
      if (requestedPaths.current.has(requestKey)) return;
      requestedPaths.current.add(requestKey);

      const api = electronService.api;
      const result = isGoogle
        ? await api.googleListSubcollections({ projectId: project.projectId, documentPath: docPath, databaseId })
        : await api.listSubcollections(docPath);

      if (result.success) {
        setSubcollectionsByDocPath((prev) => ({ ...prev, [docPath]: result.collections ?? [] }));
      } else {
        requestedPaths.current.delete(requestKey);
      }
    },
    [isGoogle, project.projectId, databaseId],
  );

  const ensureDocuments = useCallback(
    async (collectionPath: string) => {
      const requestKey = `col:${collectionPath}`;
      if (requestedPaths.current.has(requestKey)) return;
      requestedPaths.current.add(requestKey);

      const api = electronService.api;
      const result = isGoogle
        ? await api.googleGetDocuments({
            projectId: project.projectId,
            collectionPath,
            limit: NESTED_PAGE_LIMIT,
            databaseId,
          })
        : await api.getDocuments({ collectionPath, limit: NESTED_PAGE_LIMIT });

      if (result.success) {
        setDocumentsByPath((prev) => ({ ...prev, [collectionPath]: (result.documents ?? []) as Document[] }));
      } else {
        requestedPaths.current.delete(requestKey);
      }
    },
    [isGoogle, project.projectId, databaseId],
  );

  return { subcollectionsByDocPath, documentsByPath, ensureSubcollections, ensureDocuments };
}
