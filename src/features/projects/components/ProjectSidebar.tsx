import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  Chat as ChatIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { signInWithGoogle } from '../store/projectsSlice';
import { selectExpandedSidebarItems, setSidebarItemExpanded, Tab } from '../../../app/store/slices/uiSlice';
import SidebarSearch from './sidebar/SidebarSearch';
import SidebarProjectsList from './sidebar/SidebarProjectsList';
import SidebarMenu from './sidebar/SidebarMenu';
import { Project, GoogleAccount } from '../store/projectsSlice';
import { AppDispatch } from '../../../app/store';
import { MenuTarget, MenuTargetType, isGoogleAccount } from '../types';

export interface ProjectSidebarProps {
  projects: (Project | GoogleAccount)[];
  selectedProject: Project | GoogleAccount | null;
  activeTab?: Tab | null;
  // onSelectProject, // Unusedtring;
  onSelectProject: (projectId: string) => void;
  onOpenCollection: (
    project: Project | GoogleAccount,
    collectionId: string,
    firestoreDatabaseId?: string,
    databaseLabel?: string,
  ) => void;
  onOpenStorage: (project: Project | GoogleAccount) => void;
  onOpenAuth: (project: Project | GoogleAccount) => void;
  onAddProject: () => void;
  onAddCollection: (project: Project | GoogleAccount) => void;
  onAddFirestoreDatabase: (project: Project) => void;
  onSetActiveFirestoreDatabase: (projectId: string, firestoreDatabaseId: string) => void;
  onRefreshFirestoreDatabase?: (project: Project, firestoreDatabaseId: string) => void;
  onDisconnectProject: (project: Project | GoogleAccount) => void;
  onDisconnectAccount: (account: GoogleAccount) => void;
  onRefreshCollections: (project: Project | GoogleAccount) => void;
  onExportAllCollections: (project: Project | GoogleAccount) => void;
  onRevealInFirebaseConsole: (project: Project | GoogleAccount) => void;
  onCopyProjectId: (project: Project | GoogleAccount) => void;
  // Collection menu handlers
  onAddDocument?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onRenameCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onDeleteCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onExportCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onEstimateDocCount?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onCopyCollectionId?: (collectionId: string) => void;
  onCopyResourcePath?: (project: Project | GoogleAccount, collectionId: string) => void;
  onRevealCollectionInConsole?: (project: Project | GoogleAccount, collectionId: string) => void;
  onOpenSettings: () => void;
  onOpenFavorites: () => void;
  onOpenConsole: () => void;
  onOpenSavedQueries: () => void;
}

function ProjectSidebar({
  projects,
  selectedProject,
  activeTab,
  onOpenCollection,
  onOpenStorage,
  onOpenAuth,
  onAddProject,
  onAddCollection,
  onAddFirestoreDatabase,
  onSetActiveFirestoreDatabase,
  onRefreshFirestoreDatabase,
  onDisconnectProject,
  onDisconnectAccount,
  onRefreshCollections,
  onExportAllCollections,
  onRevealInFirebaseConsole,
  onCopyProjectId,
  // Collection menu handlers
  onAddDocument,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
  onEstimateDocCount,
  onCopyCollectionId,
  onCopyResourcePath,
  onRevealCollectionInConsole,
  onOpenSettings,
  onOpenFavorites,
  onOpenConsole,
  onOpenSavedQueries,
}: ProjectSidebarProps) {
  const dispatch = useDispatch<AppDispatch>();
  // const { reauthenticateAccount } = useProjects(); // Removed

  const expandedItems = useSelector(selectExpandedSidebarItems);

  // Removed local state logic (localStorage handled by Redux persistence if configured, otherwise ephemeral session)

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleReconnect = async (accountId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReconnecting(accountId);
    try {
      await dispatch(signInWithGoogle()).unwrap();
    } catch (error) {
      console.error('Reauth failed', error);
    } finally {
      setReconnecting(null);
    }
  };

  const toggleExpanded = (itemId: string, isCurrentlyExpanded: boolean) => {
    // If there's a search query, expand and clear search instead of toggling
    if (searchQuery) {
      dispatch(setSidebarItemExpanded({ id: itemId, expanded: true }));
      setSearchQuery('');
    } else {
      dispatch(setSidebarItemExpanded({ id: itemId, expanded: !isCurrentlyExpanded }));
    }
  };

  const handleMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    target: Project | GoogleAccount,
    type: 'account' | 'project',
  ) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    if (type === 'account' && isGoogleAccount(target)) {
      setMenuTarget({ ...target, menuType: 'account' });
    } else if (type === 'project' && !isGoogleAccount(target)) {
      setMenuTarget({ ...target, menuType: 'project' });
    }
  };

  const handleProjectMenu = (e: React.MouseEvent<HTMLButtonElement>, project: Project) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuTarget({ ...project, menuType: 'googleProject' });
  };

  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = (
    e: React.MouseEvent,
    target:
      | MenuTarget
      | Project
      | { project: Project | GoogleAccount; collection: string; firestoreDatabaseId?: string },
    type: Exclude<MenuTargetType, 'account'>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ top: e.clientY, left: e.clientX });
    setMenuAnchor(null);
    if (type === 'collection') {
      const collectionTarget = target as {
        project: Project | GoogleAccount;
        collection: string;
        firestoreDatabaseId?: string;
      };
      setMenuTarget({ menuType: 'collection', ...collectionTarget });
      return;
    }
    if (type === 'firestoreRoot' || type === 'firestoreDatabase') {
      setMenuTarget(target as MenuTarget);
      return;
    }
    if ('collection' in target) return;
    setMenuTarget({ ...(target as Project), menuType: type });
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setContextMenuPosition(null);
  };

  const handleMenuExited = () => {
    // Clear target only after menu exit animation completes
    setMenuTarget(null);
  };

  const isMenuOpen = Boolean(menuAnchor) || Boolean(contextMenuPosition);

  // Separate Google accounts from service account projects
  const googleAccounts = projects.filter(isGoogleAccount);
  const serviceAccountProjects = projects.filter(
    (p) => !isGoogleAccount(p) && p.authMethod === 'serviceAccount',
  ) as Project[];

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        height: '100%',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Projects
        </Typography>
        <Tooltip title="Add Project">
          <IconButton
            onClick={onAddProject}
            size="small"
            sx={{
              color: 'primary.main',
              p: 0.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Search Box */}
      <SidebarSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Projects List */}
      <SidebarProjectsList
        googleAccounts={googleAccounts}
        serviceAccountProjects={serviceAccountProjects}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        expandedItems={expandedItems}
        toggleExpanded={toggleExpanded}
        selectedProject={selectedProject}
        activeTab={activeTab} // Passed even if unused in component logic, required by interface
        onOpenCollection={onOpenCollection}
        onAddCollection={onAddCollection}
        onAddFirestoreDatabase={onAddFirestoreDatabase}
        onSetActiveFirestoreDatabase={onSetActiveFirestoreDatabase}
        onOpenStorage={onOpenStorage}
        onOpenAuth={onOpenAuth}
        handleReconnect={handleReconnect}
        reconnecting={reconnecting}
        handleMenu={handleMenu}
        handleProjectMenu={handleProjectMenu}
        handleContextMenu={handleContextMenu}
        isMenuOpen={isMenuOpen}
        menuTarget={menuTarget}
      />

      {/* Bottom Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          px: 1.5,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Tooltip title="Saved Queries">
          <IconButton
            size="small"
            onClick={onOpenSavedQueries}
            sx={{
              p: 0.75,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'info.main',
              },
            }}
          >
            <CodeIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Favorites">
          <IconButton
            size="small"
            onClick={onOpenFavorites}
            sx={{
              p: 0.75,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'warning.main',
              },
            }}
          >
            <StarIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Console">
          <IconButton
            size="small"
            onClick={onOpenConsole}
            sx={{
              p: 0.75,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'primary.main',
              },
            }}
          >
            <ChatIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={onOpenSettings}
            sx={{
              p: 0.75,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'text.primary',
              },
            }}
          >
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Context Menu */}
      <SidebarMenu
        menuAnchor={menuAnchor}
        contextMenuPosition={contextMenuPosition}
        isMenuOpen={isMenuOpen}
        onClose={handleCloseMenu}
        onExited={handleMenuExited}
        menuTarget={menuTarget}
        onRefreshCollections={onRefreshCollections}
        onDisconnectAccount={onDisconnectAccount}
        onAddCollection={onAddCollection}
        onExportAllCollections={onExportAllCollections}
        onRevealInFirebaseConsole={onRevealInFirebaseConsole}
        onCopyProjectId={onCopyProjectId}
        onAddDocument={onAddDocument}
        onRenameCollection={onRenameCollection}
        onDeleteCollection={onDeleteCollection}
        onExportCollection={onExportCollection}
        onEstimateDocCount={onEstimateDocCount}
        onCopyCollectionId={onCopyCollectionId}
        onCopyResourcePath={onCopyResourcePath}
        onRevealCollectionInConsole={onRevealCollectionInConsole}
        onDisconnectProject={onDisconnectProject}
        onAddFirestoreDatabase={onAddFirestoreDatabase}
        onRefreshFirestoreDatabase={onRefreshFirestoreDatabase}
      />
    </Box>
  );
}

export default ProjectSidebar;
