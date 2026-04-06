// React import not needed with react-jsx.
import { Menu, MenuItem, ListItemIcon, Divider, Box, Typography } from '@mui/material';
import { Project, GoogleAccount } from '../../store/projectsSlice';
import { MenuTarget } from '../../types';

interface SidebarMenuProps {
  menuAnchor: HTMLElement | null;
  contextMenuPosition: { top: number; left: number } | null;
  isMenuOpen: boolean;
  onClose: () => void;
  onExited: () => void;
  menuTarget: MenuTarget | null;
  // Actions
  onRefreshCollections: (project: Project | GoogleAccount) => void;
  onDisconnectAccount: (account: GoogleAccount) => void;
  onAddCollection: (project: Project | GoogleAccount) => void;
  onExportAllCollections: (project: Project | GoogleAccount) => void;
  onRevealInFirebaseConsole: (project: Project | GoogleAccount) => void;
  onCopyProjectId: (project: Project | GoogleAccount) => void;
  onAddDocument?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onRenameCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onDeleteCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onExportCollection?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onEstimateDocCount?: (project: Project | GoogleAccount, collectionId: string, firestoreDatabaseId?: string) => void;
  onCopyCollectionId?: (collectionId: string) => void;
  onCopyResourcePath?: (project: Project | GoogleAccount, collectionId: string) => void;
  onRevealCollectionInConsole?: (project: Project | GoogleAccount, collectionId: string) => void;
  onDisconnectProject: (project: Project | GoogleAccount) => void;
  onAddFirestoreDatabase?: (project: Project) => void;
  onRefreshFirestoreDatabase?: (project: Project, firestoreDatabaseId: string) => void;
}
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Logout as LogoutIcon,
  FileDownload as ExportIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  NoteAdd as AddDocIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Numbers as NumbersIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

function SidebarMenu({
  menuAnchor,
  contextMenuPosition,
  isMenuOpen,
  onClose,
  onExited,
  menuTarget,
  // Actions
  onRefreshCollections,
  onDisconnectAccount,
  onAddCollection,
  onExportAllCollections,
  onRevealInFirebaseConsole,
  onCopyProjectId,
  onAddDocument,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
  onEstimateDocCount,
  onCopyCollectionId,
  onCopyResourcePath,
  onRevealCollectionInConsole,
  onDisconnectProject,
  onAddFirestoreDatabase,
  onRefreshFirestoreDatabase,
}: SidebarMenuProps) {
  const handleAction = <A extends unknown[]>(action: ((...args: A) => void) | undefined, ...args: A) => {
    onClose();
    if (action) action(...args);
  };

  const open = isMenuOpen && menuTarget != null;

  return (
    <Menu
      anchorEl={menuAnchor}
      anchorReference={contextMenuPosition ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={contextMenuPosition || undefined}
      open={open}
      onClose={onClose}
      TransitionProps={{ onExited: onExited }}
      sx={{
        '& .MuiMenuItem-root': {
          '&:hover': {
            bgcolor: 'action.hover',
          },
        },
        '& .MuiPaper-root': {
          bgcolor: 'background.paper',
          scrollbarWidth: 'none', // Optional clean look
          maxWidth: 320,
        },
      }}
    >
      {menuTarget?.menuType === 'account' ? (
        // Google Account menu
        <>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 600 }}>
              {menuTarget?.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              handleAction(onRefreshCollections, menuTarget);
            }}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            Refresh All Collections
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onDisconnectAccount, menuTarget)} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            Sign Out
          </MenuItem>
        </>
      ) : menuTarget?.menuType === 'googleProject' ? (
        // Google OAuth Project menu
        <>
          <MenuItem onClick={() => handleAction(onAddCollection, menuTarget)}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            Add Collection
          </MenuItem>
          <MenuItem onClick={() => handleAction(onRefreshCollections, menuTarget)}>
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            Refresh Collections
          </MenuItem>
          <MenuItem onClick={() => handleAction(onExportAllCollections, menuTarget)}>
            <ListItemIcon>
              <ExportIcon fontSize="small" />
            </ListItemIcon>
            Export All Collections
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onRevealInFirebaseConsole, menuTarget)}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            Reveal in Firebase Console
          </MenuItem>
          <MenuItem onClick={() => handleAction(onCopyProjectId, menuTarget)}>
            <ListItemIcon>
              <CopyIcon fontSize="small" />
            </ListItemIcon>
            Copy Project ID
          </MenuItem>
        </>
      ) : menuTarget?.menuType === 'firestoreRoot' ? (
        <>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 600 }}>Firestore</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => handleAction(onAddFirestoreDatabase, menuTarget.project)}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            Add database
          </MenuItem>
        </>
      ) : menuTarget?.menuType === 'firestoreDatabase' ? (
        <>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 600 }}>
              {menuTarget.firestoreDatabase.label || menuTarget.firestoreDatabase.databaseId}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              {menuTarget.firestoreDatabase.databaseId}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() =>
              handleAction(onRefreshFirestoreDatabase, menuTarget.project, menuTarget.firestoreDatabase.id)
            }
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            Refresh collections
          </MenuItem>
        </>
      ) : menuTarget?.menuType === 'collection' ? (
        // Collection menu
        <>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 600 }}>
              {menuTarget?.collection}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() =>
              handleAction(onAddDocument, menuTarget.project, menuTarget.collection, menuTarget.firestoreDatabaseId)
            }
          >
            <ListItemIcon>
              <AddDocIcon fontSize="small" />
            </ListItemIcon>
            Add Document
          </MenuItem>
          <MenuItem
            onClick={() =>
              handleAction(
                onRenameCollection,
                menuTarget.project,
                menuTarget.collection,
                menuTarget.firestoreDatabaseId,
              )
            }
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            Rename Collection
          </MenuItem>
          <MenuItem
            onClick={() =>
              handleAction(
                onDeleteCollection,
                menuTarget.project,
                menuTarget.collection,
                menuTarget.firestoreDatabaseId,
              )
            }
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            Delete Collection
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() =>
              handleAction(
                onExportCollection,
                menuTarget.project,
                menuTarget.collection,
                menuTarget.firestoreDatabaseId,
              )
            }
          >
            <ListItemIcon>
              <ExportIcon fontSize="small" />
            </ListItemIcon>
            Export Collection
          </MenuItem>
          <MenuItem
            onClick={() =>
              handleAction(
                onEstimateDocCount,
                menuTarget.project,
                menuTarget.collection,
                menuTarget.firestoreDatabaseId,
              )
            }
          >
            <ListItemIcon>
              <NumbersIcon fontSize="small" />
            </ListItemIcon>
            Estimate Document Count
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onCopyCollectionId, menuTarget.collection)}>
            <ListItemIcon>
              <CopyIcon fontSize="small" />
            </ListItemIcon>
            Copy Collection ID
          </MenuItem>
          <MenuItem onClick={() => handleAction(onCopyResourcePath, menuTarget.project, menuTarget.collection)}>
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            Copy Resource Path
          </MenuItem>
          <MenuItem
            onClick={() => handleAction(onRevealCollectionInConsole, menuTarget.project, menuTarget.collection)}
          >
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            Reveal in Firebase Console
          </MenuItem>
        </>
      ) : menuTarget ? (
        // Service Account Project menu
        <>
          <MenuItem onClick={() => handleAction(onAddCollection, menuTarget)}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            Add Collection
          </MenuItem>
          <MenuItem onClick={() => handleAction(onRefreshCollections, menuTarget)}>
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            Refresh Collections
          </MenuItem>
          <MenuItem onClick={() => handleAction(onExportAllCollections, menuTarget)}>
            <ListItemIcon>
              <ExportIcon fontSize="small" />
            </ListItemIcon>
            Export All Collections
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onRevealInFirebaseConsole, menuTarget)}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            Reveal in Firebase Console
          </MenuItem>
          <MenuItem onClick={() => handleAction(onCopyProjectId, menuTarget)}>
            <ListItemIcon>
              <CopyIcon fontSize="small" />
            </ListItemIcon>
            Copy Project ID
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(onDisconnectProject, menuTarget)} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            Disconnect
          </MenuItem>
        </>
      ) : null}
    </Menu>
  );
}

export default SidebarMenu;
