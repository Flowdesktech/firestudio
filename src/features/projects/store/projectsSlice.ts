import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { loadProjectsFromStorage } from './projectsPersistence';
import { ThunkExtra } from '../../../app/store/thunkTypes';
import { RootState } from '../../../app/store';
import type { FirestoreDatabase } from '../utils/firestoreDatabaseTypes';
import {
  migratePersistedProjectsItem,
  databaseIdToConnectParam,
  getActiveFirestoreDatabase,
  normalizeDatabaseIdInput,
  defaultLabelForDatabase,
} from '../utils/firestoreDatabaseUtils';

export type { FirestoreDatabase } from '../utils/firestoreDatabaseTypes';

export interface FirestoreCollection {
  id: string;
  path: string;
}

export interface Project {
  id: string;
  projectId: string;
  authMethod: 'serviceAccount' | 'google';
  serviceAccountPath?: string;
  /** @deprecated Prefer firestoreDatabases; kept for persisted legacy */
  databaseId?: string;
  /** @deprecated Prefer firestoreDatabases[].collections */
  collections?: FirestoreCollection[];
  /** Named Firestore databases (service account projects) */
  firestoreDatabases?: FirestoreDatabase[];
  /** Which firestoreDatabases[].id is selected in the sidebar */
  activeFirestoreDatabaseId?: string;
  connected?: boolean;
  expanded?: boolean;
  error?: string;
  // For nested Google projects
  parentAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface GoogleAccount {
  id: string;
  type: 'googleAccount';
  email: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
  projects: Project[];
  expanded?: boolean;
  sessionExpired?: boolean;
  needsReauth?: boolean;
}

interface ProjectsState {
  items: (Project | GoogleAccount)[];
  selectedProjectId: string | null;
  loading: boolean;
  googleSignInLoading: boolean;
  error: string | null;
}

// Type guards
const isGoogleAccount = (item: Project | GoogleAccount): item is GoogleAccount => {
  return (item as GoogleAccount).type === 'googleAccount';
};

const isProject = (item: Project | GoogleAccount): item is Project => {
  return !isGoogleAccount(item);
};

const normalizeCollections = (collections?: Array<FirestoreCollection | string>) => {
  if (!collections) return [];
  return collections.map((collection) => {
    if (typeof collection === 'string') {
      return { id: collection, path: collection };
    }
    return {
      id: collection.id,
      path: collection.path || collection.id,
    };
  });
};

const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  extra: ThunkExtra;
}>();

// Async Thunks

export const loadProjects = createAppAsyncThunk('projects/loadProjects', async (_, { extra }) => {
  const electron = extra.electron.api;
  const savedProjects = loadProjectsFromStorage();
  if (savedProjects.length === 0) return [];
  const reconnectedProjects: (Project | GoogleAccount)[] = [];

  for (const p of savedProjects) {
    if (isProject(p) && p.authMethod === 'serviceAccount' && p.serviceAccountPath) {
      // Reconnect Service Account
      try {
        reconnectedProjects.push({
          ...p,
          connected: true,
          expanded: true,
          collections: normalizeCollections(p.collections),
        });
      } catch (e) {
        const error = e as Error;
        reconnectedProjects.push({
          ...p,
          connected: false,
          error: error.message,
          collections: normalizeCollections(p.collections),
        });
      }
    } else if (isGoogleAccount(p) && p.refreshToken) {
      // Restore Google Account session using refresh token
      try {
        const result = await electron.googleSetRefreshToken(p.refreshToken);
        if (result?.success) {
          // Session restored, update projects with fresh token
          const updatedProjects = (p.projects || []).map((proj: Project) => ({
            ...proj,
            accessToken: result.accessToken,
            expanded: false,
            collections: normalizeCollections(proj.collections),
          }));
          reconnectedProjects.push({
            ...p,
            accessToken: result.accessToken,
            expanded: true,
            projects: updatedProjects,
            needsReauth: false,
            sessionExpired: false,
          } as GoogleAccount);
        } else {
          // Session expired, keep project but mark as needing re-auth
          reconnectedProjects.push({
            ...p,
            expanded: true,
            sessionExpired: true,
            needsReauth: true,
            projects: (p.projects || []).map((proj: Project) => ({
              ...proj,
              collections: normalizeCollections(proj.collections),
            })),
          });
        }
      } catch {
        reconnectedProjects.push({
          ...p,
          expanded: true,
          sessionExpired: true,
          needsReauth: true,
          projects: (p.projects || []).map((proj: Project) => ({
            ...proj,
            collections: normalizeCollections(proj.collections),
          })),
        });
      }
    } else if (isGoogleAccount(p)) {
      reconnectedProjects.push({
        ...p,
        expanded: true,
        projects: (p.projects || []).map((proj: Project) => ({
          ...proj,
          collections: normalizeCollections(proj.collections),
        })),
      });
    } else {
      // Return other projects as is
      reconnectedProjects.push({
        ...p,
        expanded: true,
        collections: normalizeCollections(p.collections),
      });
    }
  }
  return reconnectedProjects.map((item) => migratePersistedProjectsItem(item)) as (Project | GoogleAccount)[];
});

export const connectServiceAccount = createAppAsyncThunk(
  'projects/connectServiceAccount',
  async (
    { serviceAccountPath, databaseId }: { serviceAccountPath: string; databaseId?: string },
    { extra, getState },
  ) => {
    const electron = extra.electron.api;
    const state = getState() as RootState;
    const existing = state.projects.items.find(
      (item): item is Project =>
        !isGoogleAccount(item) &&
        item.authMethod === 'serviceAccount' &&
        item.serviceAccountPath === serviceAccountPath,
    );

    const normalized = normalizeDatabaseIdInput(databaseId);
    if (existing?.firestoreDatabases?.some((d) => d.databaseId.toLowerCase() === normalized.toLowerCase())) {
      throw new Error(`Database "${normalized}" is already added to this project.`);
    }

    const result = await electron.connectFirebase({
      serviceAccountPath,
      databaseId: databaseIdToConnectParam(normalized),
    });
    if (!result?.success) throw new Error(result?.error || 'Connection failed');
    const gcpProjectId = result.projectId;
    if (!gcpProjectId) throw new Error('Could not read project ID from service account');

    const collectionsResult = await electron.getCollections();
    const collections = collectionsResult?.success ? normalizeCollections(collectionsResult.collections) : [];

    const newFd: FirestoreDatabase = {
      id: `fd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      databaseId: normalized,
      label: defaultLabelForDatabase(normalized),
      collections,
    };

    if (existing) {
      return { mode: 'merge' as const, projectId: existing.id, newDatabase: newFd };
    }

    return {
      mode: 'create' as const,
      project: {
        id: Date.now().toString(),
        projectId: gcpProjectId,
        serviceAccountPath,
        authMethod: 'serviceAccount' as const,
        firestoreDatabases: [newFd],
        activeFirestoreDatabaseId: newFd.id,
        expanded: true,
        connected: true,
      } satisfies Project,
    };
  },
);

export const addFirestoreDatabase = createAppAsyncThunk(
  'projects/addFirestoreDatabase',
  async (
    { projectId, databaseId, label }: { projectId: string; databaseId: string; label?: string },
    { extra, getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const project = state.projects.items.find((i): i is Project => !isGoogleAccount(i) && i.id === projectId);
    if (!project || project.authMethod !== 'serviceAccount' || !project.serviceAccountPath) {
      return rejectWithValue('Invalid project');
    }
    const normalized = normalizeDatabaseIdInput(databaseId);
    if (project.firestoreDatabases?.some((d) => d.databaseId.toLowerCase() === normalized.toLowerCase())) {
      return rejectWithValue(`Database "${normalized}" is already added.`);
    }
    const electron = extra.electron.api;
    await electron.disconnectFirebase();
    const result = await electron.connectFirebase({
      serviceAccountPath: project.serviceAccountPath,
      databaseId: databaseIdToConnectParam(normalized),
    });
    if (!result?.success) throw new Error(result?.error || 'Connection failed');
    const collectionsResult = await electron.getCollections();
    const collections = collectionsResult?.success ? normalizeCollections(collectionsResult.collections) : [];
    const newFd: FirestoreDatabase = {
      id: `fd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      databaseId: normalized,
      label: label?.trim() || defaultLabelForDatabase(normalized),
      collections,
    };
    return { projectId, newDatabase: newFd };
  },
);

export const addGoogleFirestoreDatabase = createAppAsyncThunk(
  'projects/addGoogleFirestoreDatabase',
  async (
    { projectId, databaseId, label }: { projectId: string; databaseId: string; label?: string },
    { extra, getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    let googleProject: Project | undefined;
    let refreshToken: string | undefined;
    for (const item of state.projects.items) {
      if (isGoogleAccount(item) && item.projects) {
        const p = item.projects.find((x) => x.id === projectId);
        if (p?.authMethod === 'google') {
          googleProject = p;
          refreshToken = item.refreshToken;
          break;
        }
      }
    }
    if (!googleProject) return rejectWithValue('Invalid project');
    const normalized = normalizeDatabaseIdInput(databaseId);
    if (googleProject.firestoreDatabases?.some((d) => d.databaseId.toLowerCase() === normalized.toLowerCase())) {
      return rejectWithValue(`Database "${normalized}" is already added.`);
    }
    const electron = extra.electron.api;
    if (refreshToken) await electron.googleSetRefreshToken(refreshToken);
    const result = await electron.googleGetCollections({
      projectId: googleProject.projectId.trim(),
      databaseId: normalized,
    });
    if (!result?.success) {
      throw new Error(result?.error || 'Could not access this database. Check the database ID and permissions.');
    }
    const collections = normalizeCollections(result.collections || []);
    const newFd: FirestoreDatabase = {
      id: `gfd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      databaseId: normalized,
      label: label?.trim() || defaultLabelForDatabase(normalized),
      collections,
    };
    return { projectId, newDatabase: newFd };
  },
);

export const refreshCollections = createAppAsyncThunk(
  'projects/refreshCollections',
  async (
    {
      project,
      refreshToken,
      firestoreDatabaseId,
    }: { project: Project; refreshToken?: string; firestoreDatabaseId?: string },
    { extra, rejectWithValue },
  ) => {
    const electron = extra.electron.api;
    try {
      if (!project.projectId || typeof project.projectId !== 'string') {
        return rejectWithValue('Invalid project ID. Please reconnect the project.');
      }
      let collections: FirestoreCollection[] = [];
      if (project.authMethod === 'google') {
        if (refreshToken) {
          await electron.googleSetRefreshToken(refreshToken);
        }
        const fd =
          (firestoreDatabaseId
            ? project.firestoreDatabases?.find((d) => d.id === firestoreDatabaseId)
            : getActiveFirestoreDatabase(project)) || project.firestoreDatabases?.[0];
        if (!fd) {
          return rejectWithValue('No Firestore database configured for this project.');
        }
        const result = await electron.googleGetCollections({
          projectId: project.projectId.trim(),
          databaseId: fd.databaseId,
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to get collections');
        collections = normalizeCollections(result.collections || []);
        return { projectId: project.id, collections, firestoreDatabaseId: fd.id };
      } else {
        const fd =
          (firestoreDatabaseId
            ? project.firestoreDatabases?.find((d) => d.id === firestoreDatabaseId)
            : getActiveFirestoreDatabase(project)) || project.firestoreDatabases?.[0];
        if (!fd) {
          return rejectWithValue('No Firestore database configured for this project.');
        }
        await electron.disconnectFirebase();
        const connectResult = await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath || '',
          databaseId: databaseIdToConnectParam(fd.databaseId),
        });
        if (!connectResult?.success) {
          throw new Error(connectResult?.error || 'Failed to connect to Firebase');
        }
        const result = await electron.getCollections();
        if (!result?.success) throw new Error(result?.error || 'Failed to get collections');
        collections = normalizeCollections(result.collections || []);
        return { projectId: project.id, collections, firestoreDatabaseId: fd.id };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh collections';
      return rejectWithValue(message);
    }
  },
);

interface GoogleFirestoreDatabaseInfo {
  databaseId: string;
  collections?: Array<FirestoreCollection | string>;
}

interface GoogleProjectInfo {
  projectId: string;
  displayName?: string;
  firestoreDatabases?: GoogleFirestoreDatabaseInfo[];
  /** @deprecated Prefer firestoreDatabases */
  collections?: Array<FirestoreCollection | string>;
}

function mapGoogleProjectFromApi(
  proj: GoogleProjectInfo,
  accountId: string,
  accessToken: string | undefined,
  refreshToken: string | undefined,
  existing: Project | undefined,
  index: number,
): Project {
  const fromApi =
    proj.firestoreDatabases && proj.firestoreDatabases.length > 0
      ? proj.firestoreDatabases
      : [{ databaseId: '(default)', collections: proj.collections || [] }];

  const existingByDbId = new Map((existing?.firestoreDatabases || []).map((fd) => [fd.databaseId, fd]));

  const firestoreDatabases: FirestoreDatabase[] = fromApi.map((fd, idx) => {
    const prev = existingByDbId.get(fd.databaseId);
    const safe = fd.databaseId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      id: prev?.id ?? `g-${proj.projectId}-${safe}-${idx}`,
      databaseId: fd.databaseId,
      label: prev?.label ?? defaultLabelForDatabase(fd.databaseId),
      collections: normalizeCollections(fd.collections || []),
    };
  });

  const prevActive = existing?.activeFirestoreDatabaseId;
  const activeFirestoreDatabaseId =
    prevActive && firestoreDatabases.some((d) => d.id === prevActive) ? prevActive : firestoreDatabases[0]?.id;

  return {
    id: existing?.id ?? `${accountId}-${index}-${proj.projectId}`,
    projectId: proj.projectId,
    parentAccountId: accountId,
    authMethod: 'google',
    accessToken,
    refreshToken,
    firestoreDatabases,
    activeFirestoreDatabaseId,
    expanded: existing?.expanded ?? false,
  };
}

export const refreshGoogleAccountProjects = createAppAsyncThunk(
  'projects/refreshGoogleAccountProjects',
  async (
    { accountId, refreshToken }: { accountId: string; refreshToken?: string },
    { extra, getState, rejectWithValue },
  ) => {
    const electron = extra.electron.api;
    try {
      const state = getState();
      const existingAccount = state.projects.items.find((item) => isGoogleAccount(item) && item.id === accountId) as
        | GoogleAccount
        | undefined;
      const effectiveRefreshToken = refreshToken ?? existingAccount?.refreshToken;

      let accessToken = existingAccount?.accessToken;
      if (effectiveRefreshToken) {
        const tokenResult = await electron.googleSetRefreshToken(effectiveRefreshToken);
        if (!tokenResult?.success) {
          return rejectWithValue(tokenResult?.error || 'Failed to refresh Google token');
        }
        accessToken = tokenResult.accessToken;
      }

      const projectsResult = await electron.getUserProjects();
      if (!projectsResult?.success) {
        return rejectWithValue(projectsResult?.error || 'Failed to get Google projects');
      }

      const existingByProjectId = new Map((existingAccount?.projects || []).map((proj) => [proj.projectId, proj]));

      const projects = (projectsResult.projects || []).map((proj: GoogleProjectInfo, index: number) => {
        const existing = existingByProjectId.get(proj.projectId);
        return mapGoogleProjectFromApi(proj, accountId, accessToken, effectiveRefreshToken, existing, index);
      });

      return { accountId, accessToken, projects };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to refresh Google projects');
    }
  },
);

export const signInWithGoogle = createAppAsyncThunk('projects/signInWithGoogle', async (_, { dispatch, extra }) => {
  const electron = extra.electron.api;
  const result = await electron.googleSignIn();
  if (!result?.success) {
    throw new Error(result?.error || 'Sign in failed');
  }

  const projectsResult = await electron.getUserProjects();
  const accountId = `google-account-${Date.now()}`;

  // Extract user info from result (may be in user object or directly on result)
  const email = result.email || result.user?.email || '';
  const name = result.name || result.user?.name || '';
  const accessToken = result.accessToken;
  const refreshToken = result.refreshToken;

  const googleAccount: GoogleAccount = {
    id: accountId,
    type: 'googleAccount',
    email,
    name,
    accessToken,
    refreshToken,
    expanded: true,
    projects: (projectsResult?.success ? projectsResult.projects || [] : []).map(
      (proj: GoogleProjectInfo, index: number) =>
        mapGoogleProjectFromApi(proj, accountId, accessToken, refreshToken, undefined, index),
    ),
  };

  dispatch(addGoogleAccount(googleAccount));
  return googleAccount;
});

const projectsSlice = createSlice({
  name: 'projects',
  initialState: {
    items: [],
    selectedProjectId: null,
    loading: false,
    googleSignInLoading: false,
    error: null,
  } as ProjectsState,
  reducers: {
    // Synchronous actions
    addProject: (state, action: PayloadAction<Project>) => {
      state.items.push(action.payload);
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((p) => p.id !== action.payload);
      if (state.selectedProjectId === action.payload) {
        state.selectedProjectId = null;
      }
    },
    setSelectedProject: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload;
    },
    updateProject: (state, action: PayloadAction<{ id: string; changes: Partial<Project | GoogleAccount> }>) => {
      const { id, changes } = action.payload;
      const index = state.items.findIndex((p: Project | GoogleAccount) => p.id === id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...changes } as Project | GoogleAccount;
      }
    },
    setActiveFirestoreDatabase: (state, action: PayloadAction<{ projectId: string; firestoreDatabaseId: string }>) => {
      const { projectId, firestoreDatabaseId } = action.payload;
      state.items = state.items.map((item) => {
        if (!isGoogleAccount(item) && item.id === projectId && item.authMethod === 'serviceAccount') {
          return { ...item, activeFirestoreDatabaseId: firestoreDatabaseId };
        }
        if (isGoogleAccount(item) && item.projects?.some((p) => p.id === projectId)) {
          return {
            ...item,
            projects: item.projects.map((p) =>
              p.id === projectId ? { ...p, activeFirestoreDatabaseId: firestoreDatabaseId } : p,
            ),
          } as GoogleAccount;
        }
        return item;
      });
      state.selectedProjectId = projectId;
    },
    // Google Account specific actions
    addGoogleAccount: (state, action: PayloadAction<GoogleAccount>) => {
      const account = action.payload;
      const index = state.items.findIndex(
        (p: Project | GoogleAccount) => isGoogleAccount(p) && p.email === account.email,
      );
      if (index !== -1) {
        state.items[index] = account;
      } else {
        state.items.push(account);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProjects.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadProjects.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(connectServiceAccount.pending, (state) => {
        state.loading = true;
      })
      .addCase(connectServiceAccount.fulfilled, (state, action) => {
        const payload = action.payload;
        if (payload.mode === 'create') {
          state.items.push(payload.project);
          state.selectedProjectId = payload.project.id;
        } else {
          const idx = state.items.findIndex((i) => i.id === payload.projectId);
          if (idx !== -1) {
            const p = state.items[idx] as Project;
            state.items[idx] = {
              ...p,
              firestoreDatabases: [...(p.firestoreDatabases || []), payload.newDatabase],
              activeFirestoreDatabaseId: payload.newDatabase.id,
              connected: true,
            };
          }
          state.selectedProjectId = payload.projectId;
        }
        state.loading = false;
      })
      .addCase(connectServiceAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(refreshCollections.fulfilled, (state, action) => {
        const { projectId, collections, firestoreDatabaseId } = action.payload;

        const updateCollections = (items: (Project | GoogleAccount)[]): (Project | GoogleAccount)[] => {
          return items.map((item: Project | GoogleAccount) => {
            if (item.id === projectId) {
              const proj = item as Project;
              if (
                (proj.authMethod === 'serviceAccount' || proj.authMethod === 'google') &&
                firestoreDatabaseId &&
                proj.firestoreDatabases?.length
              ) {
                return {
                  ...proj,
                  firestoreDatabases: proj.firestoreDatabases.map((fd) =>
                    fd.id === firestoreDatabaseId ? { ...fd, collections } : fd,
                  ),
                };
              }
              return { ...item, collections } as Project;
            }
            if (isGoogleAccount(item) && item.projects) {
              return {
                ...item,
                projects: updateCollections(item.projects) as Project[],
              } as GoogleAccount;
            }
            return item;
          });
        };

        state.items = updateCollections(state.items);
      })
      .addCase(addFirestoreDatabase.pending, (state) => {
        state.loading = true;
      })
      .addCase(addFirestoreDatabase.fulfilled, (state, action) => {
        const { projectId, newDatabase } = action.payload;
        const idx = state.items.findIndex((i) => i.id === projectId);
        if (idx !== -1) {
          const p = state.items[idx] as Project;
          state.items[idx] = {
            ...p,
            firestoreDatabases: [...(p.firestoreDatabases || []), newDatabase],
            activeFirestoreDatabaseId: newDatabase.id,
            connected: true,
          };
        }
        state.selectedProjectId = projectId;
        state.loading = false;
      })
      .addCase(addFirestoreDatabase.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addGoogleFirestoreDatabase.pending, (state) => {
        state.loading = true;
      })
      .addCase(addGoogleFirestoreDatabase.fulfilled, (state, action) => {
        const { projectId, newDatabase } = action.payload;
        state.items = state.items.map((item) => {
          if (isGoogleAccount(item) && item.projects?.some((p) => p.id === projectId)) {
            return {
              ...item,
              projects: item.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      firestoreDatabases: [...(p.firestoreDatabases || []), newDatabase],
                      activeFirestoreDatabaseId: newDatabase.id,
                    }
                  : p,
              ),
            } as GoogleAccount;
          }
          return item;
        });
        state.selectedProjectId = projectId;
        state.loading = false;
      })
      .addCase(addGoogleFirestoreDatabase.rejected, (state) => {
        state.loading = false;
      })
      .addCase(refreshGoogleAccountProjects.fulfilled, (state, action) => {
        const { accountId, accessToken, projects } = action.payload;
        state.items = state.items.map((item) => {
          if (isGoogleAccount(item) && item.id === accountId) {
            return {
              ...item,
              accessToken,
              sessionExpired: false,
              projects,
            } as GoogleAccount;
          }
          return item;
        });
      })
      .addCase(signInWithGoogle.pending, (state) => {
        state.googleSignInLoading = true;
      })
      .addCase(signInWithGoogle.fulfilled, (state) => {
        state.googleSignInLoading = false;
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.googleSignInLoading = false;
        state.error = action.error.message || null;
      });
  },
});

export const {
  addProject,
  removeProject,
  setSelectedProject,
  updateProject,
  addGoogleAccount,
  setActiveFirestoreDatabase,
} = projectsSlice.actions;

// Selectors
export const selectProjects = (state: { projects: ProjectsState }) => state.projects.items;
export const selectSelectedProjectId = (state: { projects: ProjectsState }) => state.projects.selectedProjectId;
export const selectSelectedProject = (state: { projects: ProjectsState }) => {
  // Helper to find deep
  const findDeep = (items: (Project | GoogleAccount)[], id: string | null): Project | GoogleAccount | null => {
    if (!id) return null;
    for (const item of items) {
      if (item.id === id) return item;
      if (isGoogleAccount(item) && item.projects) {
        const found = findDeep(item.projects, id);
        if (found) return found;
      }
    }
    return null;
  };
  return findDeep(state.projects.items, state.projects.selectedProjectId || null);
};
export const selectProjectsLoading = (state: { projects: ProjectsState }) => state.projects.loading;
export const selectGoogleSignInLoading = (state: { projects: ProjectsState }) => state.projects.googleSignInLoading;

export default projectsSlice.reducer;
