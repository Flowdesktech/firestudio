import React, { useState, useCallback, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Button,
    Snackbar,
    Alert,
    Tooltip,
    useTheme,
    CircularProgress,
    LinearProgress,
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';

import ProjectSidebar from './components/ProjectSidebar';
import CollectionTab from './components/CollectionTab';
import StorageTab from './components/StorageTab';
import AuthTab from './components/AuthTab';
import ConnectionDialog from './components/ConnectionDialog';
import SettingsDialog from './components/SettingsDialog';
import LogsPanel from './components/LogsPanel';
import FavoritesPanel from './components/FavoritesPanel';
import ConsolePanel from './components/ConsolePanel';
import { useSettings } from './context/SettingsContext';
import { useFavorites } from './context/FavoritesContext';
import { useProjects } from './context/ProjectsContext';

function App() {
    const theme = useTheme();
    const { settings } = useSettings();
    const { favorites } = useFavorites();
    const { projects, setProjects, addProject, removeProject, updateProject, isLoading: projectsLoading } = useProjects();
    const isDark = theme.palette.mode === 'dark';

    // Selected project state
    const [selectedProject, setSelectedProject] = useState(null);
    const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

    // Listen for menu events to open dialogs
    useEffect(() => {
        const handleOpenAddProject = () => setConnectionDialogOpen(true);
        const handleOpenSettings = () => setSettingsDialogOpen(true);

        window.addEventListener('open-add-project-dialog', handleOpenAddProject);
        window.addEventListener('open-settings-dialog', handleOpenSettings);

        return () => {
            window.removeEventListener('open-add-project-dialog', handleOpenAddProject);
            window.removeEventListener('open-settings-dialog', handleOpenSettings);
        };
    }, []);
    const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);
    const [consolePanelOpen, setConsolePanelOpen] = useState(false);

    // Tabs state - multiple open collections
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    // Logs state
    const [logs, setLogs] = useState([]);

    const addLog = useCallback((type, message, details = null) => {
        setLogs(prev => [...prev, {
            type,
            message,
            details,
            timestamp: Date.now()
        }]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const showMessage = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
        addLog(severity, message);
    }, [addLog]);

    // Connect to a new project via service account
    const handleConnect = async (serviceAccountPath) => {
        setLoading(true);
        addLog('info', `Connecting to Firebase...`);
        try {
            const result = await window.electronAPI.connectFirebase(serviceAccountPath);
            if (result.success) {
                // Load collections for this project
                const collectionsResult = await window.electronAPI.getCollections();

                const newProject = {
                    id: Date.now().toString(),
                    projectId: result.projectId,
                    serviceAccountPath,
                    authMethod: 'serviceAccount',
                    collections: collectionsResult.success ? collectionsResult.collections : [],
                    expanded: true
                };

                setProjects(prev => [...prev, newProject]);
                setSelectedProject(newProject);
                showMessage(`Connected to ${result.projectId}`, 'success');
            } else {
                showMessage(result.error, 'error');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            setLoading(false);
            setConnectionDialogOpen(false);
        }
    };

    // Google Sign-In handler
    const handleGoogleSignIn = async () => {
        // Check if running in Electron
        if (!window.electronAPI?.googleSignIn) {
            showMessage('Google Sign-In requires running in Electron desktop mode. Run "npm run dev" instead.', 'warning');
            return;
        }

        setLoading(true);
        addLog('info', 'Starting Google Sign-In...');
        try {
            const result = await window.electronAPI.googleSignIn();
            if (result.success) {
                // Load user's Firebase projects
                const projectsResult = await window.electronAPI.getUserProjects();

                // Create a Google account entry with all its projects
                const accountId = `google-account-${Date.now()}`;
                const googleAccount = {
                    id: accountId,
                    type: 'googleAccount',
                    email: result.email,
                    name: result.name,
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    expanded: true,
                    projects: (projectsResult.success ? projectsResult.projects : []).map((proj, index) => ({
                        id: `${accountId}-${index}-${proj.projectId}`,
                        projectId: proj.projectId,
                        parentAccountId: accountId,
                        authMethod: 'google',
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                        collections: proj.collections || [],
                        expanded: false
                    }))
                };

                // Add the account and its projects to the projects list
                setProjects(prev => {
                    // Check if already signed in with this email
                    const existingAccount = prev.find(p => p.type === 'googleAccount' && p.email === result.email);
                    if (existingAccount) {
                        // Update existing account
                        return prev.map(p => p.id === existingAccount.id ? googleAccount : p);
                    }
                    return [...prev, googleAccount];
                });

                if (googleAccount.projects.length > 0) {
                    setSelectedProject(googleAccount.projects[0]);
                }
                showMessage(`Signed in as ${result.email} (${googleAccount.projects.length} projects)`, 'success');
                setConnectionDialogOpen(false);
            } else {
                // User cancelled or sign-in failed - just show message, don't close dialog
                if (result.error && !result.error.includes('cancelled')) {
                    showMessage(result.error || 'Google Sign-In failed', 'error');
                }
                addLog('info', 'Google Sign-In cancelled or failed');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            setLoading(false);
            // Don't close dialog on failure - let user try again or cancel manually
        }
    };

    // Disconnect a project
    const handleDisconnectProject = async (project) => {
        setProjects(prev => prev.filter(p => p.id !== project.id));
        setOpenTabs(prev => prev.filter(t => t.projectId !== project.id));
        if (selectedProject?.id === project.id) {
            setSelectedProject(projects.find(p => p.id !== project.id) || null);
        }
        addLog('info', `Disconnected from ${project.projectId}`);
    };

    // Disconnect a Google account (removes all projects under it)
    const handleDisconnectAccount = async (account) => {
        // Get all project IDs under this account
        const projectIds = account.projects?.map(p => p.id) || [];

        // Remove the account and close all related tabs
        setProjects(prev => prev.filter(p => p.id !== account.id));
        setOpenTabs(prev => prev.filter(t => !projectIds.includes(t.projectId)));

        // Clear selected project if it was under this account
        if (projectIds.includes(selectedProject?.id)) {
            setSelectedProject(null);
        }

        // Sign out from Google
        await window.electronAPI?.googleSignOut?.();

        addLog('info', `Signed out from ${account.email}`);
        showMessage(`Signed out from ${account.email}`, 'info');
    };

    // Open a collection in a new tab
    const handleOpenCollection = (project, collectionPath, docPath = null) => {
        const tabId = `${project.id}-${collectionPath}${docPath ? `-${docPath}` : ''}`;

        // Check if tab already exists
        const existingTab = openTabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
            return;
        }

        const newTab = {
            id: tabId,
            projectId: project.id,
            projectName: project.projectId,
            collectionPath,
            docPath,
            label: collectionPath.split('/').pop(),
            type: 'collection'
        };

        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
        setSelectedProject(project);
    };

    // Open Storage in a new tab
    const handleOpenStorage = (project) => {
        const tabId = `${project.id}-storage`;

        // Check if tab already exists
        const existingTab = openTabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
            return;
        }

        const newTab = {
            id: tabId,
            projectId: project.id,
            projectName: project.projectId,
            label: 'Storage',
            type: 'storage'
        };

        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
        setSelectedProject(project);
    };

    // Open Authentication in a new tab
    const handleOpenAuth = (project) => {
        const tabId = `${project.id}-auth`;

        // Check if tab already exists
        const existingTab = openTabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
            return;
        }

        const newTab = {
            id: tabId,
            projectId: project.id,
            projectName: project.projectId,
            label: 'Auth',
            type: 'auth'
        };

        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
        setSelectedProject(project);
    };

    // Open a favorite collection
    const handleOpenFavorite = (favorite) => {
        // Find the project
        const project = projects.find(p => p.projectId === favorite.projectId);
        if (project) {
            handleOpenCollection(project, favorite.collectionPath);
        } else {
            showMessage(`Project ${favorite.projectId} is not connected. Please connect it first.`, 'warning');
        }
    };

    // Close a tab
    const handleCloseTab = (tabId, e) => {
        e?.stopPropagation();
        const tabIndex = openTabs.findIndex(t => t.id === tabId);
        setOpenTabs(prev => prev.filter(t => t.id !== tabId));

        if (activeTabId === tabId) {
            // Switch to adjacent tab
            if (openTabs.length > 1) {
                const newIndex = tabIndex > 0 ? tabIndex - 1 : 0;
                const newActiveTab = openTabs.filter(t => t.id !== tabId)[newIndex];
                setActiveTabId(newActiveTab?.id || null);
            } else {
                setActiveTabId(null);
            }
        }
    };

    // Refresh collections for a project
    const handleRefreshCollections = async (project) => {
        try {
            // Switch to this project's connection first
            if (project.authMethod === 'serviceAccount') {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
            }

            const result = await window.electronAPI.getCollections();
            if (result.success) {
                setProjects(prev => prev.map(p =>
                    p.id === project.id
                        ? { ...p, collections: result.collections }
                        : p
                ));
                addLog('success', `Refreshed collections for ${project.projectId}`);
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    // Helper to find a project by ID (handles nested Google account projects)
    const findProject = (projectId) => {
        // First check if it's a service account project (top level)
        const serviceAccountProject = projects.find(p => p.id === projectId && p.authMethod === 'serviceAccount');
        if (serviceAccountProject) return serviceAccountProject;

        // Check in Google accounts
        for (const item of projects) {
            if (item.type === 'googleAccount' && item.projects) {
                const googleProject = item.projects.find(p => p.id === projectId);
                if (googleProject) return googleProject;
            }
        }

        return null;
    };

    const activeTab = openTabs.find(t => t.id === activeTabId);

    // Show loading screen while projects are being restored
    if (projectsLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    backgroundColor: theme.palette.background.default,
                    gap: 2,
                }}
            >
                <CircularProgress size={48} />
                <Typography variant="h6" sx={{ color: isDark ? '#ccc' : '#333' }}>
                    Restoring saved projects...
                </Typography>
                <Typography variant="body2" sx={{ color: isDark ? '#888' : '#666' }}>
                    Reconnecting to Google accounts and Firebase projects
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: theme.palette.background.default }}>
            {/* Main Content Area */}
            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {/* Project Sidebar */}
                <ProjectSidebar
                    projects={projects}
                    selectedProject={selectedProject}
                    onSelectProject={setSelectedProject}
                    onOpenCollection={handleOpenCollection}
                    onOpenStorage={handleOpenStorage}
                    onOpenAuth={handleOpenAuth}
                    onAddProject={() => setConnectionDialogOpen(true)}
                    onDisconnectProject={handleDisconnectProject}
                    onDisconnectAccount={handleDisconnectAccount}
                    onRefreshCollections={handleRefreshCollections}
                    onOpenSettings={() => setSettingsDialogOpen(true)}
                    onOpenFavorites={() => setFavoritesPanelOpen(true)}
                    onOpenConsole={() => setConsolePanelOpen(true)}
                />

                {/* Main Panel */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Tabs Bar */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                            backgroundColor: isDark ? '#252526' : '#f5f5f5',
                            minHeight: 36,
                        }}
                    >
                        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'auto' }}>
                            {openTabs.map((tab) => (
                                <Box
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 1.5,
                                        py: 0.5,
                                        cursor: 'pointer',
                                        borderRight: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                                        backgroundColor: activeTabId === tab.id ? (isDark ? '#1e1e1e' : '#fff') : 'transparent',
                                        borderBottom: activeTabId === tab.id ? '2px solid #1976d2' : '2px solid transparent',
                                        '&:hover': {
                                            backgroundColor: activeTabId === tab.id ? (isDark ? '#1e1e1e' : '#fff') : (isDark ? '#2d2d2d' : '#eee'),
                                        },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '0.8rem',
                                            color: isDark ? '#ccc' : '#333',
                                            mr: 1,
                                            maxWidth: 120,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {tab.label}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleCloseTab(tab.id, e)}
                                        sx={{ p: 0.25, color: isDark ? '#888' : undefined }}
                                    >
                                        <CloseIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, gap: 0.5 }}>
                            <Tooltip title="Settings">
                                <IconButton size="small" onClick={() => setSettingsDialogOpen(true)}>
                                    <SettingsIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                        {activeTab ? (
                            activeTab.type === 'storage' ? (
                                <StorageTab
                                    key={activeTab.id}
                                    project={findProject(activeTab.projectId)}
                                    addLog={addLog}
                                    showMessage={showMessage}
                                />
                            ) : activeTab.type === 'auth' ? (
                                <AuthTab
                                    key={activeTab.id}
                                    project={findProject(activeTab.projectId)}
                                    addLog={addLog}
                                    showMessage={showMessage}
                                />
                            ) : (
                                <CollectionTab
                                    key={activeTab.id}
                                    project={findProject(activeTab.projectId)}
                                    collectionPath={activeTab.collectionPath}
                                    addLog={addLog}
                                    showMessage={showMessage}
                                    defaultViewType={settings.defaultViewType}
                                    defaultDocLimit={settings.defaultDocLimit}
                                />
                            )
                        ) : (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    flexDirection: 'column',
                                    color: isDark ? '#888' : '#999',
                                    backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                                }}
                            >
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    {projects.length === 0
                                        ? 'Add a project to get started'
                                        : 'Select a collection from the sidebar'
                                    }
                                </Typography>
                                {projects.length === 0 && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => setConnectionDialogOpen(true)}
                                    >
                                        Add Project
                                    </Button>
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Bottom Bar with Logs */}
            <LogsPanel logs={logs} onClear={clearLogs} />

            {/* Dialogs */}
            <ConnectionDialog
                open={connectionDialogOpen}
                onClose={() => setConnectionDialogOpen(false)}
                onConnect={handleConnect}
                onGoogleSignIn={handleGoogleSignIn}
                loading={loading}
            />

            <SettingsDialog
                open={settingsDialogOpen}
                onClose={() => setSettingsDialogOpen(false)}
            />

            {/* Favorites Panel */}
            <FavoritesPanel
                open={favoritesPanelOpen}
                onClose={() => setFavoritesPanelOpen(false)}
                onOpenFavorite={handleOpenFavorite}
            />

            {/* Console Panel */}
            <ConsolePanel
                open={consolePanelOpen}
                onClose={() => setConsolePanelOpen(false)}
                projects={projects}
                addLog={addLog}
            />

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default App;
