import React from 'react';
import { Box, Typography, IconButton, Collapse, Tooltip, Button, CircularProgress } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Layers as CollectionIcon,
  Folder as ProjectIcon,
  MoreVert as MoreVertIcon,
  Warning as WarningIcon,
  Google as GoogleIcon,
  Key as KeyIcon,
  CloudQueue as StorageIcon,
  PeopleAlt as AuthIcon,
  LinkOff as LinkOffIcon,
  Add as AddIcon,
  Dns as DatabaseIcon,
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { setSidebarItemExpanded, Tab } from '../../../../app/store/slices/uiSlice';
import { Project, GoogleAccount, FirestoreCollection } from '../../store/projectsSlice';
import { MenuTarget, MenuTargetType } from '../../types';
import { getFirestoreDatabaseDisplay } from '../../utils/firestoreDatabaseUtils';

interface SidebarProjectsListProps {
  googleAccounts: GoogleAccount[];
  serviceAccountProjects: Project[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedItems: Record<string, boolean>;
  toggleExpanded: (itemId: string, isExpanded: boolean) => void;
  selectedProject: Project | GoogleAccount | null;
  activeTab?: Tab | null;
  onOpenCollection: (
    project: Project | GoogleAccount,
    collectionId: string,
    firestoreDatabaseId?: string,
    databaseLabel?: string,
  ) => void;
  onAddCollection: (project: Project | GoogleAccount) => void;
  onAddFirestoreDatabase: (project: Project) => void;
  onSetActiveFirestoreDatabase: (projectId: string, firestoreDatabaseId: string) => void;
  onOpenStorage: (project: Project | GoogleAccount) => void;
  onOpenAuth: (project: Project | GoogleAccount) => void;
  handleReconnect: (accountId: string, e?: React.MouseEvent) => void;
  reconnecting: string | null;
  handleMenu: (
    e: React.MouseEvent<HTMLButtonElement>,
    target: Project | GoogleAccount,
    type: 'account' | 'project',
  ) => void;
  handleProjectMenu: (e: React.MouseEvent<HTMLButtonElement>, project: Project) => void;
  handleContextMenu: (
    e: React.MouseEvent,
    target:
      | Project
      | { project: Project | GoogleAccount; collection: string; firestoreDatabaseId?: string }
      | MenuTarget,
    type: Exclude<MenuTargetType, 'account'>,
  ) => void;
  isMenuOpen: boolean;
  menuTarget: MenuTarget | null;
}

function SidebarProjectsList({
  googleAccounts,
  serviceAccountProjects,
  searchQuery,
  setSearchQuery,
  expandedItems,
  toggleExpanded,
  selectedProject,
  activeTab,
  onOpenCollection,
  onAddCollection,
  onAddFirestoreDatabase,
  onSetActiveFirestoreDatabase,
  onOpenStorage,
  onOpenAuth,
  handleReconnect,
  reconnecting,
  handleMenu,
  handleProjectMenu,
  handleContextMenu,
  isMenuOpen,
  menuTarget,
}: SidebarProjectsListProps) {
  const dispatch = useDispatch();

  const collectionMatchesQuery = (collection: FirestoreCollection, query: string) => {
    const normalized = query.toLowerCase();
    return collection.id.toLowerCase().includes(normalized) || collection.path.toLowerCase().includes(normalized);
  };

  const getCollectionPath = (collection: FirestoreCollection) => collection.path || collection.id;
  const getCollectionLabel = (collection: FirestoreCollection) => collection.id || collection.path;

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
      {googleAccounts.length === 0 && serviceAccountProjects.length === 0 ? (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">No projects connected</Typography>
        </Box>
      ) : (
        <>
          {/* Google Accounts */}
          {googleAccounts.map((account) => {
            // Check if any project or collection matches the search
            const hasMatchingContent =
              !searchQuery ||
              account.projects?.some(
                (project) =>
                  project.projectId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  project.firestoreDatabases?.some(
                    (fd) =>
                      getFirestoreDatabaseDisplay(fd).toLowerCase().includes(searchQuery.toLowerCase()) ||
                      fd.databaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      fd.collections?.some((c) => collectionMatchesQuery(c, searchQuery)),
                  ) ||
                  project.collections?.some((c) => collectionMatchesQuery(c, searchQuery)),
              );

            // Skip this account if nothing matches
            if (!hasMatchingContent) return null;

            const isAccountExpanded = expandedItems[account.id] !== false || !!searchQuery;

            return (
              <Box key={account.id}>
                {/* Google Account Header */}
                <Box
                  onClick={() => toggleExpanded(account.id, isAccountExpanded)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    cursor: 'pointer',
                    bgcolor: 'background.default',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.secondary', cursor: 'pointer' }}>
                    {isAccountExpanded ? (
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                  <GoogleIcon
                    sx={{
                      fontSize: 16,
                      color: account.needsReauth ? '#f44336' : '#4285f4',
                      mr: 0.5,
                    }}
                  />
                  {account.needsReauth && (
                    <Tooltip title="Session expired - reconnect required">
                      <LinkOffIcon sx={{ fontSize: 14, color: '#f44336', mr: 0.5 }} />
                    </Tooltip>
                  )}
                  <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        color: account.needsReauth ? 'error.main' : 'text.primary',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {account.email}
                    </Typography>
                    {account.needsReauth ? (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={(e) => handleReconnect(account.id, e)}
                        disabled={reconnecting === account.id}
                        sx={{
                          fontSize: '0.6rem',
                          py: 0,
                          px: 0.5,
                          minWidth: 'auto',
                          height: 18,
                          textTransform: 'none',
                        }}
                      >
                        {reconnecting === account.id ? <CircularProgress size={10} sx={{ mr: 0.5 }} /> : null}
                        Reconnect
                      </Button>
                    ) : (
                      <Typography
                        sx={{
                          fontSize: '0.65rem',
                          color: 'text.secondary',
                        }}
                      >
                        {account.projects?.length || 0} project
                        {account.projects?.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenu(e, account, 'account')}
                    sx={{
                      p: 0.25,
                      opacity: 0.5,
                      '&:hover': {
                        opacity: 1,
                        bgcolor: 'action.hover',
                      },
                      color: 'text.secondary',
                      borderRadius: 1,
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>

                {/* Projects under this account */}
                <Collapse in={isAccountExpanded}>
                  {account.projects
                    ?.filter((project) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        project.projectId.toLowerCase().includes(query) ||
                        project.firestoreDatabases?.some(
                          (fd) =>
                            getFirestoreDatabaseDisplay(fd).toLowerCase().includes(query) ||
                            fd.databaseId.toLowerCase().includes(query) ||
                            fd.collections?.some((c) => collectionMatchesQuery(c, query)),
                        ) ||
                        project.collections?.some((c) => collectionMatchesQuery(c, query))
                      );
                    })
                    .map((project, projectIndex) => {
                      // Default: only first project in first account is expanded
                      const isFirstProject = googleAccounts.indexOf(account) === 0 && projectIndex === 0;
                      const isProjectExpanded =
                        expandedItems[project.id] !== undefined
                          ? expandedItems[project.id]
                          : isFirstProject || !!searchQuery;

                      return (
                        <Box key={project.id}>
                          {/* Project Header */}
                          <Box
                            onClick={() => toggleExpanded(project.id, isProjectExpanded)}
                            onContextMenu={(e) => handleContextMenu(e, project, 'googleProject')}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              pl: 3,
                              pr: 1,
                              py: 0.4,
                              cursor: 'pointer',
                              bgcolor: selectedProject?.id === project.id ? 'action.selected' : 'transparent',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <IconButton
                              size="small"
                              sx={{
                                p: 0,
                                mr: 0.5,
                                color: 'text.secondary',
                                cursor: 'pointer',
                              }}
                            >
                              {isProjectExpanded ? (
                                <ExpandMoreIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <ChevronRightIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                            <ProjectIcon sx={{ fontSize: 14, color: 'warning.main', mr: 0.5 }} />
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                flexGrow: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: 'text.primary',
                              }}
                            >
                              {project.projectId}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={(e) => handleProjectMenu(e, project)}
                              sx={{
                                p: 0.25,
                                opacity: 0.5,
                                '&:hover': {
                                  opacity: 1,
                                  bgcolor: 'action.hover',
                                },
                                color: 'text.secondary',
                                borderRadius: 1,
                              }}
                            >
                              <MoreVertIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>

                          <Collapse in={isProjectExpanded}>
                            <Box sx={{ pl: 6 }}>
                              {(() => {
                                const isAuthActive = activeTab?.type === 'auth' && activeTab?.projectId === project.id;
                                return (
                                  <Box
                                    onClick={() => onOpenAuth?.(project)}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      px: 1,
                                      py: 0.5,
                                      cursor: 'pointer',
                                      bgcolor: isAuthActive ? 'action.selected' : 'transparent',
                                      borderLeft: isAuthActive ? '2px solid' : '2px solid transparent',
                                      borderColor: isAuthActive ? 'secondary.main' : 'transparent',
                                      '&:hover': {
                                        bgcolor: isAuthActive ? 'action.selected' : 'action.hover',
                                      },
                                    }}
                                  >
                                    <AuthIcon sx={{ fontSize: 14, color: 'secondary.main', mr: 0.75 }} />
                                    <Typography
                                      sx={{
                                        fontSize: '0.75rem',
                                        color: isAuthActive ? 'secondary.main' : 'text.primary',
                                        fontWeight: isAuthActive ? 600 : 500,
                                      }}
                                    >
                                      Authentication
                                    </Typography>
                                  </Box>
                                );
                              })()}

                              {(() => {
                                const isStorageActive =
                                  activeTab?.type === 'storage' && activeTab?.projectId === project.id;
                                return (
                                  <Box
                                    onClick={() => onOpenStorage?.(project)}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      px: 1,
                                      py: 0.5,
                                      mt: 0.25,
                                      cursor: 'pointer',
                                      borderTop: 1,
                                      borderTopColor: 'divider',
                                      bgcolor: isStorageActive ? 'action.selected' : 'transparent',
                                      borderLeft: isStorageActive ? '2px solid' : '2px solid transparent',
                                      borderLeftColor: isStorageActive ? 'primary.main' : 'transparent',
                                      '&:hover': {
                                        bgcolor: isStorageActive ? 'action.selected' : 'action.hover',
                                      },
                                    }}
                                  >
                                    <StorageIcon sx={{ fontSize: 14, color: 'primary.main', mr: 0.75 }} />
                                    <Typography
                                      sx={{
                                        fontSize: '0.75rem',
                                        color: isStorageActive ? 'primary.main' : 'text.primary',
                                        fontWeight: isStorageActive ? 600 : 500,
                                      }}
                                    >
                                      Storage
                                    </Typography>
                                  </Box>
                                );
                              })()}

                              {(() => {
                                const firestoreSectionId = `${project.id}:firestore`;
                                const isFirestoreSectionExpanded =
                                  expandedItems[firestoreSectionId] !== undefined
                                    ? expandedItems[firestoreSectionId]
                                    : true;

                                return (
                                  <Box sx={{ mt: 0.5 }}>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        pl: 0.5,
                                        pr: 0.5,
                                        py: 0.35,
                                      }}
                                    >
                                      <IconButton
                                        size="small"
                                        sx={{ p: 0, mr: 0.25, color: 'text.secondary' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpanded(firestoreSectionId, isFirestoreSectionExpanded);
                                        }}
                                      >
                                        {isFirestoreSectionExpanded ? (
                                          <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                          <ChevronRightIcon sx={{ fontSize: 16 }} />
                                        )}
                                      </IconButton>
                                      <DatabaseIcon sx={{ fontSize: 15, color: 'success.main', mr: 0.5 }} />
                                      <Typography
                                        sx={{
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          color: 'text.secondary',
                                          flexGrow: 1,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                        }}
                                      >
                                        Firestore
                                      </Typography>
                                      <Tooltip title="Add database">
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddFirestoreDatabase(project);
                                          }}
                                          sx={{ p: 0.25, color: 'primary.main' }}
                                        >
                                          <AddIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleContextMenu(e, { menuType: 'firestoreRoot', project }, 'firestoreRoot');
                                        }}
                                        sx={{ p: 0.25, color: 'text.secondary' }}
                                      >
                                        <MoreVertIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Box>

                                    <Collapse in={isFirestoreSectionExpanded}>
                                      <Box sx={{ pl: 1.5 }}>
                                        {(project.firestoreDatabases || []).map((fd) => {
                                          const fdExpandedKey = `${project.id}:fd:${fd.id}`;
                                          const isFdExpanded =
                                            expandedItems[fdExpandedKey] !== undefined
                                              ? expandedItems[fdExpandedKey]
                                              : true;
                                          const dbLabel = getFirestoreDatabaseDisplay(fd);
                                          const isDbSelected =
                                            selectedProject?.id === project.id &&
                                            project.activeFirestoreDatabaseId === fd.id;

                                          return (
                                            <Box key={fd.id} sx={{ mb: 0.25 }}>
                                              <Box
                                                sx={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  pl: 0.5,
                                                  pr: 0.25,
                                                  py: 0.2,
                                                  cursor: 'pointer',
                                                  bgcolor: isDbSelected ? 'action.hover' : 'transparent',
                                                  borderRadius: 0.5,
                                                  '&:hover': { bgcolor: 'action.hover' },
                                                }}
                                                onClick={() => onSetActiveFirestoreDatabase(project.id, fd.id)}
                                              >
                                                <IconButton
                                                  size="small"
                                                  sx={{ p: 0, mr: 0.25, color: 'text.secondary' }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExpanded(fdExpandedKey, isFdExpanded);
                                                  }}
                                                >
                                                  {isFdExpanded ? (
                                                    <ExpandMoreIcon sx={{ fontSize: 15 }} />
                                                  ) : (
                                                    <ChevronRightIcon sx={{ fontSize: 15 }} />
                                                  )}
                                                </IconButton>
                                                <DatabaseIcon sx={{ fontSize: 13, color: 'success.main', mr: 0.5 }} />
                                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                  <Typography
                                                    sx={{
                                                      fontSize: '0.75rem',
                                                      fontWeight: 600,
                                                      overflow: 'hidden',
                                                      textOverflow: 'ellipsis',
                                                      whiteSpace: 'nowrap',
                                                    }}
                                                  >
                                                    {dbLabel}
                                                  </Typography>
                                                  <Typography
                                                    variant="caption"
                                                    sx={{
                                                      fontSize: '0.65rem',
                                                      color: 'text.secondary',
                                                      display: 'block',
                                                      lineHeight: 1.1,
                                                    }}
                                                  >
                                                    {fd.databaseId}
                                                  </Typography>
                                                </Box>
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(
                                                      e,
                                                      { menuType: 'firestoreDatabase', project, firestoreDatabase: fd },
                                                      'firestoreDatabase',
                                                    );
                                                  }}
                                                  sx={{ p: 0.2, color: 'text.secondary' }}
                                                >
                                                  <MoreVertIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                              </Box>

                                              <Collapse in={isFdExpanded}>
                                                <Box sx={{ pl: 1.25, pt: 0.25 }}>
                                                  {(fd.collections || [])
                                                    .filter(
                                                      (collection) =>
                                                        !searchQuery || collectionMatchesQuery(collection, searchQuery),
                                                    )
                                                    .map((collection) => {
                                                      const collectionPath =
                                                        getCollectionPath(collection) || getCollectionLabel(collection);
                                                      const collectionLabel = getCollectionLabel(collection);
                                                      const collectionKey = `${project.id}:${fd.id}:${collectionPath}`;
                                                      const isActive =
                                                        activeTab?.type === 'collection' &&
                                                        activeTab?.projectId === project.id &&
                                                        activeTab?.collectionPath === collectionPath &&
                                                        activeTab?.firestoreDatabaseId === fd.id;
                                                      const isMenuTarget =
                                                        isMenuOpen &&
                                                        menuTarget?.menuType === 'collection' &&
                                                        menuTarget?.project?.id === project.id &&
                                                        menuTarget?.collection === collectionPath &&
                                                        (menuTarget as { firestoreDatabaseId?: string })
                                                          .firestoreDatabaseId === fd.id;
                                                      return (
                                                        <Box
                                                          key={collectionKey}
                                                          onClick={() => {
                                                            dispatch(
                                                              setSidebarItemExpanded({
                                                                id: account.id,
                                                                expanded: true,
                                                              }),
                                                            );
                                                            onSetActiveFirestoreDatabase(project.id, fd.id);
                                                            onOpenCollection(
                                                              project,
                                                              collectionPath,
                                                              fd.id,
                                                              getFirestoreDatabaseDisplay(fd),
                                                            );
                                                            dispatch(
                                                              setSidebarItemExpanded({
                                                                id: project.id,
                                                                expanded: true,
                                                              }),
                                                            );
                                                            dispatch(
                                                              setSidebarItemExpanded({
                                                                id: `${project.id}:firestore`,
                                                                expanded: true,
                                                              }),
                                                            );
                                                            dispatch(
                                                              setSidebarItemExpanded({
                                                                id: `${project.id}:fd:${fd.id}`,
                                                                expanded: true,
                                                              }),
                                                            );
                                                            setSearchQuery('');
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleContextMenu(
                                                              e,
                                                              {
                                                                project,
                                                                collection: collectionPath,
                                                                firestoreDatabaseId: fd.id,
                                                              },
                                                              'collection',
                                                            )
                                                          }
                                                          sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            px: 1,
                                                            py: 0.35,
                                                            cursor: 'pointer',
                                                            bgcolor: isMenuTarget
                                                              ? 'action.hover'
                                                              : isActive
                                                                ? 'action.selected'
                                                                : 'transparent',
                                                            borderLeft: isActive
                                                              ? '2px solid'
                                                              : '2px solid transparent',
                                                            borderColor: isActive ? 'primary.main' : 'transparent',
                                                            '&:hover': {
                                                              bgcolor: isActive ? 'action.selected' : 'action.hover',
                                                            },
                                                          }}
                                                        >
                                                          <CollectionIcon
                                                            sx={{
                                                              fontSize: 13,
                                                              color: isActive ? 'primary.main' : 'text.secondary',
                                                              mr: 0.5,
                                                            }}
                                                          />
                                                          <Typography
                                                            sx={{
                                                              fontSize: '0.72rem',
                                                              color: isActive ? 'primary.main' : 'text.primary',
                                                              fontWeight: isActive ? 600 : 400,
                                                              overflow: 'hidden',
                                                              textOverflow: 'ellipsis',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            {collectionLabel}
                                                          </Typography>
                                                        </Box>
                                                      );
                                                    })}
                                                  {(!fd.collections || fd.collections.length === 0) && (
                                                    <Typography
                                                      sx={{
                                                        fontSize: '0.68rem',
                                                        color: 'text.disabled',
                                                        px: 1,
                                                        py: 0.25,
                                                      }}
                                                    >
                                                      No collections
                                                    </Typography>
                                                  )}

                                                  <Box
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onSetActiveFirestoreDatabase(project.id, fd.id);
                                                      onAddCollection?.(project);
                                                    }}
                                                    sx={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      px: 1,
                                                      py: 0.35,
                                                      cursor: 'pointer',
                                                      color: 'primary.main',
                                                      '&:hover': { bgcolor: 'action.hover' },
                                                    }}
                                                  >
                                                    <AddIcon sx={{ fontSize: 13, mr: 0.5 }} />
                                                    <Typography sx={{ fontSize: '0.72rem' }}>Add collection</Typography>
                                                  </Box>
                                                </Box>
                                              </Collapse>
                                            </Box>
                                          );
                                        })}

                                        <Box
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddFirestoreDatabase(project);
                                          }}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.5,
                                            cursor: 'pointer',
                                            color: 'primary.main',
                                            '&:hover': { bgcolor: 'action.hover' },
                                          }}
                                        >
                                          <AddIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                          <Typography sx={{ fontSize: '0.75rem' }}>Add database</Typography>
                                        </Box>
                                      </Box>
                                    </Collapse>
                                  </Box>
                                );
                              })()}
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                </Collapse>
              </Box>
            );
          })}

          {/* Service Account Projects */}
          {serviceAccountProjects
            .filter((project) => {
              // Filter service account projects by search query
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();
              return (
                project.projectId.toLowerCase().includes(query) ||
                project.firestoreDatabases?.some(
                  (fd) =>
                    getFirestoreDatabaseDisplay(fd).toLowerCase().includes(query) ||
                    fd.databaseId.toLowerCase().includes(query) ||
                    fd.collections?.some((c) => collectionMatchesQuery(c, query)),
                ) ||
                project.collections?.some((c) => collectionMatchesQuery(c, query))
              );
            })
            .map((project, index) => {
              // Service account projects: only first one expanded if no google accounts
              const isFirstServiceAccount = googleAccounts.length === 0 && index === 0;
              const isExpanded =
                expandedItems[project.id] !== undefined
                  ? expandedItems[project.id]
                  : isFirstServiceAccount || !!searchQuery;

              return (
                <Box key={project.id}>
                  {/* Project Header */}
                  <Box
                    onClick={() => toggleExpanded(project.id, isExpanded)}
                    onContextMenu={(e) => handleContextMenu(e, project, 'project')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: 1,
                      py: 0.5,
                      cursor: 'pointer',
                      bgcolor: selectedProject?.id === project.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.secondary', cursor: 'pointer' }}>
                      {isExpanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                    <KeyIcon
                      sx={{
                        fontSize: 16,
                        color: project.connected === false ? '#f44336' : '#ff9800',
                        mr: 0.5,
                      }}
                    />
                    {project.connected === false && (
                      <Tooltip title="Connection failed">
                        <WarningIcon sx={{ fontSize: 14, color: '#f44336', mr: 0.5 }} />
                      </Tooltip>
                    )}
                    <Typography
                      sx={{
                        fontSize: '0.8rem',
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'text.primary',
                      }}
                    >
                      {project.projectId}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenu(e, project, 'project')}
                      sx={{
                        p: 0.25,
                        opacity: 0.5,
                        '&:hover': {
                          opacity: 1,
                          backgroundColor: 'action.hover',
                        },
                        color: 'text.secondary',
                        borderRadius: 1,
                      }}
                    >
                      <MoreVertIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ pl: 6 }}>
                      {(() => {
                        const isAuthActive = activeTab?.type === 'auth' && activeTab?.projectId === project.id;
                        return (
                          <Box
                            onClick={() => onOpenAuth?.(project)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              px: 1,
                              py: 0.5,
                              cursor: 'pointer',
                              bgcolor: isAuthActive ? 'action.selected' : 'transparent',
                              borderLeft: isAuthActive ? '2px solid' : '2px solid transparent',
                              borderColor: isAuthActive ? 'secondary.main' : 'transparent',
                              '&:hover': {
                                bgcolor: isAuthActive ? 'action.selected' : 'action.hover',
                              },
                            }}
                          >
                            <AuthIcon sx={{ fontSize: 14, color: 'secondary.main', mr: 0.75 }} />
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                color: isAuthActive ? 'secondary.main' : 'text.primary',
                                fontWeight: isAuthActive ? 600 : 500,
                              }}
                            >
                              Authentication
                            </Typography>
                          </Box>
                        );
                      })()}

                      {(() => {
                        const isStorageActive = activeTab?.type === 'storage' && activeTab?.projectId === project.id;
                        return (
                          <Box
                            onClick={() => onOpenStorage?.(project)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              px: 1,
                              py: 0.5,
                              mt: 0.25,
                              cursor: 'pointer',
                              borderTop: 1,
                              borderTopColor: 'divider',
                              bgcolor: isStorageActive ? 'action.selected' : 'transparent',
                              borderLeft: isStorageActive ? '2px solid' : '2px solid transparent',
                              borderLeftColor: isStorageActive ? 'primary.main' : 'transparent',
                              '&:hover': {
                                bgcolor: isStorageActive ? 'action.selected' : 'action.hover',
                              },
                            }}
                          >
                            <StorageIcon sx={{ fontSize: 14, color: 'primary.main', mr: 0.75 }} />
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                color: isStorageActive ? 'primary.main' : 'text.primary',
                                fontWeight: isStorageActive ? 600 : 500,
                              }}
                            >
                              Storage
                            </Typography>
                          </Box>
                        );
                      })()}

                      {(() => {
                        const firestoreSectionId = `${project.id}:firestore`;
                        const isFirestoreSectionExpanded =
                          expandedItems[firestoreSectionId] !== undefined ? expandedItems[firestoreSectionId] : true;

                        return (
                          <Box sx={{ mt: 0.5 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                pl: 0.5,
                                pr: 0.5,
                                py: 0.35,
                              }}
                            >
                              <IconButton
                                size="small"
                                sx={{ p: 0, mr: 0.25, color: 'text.secondary' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(firestoreSectionId, isFirestoreSectionExpanded);
                                }}
                              >
                                {isFirestoreSectionExpanded ? (
                                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <ChevronRightIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                              <DatabaseIcon sx={{ fontSize: 15, color: 'success.main', mr: 0.5 }} />
                              <Typography
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: 'text.secondary',
                                  flexGrow: 1,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Firestore
                              </Typography>
                              <Tooltip title="Add database">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddFirestoreDatabase(project);
                                  }}
                                  sx={{ p: 0.25, color: 'primary.main' }}
                                >
                                  <AddIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContextMenu(e, { menuType: 'firestoreRoot', project }, 'firestoreRoot');
                                }}
                                sx={{ p: 0.25, color: 'text.secondary' }}
                              >
                                <MoreVertIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>

                            <Collapse in={isFirestoreSectionExpanded}>
                              <Box sx={{ pl: 1.5 }}>
                                {(project.firestoreDatabases || []).map((fd) => {
                                  const fdExpandedKey = `${project.id}:fd:${fd.id}`;
                                  const isFdExpanded =
                                    expandedItems[fdExpandedKey] !== undefined ? expandedItems[fdExpandedKey] : true;
                                  const dbLabel = getFirestoreDatabaseDisplay(fd);
                                  const isDbSelected =
                                    selectedProject?.id === project.id && project.activeFirestoreDatabaseId === fd.id;

                                  return (
                                    <Box key={fd.id} sx={{ mb: 0.25 }}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          pl: 0.5,
                                          pr: 0.25,
                                          py: 0.2,
                                          cursor: 'pointer',
                                          bgcolor: isDbSelected ? 'action.hover' : 'transparent',
                                          borderRadius: 0.5,
                                          '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                        onClick={() => onSetActiveFirestoreDatabase(project.id, fd.id)}
                                      >
                                        <IconButton
                                          size="small"
                                          sx={{ p: 0, mr: 0.25, color: 'text.secondary' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpanded(fdExpandedKey, isFdExpanded);
                                          }}
                                        >
                                          {isFdExpanded ? (
                                            <ExpandMoreIcon sx={{ fontSize: 15 }} />
                                          ) : (
                                            <ChevronRightIcon sx={{ fontSize: 15 }} />
                                          )}
                                        </IconButton>
                                        <DatabaseIcon sx={{ fontSize: 13, color: 'success.main', mr: 0.5 }} />
                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                          <Typography
                                            sx={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {dbLabel}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontSize: '0.65rem',
                                              color: 'text.secondary',
                                              display: 'block',
                                              lineHeight: 1.1,
                                            }}
                                          >
                                            {fd.databaseId}
                                          </Typography>
                                        </Box>
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleContextMenu(
                                              e,
                                              { menuType: 'firestoreDatabase', project, firestoreDatabase: fd },
                                              'firestoreDatabase',
                                            );
                                          }}
                                          sx={{ p: 0.2, color: 'text.secondary' }}
                                        >
                                          <MoreVertIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Box>

                                      <Collapse in={isFdExpanded}>
                                        <Box sx={{ pl: 1.25, pt: 0.25 }}>
                                          {(fd.collections || [])
                                            .filter(
                                              (collection) =>
                                                !searchQuery || collectionMatchesQuery(collection, searchQuery),
                                            )
                                            .map((collection) => {
                                              const collectionPath =
                                                getCollectionPath(collection) || getCollectionLabel(collection);
                                              const collectionLabel = getCollectionLabel(collection);
                                              const collectionKey = `${project.id}:${fd.id}:${collectionPath}`;
                                              const isActive =
                                                activeTab?.type === 'collection' &&
                                                activeTab?.projectId === project.id &&
                                                activeTab?.collectionPath === collectionPath &&
                                                activeTab?.firestoreDatabaseId === fd.id;
                                              const isMenuTarget =
                                                isMenuOpen &&
                                                menuTarget?.menuType === 'collection' &&
                                                menuTarget?.project?.id === project.id &&
                                                menuTarget?.collection === collectionPath &&
                                                (menuTarget as { firestoreDatabaseId?: string }).firestoreDatabaseId ===
                                                  fd.id;
                                              return (
                                                <Box
                                                  key={collectionKey}
                                                  onClick={() => {
                                                    onSetActiveFirestoreDatabase(project.id, fd.id);
                                                    onOpenCollection(
                                                      project,
                                                      collectionPath,
                                                      fd.id,
                                                      getFirestoreDatabaseDisplay(fd),
                                                    );
                                                    dispatch(
                                                      setSidebarItemExpanded({
                                                        id: project.id,
                                                        expanded: true,
                                                      }),
                                                    );
                                                    dispatch(
                                                      setSidebarItemExpanded({
                                                        id: `${project.id}:firestore`,
                                                        expanded: true,
                                                      }),
                                                    );
                                                    dispatch(
                                                      setSidebarItemExpanded({
                                                        id: `${project.id}:fd:${fd.id}`,
                                                        expanded: true,
                                                      }),
                                                    );
                                                    setSearchQuery('');
                                                  }}
                                                  onContextMenu={(e) =>
                                                    handleContextMenu(
                                                      e,
                                                      {
                                                        project,
                                                        collection: collectionPath,
                                                        firestoreDatabaseId: fd.id,
                                                      },
                                                      'collection',
                                                    )
                                                  }
                                                  sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    px: 1,
                                                    py: 0.35,
                                                    cursor: 'pointer',
                                                    bgcolor: isMenuTarget
                                                      ? 'action.hover'
                                                      : isActive
                                                        ? 'action.selected'
                                                        : 'transparent',
                                                    borderLeft: isActive ? '2px solid' : '2px solid transparent',
                                                    borderColor: isActive ? 'primary.main' : 'transparent',
                                                    '&:hover': {
                                                      bgcolor: isActive ? 'action.selected' : 'action.hover',
                                                    },
                                                  }}
                                                >
                                                  <CollectionIcon
                                                    sx={{
                                                      fontSize: 13,
                                                      color: isActive ? 'primary.main' : 'text.secondary',
                                                      mr: 0.5,
                                                    }}
                                                  />
                                                  <Typography
                                                    sx={{
                                                      fontSize: '0.72rem',
                                                      color: isActive ? 'primary.main' : 'text.primary',
                                                      fontWeight: isActive ? 600 : 400,
                                                      overflow: 'hidden',
                                                      textOverflow: 'ellipsis',
                                                      whiteSpace: 'nowrap',
                                                    }}
                                                  >
                                                    {collectionLabel}
                                                  </Typography>
                                                </Box>
                                              );
                                            })}
                                          {(!fd.collections || fd.collections.length === 0) && (
                                            <Typography
                                              sx={{ fontSize: '0.68rem', color: 'text.disabled', px: 1, py: 0.25 }}
                                            >
                                              No collections
                                            </Typography>
                                          )}

                                          <Box
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSetActiveFirestoreDatabase(project.id, fd.id);
                                              onAddCollection?.(project);
                                            }}
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              px: 1,
                                              py: 0.35,
                                              cursor: 'pointer',
                                              color: 'primary.main',
                                              '&:hover': { bgcolor: 'action.hover' },
                                            }}
                                          >
                                            <AddIcon sx={{ fontSize: 13, mr: 0.5 }} />
                                            <Typography sx={{ fontSize: '0.72rem' }}>Add collection</Typography>
                                          </Box>
                                        </Box>
                                      </Collapse>
                                    </Box>
                                  );
                                })}

                                <Box
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddFirestoreDatabase(project);
                                  }}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    px: 1,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    color: 'primary.main',
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }}
                                >
                                  <AddIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                  <Typography sx={{ fontSize: '0.75rem' }}>Add database</Typography>
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })()}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
        </>
      )}
    </Box>
  );
}

export default SidebarProjectsList;
