import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProjectsContext = createContext();

// Storage key for persisted projects
const STORAGE_KEY = 'firestudio-projects';

export function ProjectsProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved projects on mount
    useEffect(() => {
        loadSavedProjects();
    }, []);

    // Save projects whenever they change (debounced)
    useEffect(() => {
        if (!isLoading && projects.length >= 0) {
            saveProjects(projects);
        }
    }, [projects, isLoading]);

    const loadSavedProjects = async () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const savedProjects = JSON.parse(saved);
                console.log('Loading saved projects:', savedProjects);

                // Reconnect each project based on auth method
                const reconnectedProjects = [];
                for (const proj of savedProjects) {
                    if (proj.authMethod === 'serviceAccount' && proj.serviceAccountPath) {
                        try {
                            // Try to reconnect using service account
                            await window.electronAPI?.disconnectFirebase?.();
                            const result = await window.electronAPI?.connectFirebase?.(proj.serviceAccountPath);

                            if (result?.success) {
                                // Refresh collections
                                const collectionsResult = await window.electronAPI?.getCollections?.();
                                reconnectedProjects.push({
                                    ...proj,
                                    collections: collectionsResult?.success ? collectionsResult.collections : proj.collections || [],
                                    connected: true,
                                    expanded: true
                                });
                                console.log(`Reconnected to ${proj.projectId}`);
                            } else {
                                // Keep project but mark as disconnected
                                reconnectedProjects.push({
                                    ...proj,
                                    connected: false,
                                    error: result?.error || 'Failed to connect',
                                    expanded: true
                                });
                                console.log(`Failed to reconnect to ${proj.projectId}:`, result?.error);
                            }
                        } catch (error) {
                            // Keep project but mark as disconnected
                            reconnectedProjects.push({
                                ...proj,
                                connected: false,
                                error: error.message,
                                expanded: true
                            });
                            console.log(`Error reconnecting to ${proj.projectId}:`, error.message);
                        }
                    } else if (proj.type === 'googleAccount') {
                        // New format - Google account with nested projects
                        const refreshToken = proj.refreshToken;

                        if (refreshToken) {
                            try {
                                const result = await window.electronAPI?.googleRefreshToken?.(refreshToken);
                                if (result?.success) {
                                    // Token refreshed - update all nested projects with fresh collections
                                    const updatedProjects = [];
                                    for (const nestedProj of (proj.projects || [])) {
                                        const collectionsResult = await window.electronAPI?.googleGetCollections?.(nestedProj.projectId);
                                        updatedProjects.push({
                                            ...nestedProj,
                                            accessToken: result.accessToken,
                                            refreshToken: refreshToken,
                                            collections: collectionsResult?.success ? collectionsResult.collections : nestedProj.collections || [],
                                            expanded: false
                                        });
                                    }
                                    reconnectedProjects.push({
                                        ...proj,
                                        accessToken: result.accessToken,
                                        projects: updatedProjects,
                                        expanded: true
                                    });
                                    console.log(`Reconnected Google account ${proj.email}`);
                                } else {
                                    // Refresh failed - keep structure but mark as needs re-auth
                                    reconnectedProjects.push({
                                        ...proj,
                                        needsReauth: true,
                                        expanded: true
                                    });
                                    console.log(`Failed to refresh token for ${proj.email}: ${result?.error}`);
                                }
                            } catch (error) {
                                reconnectedProjects.push({
                                    ...proj,
                                    needsReauth: true,
                                    expanded: true
                                });
                                console.log(`Error refreshing token for ${proj.email}:`, error.message);
                            }
                        } else {
                            // No refresh token
                            reconnectedProjects.push({
                                ...proj,
                                needsReauth: true,
                                expanded: true
                            });
                            console.log(`Google account ${proj.email} has no refresh token`);
                        }
                    } else if (proj.authMethod === 'google') {
                        // Old format - individual Google project (backward compatibility)
                        const refreshToken = proj.refreshToken;

                        if (refreshToken) {
                            try {
                                const result = await window.electronAPI?.googleRefreshToken?.(refreshToken);
                                if (result?.success) {
                                    const collectionsResult = await window.electronAPI?.googleGetCollections?.(proj.projectId);
                                    reconnectedProjects.push({
                                        ...proj,
                                        accessToken: result.accessToken,
                                        connected: true,
                                        needsReauth: false,
                                        collections: collectionsResult?.success ? collectionsResult.collections : proj.collections || [],
                                        expanded: true
                                    });
                                    console.log(`Reconnected to ${proj.projectId} using refresh token`);
                                } else {
                                    reconnectedProjects.push({
                                        ...proj,
                                        connected: false,
                                        needsReauth: true,
                                        collections: proj.collections || [],
                                        expanded: true
                                    });
                                    console.log(`Failed to refresh token for ${proj.projectId}: ${result?.error}`);
                                }
                            } catch (error) {
                                reconnectedProjects.push({
                                    ...proj,
                                    connected: false,
                                    needsReauth: true,
                                    collections: proj.collections || [],
                                    expanded: true
                                });
                                console.log(`Error refreshing token for ${proj.projectId}:`, error.message);
                            }
                        } else {
                            reconnectedProjects.push({
                                ...proj,
                                connected: false,
                                needsReauth: true,
                                collections: proj.collections || [],
                                expanded: true
                            });
                            console.log(`Google project ${proj.projectId} has no refresh token`);
                        }
                    }
                }

                setProjects(reconnectedProjects);
            }
        } catch (error) {
            console.error('Error loading saved projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveProjects = (projectsToSave) => {
        try {
            // Save both service account and Google OAuth projects/accounts
            const projectsToStore = projectsToSave.map(p => {
                if (p.authMethod === 'serviceAccount') {
                    return {
                        id: p.id,
                        projectId: p.projectId,
                        serviceAccountPath: p.serviceAccountPath,
                        authMethod: p.authMethod,
                        collections: p.collections || []
                    };
                } else if (p.type === 'googleAccount') {
                    // Save Google account with nested projects
                    return {
                        id: p.id,
                        type: 'googleAccount',
                        email: p.email,
                        name: p.name,
                        refreshToken: p.refreshToken || null,
                        projects: (p.projects || []).map(proj => ({
                            id: proj.id,
                            projectId: proj.projectId,
                            parentAccountId: proj.parentAccountId,
                            authMethod: 'google',
                            refreshToken: proj.refreshToken || p.refreshToken || null,
                            collections: proj.collections || []
                        }))
                    };
                } else if (p.authMethod === 'google') {
                    // Old format - individual Google project
                    return {
                        id: p.id,
                        projectId: p.projectId,
                        authMethod: p.authMethod,
                        refreshToken: p.refreshToken || null,
                        collections: p.collections || []
                    };
                }
                return null;
            }).filter(Boolean);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(projectsToStore));
            console.log('Saved projects:', projectsToStore.length);
        } catch (error) {
            console.error('Error saving projects:', error);
        }
    };

    const addProject = useCallback((project) => {
        setProjects(prev => {
            // Check if project already exists by projectId
            const existingIndex = prev.findIndex(p => p.projectId === project.projectId);
            if (existingIndex >= 0) {
                // Update existing project
                const updated = [...prev];
                updated[existingIndex] = { ...prev[existingIndex], ...project, connected: true };
                return updated;
            }
            return [...prev, { ...project, connected: true }];
        });
    }, []);

    const removeProject = useCallback((projectId) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
    }, []);

    const updateProject = useCallback((projectId, updates) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, ...updates } : p
        ));
    }, []);

    const clearProjects = useCallback(() => {
        setProjects([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Reconnect a Google OAuth project after re-authentication
    const reconnectGoogleProject = useCallback(async (projectId, accessToken) => {
        try {
            // Get fresh collections
            const collectionsResult = await window.electronAPI?.googleGetCollections?.(projectId);

            setProjects(prev => prev.map(p => {
                if (p.projectId === projectId && p.authMethod === 'google') {
                    return {
                        ...p,
                        accessToken,
                        connected: true,
                        needsReauth: false,
                        collections: collectionsResult?.success ? collectionsResult.collections : p.collections || []
                    };
                }
                return p;
            }));

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    return (
        <ProjectsContext.Provider value={{
            projects,
            setProjects,
            addProject,
            removeProject,
            updateProject,
            clearProjects,
            reconnectGoogleProject,
            isLoading
        }}>
            {children}
        </ProjectsContext.Provider>
    );
}

export function useProjects() {
    const context = useContext(ProjectsContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectsProvider');
    }
    return context;
}
