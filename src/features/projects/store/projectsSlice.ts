import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { loadProjectsFromStorage } from './projectsPersistence';
import { ThunkExtra } from '../../../app/store/thunkTypes';
import { RootState } from '../../../app/store';

export interface FirestoreCollection {
  id: string;
  path: string;
}

export interface Project {
  id: string;
  projectId: string;
  authMethod: 'serviceAccount' | 'google';
  serviceAccountPath?: string;
  databaseId?: string;
  collections?: FirestoreCollection[];
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
  return reconnectedProjects;
});

export const connectServiceAccount = createAppAsyncThunk(
  'projects/connectServiceAccount',
  async ({ serviceAccountPath, databaseId }: { serviceAccountPath: string; databaseId?: string }, { extra }) => {
    const electron = extra.electron.api;
    const result = await electron.connectFirebase({ serviceAccountPath, databaseId });
    if (!result?.success) throw new Error(result?.error || 'Connection failed');

    const collectionsResult = await electron.getCollections();

    return {
      id: Date.now().toString(),
      projectId: result.projectId,
      serviceAccountPath,
      databaseId,
      authMethod: 'serviceAccount' as const,
      collections: collectionsResult?.success ? normalizeCollections(collectionsResult.collections) : [],
      expanded: true,
      connected: true,
    };
  },
);

export const refreshCollections = createAppAsyncThunk(
  'projects/refreshCollections',
  async ({ project, refreshToken }: { project: Project; refreshToken?: string }, { extra, rejectWithValue }) => {
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
        const result = await electron.googleGetCollections({ projectId: project.projectId.trim() });
        if (!result?.success) throw new Error(result?.error || 'Failed to get collections');
        collections = normalizeCollections(result.collections || []);
      } else {
        // Force reconnect for service account to ensure clean state
        await electron.disconnectFirebase();
        const connectResult = await electron.connectFirebase({
          serviceAccountPath: project.serviceAccountPath || '',
          databaseId: project.databaseId,
        });
        if (!connectResult?.success) {
          throw new Error(connectResult?.error || 'Failed to connect to Firebase');
        }
        const result = await electron.getCollections();
        if (!result?.success) throw new Error(result?.error || 'Failed to get collections');
        collections = normalizeCollections(result.collections || []);
      }
      return { projectId: project.id, collections };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh collections';
      return rejectWithValue(message);
    }
  },
);

interface GoogleProjectInfo {
  projectId: string;
  collections?: Array<FirestoreCollection | string>;
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

      const existingIdByProjectId = new Map((existingAccount?.projects || []).map((proj) => [proj.projectId, proj.id]));

      const projects = (projectsResult.projects || []).map((proj: GoogleProjectInfo) => ({
        id: existingIdByProjectId.get(proj.projectId) || `${accountId}-${proj.projectId}`,
        projectId: proj.projectId,
        parentAccountId: accountId,
        authMethod: 'google' as const,
        accessToken,
        refreshToken: effectiveRefreshToken,
        collections: normalizeCollections(proj.collections || []),
        expanded: false,
      }));

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
      (proj: GoogleProjectInfo, index: number) => ({
        id: `${accountId}-${index}-${proj.projectId}`,
        projectId: proj.projectId,
        parentAccountId: accountId,
        authMethod: 'google' as const,
        accessToken,
        refreshToken,
        collections: normalizeCollections(proj.collections || []),
        expanded: false,
      }),
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
        const newProject = action.payload as Project;
        state.items.push(newProject);
        state.selectedProjectId = newProject.id;
        state.loading = false;
      })
      .addCase(connectServiceAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(refreshCollections.fulfilled, (state, action) => {
        const { projectId, collections } = action.payload;

        // Note: This logic needs to handle nested Google projects too
        const updateCollections = (items: (Project | GoogleAccount)[]): (Project | GoogleAccount)[] => {
          return items.map((item: Project | GoogleAccount) => {
            if (item.id === projectId) {
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

export const { addProject, removeProject, setSelectedProject, updateProject, addGoogleAccount } = projectsSlice.actions;

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
