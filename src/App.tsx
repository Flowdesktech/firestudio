import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadProjects,
  selectProjects,
  setSelectedProject,
  selectSelectedProject,
  refreshCollections,
  refreshGoogleAccountProjects,
  removeProject,
  selectProjectsLoading,
  Project,
  GoogleAccount,
} from './features/projects/store/projectsSlice';
import {
  selectOpenTabs,
  selectActiveTabId,
  setActiveTab,
  closeTab,
  addTab,
  openDialog,
  selectActiveTab,
  closeTabsForProject,
  DialogState,
} from './app/store/slices/uiSlice';
import { selectSettings } from './app/store/slices/settingsSlice';
import { addLog } from './app/store/slices/logsSlice';
import { Favorite } from './app/store/slices/favoritesSlice';
import { AppDispatch, RootState } from './app/store';
import { isGoogleAccount } from './features/projects/types';

import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';

// Utils
// import { downloadJson } from './shared/utils/commonUtils';

// Collection thunks
import {
  estimateDocCount,
  exportSingleCollection,
  exportAllCollections,
  initCollectionState,
  setCollectionQueryMode,
  setCollectionJsQuery,
} from './features/collections/store/collectionSlice';
import { notificationService } from './shared/services/notificationService';
import { electronService } from './shared/services/electronService';
import { getErrorMessage } from './shared/utils/commonUtils';

// Components
import AppLayout from './app/components/AppLayout';
import GlobalDialogs from './app/components/GlobalDialogs';
import CollectionTab from './features/collections/components/CollectionTab';
import StorageTab from './features/storage/components/StorageTab';
import AuthTab from './features/auth/components/AuthTab';
import { SavedQuery } from './features/console/store/savedQueriesSlice';

type MessageType = 'success' | 'error' | 'info' | 'warning';

// Main Inner Component (connected to Redux)
function FirestudioApp() {
  const dispatch = useDispatch<AppDispatch>();
  const projects = useSelector((state: RootState) => selectProjects(state));
  const selectedProject = useSelector((state: RootState) => selectSelectedProject(state));
  const projectsLoading = useSelector((state: RootState) => selectProjectsLoading(state));
  const openTabs = useSelector((state: RootState) => selectOpenTabs(state));
  const activeTabId = useSelector((state: RootState) => selectActiveTabId(state));
  const activeTab = useSelector((state: RootState) => selectActiveTab(state));
  const settings = useSelector((state: RootState) => selectSettings(state));

  // Initial Load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await dispatch(loadProjects()).unwrap();
        if (cancelled) return;
        items.forEach((item) => {
          if (isGoogleAccount(item) && (item.needsReauth || item.sessionExpired)) {
            dispatch(
              addLog({
                type: 'warning',
                message: `Session expired for ${item.email}. Please sign in again.`,
              }),
            );
          }
        });
      } catch (error: unknown) {
        if (cancelled) return;
        dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (projectsLoading || hasRefreshedRef.current) return;
    if (projects.length === 0) return;

    hasRefreshedRef.current = true;

    // Background refresh: update Google account project lists
    projects.forEach((item) => {
      if (isGoogleAccount(item)) {
        if (item.refreshToken) {
          dispatch(
            refreshGoogleAccountProjects({
              accountId: item.id,
              refreshToken: item.refreshToken,
            }),
          );
        }
      }
    });
  }, [dispatch, projects, projectsLoading]);

  // Keyboard shortcuts (Ctrl+W to close active tab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          dispatch(closeTab(activeTabId));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, activeTabId]);

  // Listen for native menu events (forwarded from preload as CustomEvents)
  useEffect(() => {
    const handleOpenAddProject = () => dispatch(openDialog({ type: 'CONNECTION' }));
    const handleOpenSettings = () => dispatch(openDialog({ type: 'SETTINGS' }));

    window.addEventListener('open-add-project-dialog', handleOpenAddProject);
    window.addEventListener('open-settings-dialog', handleOpenSettings);

    return () => {
      window.removeEventListener('open-add-project-dialog', handleOpenAddProject);
      window.removeEventListener('open-settings-dialog', handleOpenSettings);
    };
  }, [dispatch]);

  // Tab Handlers
  const onOpenCollection = (project: Project | GoogleAccount, collectionPath: string) => {
    if (isGoogleAccount(project)) return;
    const id = `${project.id}-${collectionPath}`;
    dispatch(
      addTab({
        id,
        projectId: project.id,
        projectName: project.projectId,
        label: collectionPath, // normalized to title/label
        type: 'collection',
        collectionPath,
      }),
    );
  };

  const ensureProject = (item: Project | GoogleAccount): Project | null => (isGoogleAccount(item) ? null : item);

  const findProjectById = (items: (Project | GoogleAccount)[], id: string): Project | null => {
    for (const item of items) {
      if (!isGoogleAccount(item) && item.id === id) return item;
      if (isGoogleAccount(item) && item.projects) {
        const found = findProjectById(item.projects, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findProjectByProjectId = (items: (Project | GoogleAccount)[], projectId: string): Project | null => {
    for (const item of items) {
      if (!isGoogleAccount(item) && item.projectId === projectId) return item;
      if (isGoogleAccount(item) && item.projects) {
        const found = findProjectByProjectId(item.projects, projectId);
        if (found) return found;
      }
    }
    return null;
  };

  const findGoogleAccountById = (items: (Project | GoogleAccount)[], accountId: string): GoogleAccount | null => {
    for (const item of items) {
      if (isGoogleAccount(item) && item.id === accountId) return item;
    }
    return null;
  };

  const onOpenFavorite = (favorite: Favorite) => {
    const project = findProjectByProjectId(projects, favorite.projectId);
    if (!project) {
      dispatch(addLog({ type: 'error', message: `Project not found for favorite ${favorite.collectionPath}` }));
      return;
    }
    onOpenCollection(project, favorite.collectionPath);
  };

  const onOpenSavedQuery = (query: SavedQuery) => {
    if (!query.projectId || !query.collectionPath) {
      dispatch(addLog({ type: 'error', message: 'Saved query is missing project or collection' }));
      return;
    }

    const project = findProjectByProjectId(projects, query.projectId);
    if (!project) {
      dispatch(addLog({ type: 'error', message: `Project not found for query ${query.name}` }));
      return;
    }

    onOpenCollection(project, query.collectionPath);

    const collectionKey = `${project.projectId}:${query.collectionPath}`;
    dispatch(initCollectionState({ key: collectionKey, defaultLimit: settings.defaultDocLimit || 50 }));
    dispatch(setCollectionQueryMode({ key: collectionKey, mode: 'js' }));
    dispatch(setCollectionJsQuery({ key: collectionKey, query: query.code }));
  };

  // Sidebar Props
  const sidebarProps = {
    projects,
    selectedProject,
    activeTab,
    onSelectProject: (projectId: string) => dispatch(setSelectedProject(projectId)),
    onOpenCollection,
    onOpenStorage: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(
        addTab({
          id: `${project.id}-storage`,
          projectId: project.id,
          projectName: project.projectId,
          label: 'Storage',
          type: 'storage',
        }),
      );
    },
    onOpenAuth: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(
        addTab({
          id: `${project.id}-auth`,
          projectId: project.id,
          projectName: project.projectId,
          label: 'Auth',
          type: 'auth',
        }),
      );
    },
    onAddProject: () => dispatch(openDialog({ type: 'CONNECTION' })),
    onOpenFavorite,

    // Context Actions
    onAddCollection: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(openDialog({ type: 'ADD_COLLECTION', props: { project } }));
    },
    onRefreshCollections: (item: Project | GoogleAccount) => {
      if (isGoogleAccount(item)) {
        if (item.refreshToken) {
          dispatch(addLog({ type: 'info', message: `Refreshing all collections for ${item.email}...` }));
          dispatch(
            refreshGoogleAccountProjects({
              accountId: item.id,
              refreshToken: item.refreshToken,
            }),
          )
            .unwrap()
            .then((result) => {
              dispatch(addLog({ type: 'success', message: `Refreshed ${result.projects.length} projects` }));
            })
            .catch((error) => {
              dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
            });
        } else {
          dispatch(
            addLog({
              type: 'warning',
              message: `Refresh token missing for ${item.email}. Please sign in again.`,
            }),
          );
        }
        return;
      }
      const refreshToken = item.parentAccountId
        ? findGoogleAccountById(projects, item.parentAccountId)?.refreshToken
        : item.refreshToken;
      if (item.authMethod === 'google' && !refreshToken) {
        dispatch(
          addLog({
            type: 'warning',
            message: `Refresh token missing for ${item.projectId}. Please sign in again.`,
          }),
        );
      }
      dispatch(addLog({ type: 'info', message: `Refreshing collections for ${item.projectId}...` }));
      dispatch(refreshCollections({ project: item, refreshToken }))
        .unwrap()
        .then(() => {
          dispatch(addLog({ type: 'success', message: `Refreshed collections for ${item.projectId}` }));
        })
        .catch((error) => {
          dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
        });
    },
    onDisconnectProject: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(closeTabsForProject(project.id));
      dispatch(removeProject(project.id));
    },
    onDisconnectAccount: (account: GoogleAccount) => {
      // Close tabs for all nested projects
      if (account.projects) {
        account.projects.forEach((p) => dispatch(closeTabsForProject(p.id)));
      }
      dispatch(closeTabsForProject(account.id)); // Just in case
      dispatch(removeProject(account.id));
    },

    // Document handlers
    onAddDocument: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(openDialog({ type: 'ADD_DOCUMENT', props: { project, collection } }));
    },
    onRenameCollection: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(openDialog({ type: 'RENAME_COLLECTION', props: { project, collection } }));
    },
    onDeleteCollection: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(openDialog({ type: 'DELETE_COLLECTION', props: { project, collection } }));
    },

    // Export / Misc - using Redux thunks
    onExportCollection: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(
        addLog({
          type: 'info',
          message:
            project.authMethod === 'google'
              ? `Exporting collection "${collection}"...`
              : `Opening export dialog for "${collection}"...`,
        }),
      );
      dispatch(exportSingleCollection({ project, collection }))
        .unwrap()
        .then((result) => {
          if (result?.count === 0) {
            dispatch(addLog({ type: 'warning', message: 'No documents to export' }));
            return;
          }
          if (result?.filePath) {
            dispatch(addLog({ type: 'success', message: `Exported to ${result.filePath}` }));
            return;
          }
          if (typeof result?.count === 'number') {
            dispatch(addLog({ type: 'success', message: `Exported ${result.count} documents` }));
            return;
          }
          dispatch(addLog({ type: 'success', message: 'Export completed' }));
        })
        .catch((error) => {
          dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
        });
    },
    onExportAllCollections: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(
        addLog({
          type: 'info',
          message:
            project.authMethod === 'google'
              ? `Exporting all collections for ${project.projectId}...`
              : `Opening export dialog for ${project.projectId}...`,
        }),
      );
      dispatch(exportAllCollections({ project }))
        .unwrap()
        .then((result) => {
          if (result?.collectionsCount === 0) {
            dispatch(addLog({ type: 'warning', message: 'No collections to export' }));
            return;
          }
          if (result?.filePath) {
            dispatch(
              addLog({
                type: 'success',
                message: `Exported ${result.collectionsCount} collections to ${result.filePath}`,
              }),
            );
            return;
          }
          if (typeof result?.collectionsCount === 'number') {
            dispatch(addLog({ type: 'success', message: `Exported ${result.collectionsCount} collections` }));
            return;
          }
          dispatch(addLog({ type: 'success', message: 'Export completed' }));
        })
        .catch((error) => {
          dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
        });
    },
    onEstimateDocCount: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      dispatch(estimateDocCount({ project, collection }))
        .unwrap()
        .then(({ count }) => notificationService.showDocumentCount(collection, count))
        .catch((error) => {
          notificationService.showError(getErrorMessage(error));
        });
    },
    onCopyCollectionId: (id: string) => {
      navigator.clipboard.writeText(id);
      dispatch(addLog({ type: 'success', message: 'Copied Collection ID' }));
    },
    onCopyProjectId: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      navigator.clipboard.writeText(project.projectId);
      dispatch(addLog({ type: 'success', message: 'Copied Project ID' }));
    },
    onCopyResourcePath: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      const path = `projects/${project.projectId}/databases/(default)/documents/${collection}`;
      navigator.clipboard.writeText(path);
      dispatch(addLog({ type: 'success', message: 'Copied Resource Path' }));
    },
    onRevealInFirebaseConsole: (item: Project | GoogleAccount) => {
      const project = ensureProject(item);
      if (!project) return;
      const url = `https://console.firebase.google.com/project/${project.projectId}/firestore`;
      electronService.openExternal(url);
    },
    onRevealCollectionInConsole: (item: Project | GoogleAccount, collection: string) => {
      const project = ensureProject(item);
      if (!project) return;
      const url = `https://console.firebase.google.com/project/${project.projectId}/firestore/data/${collection}`;
      electronService.openExternal(url);
    },

    // Pass generic open for settings
    onOpenDialog: (payload: DialogState) => dispatch(openDialog(payload)),
  };

  if (projectsLoading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AppLayout sidebarProps={sidebarProps} onOpenQuery={onOpenSavedQuery}>
      {/* Tabs Header */}
      {openTabs.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            borderBottom: 1,
            borderColor: 'divider',
            overflowX: 'auto',
            bgcolor: 'background.paper',
            flexShrink: 0,
            minHeight: 40,
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
          }}
        >
          {openTabs.map((tab) => (
            <Box
              key={tab.id}
              onClick={() => dispatch(setActiveTab(tab.id))}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  // Middle mouse button - prevent autoscroll
                  e.preventDefault();
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  // Middle mouse button
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch(closeTab(tab.id));
                }
              }}
              sx={{
                py: 1,
                px: 2,
                cursor: 'pointer',
                borderBottom: activeTabId === tab.id ? 2 : 0,
                borderColor: 'primary.main',
                bgcolor: activeTabId === tab.id ? 'action.selected' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: activeTabId === tab.id ? 'action.selected' : 'action.hover' },
              }}
            >
              <Typography variant="body2" noWrap>
                {tab.label}
              </Typography>
              <CloseIcon
                fontSize="small"
                sx={{
                  opacity: 0.5,
                  fontSize: 16,
                  flexShrink: 0,
                  '&:hover': { opacity: 1, color: 'error.main' },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(closeTab(tab.id));
                }}
              />
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 300 }}>
            Welcome to Firestudio
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={sidebarProps.onAddProject}>
            Connect Project
          </Button>
        </Box>
      )}

      {/* Active Tab Content */}
      {activeTab && (
        <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
          {(() => {
            const project = findProjectById(projects, activeTab.projectId);

            if (!project) {
              return (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 2,
                    p: 4,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h6">Project disconnected</Typography>
                  <Typography variant="body2" color="text.secondary">
                    This tab references a project that is no longer connected.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" onClick={() => dispatch(closeTab(activeTab.id))}>
                      Close Tab
                    </Button>
                    <Button variant="contained" onClick={sidebarProps.onAddProject}>
                      Reconnect Project
                    </Button>
                  </Box>
                </Box>
              );
            }

            if (activeTab.type === 'collection') {
              if (!project || !activeTab.collectionPath) return null;
              return (
                <CollectionTab
                  key={activeTab.id}
                  project={project}
                  collectionPath={activeTab.collectionPath}
                  showMessage={(msg: string, type: MessageType) => dispatch(addLog({ type, message: msg }))}
                  // Pass down handlers that map to Redux actions...
                />
              );
            }
            if (activeTab.type === 'storage') {
              return (
                <StorageTab
                  project={project}
                  showMessage={(msg: string, type: MessageType) => dispatch(addLog({ type, message: msg }))}
                />
              );
            }
            if (activeTab.type === 'auth') {
              if (!project) return null;
              return (
                <AuthTab
                  project={project}
                  showMessage={(msg: string, type: MessageType) => dispatch(addLog({ type, message: msg }))}
                />
              );
            }
            return null;
          })()}
        </Box>
      )}

      <GlobalDialogs
        onShowMessage={(msg: string, type: 'success' | 'error' | 'warning') => dispatch(addLog({ type, message: msg }))}
      />
    </AppLayout>
  );
}

export default function App() {
  return <FirestudioApp />;
}
