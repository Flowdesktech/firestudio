/// <reference types="vite/client" />

// Firestore Document Types
interface FirestoreDocument {
  id: string;
  data: Record<string, unknown>;
}

interface FirestoreCollection {
  id: string;
  path: string;
}

// Google User
interface GoogleUser {
  email: string;
  name?: string;
  picture?: string;
}

// Firebase Project
interface FirebaseProject {
  projectId: string;
  displayName?: string;
}

// Storage File
interface StorageFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  contentType?: string;
  updated?: string;
}

// Auth User
interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
  emailVerified?: boolean;
  creationTime?: string;
  lastSignInTime?: string;
}

// Query Parameters
interface GetDocumentsParams {
  collectionPath: string;
  limit?: number;
  where?: Array<{ field: string; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

interface CreateDocumentParams {
  collectionPath: string;
  documentId?: string;
  data: Record<string, unknown>;
}

interface SetDocumentParams {
  documentPath: string;
  data: Record<string, unknown>;
}

interface GoogleGetDocumentsParams {
  projectId: string;
  collectionPath: string;
  limit?: number;
  where?: Array<{ field: string; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

interface GoogleSetDocumentParams {
  projectId: string;
  collectionPath: string;
  documentId: string;
  data: Record<string, unknown>;
}

interface GoogleDeleteDocumentParams {
  projectId: string;
  collectionPath: string;
  documentId: string;
}

interface StructuredQueryParams {
  projectId: string;
  structuredQuery: Record<string, unknown>;
}

interface GoogleCountParams {
  projectId: string;
  collectionPath: string;
}

interface GoogleExportParams {
  projectId: string;
  collectionPath?: string;
}

interface JsQueryParams {
  collectionPath: string;
  jsQuery: string;
}

interface StorageListParams {
  projectId?: string;
  path?: string;
}

interface StorageFileParams {
  projectId?: string;
  storagePath?: string;
  filePath?: string;
  expiresInMs?: number;
}

interface AuthUserParams {
  projectId?: string;
  uid?: string | null;
  email?: string;
  password?: string;
  displayName?: string | null;
  disabled?: boolean;
  phoneNumber?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}

interface ListAuthUsersParams {
  projectId?: string;
  limit?: number;
  pageToken?: string;
}

interface SelectFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

interface GoogleSignInResult {
  success: boolean;
  email?: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: GoogleUser;
  error?: string;
}

interface ConnectFirebaseParams {
  serviceAccountPath: string;
  databaseId?: string;
}

interface ConnectFirebaseResult {
  success: boolean;
  projectId?: string;
  databaseId?: string;
  error?: string;
}

interface GoogleSetRefreshTokenResult {
  success: boolean;
  accessToken?: string;
  requiresReauth?: boolean;
  error?: string;
}

interface ElectronAPI {
  // Firebase
  connectFirebase: (params: ConnectFirebaseParams) => Promise<ConnectFirebaseResult>;
  disconnectFirebase: () => Promise<{ success: boolean }>;

  // Firestore
  getCollections: () => Promise<{ success: boolean; collections?: FirestoreCollection[]; error?: string }>;
  getDocuments: (
    params: GetDocumentsParams,
  ) => Promise<{ success: boolean; documents?: FirestoreDocument[]; error?: string }>;
  getDocument: (documentPath: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  createDocument: (params: CreateDocumentParams) => Promise<{ success: boolean; error?: string }>;
  updateDocument: (params: SetDocumentParams) => Promise<{ success: boolean; error?: string }>;
  setDocument: (params: SetDocumentParams) => Promise<{ success: boolean; error?: string }>;
  deleteDocument: (documentPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteCollection: (collectionPath: string) => Promise<{ success: boolean; error?: string }>;

  // Query
  query: (params: GetDocumentsParams) => Promise<{ success: boolean; documents?: FirestoreDocument[]; error?: string }>;

  // Import/Export
  exportCollection: (collectionPath: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  importDocuments: (collectionPath: string) => Promise<{ success: boolean; count?: number; error?: string }>;

  // Dialog
  openFileDialog: () => Promise<string | null>;

  // Auth
  googleSignIn: () => Promise<GoogleSignInResult>;
  googleSignOut: () => Promise<{ success: boolean }>;
  cancelGoogleSignIn?: () => Promise<{ success: boolean }>;
  getUserProjects: () => Promise<{ success: boolean; projects?: FirebaseProject[]; error?: string }>;
  googleSetRefreshToken: (refreshToken: string) => Promise<GoogleSetRefreshTokenResult>;

  // Google API
  googleGetCollections: (params: {
    projectId: string;
    parent?: string;
  }) => Promise<{ success: boolean; collections?: FirestoreCollection[]; error?: string }>;
  googleGetDocuments: (
    params: GoogleGetDocumentsParams,
  ) => Promise<{ success: boolean; documents?: FirestoreDocument[]; error?: string }>;
  googleGetDocument: (params: {
    projectId: string;
    documentPath: string;
  }) => Promise<{ success: boolean; document?: Record<string, unknown>; error?: string }>;
  googleSetDocument: (params: GoogleSetDocumentParams) => Promise<{ success: boolean; error?: string }>;
  googleDeleteDocument: (params: GoogleDeleteDocumentParams) => Promise<{ success: boolean; error?: string }>;
  googleExecuteStructuredQuery: (
    params: StructuredQueryParams,
  ) => Promise<{ success: boolean; documents?: FirestoreDocument[]; data?: unknown[]; error?: string }>;
  googleCountDocuments: (params: GoogleCountParams) => Promise<{ success: boolean; count: number; error?: string }>;
  googleExportCollection: (params: GoogleExportParams) => Promise<{
    success: boolean;
    count: number;
    documents?: Record<string, Record<string, unknown>>;
    error?: string;
  }>;
  googleExportCollections: (params: GoogleExportParams) => Promise<{
    success: boolean;
    collectionsCount: number;
    data?: Record<string, Record<string, unknown>>;
    error?: string;
  }>;
  executeJsQuery: (
    params: JsQueryParams,
  ) => Promise<{ success: boolean; result?: unknown; documents?: FirestoreDocument[]; error?: string }>;

  // Storage
  storageListFiles: (
    params: StorageListParams,
  ) => Promise<{ success: boolean; files?: StorageFile[]; items?: StorageFile[]; error?: string }>;
  storageUploadFile: (
    params: StorageFileParams,
  ) => Promise<{ success: boolean; url?: string; fileName?: string; error?: string }>;
  storageDeleteFile: (params: StorageFileParams) => Promise<{ success: boolean; error?: string }>;
  storageGetDownloadUrl: (params: StorageFileParams) => Promise<{ success: boolean; url?: string; error?: string }>;

  // Google OAuth Storage
  googleStorageListFiles: (
    params: StorageListParams & { projectId: string },
  ) => Promise<{ success: boolean; files?: StorageFile[]; items?: StorageFile[]; error?: string }>;
  googleStorageUploadFile: (
    params: StorageFileParams & { projectId: string },
  ) => Promise<{ success: boolean; url?: string; fileName?: string; error?: string }>;
  googleStorageDeleteFile: (
    params: StorageFileParams & { projectId: string },
  ) => Promise<{ success: boolean; error?: string }>;
  googleStorageGetDownloadUrl: (
    params: StorageFileParams & { projectId: string },
  ) => Promise<{ success: boolean; url?: string; error?: string }>;

  // Auth Management
  listAuthUsers: (params: ListAuthUsersParams) => Promise<{ success: boolean; users?: AuthUser[]; error?: string }>;
  createAuthUser: (params: AuthUserParams) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  updateAuthUser: (params: AuthUserParams) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  deleteAuthUser: (params: { uid: string }) => Promise<{ success: boolean; error?: string }>;

  // Google Auth Management
  googleListAuthUsers: (params: {
    projectId: string;
    maxResults?: number;
  }) => Promise<{ success: boolean; users?: AuthUser[]; error?: string }>;
  googleCreateAuthUser: (
    params: AuthUserParams & { projectId: string },
  ) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  googleUpdateAuthUser: (
    params: AuthUserParams & { projectId: string },
  ) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  googleDeleteAuthUser: (params: { projectId: string; uid: string }) => Promise<{ success: boolean; error?: string }>;

  // System
  openExternal: (url: string) => Promise<void>;
  selectFile: (options: SelectFileOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
  setNativeTheme: (theme: 'system' | 'light' | 'dark') => void;

  // Export
  exportCollections: () => Promise<{
    success: boolean;
    collectionsCount?: number;
    filePath?: string;
    error?: string;
  }>;
}

interface Window {
  electronAPI: ElectronAPI;
}
