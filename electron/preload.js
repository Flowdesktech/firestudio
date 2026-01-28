const { contextBridge, ipcRenderer } = require('electron');

// Listen for menu events and forward to renderer
ipcRenderer.on('open-add-project-dialog', () => {
    window.dispatchEvent(new CustomEvent('open-add-project-dialog'));
});

ipcRenderer.on('open-settings-dialog', () => {
    window.dispatchEvent(new CustomEvent('open-settings-dialog'));
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Firebase connection
    connectFirebase: (serviceAccountPath) => ipcRenderer.invoke('firebase:connect', serviceAccountPath),
    disconnectFirebase: () => ipcRenderer.invoke('firebase:disconnect'),

    // Firestore operations
    getCollections: () => ipcRenderer.invoke('firestore:getCollections'),
    getDocuments: (params) => ipcRenderer.invoke('firestore:getDocuments', params),
    getDocument: (documentPath) => ipcRenderer.invoke('firestore:getDocument', documentPath),
    createDocument: (params) => ipcRenderer.invoke('firestore:createDocument', params),
    updateDocument: (params) => ipcRenderer.invoke('firestore:updateDocument', params),
    setDocument: (params) => ipcRenderer.invoke('firestore:setDocument', params),
    deleteDocument: (documentPath) => ipcRenderer.invoke('firestore:deleteDocument', documentPath),
    deleteCollection: (collectionPath) => ipcRenderer.invoke('firestore:deleteCollection', collectionPath),

    // Query
    query: (params) => ipcRenderer.invoke('firestore:query', params),
    executeJsQuery: (params) => ipcRenderer.invoke('firestore:executeJsQuery', params),

    // Import/Export
    exportCollection: (collectionPath) => ipcRenderer.invoke('firestore:exportCollection', collectionPath),
    importDocuments: (collectionPath) => ipcRenderer.invoke('firestore:importDocuments', collectionPath),

    // Dialog
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),

    // Google Sign-In
    googleSignIn: () => ipcRenderer.invoke('google:signIn'),
    googleSignOut: () => ipcRenderer.invoke('google:signOut'),
    googleRefreshToken: (refreshToken) => ipcRenderer.invoke('google:refreshToken', refreshToken),
    getUserProjects: () => ipcRenderer.invoke('google:getUserProjects'),

    // Google OAuth Firestore operations (REST API)
    googleGetCollections: (projectId) => ipcRenderer.invoke('google:getCollections', projectId),
    googleGetDocuments: (params) => ipcRenderer.invoke('google:getDocuments', params),

    // Firebase Storage operations (Service Account)
    storageListFiles: (params) => ipcRenderer.invoke('storage:listFiles', params),
    storageUploadFile: (params) => ipcRenderer.invoke('storage:uploadFile', params),
    storageDownloadFile: (params) => ipcRenderer.invoke('storage:downloadFile', params),
    storageGetDownloadUrl: (params) => ipcRenderer.invoke('storage:getDownloadUrl', params),
    storageDeleteFile: (params) => ipcRenderer.invoke('storage:deleteFile', params),
    storageCreateFolder: (params) => ipcRenderer.invoke('storage:createFolder', params),
    storageGetFileMetadata: (params) => ipcRenderer.invoke('storage:getFileMetadata', params),

    // Google OAuth Storage operations (REST API)
    googleStorageListFiles: (params) => ipcRenderer.invoke('google:storageListFiles', params),
    googleStorageUploadFile: (params) => ipcRenderer.invoke('google:storageUploadFile', params),
    googleStorageDownloadFile: (params) => ipcRenderer.invoke('google:storageDownloadFile', params),
    googleStorageGetDownloadUrl: (params) => ipcRenderer.invoke('google:storageGetDownloadUrl', params),
    googleStorageDeleteFile: (params) => ipcRenderer.invoke('google:storageDeleteFile', params),
    googleStorageCreateFolder: (params) => ipcRenderer.invoke('google:storageCreateFolder', params),

    // Firebase Auth operations
    listAuthUsers: (params) => ipcRenderer.invoke('auth:listUsers', params),
    createAuthUser: (params) => ipcRenderer.invoke('auth:createUser', params),
    updateAuthUser: (params) => ipcRenderer.invoke('auth:updateUser', params),
    deleteAuthUser: (params) => ipcRenderer.invoke('auth:deleteUser', params),
    getAuthUser: (params) => ipcRenderer.invoke('auth:getUser', params),

    // Google OAuth Auth operations (REST API)
    googleListAuthUsers: (params) => ipcRenderer.invoke('google:listAuthUsers', params),
    googleCreateAuthUser: (params) => ipcRenderer.invoke('google:createAuthUser', params),
    googleUpdateAuthUser: (params) => ipcRenderer.invoke('google:updateAuthUser', params),
    googleDeleteAuthUser: (params) => ipcRenderer.invoke('google:deleteAuthUser', params),

    // Google OAuth JS Query (structured query)
    googleExecuteStructuredQuery: (params) => ipcRenderer.invoke('google:executeStructuredQuery', params)
});
