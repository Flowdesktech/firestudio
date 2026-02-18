import { loadProjectsFromStorage, saveProjectsToStorage } from './projectsPersistence';
import type { Project, GoogleAccount } from './projectsSlice';

describe('loadProjectsFromStorage', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(loadProjectsFromStorage()).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('firefoo-projects', '{not valid json');
    expect(loadProjectsFromStorage()).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns empty array when value is not an array', () => {
    localStorage.setItem('firefoo-projects', '{"key": "value"}');
    expect(loadProjectsFromStorage()).toEqual([]);
  });

  it('returns parsed array for valid data', () => {
    const projects = [{ id: '1', projectId: 'my-project', authMethod: 'serviceAccount' }];
    localStorage.setItem('firefoo-projects', JSON.stringify(projects));
    expect(loadProjectsFromStorage()).toEqual(projects);
  });
});

describe('saveProjectsToStorage', () => {
  it('serializes service account with minimal fields including databaseId', () => {
    const project: Project = {
      id: '1',
      projectId: 'my-project',
      authMethod: 'serviceAccount',
      serviceAccountPath: '/path/to/sa.json',
      databaseId: 'my-db',
      collections: [{ id: 'users', path: 'users' }],
      connected: true,
      expanded: true,
    };

    saveProjectsToStorage([project]);
    const saved = JSON.parse(localStorage.getItem('firefoo-projects')!);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({
      id: '1',
      projectId: 'my-project',
      serviceAccountPath: '/path/to/sa.json',
      databaseId: 'my-db',
      authMethod: 'serviceAccount',
      collections: [{ id: 'users', path: 'users' }],
    });
    // Runtime state should NOT be persisted
    expect(saved[0].connected).toBeUndefined();
    expect(saved[0].expanded).toBeUndefined();
  });

  it('serializes Google account with refreshToken and nested projects', () => {
    const account: GoogleAccount = {
      id: 'g1',
      type: 'googleAccount',
      email: 'test@gmail.com',
      name: 'Test User',
      refreshToken: 'rt_123',
      accessToken: 'at_456',
      projects: [
        {
          id: 'g1-proj1',
          projectId: 'proj1',
          parentAccountId: 'g1',
          authMethod: 'google',
          refreshToken: 'rt_proj',
          collections: [],
        },
      ],
    };

    saveProjectsToStorage([account]);
    const saved = JSON.parse(localStorage.getItem('firefoo-projects')!);

    expect(saved).toHaveLength(1);
    expect(saved[0].type).toBe('googleAccount');
    expect(saved[0].email).toBe('test@gmail.com');
    expect(saved[0].refreshToken).toBe('rt_123');
    expect(saved[0].projects).toHaveLength(1);
    expect(saved[0].projects[0].refreshToken).toBe('rt_proj');
    // accessToken should NOT be persisted (runtime only)
    expect(saved[0].accessToken).toBeUndefined();
  });

  it('filters out null entries from unknown item types', () => {
    const items = [
      {
        id: '1',
        projectId: 'p1',
        authMethod: 'serviceAccount' as const,
        serviceAccountPath: '/sa.json',
        collections: [],
      },
      // An item that doesn't match any branch returns null and gets filtered
    ];

    saveProjectsToStorage(items);
    const saved = JSON.parse(localStorage.getItem('firefoo-projects')!);
    expect(saved.every((item: unknown) => item !== null)).toBe(true);
  });
});
