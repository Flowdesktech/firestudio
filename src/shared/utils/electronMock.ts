// Mock electronAPI for browser development mode
// This allows basic testing when not running in Electron

const mockElectronAPI: ElectronAPI = {
  // Firebase connection - mock
  connectFirebase: async (_params: ConnectFirebaseParams) => {
    console.warn('[Mock] connectFirebase called in browser mode');
    return {
      success: false,
      error: 'Service Account connection requires Electron. Run "pnpm run dev" for full functionality.',
    };
  },
  disconnectFirebase: async () => {
    return { success: true };
  },

  // Firestore operations - mock
  getCollections: async () => {
    console.warn('[Mock] getCollections called in browser mode');
    return { success: false, error: 'Requires Electron mode' };
  },
  getDocuments: async (_params: GetDocumentsParams) => {
    console.warn('[Mock] getDocuments called in browser mode');
    return { success: false, error: 'Requires Electron mode' };
  },
  getDocument: async (_documentPath: string) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  createDocument: async (_params: CreateDocumentParams) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  updateDocument: async (_params: SetDocumentParams) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  setDocument: async (_params: SetDocumentParams) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  deleteDocument: async (_documentPath: string) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  deleteCollection: async (_collectionPath: string) => {
    return { success: false, error: 'Requires Electron mode' };
  },

  // Query
  query: async (_params: GetDocumentsParams) => {
    return { success: false, error: 'Requires Electron mode' };
  },

  // Import/Export
  exportCollection: async (_collectionPath: string) => {
    return { success: false, error: 'Requires Electron mode' };
  },
  importDocuments: async (_collectionPath: string) => {
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
    return {
      success: false,
      error: 'Google Sign-In requires Electron desktop mode. Run "pnpm run dev" instead of "pnpm run dev:vite".',
    };
  },
  googleSignOut: async () => {
    return { success: true };
  },
  getUserProjects: async () => {
    return { success: false, error: 'Requires Electron mode' };
  },
  googleSetRefreshToken: async (_refreshToken: string) => {
    console.warn('[Mock] googleSetRefreshToken');
    return { success: false, error: 'Requires Electron mode' };
  },

  // Google OAuth Firestore operations (REST API)
  googleGetCollections: async (_params: { projectId: string; parent?: string }) => {
    console.warn('[Mock] googleGetCollections requires Electron mode');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleGetDocuments: async (_params: GoogleGetDocumentsParams) => {
    console.warn('[Mock] googleGetDocuments requires Electron mode');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleGetDocument: async (_params: { projectId: string; documentPath: string }) => {
    console.warn('[Mock] googleGetDocument requires Electron mode');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleExecuteStructuredQuery: async (_params: StructuredQueryParams) => {
    console.warn('[Mock] googleExecuteStructuredQuery');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleSetDocument: async (_params: GoogleSetDocumentParams) => {
    console.warn('[Mock] googleSetDocument');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleDeleteDocument: async (_params: GoogleDeleteDocumentParams) => {
    console.warn('[Mock] googleDeleteDocument');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleCountDocuments: async (_params: GoogleCountParams) => {
    console.warn('[Mock] googleCountDocuments');
    return { success: false, count: 0, error: 'Requires Electron mode' };
  },
  googleExportCollection: async (_params: GoogleExportParams) => {
    console.warn('[Mock] googleExportCollection');
    return { success: false, count: 0, error: 'Requires Electron mode' };
  },
  googleExportCollections: async (_params: GoogleExportParams) => {
    console.warn('[Mock] googleExportCollections');
    return { success: false, collectionsCount: 0, error: 'Requires Electron mode' };
  },
  executeJsQuery: async (_params: JsQueryParams) => {
    console.warn('[Mock] executeJsQuery');
    return { success: false, error: 'Requires Electron mode' };
  },

  // Storage
  storageListFiles: async (_params: StorageListParams) => {
    console.warn('[Mock] storageListFiles');
    return { success: false, error: 'Requires Electron mode' };
  },
  storageUploadFile: async (_params: StorageFileParams) => {
    console.warn('[Mock] storageUploadFile');
    return { success: false, error: 'Requires Electron mode' };
  },
  storageDeleteFile: async (_params: StorageFileParams) => {
    console.warn('[Mock] storageDeleteFile');
    return { success: false, error: 'Requires Electron mode' };
  },
  storageGetDownloadUrl: async (_params: StorageFileParams) => {
    console.warn('[Mock] storageGetDownloadUrl');
    return { success: false, error: 'Requires Electron mode' };
  },

  // Google OAuth Storage
  googleStorageListFiles: async (_params: StorageListParams & { projectId: string }) => {
    console.warn('[Mock] googleStorageListFiles');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleStorageUploadFile: async (_params: StorageFileParams & { projectId: string }) => {
    console.warn('[Mock] googleStorageUploadFile');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleStorageDeleteFile: async (_params: StorageFileParams & { projectId: string }) => {
    console.warn('[Mock] googleStorageDeleteFile');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleStorageGetDownloadUrl: async (_params: StorageFileParams & { projectId: string }) => {
    console.warn('[Mock] googleStorageGetDownloadUrl');
    return { success: false, error: 'Requires Electron mode' };
  },

  // Auth
  listAuthUsers: async (_params: ListAuthUsersParams) => {
    console.warn('[Mock] listAuthUsers');
    return { success: false, error: 'Requires Electron mode' };
  },
  createAuthUser: async (_params: AuthUserParams) => {
    console.warn('[Mock] createAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },
  updateAuthUser: async (_params: AuthUserParams) => {
    console.warn('[Mock] updateAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },
  deleteAuthUser: async (_params: { uid: string }) => {
    console.warn('[Mock] deleteAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },

  // Google Auth Management
  googleListAuthUsers: async (_params: { projectId: string; maxResults?: number }) => {
    console.warn('[Mock] googleListAuthUsers');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleCreateAuthUser: async (_params: AuthUserParams & { projectId: string }) => {
    console.warn('[Mock] googleCreateAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleUpdateAuthUser: async (_params: AuthUserParams & { projectId: string }) => {
    console.warn('[Mock] googleUpdateAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },
  googleDeleteAuthUser: async (_params: { projectId: string; uid: string }) => {
    console.warn('[Mock] googleDeleteAuthUser');
    return { success: false, error: 'Requires Electron mode' };
  },

  // System
  openExternal: async (url: string) => {
    console.log('[Mock] openExternal:', url);
  },
  selectFile: async (_options: SelectFileOptions) => {
    console.warn('[Mock] selectFile');
    return { canceled: true, filePaths: [] };
  },
  setNativeTheme: (theme: 'system' | 'light' | 'dark') => {
    console.log('[Mock] setNativeTheme:', theme);
  },
  exportCollections: async () => {
    console.warn('[Mock] exportCollections');
    return { success: false, error: 'Requires Electron mode' };
  },
};

// Install mock if not running in Electron
export function initElectronMock() {
  if (!window.electronAPI) {
    console.log('Running in browser mode - using mock electronAPI');
    window.electronAPI = mockElectronAPI;
  }
}
