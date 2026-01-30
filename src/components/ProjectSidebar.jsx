import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Collapse,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    useTheme,
    Button,
    CircularProgress,
} from '@mui/material';
import {
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon,
    ChevronRight as ChevronRightIcon,
    Layers as CollectionIcon,
    Folder as ProjectIcon,
    Refresh as RefreshIcon,
    MoreVert as MoreVertIcon,
    Delete as DeleteIcon,
    Settings as SettingsIcon,
    Star as StarIcon,
    Chat as ChatIcon,
    Warning as WarningIcon,
    Login as LoginIcon,
    Google as GoogleIcon,
    Key as KeyIcon,
    CloudQueue as StorageIcon,
    AccountCircle as AccountIcon,
    Logout as LogoutIcon,
    PeopleAlt as AuthIcon,
    LinkOff as LinkOffIcon,
    FileDownload as ExportIcon,
    OpenInNew as OpenInNewIcon,
    ContentCopy as CopyIcon,
    Edit as EditIcon,
    Numbers as NumbersIcon,
    Link as LinkIcon,
    NoteAdd as AddDocIcon,
    Code as CodeIcon,
} from '@mui/icons-material';
import { useProjects } from '../context/ProjectsContext';

function ProjectSidebar({
    projects,
    selectedProject,
    activeTab,
    onSelectProject,
    onOpenCollection,
    onOpenStorage,
    onOpenAuth,
    onAddProject,
    onAddCollection,
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
}) {
    const theme = useTheme();
    const { reauthenticateAccount } = useProjects();

    // Load expanded state from localStorage
    const [expandedItems, setExpandedItems] = useState(() => {
        try {
            const saved = localStorage.getItem('firestudio-sidebar-expanded');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Save expanded state to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('firestudio-sidebar-expanded', JSON.stringify(expandedItems));
    }, [expandedItems]);

    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuTarget, setMenuTarget] = useState(null);
    const [reconnecting, setReconnecting] = useState(null);

    const handleReconnect = async (accountId, e) => {
        e?.stopPropagation();
        setReconnecting(accountId);
        try {
            await reauthenticateAccount(accountId);
        } finally {
            setReconnecting(null);
        }
    };

    const toggleExpanded = (itemId) => {
        setExpandedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const handleMenu = (e, target, type) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
        setMenuTarget({ ...target, menuType: type });
    };

    const handleProjectMenu = (e, project) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
        setMenuTarget({ ...project, menuType: 'googleProject' });
    };

    const [contextMenuPosition, setContextMenuPosition] = useState(null);

    const handleContextMenu = (e, target, type) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPosition({ top: e.clientY, left: e.clientX });
        setMenuAnchor(null); // Clear any existing anchor
        setMenuTarget({ ...target, menuType: type });
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
    const googleAccounts = projects.filter(p => p.type === 'googleAccount');
    const serviceAccountProjects = projects.filter(p => p.authMethod === 'serviceAccount');

    const isDark = theme.palette.mode === 'dark';

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
                <Typography sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}>
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

            {/* Projects List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {projects.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography variant="caption">
                            No projects connected
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Google Accounts */}
                        {googleAccounts.map((account) => {
                            const isAccountExpanded = expandedItems[account.id] !== false;

                            return (
                                <Box key={account.id}>
                                    {/* Google Account Header */}
                                    <Box
                                        onClick={() => toggleExpanded(account.id)}
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
                                        <GoogleIcon sx={{ fontSize: 16, color: account.needsReauth ? '#f44336' : '#4285f4', mr: 0.5 }} />
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
                                                        textTransform: 'none'
                                                    }}
                                                >
                                                    {reconnecting === account.id ? (
                                                        <CircularProgress size={10} sx={{ mr: 0.5 }} />
                                                    ) : null}
                                                    Reconnect
                                                </Button>
                                            ) : (
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.65rem',
                                                        color: 'text.secondary',
                                                    }}
                                                >
                                                    {account.projects?.length || 0} project{account.projects?.length !== 1 ? 's' : ''}
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
                                        {account.projects?.map((project, projectIndex) => {
                                            // Default: only first project in first account is expanded
                                            const isFirstProject = googleAccounts.indexOf(account) === 0 && projectIndex === 0;
                                            const isProjectExpanded = expandedItems[project.id] !== undefined
                                                ? expandedItems[project.id]
                                                : isFirstProject;

                                            return (
                                                <Box key={project.id}>
                                                    {/* Project Header */}
                                                    <Box
                                                        onClick={() => toggleExpanded(project.id)}
                                                        onContextMenu={(e) => handleContextMenu(e, project, 'googleProject')}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            pl: 3,
                                                            pr: 1,
                                                            py: 0.4,
                                                            cursor: 'pointer',
                                                            bgcolor: selectedProject?.id === project.id
                                                                ? 'action.selected'
                                                                : 'transparent',
                                                            '&:hover': { bgcolor: 'action.hover' },
                                                        }}
                                                    >
                                                        <IconButton size="small" sx={{ p: 0, mr: 0.5, color: 'text.secondary', cursor: 'pointer' }}>
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

                                                    {/* Collections */}
                                                    <Collapse in={isProjectExpanded}>
                                                        <Box sx={{ pl: 5 }}>
                                                            {project.collections?.map((collection) => {
                                                                const isActive = activeTab?.type === 'collection' && activeTab?.projectId === project.id && activeTab?.collectionPath === collection;
                                                                const isMenuTarget = isMenuOpen && menuTarget?.menuType === 'collection' && menuTarget?.project?.id === project.id && menuTarget?.collection === collection;
                                                                return (
                                                                    <Box
                                                                        key={collection}
                                                                        onClick={() => onOpenCollection(project, collection)}
                                                                        onContextMenu={(e) => handleContextMenu(e, { project, collection }, 'collection')}
                                                                        sx={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            px: 1,
                                                                            py: 0.5,
                                                                            cursor: 'pointer',
                                                                            bgcolor: isMenuTarget
                                                                                ? 'action.hover'
                                                                                : (isActive ? 'action.selected' : 'transparent'),
                                                                            borderLeft: isActive ? '2px solid' : '2px solid transparent',
                                                                            borderColor: isActive ? 'primary.main' : 'transparent',
                                                                            '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
                                                                        }}
                                                                    >
                                                                        <CollectionIcon sx={{ fontSize: 14, color: isActive ? 'primary.main' : 'text.secondary', mr: 0.75 }} />
                                                                        <Typography sx={{ fontSize: '0.75rem', color: isActive ? 'primary.main' : 'text.primary', fontWeight: isActive ? 600 : 400 }}>
                                                                            {collection}
                                                                        </Typography>
                                                                    </Box>
                                                                );
                                                            })}
                                                            {(!project.collections || project.collections.length === 0) && (
                                                                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', px: 1, py: 0.3 }}>
                                                                    No collections
                                                                </Typography>
                                                            )}
                                                            {/* Add Collection */}
                                                            <Box
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    console.log('Add collection clicked for:', project);
                                                                    onAddCollection?.(project);
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
                                                                <AddIcon sx={{ fontSize: 14, mr: 0.75 }} />
                                                                <Typography sx={{ fontSize: '0.75rem' }}>
                                                                    Add collection
                                                                </Typography>
                                                            </Box>
                                                            {/* Storage */}
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
                                                                            mt: 0.5,
                                                                            cursor: 'pointer',
                                                                            borderTop: 1,
                                                                            borderColor: isStorageActive ? 'primary.main' : 'divider',
                                                                            bgcolor: isStorageActive ? 'action.selected' : 'transparent',
                                                                            borderLeft: isStorageActive ? '2px solid' : '2px solid transparent',
                                                                            borderLeftColor: isStorageActive ? 'primary.main' : 'transparent',
                                                                            '&:hover': { bgcolor: isStorageActive ? 'action.selected' : 'action.hover' },
                                                                        }}
                                                                    >
                                                                        <StorageIcon sx={{ fontSize: 14, color: 'primary.main', mr: 0.75 }} />
                                                                        <Typography sx={{ fontSize: '0.75rem', color: isStorageActive ? 'primary.main' : 'text.primary', fontWeight: isStorageActive ? 600 : 500 }}>
                                                                            Storage
                                                                        </Typography>
                                                                    </Box>
                                                                );
                                                            })()}
                                                            {/* Authentication */}
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
                                                                            '&:hover': { bgcolor: isAuthActive ? 'action.selected' : 'action.hover' },
                                                                        }}
                                                                    >
                                                                        <AuthIcon sx={{ fontSize: 14, color: 'secondary.main', mr: 0.75 }} />
                                                                        <Typography sx={{ fontSize: '0.75rem', color: isAuthActive ? 'secondary.main' : 'text.primary', fontWeight: isAuthActive ? 600 : 500 }}>
                                                                            Authentication
                                                                        </Typography>
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
                        {serviceAccountProjects.map((project, index) => {
                            // Service account projects: only first one expanded if no google accounts
                            const isFirstServiceAccount = googleAccounts.length === 0 && index === 0;
                            const isExpanded = expandedItems[project.id] !== undefined
                                ? expandedItems[project.id]
                                : isFirstServiceAccount;

                            return (
                                <Box key={project.id}>
                                    {/* Project Header */}
                                    <Box
                                        onClick={() => toggleExpanded(project.id)}
                                        onContextMenu={(e) => handleContextMenu(e, project, 'project')}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.5,
                                            cursor: 'pointer',
                                            bgcolor: selectedProject?.id === project.id
                                                ? 'action.selected'
                                                : 'transparent',
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
                                        <KeyIcon sx={{ fontSize: 16, color: project.connected === false ? '#f44336' : '#ff9800', mr: 0.5 }} />
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

                                    {/* Collections and Storage */}
                                    <Collapse in={isExpanded}>
                                        <Box sx={{ pl: 2 }}>
                                            {/* Collections */}
                                            {project.collections?.map((collection) => {
                                                const isActive = activeTab?.type === 'collection' && activeTab?.projectId === project.id && activeTab?.collectionPath === collection;
                                                const isMenuTarget = isMenuOpen && menuTarget?.menuType === 'collection' && menuTarget?.project?.id === project.id && menuTarget?.collection === collection;
                                                return (
                                                    <Box
                                                        key={collection}
                                                        onClick={() => onOpenCollection(project, collection)}
                                                        onContextMenu={(e) => handleContextMenu(e, { project, collection }, 'collection')}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            px: 1,
                                                            py: 0.4,
                                                            cursor: 'pointer',
                                                            bgcolor: isMenuTarget ? 'action.hover' : (isActive ? 'action.selected' : 'transparent'),
                                                            borderLeft: isActive ? '2px solid' : '2px solid transparent',
                                                            borderColor: isActive ? 'primary.main' : 'transparent',
                                                            '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
                                                        }}
                                                    >
                                                        <CollectionIcon sx={{ fontSize: 14, color: isActive ? 'primary.main' : 'text.secondary', mr: 0.5 }} />
                                                        <Typography
                                                            sx={{
                                                                fontSize: '0.75rem',
                                                                color: isActive ? 'primary.main' : 'text.primary',
                                                                fontWeight: isActive ? 600 : 400,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {collection}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                            {(!project.collections || project.collections.length === 0) && (
                                                <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', px: 1, py: 0.5 }}>
                                                    No collections
                                                </Typography>
                                            )}

                                            {/* Add Collection */}
                                            <Box
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('Add collection clicked for service account:', project);
                                                    onAddCollection?.(project);
                                                }}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    px: 1,
                                                    py: 0.4,
                                                    cursor: 'pointer',
                                                    color: 'primary.main',
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                }}
                                            >
                                                <AddIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                                <Typography sx={{ fontSize: '0.75rem' }}>
                                                    Add collection
                                                </Typography>
                                            </Box>

                                            {/* Storage */}
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
                                                            mt: 0.5,
                                                            cursor: 'pointer',
                                                            borderTop: 1,
                                                            borderTopColor: 'divider',
                                                            bgcolor: isStorageActive ? 'action.selected' : 'transparent',
                                                            borderLeft: isStorageActive ? '2px solid' : '2px solid transparent',
                                                            borderLeftColor: isStorageActive ? 'primary.main' : 'transparent',
                                                            '&:hover': { bgcolor: isStorageActive ? 'action.selected' : 'action.hover' },
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

                                            {/* Authentication */}
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
                                                            '&:hover': { bgcolor: isAuthActive ? 'action.selected' : 'action.hover' },
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
                                        </Box>
                                    </Collapse>
                                </Box>
                            );
                        })}
                    </>
                )}
            </Box>

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
            <Menu
                anchorEl={menuAnchor}
                anchorReference={contextMenuPosition ? "anchorPosition" : "anchorEl"}
                anchorPosition={contextMenuPosition}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                TransitionProps={{ onExited: handleMenuExited }}
                sx={{
                    '& .MuiMenuItem-root': {
                        '&:hover': {
                            bgcolor: 'action.hover',
                        },
                    },
                    '& .MuiPaper-root': {
                        bgcolor: 'background.paper',
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
                        <MenuItem onClick={async () => {
                            // Close menu immediately
                            const projectsToRefresh = menuTarget?.projects || [];
                            handleCloseMenu();
                            // Refresh collections for all projects under this account (silent mode)
                            for (const project of projectsToRefresh) {
                                await onRefreshCollections?.(project, true); // silent = true
                            }
                        }}>
                            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                            Refresh All Collections
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onDisconnectAccount?.(menuTarget);
                            handleCloseMenu();
                        }} sx={{ color: 'error.main' }}>
                            <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                            Sign Out
                        </MenuItem>
                    </>
                ) : menuTarget?.menuType === 'googleProject' ? (
                    // Google OAuth Project menu
                    <>
                        <MenuItem onClick={() => {
                            onAddCollection?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                            Add Collection
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onRefreshCollections?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                            Refresh Collections
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onExportAllCollections?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
                            Export All Collections
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onRevealInFirebaseConsole?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
                            Reveal in Firebase Console
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onCopyProjectId?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                            Copy Project ID
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
                        <MenuItem onClick={() => {
                            onAddDocument?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><AddDocIcon fontSize="small" /></ListItemIcon>
                            Add Document
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onRenameCollection?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                            Rename Collection
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onDeleteCollection?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }} sx={{ color: 'error.main' }}>
                            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                            Delete Collection
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onExportCollection?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
                            Export Collection
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onEstimateDocCount?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><NumbersIcon fontSize="small" /></ListItemIcon>
                            Estimate Document Count
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onCopyCollectionId?.(menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                            Copy Collection ID
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onCopyResourcePath?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                            Copy Resource Path
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onRevealCollectionInConsole?.(menuTarget.project, menuTarget.collection);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
                            Reveal in Firebase Console
                        </MenuItem>
                    </>
                ) : (
                    // Service Account Project menu
                    <>
                        <MenuItem onClick={() => {
                            onAddCollection?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                            Add Collection
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onRefreshCollections?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                            Refresh Collections
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onExportAllCollections?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
                            Export All Collections
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onRevealInFirebaseConsole?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
                            Reveal in Firebase Console
                        </MenuItem>
                        <MenuItem onClick={() => {
                            onCopyProjectId?.(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                            Copy Project ID
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onDisconnectProject?.(menuTarget);
                            handleCloseMenu();
                        }} sx={{ color: 'error.main' }}>
                            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                            Disconnect
                        </MenuItem>
                    </>
                )}
            </Menu>
        </Box>
    );
}

export default ProjectSidebar;
