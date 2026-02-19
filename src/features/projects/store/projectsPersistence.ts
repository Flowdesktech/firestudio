import type { Project, GoogleAccount } from './projectsSlice';

const STORAGE_KEY = 'firefoo-projects';

const isGoogleAccount = (item: Project | GoogleAccount): item is GoogleAccount =>
  (item as GoogleAccount).type === 'googleAccount';

const isProject = (item: Project | GoogleAccount): item is Project => !isGoogleAccount(item);

export const loadProjectsFromStorage = (): (Project | GoogleAccount)[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load projects', e);
    return [];
  }
};

export const saveProjectsToStorage = (projects: (Project | GoogleAccount)[]) => {
  try {
    const minimalProjects = projects
      .map((p) => {
        if (isProject(p) && p.authMethod === 'serviceAccount') {
          return {
            id: p.id,
            projectId: p.projectId,
            serviceAccountPath: p.serviceAccountPath,
            databaseId: p.databaseId,
            authMethod: p.authMethod,
            collections: p.collections || [],
          };
        } else if (isGoogleAccount(p)) {
          return {
            id: p.id,
            type: 'googleAccount',
            email: p.email,
            name: p.name,
            refreshToken: p.refreshToken || null,
            projects: (p.projects || []).map((proj) => ({
              id: proj.id,
              projectId: proj.projectId,
              parentAccountId: proj.parentAccountId,
              authMethod: 'google',
              refreshToken: proj.refreshToken || p.refreshToken || null,
              collections: proj.collections || [],
            })),
          };
        } else if (isProject(p) && p.authMethod === 'google') {
          return {
            id: p.id,
            projectId: p.projectId,
            authMethod: p.authMethod,
            refreshToken: p.refreshToken || null,
            collections: p.collections || [],
          };
        }
        return null;
      })
      .filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalProjects));
  } catch (e) {
    console.error('Failed to save projects', e);
  }
};
