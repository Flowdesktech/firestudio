// Mock electronAPI for browser development mode
// This allows basic testing when not running in Electron

const mockElectronAPI = {
    // Firebase connection - mock
    connectFirebase: async (serviceAccountPath) => {
        console.warn('[Mock] connectFirebase called in browser mode');
        return { success: false, error: 'Service Account connection requires Electron. Run "npm run dev" for full functionality.' };
    },
    disconnectFirebase: async () => {
        return { success: true };
    },

    // Firestore operations - mock
    getCollections: async () => {
        console.warn('[Mock] getCollections called in browser mode');
        return { success: false, error: 'Requires Electron mode' };
    },
    getDocuments: async (params) => {
        console.warn('[Mock] getDocuments called in browser mode');
        return { success: false, error: 'Requires Electron mode' };
    },
    getDocument: async (documentPath) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    createDocument: async (params) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    updateDocument: async (params) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    setDocument: async (params) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    deleteDocument: async (documentPath) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    deleteCollection: async (collectionPath) => {
        return { success: false, error: 'Requires Electron mode' };
    },

    // Query
    query: async (params) => {
        return { success: false, error: 'Requires Electron mode' };
    },

    // Import/Export
    exportCollection: async (collectionPath) => {
        return { success: false, error: 'Requires Electron mode' };
    },
    importDocuments: async (collectionPath) => {
        return { success: false, error: 'Requires Electron mode' };
    },

    // Dialog
    openFileDialog: async () => {
        console.warn('[Mock] File dialog requires Electron');
        return null;
    },

    // Google Sign-In - mock (requires Electron)
    googleSignIn: async () => {
        console.warn('[Mock] Google Sign-In requires Electron mode');
        return { success: false, error: 'Google Sign-In requires Electron desktop mode. Run "npm run dev" instead of "npm run dev:vite".' };
    },
    googleSignOut: async () => {
        return { success: true };
    },
    getUserProjects: async () => {
        return { success: false, error: 'Requires Electron mode' };
    },

    // Google OAuth Firestore operations (REST API)
    googleGetCollections: async (projectId) => {
        console.warn('[Mock] googleGetCollections requires Electron mode');
        return { success: false, error: 'Requires Electron mode' };
    },
    googleGetDocuments: async (params) => {
        console.warn('[Mock] googleGetDocuments requires Electron mode');
        return { success: false, error: 'Requires Electron mode' };
    }
};

// Install mock if not running in Electron
export function initElectronMock() {
    if (!window.electronAPI) {
        console.log('Running in browser mode - using mock electronAPI');
        window.electronAPI = mockElectronAPI;
    }
}
