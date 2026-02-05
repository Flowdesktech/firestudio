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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
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
import SavedQueriesPanel from './components/SavedQueriesPanel';
import { useSettings } from './context/SettingsContext';
import { useFavorites } from './context/FavoritesContext';
import { useProjects } from './context/ProjectsContext';

function App() {
    const theme = useTheme();
    const { settings } = useSettings();
    const { favorites } = useFavorites();
    const { projects, setProjects, addProject, removeProject, updateProject, isLoading: projectsLoading } = useProjects();

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
    const [savedQueriesPanelOpen, setSavedQueriesPanelOpen] = useState(false);

    // Add Collection Dialog state
    const [addCollectionDialogOpen, setAddCollectionDialogOpen] = useState(false);
    const [addCollectionProject, setAddCollectionProject] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newDocumentId, setNewDocumentId] = useState('');
    const [newDocumentData, setNewDocumentData] = useState('{}');
    const [addCollectionLoading, setAddCollectionLoading] = useState(false);

    // Tabs state - multiple open collections (persist to localStorage)
    const [openTabs, setOpenTabs] = useState(() => {
        try {
            const saved = localStorage.getItem('firestudio-open-tabs');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [activeTabId, setActiveTabId] = useState(() => {
        try {
            return localStorage.getItem('firestudio-active-tab') || null;
        } catch {
            return null;
        }
    });

    // Save tabs state to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('firestudio-open-tabs', JSON.stringify(openTabs));
    }, [openTabs]);

    useEffect(() => {
        if (activeTabId) {
            localStorage.setItem('firestudio-active-tab', activeTabId);
        } else {
            localStorage.removeItem('firestudio-active-tab');
        }
    }, [activeTabId]);

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

    // API Disabled Error Dialog state
    const [apiDisabledDialog, setApiDisabledDialog] = useState({ open: false, projectId: '', apiUrl: '' });

    const showMessage = useCallback((message, severity = 'info') => {
        // Check for API disabled error and show special dialog
        if (message && message.includes('has not been used in project') && message.includes('Enable it by visiting')) {
            const urlMatch = message.match(/https:\/\/console\.developers\.google\.com\/[^\s]+/);
            const projectMatch = message.match(/project\s+([^\s]+)\s+before/);
            if (urlMatch) {
                setApiDisabledDialog({
                    open: true,
                    projectId: projectMatch ? projectMatch[1] : 'this project',
                    apiUrl: urlMatch[0]
                });
                addLog('error', message);
                return;
            }
        }
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

            // Handle cancelled sign-in (user closed the window)
            if (result.cancelled) {
                setLoading(false);
                return;
            }

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
        // Find the project (check both top-level and nested Google account projects)
        let project = projects.find(p => p.projectId === favorite.projectId && p.authMethod);

        // If not found at top level, search in Google accounts
        if (!project) {
            for (const item of projects) {
                if (item.type === 'googleAccount' && item.projects) {
                    const googleProject = item.projects.find(p => p.projectId === favorite.projectId);
                    if (googleProject) {
                        project = googleProject;
                        break;
                    }
                }
            }
        }

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

    // Open Add Collection dialog
    const handleAddCollection = (project) => {
        if (!project) {
            showMessage('No project selected', 'error');
            return;
        }
        setAddCollectionProject(project);
        setNewCollectionName('');
        setNewDocumentId('');
        setNewDocumentData('{}');
        setAddCollectionDialogOpen(true);
    };

    // Create the collection
    const handleCreateCollection = async () => {
        if (!addCollectionProject || !newCollectionName.trim()) return;

        const trimmedName = newCollectionName.trim();

        // Validate collection name (no slashes, not starting with underscore)
        if (trimmedName.includes('/') || trimmedName.startsWith('_')) {
            showMessage('Invalid collection name. Cannot contain "/" or start with "_"', 'error');
            return;
        }

        // Parse document data
        let data;
        try {
            data = JSON.parse(newDocumentData.trim() || '{}');
        } catch (parseError) {
            showMessage('Invalid JSON in document data', 'error');
            return;
        }

        setAddCollectionLoading(true);
        addLog('info', `Creating collection "${trimmedName}" in ${addCollectionProject.projectId}...`);

        try {
            // Use provided document ID or auto-generate one
            const docId = newDocumentId.trim() || `auto_${Date.now()}`;

            let result;
            if (addCollectionProject.authMethod === 'google') {
                result = await window.electronAPI.googleSetDocument({
                    projectId: addCollectionProject.projectId,
                    collectionPath: trimmedName,
                    documentId: docId,
                    data
                });
                if (!result?.success) {
                    showMessage(`Failed to create collection: ${result?.error || 'Unknown error'}`, 'error');
                    return;
                }
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(addCollectionProject.serviceAccountPath);
                result = await window.electronAPI.createDocument({
                    collectionPath: trimmedName,
                    documentId: docId,
                    data
                });
                if (!result?.success) {
                    showMessage(`Failed to create collection: ${result?.error || 'Unknown error'}`, 'error');
                    return;
                }
            }

            // Refresh collections to show the new one
            await handleRefreshCollections(addCollectionProject);

            // Open the new collection
            handleOpenCollection(addCollectionProject, trimmedName);

            setAddCollectionDialogOpen(false);
            showMessage(`Created collection "${trimmedName}" with document "${docId}"`, 'success');
        } catch (error) {
            showMessage(`Failed to create collection: ${error.message}`, 'error');
        } finally {
            setAddCollectionLoading(false);
        }
    };

    // Refresh collections for a project (silent mode skips error dialogs)
    const handleRefreshCollections = async (project, silent = false) => {
        try {
            let collections = [];

            if (project.authMethod === 'google') {
                // For Google OAuth, use googleGetCollections
                const result = await window.electronAPI.googleGetCollections(project.projectId);
                if (result.success) {
                    collections = result.collections;
                } else {
                    // In silent mode, just log the error without showing dialog
                    if (silent) {
                        addLog('warning', `Skipped ${project.projectId}: ${result.error}`);
                        return;
                    }
                    showMessage(result.error, 'error');
                    return;
                }
            } else {
                // For service account, switch connection first
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                const result = await window.electronAPI.getCollections();
                if (result.success) {
                    collections = result.collections;
                } else {
                    showMessage(result.error, 'error');
                    return;
                }
            }

            // Update project collections - handle nested Google account projects
            setProjects(prev => prev.map(item => {
                if (item.type === 'googleAccount' && item.projects) {
                    return {
                        ...item,
                        projects: item.projects.map(p =>
                            p.id === project.id ? { ...p, collections } : p
                        )
                    };
                }
                if (item.id === project.id) {
                    return { ...item, collections };
                }
                return item;
            }));

            addLog('success', `Refreshed collections for ${project.projectId}`);
        } catch (error) {
            showMessage(error.message, 'error');
        }
    };

    // Export all collections from a project
    const handleExportAllCollections = async (project) => {
        if (!project?.collections || project.collections.length === 0) {
            showMessage('No collections to export', 'warning');
            return;
        }

        addLog('info', `Exporting all collections from ${project.projectId}...`);
        showMessage(`Exporting ${project.collections.length} collection(s)...`, 'info');

        try {
            const allData = {};

            for (const collectionName of project.collections) {
                try {
                    let documents;
                    if (project.authMethod === 'google') {
                        const result = await window.electronAPI.googleGetDocuments({
                            projectId: project.projectId,
                            collectionPath: collectionName,
                            limit: 10000 // Get all documents
                        });
                        documents = result.success ? result.documents : [];
                    } else {
                        await window.electronAPI.disconnectFirebase();
                        await window.electronAPI.connectFirebase(project.serviceAccountPath);
                        const result = await window.electronAPI.getDocuments({
                            collectionPath: collectionName,
                            limit: 10000
                        });
                        documents = result.success ? result.documents : [];
                    }

                    // Convert documents to a map with doc ID as key
                    allData[collectionName] = {};
                    documents.forEach(doc => {
                        allData[collectionName][doc.id] = doc.data;
                    });
                } catch (error) {
                    addLog('error', `Failed to export ${collectionName}: ${error.message}`);
                }
            }

            // Create and download JSON file
            const jsonStr = JSON.stringify(allData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.projectId}_all_collections_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showMessage(`Exported ${Object.keys(allData).length} collection(s)`, 'success');
        } catch (error) {
            showMessage(`Export failed: ${error.message}`, 'error');
        }
    };

    // Open Firebase Console in browser
    const handleRevealInFirebaseConsole = (project) => {
        const url = `https://console.firebase.google.com/project/${project.projectId}/firestore`;
        window.electronAPI.openExternal(url);
        addLog('info', `Opened Firebase Console for ${project.projectId}`);
    };

    // Copy project ID to clipboard
    const handleCopyProjectId = async (project) => {
        try {
            await navigator.clipboard.writeText(project.projectId);
            showMessage(`Copied "${project.projectId}" to clipboard`, 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = project.projectId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage(`Copied "${project.projectId}" to clipboard`, 'success');
        }
    };

    // Add Document Dialog state
    const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
    const [addDocumentTarget, setAddDocumentTarget] = useState(null);
    const [newDocId, setNewDocId] = useState('');
    const [newDocData, setNewDocData] = useState('{}');
    const [addDocumentLoading, setAddDocumentLoading] = useState(false);

    // Rename Collection Dialog state
    const [renameCollectionDialogOpen, setRenameCollectionDialogOpen] = useState(false);
    const [renameCollectionTarget, setRenameCollectionTarget] = useState(null);
    const [renameTargetPath, setRenameTargetPath] = useState('');
    const [renameCollectionLoading, setRenameCollectionLoading] = useState(false);

    // Collection Menu Handlers
    const handleAddDocument = (project, collection) => {
        setAddDocumentTarget({ project, collection });
        setNewDocId('');
        setNewDocData('{}');
        setAddDocumentDialogOpen(true);
    };

    const confirmAddDocument = async () => {
        if (!addDocumentTarget) return;
        const { project, collection } = addDocumentTarget;

        let data;
        try {
            data = JSON.parse(newDocData.trim() || '{}');
        } catch (parseError) {
            showMessage('Invalid JSON in document data', 'error');
            return;
        }

        setAddDocumentLoading(true);
        const docId = newDocId.trim() || `auto_${Date.now()}`;

        try {
            if (project.authMethod === 'google') {
                const result = await window.electronAPI.googleSetDocument({
                    projectId: project.projectId,
                    collectionPath: collection,
                    documentId: docId,
                    data
                });
                if (!result?.success) {
                    showMessage(`Failed to create document: ${result?.error}`, 'error');
                    return;
                }
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                const result = await window.electronAPI.createDocument({
                    collectionPath: collection,
                    documentId: docId,
                    data
                });
                if (!result?.success) {
                    showMessage(`Failed to create document: ${result?.error}`, 'error');
                    return;
                }
            }

            showMessage(`Created document "${docId}" in ${collection}`, 'success');
            setAddDocumentDialogOpen(false);

            // Dispatch event to refresh collection if it's open
            window.dispatchEvent(new CustomEvent('refresh-collection', {
                detail: { projectId: project.projectId, collectionPath: collection }
            }));
        } catch (error) {
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            setAddDocumentLoading(false);
        }
    };

    const handleRenameCollection = (project, collection) => {
        setRenameCollectionTarget({ project, collection });
        setRenameTargetPath(collection);
        setRenameCollectionDialogOpen(true);
    };

    const confirmRenameCollection = async () => {
        if (!renameCollectionTarget || !renameTargetPath.trim()) return;
        const { project, collection } = renameCollectionTarget;
        const targetPath = renameTargetPath.trim();

        if (targetPath === collection) {
            showMessage('Target path must differ from current path', 'warning');
            return;
        }

        setRenameCollectionLoading(true);
        addLog('info', `Renaming collection "${collection}" to "${targetPath}"...`);

        try {
            // Step 1: Get all documents from source collection
            let documents = [];
            if (project.authMethod === 'google') {
                const result = await window.electronAPI.googleGetDocuments({
                    projectId: project.projectId,
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                const result = await window.electronAPI.getDocuments({
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            }

            // Step 2: Copy documents to new collection
            let copied = 0;
            for (const doc of documents) {
                try {
                    if (project.authMethod === 'google') {
                        await window.electronAPI.googleSetDocument({
                            projectId: project.projectId,
                            collectionPath: targetPath,
                            documentId: doc.id,
                            data: doc.data
                        });
                    } else {
                        await window.electronAPI.createDocument({
                            collectionPath: targetPath,
                            documentId: doc.id,
                            data: doc.data
                        });
                    }
                    copied++;
                } catch (err) {
                    addLog('error', `Failed to copy document ${doc.id}: ${err.message}`);
                }
            }

            // Step 3: Delete documents from original collection
            let deleted = 0;
            for (const doc of documents) {
                try {
                    if (project.authMethod === 'google') {
                        await window.electronAPI.googleDeleteDocument({
                            projectId: project.projectId,
                            collectionPath: collection,
                            documentId: doc.id
                        });
                    } else {
                        await window.electronAPI.deleteDocument(`${collection}/${doc.id}`);
                    }
                    deleted++;
                } catch (err) {
                    addLog('error', `Failed to delete original ${doc.id}: ${err.message}`);
                }
            }

            showMessage(`Renamed: copied ${copied} docs, deleted ${deleted} originals`, 'success');

            // Refresh collections
            await handleRefreshCollections(project);

            // Close tabs for old collection, open new one
            setOpenTabs(prev => prev.filter(t => !(t.projectId === project.id && t.collectionPath === collection)));
            handleOpenCollection(project, targetPath);
        } catch (error) {
            showMessage(`Rename failed: ${error.message}`, 'error');
        } finally {
            setRenameCollectionLoading(false);
            setRenameCollectionDialogOpen(false);
            setRenameCollectionTarget(null);
        }
    };

    const [deleteCollectionDialogOpen, setDeleteCollectionDialogOpen] = useState(false);
    const [deleteCollectionTarget, setDeleteCollectionTarget] = useState(null);
    const [deleteCollectionLoading, setDeleteCollectionLoading] = useState(false);

    const handleDeleteCollection = (project, collection) => {
        setDeleteCollectionTarget({ project, collection });
        setDeleteCollectionDialogOpen(true);
    };

    const confirmDeleteCollection = async () => {
        if (!deleteCollectionTarget) return;
        const { project, collection } = deleteCollectionTarget;

        setDeleteCollectionLoading(true);
        addLog('info', `Deleting collection "${collection}"...`);

        try {
            // Get all documents in the collection
            let documents = [];
            if (project.authMethod === 'google') {
                const result = await window.electronAPI.googleGetDocuments({
                    projectId: project.projectId,
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                const result = await window.electronAPI.getDocuments({
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            }

            // Delete each document
            let deleted = 0;
            for (const doc of documents) {
                try {
                    if (project.authMethod === 'google') {
                        await window.electronAPI.googleDeleteDocument({
                            projectId: project.projectId,
                            collectionPath: collection,
                            documentId: doc.id
                        });
                    } else {
                        await window.electronAPI.deleteDocument(`${collection}/${doc.id}`);
                    }
                    deleted++;
                } catch (err) {
                    addLog('error', `Failed to delete document ${doc.id}: ${err.message}`);
                }
            }

            showMessage(`Deleted ${deleted} documents from "${collection}"`, 'success');

            // Refresh collections
            await handleRefreshCollections(project);

            // Close any tabs for this collection
            setOpenTabs(prev => prev.filter(t => !(t.projectId === project.id && t.collectionPath === collection)));
        } catch (error) {
            showMessage(`Failed to delete collection: ${error.message}`, 'error');
        } finally {
            setDeleteCollectionLoading(false);
            setDeleteCollectionDialogOpen(false);
            setDeleteCollectionTarget(null);
        }
    };

    const handleExportCollection = async (project, collection) => {
        addLog('info', `Exporting collection "${collection}"...`);
        showMessage(`Exporting ${collection}...`, 'info');

        try {
            let documents;
            if (project.authMethod === 'google') {
                const result = await window.electronAPI.googleGetDocuments({
                    projectId: project.projectId,
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                const result = await window.electronAPI.getDocuments({
                    collectionPath: collection,
                    limit: 10000
                });
                documents = result.success ? result.documents : [];
            }

            // Convert to export format
            const exportData = {};
            documents.forEach(doc => {
                exportData[doc.id] = doc.data;
            });

            // Download
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.projectId}_${collection}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showMessage(`Exported ${documents.length} documents from "${collection}"`, 'success');
        } catch (error) {
            showMessage(`Export failed: ${error.message}`, 'error');
        }
    };

    const handleEstimateDocCount = async (project, collection) => {
        addLog('info', `Estimating document count for "${collection}"...`);
        showMessage(`Counting documents in ${collection}...`, 'info');

        try {
            let count = 0;
            if (project.authMethod === 'google') {
                // Try to use COUNT aggregation query first (more efficient)
                const countResult = await window.electronAPI.googleCountDocuments?.({
                    projectId: project.projectId,
                    collectionPath: collection
                });

                if (countResult?.success && countResult.count !== undefined) {
                    count = countResult.count;
                } else {
                    // Fallback: paginate through documents to count them
                    let pageToken = null;
                    const pageSize = 1000;
                    do {
                        const result = await window.electronAPI.googleGetDocuments({
                            projectId: project.projectId,
                            collectionPath: collection,
                            limit: pageSize,
                            pageToken
                        });
                        if (result.success) {
                            count += result.documents?.length || 0;
                            pageToken = result.nextPageToken;
                        } else {
                            break;
                        }
                    } while (pageToken);
                }
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                // Try COUNT aggregation first
                const countResult = await window.electronAPI.countDocuments?.({
                    collectionPath: collection
                });

                if (countResult?.success && countResult.count !== undefined) {
                    count = countResult.count;
                } else {
                    // Fallback: get all documents
                    const result = await window.electronAPI.getDocuments({
                        collectionPath: collection,
                        limit: 100000
                    });
                    count = result.success ? result.documents?.length || 0 : 0;
                }
            }

            showMessage(`"${collection}" has ${count.toLocaleString()} documents`, 'success');
        } catch (error) {
            showMessage(`Failed to count: ${error.message}`, 'error');
        }
    };

    const handleCopyCollectionId = async (collection) => {
        try {
            await navigator.clipboard.writeText(collection);
            showMessage(`Copied "${collection}" to clipboard`, 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = collection;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage(`Copied "${collection}" to clipboard`, 'success');
        }
    };

    const handleCopyResourcePath = async (project, collection) => {
        const path = `projects/${project.projectId}/databases/(default)/documents/${collection}`;
        try {
            await navigator.clipboard.writeText(path);
            showMessage(`Copied resource path to clipboard`, 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = path;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage(`Copied resource path to clipboard`, 'success');
        }
    };

    const handleRevealCollectionInConsole = (project, collection) => {
        const url = `https://console.firebase.google.com/project/${project.projectId}/firestore/data/~2F${collection}`;
        window.electronAPI.openExternal(url);
        addLog('info', `Opened Firebase Console for collection ${collection}`);
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

    // Ctrl+W keyboard shortcut to close current tab
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (activeTabId) {
                    handleCloseTab(activeTabId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTabId, openTabs]);

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
                    bgcolor: 'background.default', // Use theme color
                    gap: 2,
                }}
            >
                <CircularProgress size={48} />
                <Typography variant="h6" color="text.primary">
                    Restoring saved projects...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Reconnecting to Google accounts and Firebase projects
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
            {/* Main Content Area */}
            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {/* Project Sidebar */}
                <ProjectSidebar
                    projects={projects}
                    selectedProject={selectedProject}
                    activeTab={activeTab}
                    onSelectProject={setSelectedProject}
                    onOpenCollection={handleOpenCollection}
                    onOpenStorage={handleOpenStorage}
                    onOpenAuth={handleOpenAuth}
                    onAddProject={() => setConnectionDialogOpen(true)}
                    onAddCollection={handleAddCollection}
                    onDisconnectProject={handleDisconnectProject}
                    onDisconnectAccount={handleDisconnectAccount}
                    onRefreshCollections={handleRefreshCollections}
                    onExportAllCollections={handleExportAllCollections}
                    onRevealInFirebaseConsole={handleRevealInFirebaseConsole}
                    onCopyProjectId={handleCopyProjectId}
                    // Collection menu handlers
                    onAddDocument={handleAddDocument}
                    onRenameCollection={handleRenameCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onExportCollection={handleExportCollection}
                    onEstimateDocCount={handleEstimateDocCount}
                    onCopyCollectionId={handleCopyCollectionId}
                    onCopyResourcePath={handleCopyResourcePath}
                    onRevealCollectionInConsole={handleRevealCollectionInConsole}
                    onOpenSettings={() => setSettingsDialogOpen(true)}
                    onOpenFavorites={() => setFavoritesPanelOpen(true)}
                    onOpenConsole={() => setConsolePanelOpen(true)}
                    onOpenSavedQueries={() => setSavedQueriesPanelOpen(true)}
                />

                {/* Main Panel */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Tabs Bar */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            minHeight: 36,
                        }}
                    >
                        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'auto' }}>
                            {openTabs.map((tab) => (
                                <Box
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    onAuxClick={(e) => {
                                        // Middle mouse button click to close tab
                                        if (e.button === 1) {
                                            e.preventDefault();
                                            handleCloseTab(tab.id, e);
                                        }
                                    }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 1.5,
                                        py: 0.5,
                                        cursor: 'pointer',
                                        borderRight: 1,
                                        borderColor: 'divider',
                                        bgcolor: activeTabId === tab.id ? 'background.paper' : 'transparent',
                                        borderBottom: activeTabId === tab.id ? '2px solid' : '2px solid transparent',
                                        borderBottomColor: activeTabId === tab.id ? 'primary.main' : 'transparent',
                                        '&:hover': {
                                            bgcolor: activeTabId === tab.id ? 'background.paper' : 'action.hover',
                                        },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '0.8rem',
                                            color: 'text.primary',
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
                                        sx={{ p: 0.25, color: 'text.secondary' }}
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
                                    color: 'text.secondary',
                                    bgcolor: 'background.default',
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
                allCollections={projects.flatMap(p =>
                    p.type === 'googleAccount' && p.projects
                        ? p.projects.flatMap(proj => proj.collections || [])
                        : (p.collections || [])
                )}
            />

            {/* Saved Queries Panel */}
            <SavedQueriesPanel
                open={savedQueriesPanelOpen}
                onClose={() => setSavedQueriesPanelOpen(false)}
                onOpenQuery={(savedQuery) => {
                    // Find the project by projectId
                    let project = null;
                    for (const item of projects) {
                        if (item.type === 'googleAccount' && item.projects) {
                            const googleProject = item.projects.find(p => p.projectId === savedQuery.projectId);
                            if (googleProject) {
                                project = googleProject;
                                break;
                            }
                        } else if (item.projectId === savedQuery.projectId) {
                            project = item;
                            break;
                        }
                    }

                    if (project && savedQuery.collectionPath) {
                        // Open the collection
                        handleOpenCollection(project, savedQuery.collectionPath);
                        // Dispatch event to load the query into the JS editor (wait for component to mount)
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('load-query', {
                                detail: { query: savedQuery.code }
                            }));
                        }, 300);
                    } else {
                        showMessage('Project or collection not found. Please connect the project first.', 'warning');
                    }
                }}
            />

            {/* Add Collection Dialog */}
            <Dialog
                open={addCollectionDialogOpen}
                onClose={() => !addCollectionLoading && setAddCollectionDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Add Collection
                    {addCollectionProject && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                            Project: {addCollectionProject.projectId}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Collection Name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        disabled={addCollectionLoading}
                        placeholder="e.g., users, products, orders"
                        helperText="Collection names cannot contain '/' or start with '_'"
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="First Document ID (optional)"
                        value={newDocumentId}
                        onChange={(e) => setNewDocumentId(e.target.value)}
                        disabled={addCollectionLoading}
                        placeholder="Leave empty for auto-generated ID"
                        helperText="Optional: Specify a custom document ID"
                        sx={{ mt: 2 }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="First Document Data"
                        value={newDocumentData}
                        onChange={(e) => setNewDocumentData(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey && newCollectionName.trim() && !addCollectionLoading) {
                                handleCreateCollection();
                            }
                        }}
                        disabled={addCollectionLoading}
                        placeholder='{"field": "value"}'
                        helperText="JSON object for the first document (Ctrl+Enter to submit)"
                        sx={{ mt: 2, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setAddCollectionDialogOpen(false)}
                        disabled={addCollectionLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateCollection}
                        variant="contained"
                        disabled={!newCollectionName.trim() || addCollectionLoading}
                        startIcon={addCollectionLoading ? <CircularProgress size={16} /> : <AddIcon />}
                    >
                        {addCollectionLoading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Collection Dialog */}
            <Dialog
                open={deleteCollectionDialogOpen}
                onClose={() => !deleteCollectionLoading && setDeleteCollectionDialogOpen(false)}
            >
                <DialogTitle sx={{ color: 'error.main' }}>
                    Delete Collection?
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 2 }}>
                        Are you sure you want to delete the collection <strong>"{deleteCollectionTarget?.collection}"</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        This will permanently delete all documents in this collection. This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteCollectionDialogOpen(false)}
                        disabled={deleteCollectionLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDeleteCollection}
                        color="error"
                        variant="contained"
                        disabled={deleteCollectionLoading}
                        startIcon={deleteCollectionLoading ? <CircularProgress size={16} /> : null}
                    >
                        {deleteCollectionLoading ? 'Deleting...' : 'Delete Collection'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Document Dialog */}
            <Dialog
                open={addDocumentDialogOpen}
                onClose={() => !addDocumentLoading && setAddDocumentDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Add Document
                    {addDocumentTarget && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                            Collection: {addDocumentTarget.collection}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Document ID (optional)"
                        value={newDocId}
                        onChange={(e) => setNewDocId(e.target.value)}
                        disabled={addDocumentLoading}
                        placeholder="Leave empty for auto-generated ID"
                        helperText="Optional: Specify a custom document ID"
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={6}
                        label="Document Data"
                        value={newDocData}
                        onChange={(e) => setNewDocData(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey && !addDocumentLoading) {
                                confirmAddDocument();
                            }
                        }}
                        disabled={addDocumentLoading}
                        placeholder='{"field": "value"}'
                        helperText="JSON object for the document (Ctrl+Enter to submit)"
                        sx={{ mt: 2, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setAddDocumentDialogOpen(false)}
                        disabled={addDocumentLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmAddDocument}
                        variant="contained"
                        disabled={addDocumentLoading}
                        startIcon={addDocumentLoading ? <CircularProgress size={16} /> : <AddIcon />}
                    >
                        {addDocumentLoading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Rename Collection Dialog */}
            <Dialog
                open={renameCollectionDialogOpen}
                onClose={() => !renameCollectionLoading && setRenameCollectionDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Rename Collection</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 1 }}>
                        <Typography variant="body2" sx={{ minWidth: 100 }}>Source Project:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {renameCollectionTarget?.project?.projectId}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="body2" sx={{ minWidth: 100 }}>Source Path:</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            /{renameCollectionTarget?.collection}
                        </Typography>
                    </Box>
                    <TextField
                        fullWidth
                        label="Target Path"
                        value={renameTargetPath}
                        onChange={(e) => setRenameTargetPath(e.target.value)}
                        disabled={renameCollectionLoading}
                        error={renameTargetPath === renameCollectionTarget?.collection}
                        helperText={renameTargetPath === renameCollectionTarget?.collection ? 'Target path must differ from current path' : ''}
                        sx={{ mb: 2 }}
                    />
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        This will copy all documents to the new collection and delete the original documents.
                        Nested subcollections are copied recursively. Existing documents with the same ID at the target path will be overwritten.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setRenameCollectionDialogOpen(false)}
                        disabled={renameCollectionLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmRenameCollection}
                        variant="contained"
                        disabled={renameCollectionLoading || renameTargetPath === renameCollectionTarget?.collection || !renameTargetPath.trim()}
                        startIcon={renameCollectionLoading ? <CircularProgress size={16} /> : null}
                    >
                        {renameCollectionLoading ? 'Renaming...' : 'OK'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* API Disabled Dialog */}
            <Dialog
                open={apiDisabledDialog.open}
                onClose={() => setApiDisabledDialog({ open: false, projectId: '', apiUrl: '' })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ color: 'warning.main' }}>
                    Cloud Firestore API Not Enabled
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 2 }}>
                        The Cloud Firestore API has not been enabled for project <strong>{apiDisabledDialog.projectId}</strong>.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        To use Firestore with this project, you need to enable the Cloud Firestore API in the Google Cloud Console.
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Click the button below to open the Google Cloud Console and enable the API. After enabling, wait a few minutes and try again.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setApiDisabledDialog({ open: false, projectId: '', apiUrl: '' })}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            window.electronAPI.openExternal(apiDisabledDialog.apiUrl);
                        }}
                    >
                        Enable Firestore API
                    </Button>
                </DialogActions>
            </Dialog>

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
