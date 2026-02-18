import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  addProject,
  removeProject,
  updateProject,
  addGoogleAccount,
  connectServiceAccount,
  loadProjects,
} from './projectsSlice';
import type { Project, GoogleAccount } from './projectsSlice';

// ─── Reducer Tests ───────────────────────────────────────────────────────────

describe('projectsSlice reducers', () => {
  const initialState = {
    items: [] as (Project | GoogleAccount)[],
    selectedProjectId: null as string | null,
    loading: false,
    googleSignInLoading: false,
    error: null as string | null,
  };

  it('addProject pushes to empty items', () => {
    const project: Project = {
      id: '1',
      projectId: 'p1',
      authMethod: 'serviceAccount',
      serviceAccountPath: '/sa.json',
    };

    const state = reducer(initialState, addProject(project));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual(project);
  });

  it('removeProject clears selectedProjectId if it matches', () => {
    const stateWithSelection = {
      ...initialState,
      items: [{ id: '1', projectId: 'p1', authMethod: 'serviceAccount' as const }],
      selectedProjectId: '1',
    };

    const state = reducer(stateWithSelection, removeProject('1'));
    expect(state.items).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it('removeProject does not clear selectedProjectId if different', () => {
    const stateWithSelection = {
      ...initialState,
      items: [
        { id: '1', projectId: 'p1', authMethod: 'serviceAccount' as const },
        { id: '2', projectId: 'p2', authMethod: 'serviceAccount' as const },
      ],
      selectedProjectId: '2',
    };

    const state = reducer(stateWithSelection, removeProject('1'));
    expect(state.items).toHaveLength(1);
    expect(state.selectedProjectId).toBe('2');
  });

  it('updateProject merges partial changes', () => {
    const stateWithProject = {
      ...initialState,
      items: [{ id: '1', projectId: 'p1', authMethod: 'serviceAccount' as const, connected: false }],
    };

    const state = reducer(stateWithProject, updateProject({ id: '1', changes: { connected: true } }));
    expect((state.items[0] as Project).connected).toBe(true);
    expect((state.items[0] as Project).projectId).toBe('p1');
  });

  it('addGoogleAccount deduplicates by email', () => {
    const account1: GoogleAccount = {
      id: 'g1',
      type: 'googleAccount',
      email: 'test@gmail.com',
      name: 'Test',
      projects: [],
    };

    let state = reducer(initialState, addGoogleAccount(account1));
    expect(state.items).toHaveLength(1);

    // Add same email with updated token
    const account2: GoogleAccount = {
      id: 'g2',
      type: 'googleAccount',
      email: 'test@gmail.com',
      name: 'Test Updated',
      accessToken: 'new-token',
      projects: [],
    };

    state = reducer(state, addGoogleAccount(account2));
    // Should replace, not add
    expect(state.items).toHaveLength(1);
    expect((state.items[0] as GoogleAccount).name).toBe('Test Updated');
  });
});

// ─── Thunk Tests ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTestStore(electronApi: Record<string, any> = {}) {
  return configureStore({
    reducer: { projects: reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: {
          extraArgument: { electron: { api: electronApi } },
        },
      }),
  });
}

describe('projectsSlice thunks', () => {
  it('connectServiceAccount success with databaseId', async () => {
    const mockApi = {
      connectFirebase: vi.fn().mockResolvedValue({
        success: true,
        projectId: 'test-project',
      }),
      getCollections: vi.fn().mockResolvedValue({
        success: true,
        collections: ['users', 'orders'],
      }),
    };

    const store = createTestStore(mockApi);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store.dispatch(connectServiceAccount({ serviceAccountPath: '/sa.json', databaseId: 'my-db' }) as any);

    const state = store.getState().projects;
    expect(state.items).toHaveLength(1);

    const project = state.items[0] as Project;
    expect(project.projectId).toBe('test-project');
    expect(project.databaseId).toBe('my-db');
    expect(project.connected).toBe(true);
    expect(project.collections).toHaveLength(2);
    expect(state.selectedProjectId).toBe(project.id);
  });

  it('connectServiceAccount failure sets error', async () => {
    const mockApi = {
      connectFirebase: vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      }),
    };

    const store = createTestStore(mockApi);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store.dispatch(connectServiceAccount({ serviceAccountPath: '/bad.json' }) as any);

    const state = store.getState().projects;
    expect(state.items).toHaveLength(0);
    expect(state.error).toBe('Invalid credentials');
  });

  it('loadProjects returns empty for no saved data', async () => {
    // localStorage is cleared in setup, so loadProjectsFromStorage returns []
    const store = createTestStore({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store.dispatch(loadProjects() as any);

    expect(store.getState().projects.items).toEqual([]);
  });

  it('loadProjects restores service account project', async () => {
    const saved = [
      {
        id: '1',
        projectId: 'restored-project',
        authMethod: 'serviceAccount',
        serviceAccountPath: '/sa.json',
        collections: ['col1'],
      },
    ];
    localStorage.setItem('firefoo-projects', JSON.stringify(saved));

    const store = createTestStore({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store.dispatch(loadProjects() as any);

    const state = store.getState().projects;
    expect(state.items).toHaveLength(1);

    const project = state.items[0] as Project;
    expect(project.projectId).toBe('restored-project');
    expect(project.connected).toBe(true);
    expect(project.expanded).toBe(true);
    // Collections should be normalized to objects
    expect(project.collections).toEqual([{ id: 'col1', path: 'col1' }]);
  });
});
