import type { FirestoreDatabase } from './firestoreDatabaseTypes';

/** Minimal project shape — avoids importing the projects slice (circular deps). */
export type ServiceAccountProjectLike = {
  id: string;
  projectId: string;
  authMethod: 'serviceAccount' | 'google';
  databaseId?: string;
  collections?: { id: string; path: string }[];
  firestoreDatabases?: FirestoreDatabase[];
  activeFirestoreDatabaseId?: string;
};

export function isGoogleAccountLike(item: unknown): item is { type: 'googleAccount' } {
  return typeof item === 'object' && item !== null && (item as { type?: string }).type === 'googleAccount';
}

export function normalizeDatabaseIdInput(raw: string | undefined | null): string {
  const t = (raw ?? '').trim();
  if (!t) return '(default)';
  return t;
}

export function databaseIdToConnectParam(databaseId: string): string | undefined {
  const t = databaseId.trim();
  if (!t || t === '(default)') return undefined;
  return t;
}

export function defaultLabelForDatabase(databaseId: string): string {
  return databaseId === '(default)' ? 'Default' : databaseId;
}

export function getFirestoreDatabaseDisplay(fd: FirestoreDatabase): string {
  return fd.label?.trim() || defaultLabelForDatabase(fd.databaseId);
}

export function getActiveFirestoreDatabase(project: ServiceAccountProjectLike): FirestoreDatabase | null {
  const list = project.firestoreDatabases;
  if (!list?.length) return null;
  const activeId = project.activeFirestoreDatabaseId;
  if (activeId) {
    const found = list.find((d) => d.id === activeId);
    if (found) return found;
  }
  return list[0];
}

export function getFirestoreDatabaseById(
  project: ServiceAccountProjectLike,
  firestoreDatabaseId: string | undefined | null,
) {
  if (!firestoreDatabaseId) return null;
  return project.firestoreDatabases?.find((d) => d.id === firestoreDatabaseId) ?? null;
}

/** Firestore REST `databaseId` path segment for Google OAuth calls */
export function getGoogleApiDatabaseId(
  project: ServiceAccountProjectLike,
  firestoreDatabaseId?: string | null,
): string {
  if (project.authMethod !== 'google') return '(default)';
  const fd = firestoreDatabaseId
    ? getFirestoreDatabaseById(project, firestoreDatabaseId)
    : getActiveFirestoreDatabase(project);
  return fd?.databaseId ?? normalizeDatabaseIdInput(undefined);
}

export function getServiceAccountConnectDatabaseId(
  project: ServiceAccountProjectLike,
  firestoreDatabaseId?: string | null,
): string | undefined {
  if (project.authMethod !== 'serviceAccount') return undefined;
  const fd = firestoreDatabaseId
    ? getFirestoreDatabaseById(project, firestoreDatabaseId)
    : getActiveFirestoreDatabase(project);
  if (!fd) {
    return databaseIdToConnectParam(project.databaseId ?? '(default)');
  }
  return databaseIdToConnectParam(fd.databaseId);
}

export function migrateGoogleProject(project: unknown): unknown {
  const p = project as ServiceAccountProjectLike;
  if (p.authMethod !== 'google') return project;

  if (p.firestoreDatabases && p.firestoreDatabases.length > 0) {
    return {
      ...p,
      activeFirestoreDatabaseId: p.activeFirestoreDatabaseId ?? p.firestoreDatabases[0].id,
    };
  }

  const cols = p.collections || [];
  const fdId = `${p.id}-legacy-db`;
  return {
    ...p,
    firestoreDatabases: [
      {
        id: fdId,
        databaseId: '(default)',
        label: 'Default',
        collections: cols,
      },
    ],
    activeFirestoreDatabaseId: fdId,
  };
}

export function migrateServiceAccountProject(item: unknown): unknown {
  if (isGoogleAccountLike(item)) return item;
  const p = item as ServiceAccountProjectLike;
  if (p.authMethod !== 'serviceAccount') return item;

  if (p.firestoreDatabases && p.firestoreDatabases.length > 0) {
    return {
      ...p,
      activeFirestoreDatabaseId: p.activeFirestoreDatabaseId ?? p.firestoreDatabases[0].id,
    };
  }

  const legacyDb = p.databaseId?.trim() || '';
  const display = !legacyDb || legacyDb === '(default)' ? '(default)' : legacyDb;
  const fdId = `${p.id}-legacy-db`;
  return {
    ...p,
    firestoreDatabases: [
      {
        id: fdId,
        databaseId: display,
        label: display === '(default)' ? 'Default' : display,
        collections: p.collections || [],
      },
    ],
    activeFirestoreDatabaseId: fdId,
  };
}

/** Run after loading persisted projects: SA multi-DB migration + Google nested Firestore DB migration */
export function migratePersistedProjectsItem(item: unknown): unknown {
  if (isGoogleAccountLike(item)) {
    const acc = item as { projects?: unknown[] };
    return {
      ...acc,
      projects: (acc.projects || []).map((proj) => migrateGoogleProject(proj)),
    };
  }
  return migrateServiceAccountProject(item);
}

export function buildCollectionStateKey(
  project: ServiceAccountProjectLike,
  collectionPath: string,
  firestoreDatabaseId?: string | null,
): string {
  const fdId = firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id ?? 'default';
  return `${project.id}:${fdId}:${collectionPath}`;
}
