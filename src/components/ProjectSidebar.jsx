import React, { useState } from 'react';
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
} from '@mui/material';
import {
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon,
    ChevronRight as ChevronRightIcon,
    Storage as CollectionIcon,
    Folder as FolderIcon,
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
} from '@mui/icons-material';

function ProjectSidebar({
    projects,
    selectedProject,
    onSelectProject,
    onOpenCollection,
    onOpenStorage,
    onOpenAuth,
    onAddProject,
    onDisconnectProject,
    onDisconnectAccount,
    onRefreshCollections,
    onOpenSettings,
    onOpenFavorites,
    onOpenConsole,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [expandedItems, setExpandedItems] = useState({});
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuTarget, setMenuTarget] = useState(null);

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

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setMenuTarget(null);
    };

    // Separate Google accounts from service account projects
    const googleAccounts = projects.filter(p => p.type === 'googleAccount');
    const serviceAccountProjects = projects.filter(p => p.authMethod === 'serviceAccount');

    return (
        <Box
            sx={{
                width: 240,
                minWidth: 240,
                borderRight: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isDark ? '#252526' : '#fff',
                height: '100%',
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                }}
            >
                <Tooltip title="Add Project">
                    <Box
                        onClick={onAddProject}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: '#1976d2',
                            '&:hover': { color: '#1565c0' },
                        }}
                    >
                        <AddIcon sx={{ fontSize: 18, mr: 0.5 }} />
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            Add Project
                        </Typography>
                    </Box>
                </Tooltip>
            </Box>

            {/* Projects List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {projects.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', color: isDark ? '#666' : '#999' }}>
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
                                            backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5',
                                            borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                                            '&:hover': { backgroundColor: isDark ? '#333' : '#eee' },
                                        }}
                                    >
                                        <IconButton size="small" sx={{ p: 0, mr: 0.5, color: isDark ? '#aaa' : undefined }}>
                                            {isAccountExpanded ? (
                                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                            ) : (
                                                <ChevronRightIcon sx={{ fontSize: 18 }} />
                                            )}
                                        </IconButton>
                                        <GoogleIcon sx={{ fontSize: 16, color: '#4285f4', mr: 0.5 }} />
                                        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                            <Typography
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    color: isDark ? '#ddd' : '#333',
                                                    fontWeight: 500,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {account.email}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontSize: '0.65rem',
                                                    color: isDark ? '#888' : '#666',
                                                }}
                                            >
                                                {account.projects?.length || 0} project{account.projects?.length !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleMenu(e, account, 'account')}
                                            sx={{ p: 0, opacity: 0.5, '&:hover': { opacity: 1 }, color: isDark ? '#aaa' : undefined }}
                                        >
                                            <MoreVertIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Box>

                                    {/* Projects under this account */}
                                    <Collapse in={isAccountExpanded}>
                                        {account.projects?.map((project) => {
                                            const isProjectExpanded = expandedItems[project.id] !== false;

                                            return (
                                                <Box key={project.id}>
                                                    {/* Project Header */}
                                                    <Box
                                                        onClick={() => toggleExpanded(project.id)}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            pl: 3,
                                                            pr: 1,
                                                            py: 0.4,
                                                            cursor: 'pointer',
                                                            backgroundColor: selectedProject?.id === project.id
                                                                ? (isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd')
                                                                : 'transparent',
                                                            '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                        }}
                                                    >
                                                        <IconButton size="small" sx={{ p: 0, mr: 0.5, color: isDark ? '#aaa' : undefined }}>
                                                            {isProjectExpanded ? (
                                                                <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                                            ) : (
                                                                <ChevronRightIcon sx={{ fontSize: 16 }} />
                                                            )}
                                                        </IconButton>
                                                        <FolderIcon sx={{ fontSize: 14, color: '#ff9800', mr: 0.5 }} />
                                                        <Typography
                                                            sx={{
                                                                fontSize: '0.75rem',
                                                                flexGrow: 1,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                color: isDark ? '#ccc' : '#333',
                                                            }}
                                                        >
                                                            {project.projectId}
                                                        </Typography>
                                                    </Box>

                                                    {/* Collections */}
                                                    <Collapse in={isProjectExpanded}>
                                                        <Box sx={{ pl: 5 }}>
                                                            {project.collections?.map((collection) => (
                                                                <Box
                                                                    key={collection}
                                                                    onClick={() => onOpenCollection(project, collection)}
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        px: 1,
                                                                        py: 0.3,
                                                                        cursor: 'pointer',
                                                                        '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                                    }}
                                                                >
                                                                    <CollectionIcon sx={{ fontSize: 12, color: isDark ? '#888' : '#666', mr: 0.5 }} />
                                                                    <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#ccc' : '#333' }}>
                                                                        {collection}
                                                                    </Typography>
                                                                </Box>
                                                            ))}
                                                            {(!project.collections || project.collections.length === 0) && (
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#666' : '#999', px: 1, py: 0.3 }}>
                                                                    No collections
                                                                </Typography>
                                                            )}
                                                            {/* Storage */}
                                                            <Box
                                                                onClick={() => onOpenStorage?.(project)}
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    px: 1,
                                                                    py: 0.3,
                                                                    mt: 0.5,
                                                                    cursor: 'pointer',
                                                                    borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                                                                    '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                                }}
                                                            >
                                                                <StorageIcon sx={{ fontSize: 12, color: '#2196f3', mr: 0.5 }} />
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#ccc' : '#333', fontWeight: 500 }}>
                                                                    Storage
                                                                </Typography>
                                                            </Box>
                                                            {/* Authentication */}
                                                            <Box
                                                                onClick={() => onOpenAuth?.(project)}
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    px: 1,
                                                                    py: 0.3,
                                                                    cursor: 'pointer',
                                                                    '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                                }}
                                                            >
                                                                <AuthIcon sx={{ fontSize: 12, color: '#9c27b0', mr: 0.5 }} />
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#ccc' : '#333', fontWeight: 500 }}>
                                                                    Authentication
                                                                </Typography>
                                                            </Box>
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
                        {serviceAccountProjects.map((project) => {
                            const isExpanded = expandedItems[project.id] !== false;

                            return (
                                <Box key={project.id}>
                                    {/* Project Header */}
                                    <Box
                                        onClick={() => toggleExpanded(project.id)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.5,
                                            cursor: 'pointer',
                                            backgroundColor: selectedProject?.id === project.id
                                                ? (isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd')
                                                : 'transparent',
                                            '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                        }}
                                    >
                                        <IconButton size="small" sx={{ p: 0, mr: 0.5, color: isDark ? '#aaa' : undefined }}>
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
                                                color: isDark ? '#ddd' : 'inherit',
                                            }}
                                        >
                                            {project.projectId}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleMenu(e, project, 'project')}
                                            sx={{ p: 0, opacity: 0.5, '&:hover': { opacity: 1 }, color: isDark ? '#aaa' : undefined }}
                                        >
                                            <MoreVertIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Box>

                                    {/* Collections and Storage */}
                                    <Collapse in={isExpanded}>
                                        <Box sx={{ pl: 2 }}>
                                            {/* Collections */}
                                            {project.collections?.map((collection) => (
                                                <Box
                                                    key={collection}
                                                    onClick={() => onOpenCollection(project, collection)}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        px: 1,
                                                        py: 0.4,
                                                        cursor: 'pointer',
                                                        '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                    }}
                                                >
                                                    <CollectionIcon sx={{ fontSize: 14, color: isDark ? '#888' : '#666', mr: 0.5 }} />
                                                    <Typography
                                                        sx={{
                                                            fontSize: '0.75rem',
                                                            color: isDark ? '#ccc' : '#333',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {collection}
                                                    </Typography>
                                                </Box>
                                            ))}
                                            {(!project.collections || project.collections.length === 0) && (
                                                <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#666' : '#999', px: 1, py: 0.5 }}>
                                                    No collections
                                                </Typography>
                                            )}

                                            {/* Storage */}
                                            <Box
                                                onClick={() => onOpenStorage?.(project)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    px: 1,
                                                    py: 0.4,
                                                    mt: 0.5,
                                                    cursor: 'pointer',
                                                    borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                                                    '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                }}
                                            >
                                                <StorageIcon sx={{ fontSize: 14, color: '#2196f3', mr: 0.5 }} />
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.75rem',
                                                        color: isDark ? '#ccc' : '#333',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    Storage
                                                </Typography>
                                            </Box>

                                            {/* Authentication */}
                                            <Box
                                                onClick={() => onOpenAuth?.(project)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    px: 1,
                                                    py: 0.4,
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                }}
                                            >
                                                <AuthIcon sx={{ fontSize: 14, color: '#9c27b0', mr: 0.5 }} />
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.75rem',
                                                        color: isDark ? '#ccc' : '#333',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    Authentication
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Collapse>
                                </Box>
                            );
                        })}
                    </>
                )}
            </Box>

            {/* Bottom Icons */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    p: 1,
                    borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                }}
            >
                <Tooltip title="Favorites">
                    <IconButton size="small" onClick={onOpenFavorites}>
                        <StarIcon sx={{ fontSize: 20, color: isDark ? '#888' : '#666' }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Console">
                    <IconButton size="small" onClick={onOpenConsole}>
                        <ChatIcon sx={{ fontSize: 20, color: isDark ? '#888' : '#666' }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                    <IconButton size="small" onClick={onOpenSettings}>
                        <SettingsIcon sx={{ fontSize: 20, color: isDark ? '#888' : '#666' }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
            >
                {menuTarget?.menuType === 'account' ? (
                    // Google Account menu
                    <>
                        <MenuItem disabled sx={{ opacity: 1 }}>
                            <Typography variant="caption" sx={{ color: '#888' }}>
                                {menuTarget?.email}
                            </Typography>
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
                ) : (
                    // Project menu
                    <>
                        <MenuItem onClick={() => {
                            onRefreshCollections(menuTarget);
                            handleCloseMenu();
                        }}>
                            <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                            Refresh Collections
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => {
                            onDisconnectProject(menuTarget);
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
