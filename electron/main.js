const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// App version and info
const APP_VERSION = '1.0.0';
const APP_NAME = 'Firestudio';
const COMPANY_NAME = 'Flowdesk';
const SUPPORT_EMAIL = 'contact@flowdesk.tech';

// Load environment variables from .env file
// In development: reads from project root
// In production: reads from resources folder (bundled with app)
function loadEnvFile() {
    const envPaths = [
        path.join(__dirname, '../.env'),                                    // Development
        path.join(__dirname, '../../.env'),                                 // Production (app.asar)
        path.join(process.resourcesPath || '', '.env'),                     // Production (resources folder)
        path.join(app.getPath('exe'), '..', '.env'),                        // Next to exe
        path.join(app.getAppPath(), '.env'),                                // App path
    ];

    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            try {
                require('dotenv').config({ path: envPath });
                console.log('Loaded .env from:', envPath);
                return true;
            } catch (e) {
                // Continue trying other paths
            }
        }
    }

    console.log('.env file not found, using environment variables or defaults');
    return false;
}

loadEnvFile();

// Firebase Admin SDK
let admin = null;
let db = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'default',
        icon: path.join(__dirname, '../assets/icon.png')
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    return mainWindow;
}

app.whenReady().then(() => {
    // Create custom menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Add Firebase Project',
                    accelerator: 'CmdOrCtrl+N',
                    click: async () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) {
                            win.webContents.send('open-add-project-dialog');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: async () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) {
                            win.webContents.send('open-settings-dialog');
                        }
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: async () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox({
                            type: 'info',
                            title: `About ${APP_NAME}`,
                            message: APP_NAME,
                            detail: `Version: ${APP_VERSION}\n\n© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.\n\nA powerful Firebase GUI client for managing Firestore, Storage, and Authentication.`,
                            buttons: ['OK']
                        });
                    }
                },
                {
                    label: 'Contact Support',
                    click: async () => {
                        shell.openExternal(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(APP_NAME + ' Support')}`);
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers for Firebase operations

// Connect to Firebase with service account
ipcMain.handle('firebase:connect', async (event, serviceAccountPath) => {
    try {
        if (admin) {
            await admin.app().delete();
        }

        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin = require('firebase-admin');

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();

        return { success: true, projectId: serviceAccount.project_id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Disconnect from Firebase
ipcMain.handle('firebase:disconnect', async () => {
    try {
        if (admin) {
            await admin.app().delete();
            admin = null;
            db = null;
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get all collections
ipcMain.handle('firestore:getCollections', async () => {
    try {
        if (!db) throw new Error('Not connected to Firebase');
        const collections = await db.listCollections();
        return {
            success: true,
            collections: collections.map(col => col.id)
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get documents from a collection with pagination
ipcMain.handle('firestore:getDocuments', async (event, { collectionPath, limit = 50, startAfter = null }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        let query = db.collection(collectionPath).limit(limit);

        if (startAfter) {
            const startDoc = await db.collection(collectionPath).doc(startAfter).get();
            if (startDoc.exists) {
                query = query.startAfter(startDoc);
            }
        }

        const snapshot = await query.get();
        const documents = [];

        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                data: doc.data(),
                path: doc.ref.path
            });
        });

        return { success: true, documents };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get a single document
ipcMain.handle('firestore:getDocument', async (event, documentPath) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        const doc = await db.doc(documentPath).get();

        if (!doc.exists) {
            return { success: false, error: 'Document not found' };
        }

        // Get subcollections
        const subcollections = await doc.ref.listCollections();

        return {
            success: true,
            document: {
                id: doc.id,
                data: doc.data(),
                path: doc.ref.path,
                subcollections: subcollections.map(col => col.id)
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new document
ipcMain.handle('firestore:createDocument', async (event, { collectionPath, documentId, data }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        const docRef = documentId
            ? db.collection(collectionPath).doc(documentId)
            : db.collection(collectionPath).doc();

        await docRef.set(data);

        return { success: true, documentId: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Update a document
ipcMain.handle('firestore:updateDocument', async (event, { documentPath, data }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        await db.doc(documentPath).update(data);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Set a document (overwrite)
ipcMain.handle('firestore:setDocument', async (event, { documentPath, data }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        await db.doc(documentPath).set(data);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a document
ipcMain.handle('firestore:deleteDocument', async (event, documentPath) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        await db.doc(documentPath).delete();

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Run a query
ipcMain.handle('firestore:query', async (event, { collectionPath, queries, orderBy, limit = 50 }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        let query = db.collection(collectionPath);

        // Apply where clauses
        if (queries && queries.length > 0) {
            for (const q of queries) {
                query = query.where(q.field, q.operator, q.value);
            }
        }

        // Apply orderBy
        if (orderBy) {
            query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
        }

        // Apply limit
        query = query.limit(limit);

        const snapshot = await query.get();
        const documents = [];

        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                data: doc.data(),
                path: doc.ref.path
            });
        });

        return { success: true, documents };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Export collection to JSON
ipcMain.handle('firestore:exportCollection', async (event, collectionPath) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        const snapshot = await db.collection(collectionPath).get();
        const documents = {};

        snapshot.forEach(doc => {
            documents[doc.id] = doc.data();
        });

        const { filePath } = await dialog.showSaveDialog({
            defaultPath: `${collectionPath.replace(/\//g, '_')}_export.json`,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
            return { success: true, filePath };
        }

        return { success: false, error: 'Export cancelled' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Import documents from JSON
ipcMain.handle('firestore:importDocuments', async (event, collectionPath) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        const { filePaths } = await dialog.showOpenDialog({
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (filePaths && filePaths.length > 0) {
            const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            const batch = db.batch();
            let count = 0;

            for (const [docId, docData] of Object.entries(data)) {
                const docRef = db.collection(collectionPath).doc(docId);
                batch.set(docRef, docData);
                count++;

                // Firestore batch limit is 500
                if (count >= 500) {
                    await batch.commit();
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
            }

            return { success: true, count: Object.keys(data).length };
        }

        return { success: false, error: 'Import cancelled' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Open file dialog for service account
ipcMain.handle('dialog:openFile', async () => {
    const { filePaths } = await dialog.showOpenDialog({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
});

// Execute a JS Query
ipcMain.handle('firestore:executeJsQuery', async (event, { collectionPath, jsQuery }) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        // Extract the function body from the JS query
        // The query should be in the format: async function run() { ... return query; }

        // Create a sandboxed execution context with db available
        const vm = require('vm');

        // Wrap the query in a self-executing async function
        const wrappedCode = `
            (async () => {
                ${jsQuery}
                return await run();
            })()
        `;

        // Create a context with db available
        const context = vm.createContext({
            db: db,
            console: console,
            Date: Date,
            JSON: JSON,
            Math: Math,
            Array: Array,
            Object: Object,
            String: String,
            Number: Number,
            Boolean: Boolean,
            Promise: Promise,
        });

        // Execute the query
        const script = new vm.Script(wrappedCode);
        const queryResult = await script.runInContext(context, { timeout: 30000 });

        // Process the result - it should be a QuerySnapshot
        const documents = [];

        if (queryResult && queryResult.forEach) {
            // It's a QuerySnapshot
            queryResult.forEach(doc => {
                documents.push({
                    id: doc.id,
                    data: doc.data(),
                    path: doc.ref.path
                });
            });
        } else if (queryResult && queryResult.docs) {
            // It's a QuerySnapshot with docs array
            queryResult.docs.forEach(doc => {
                documents.push({
                    id: doc.id,
                    data: doc.data(),
                    path: doc.ref.path
                });
            });
        } else if (queryResult && queryResult.exists !== undefined) {
            // It's a single DocumentSnapshot
            if (queryResult.exists) {
                documents.push({
                    id: queryResult.id,
                    data: queryResult.data(),
                    path: queryResult.ref.path
                });
            }
        }

        return { success: true, documents };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete all documents in a collection
ipcMain.handle('firestore:deleteCollection', async (event, collectionPath) => {
    try {
        if (!db) throw new Error('Not connected to Firebase');

        const collectionRef = db.collection(collectionPath);
        const snapshot = await collectionRef.get();

        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
        }

        return { success: true, count };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Google OAuth configuration
// Production credentials (bundled with the app)
// Development can override via .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET_HERE';
let googleAccessToken = null;
let googleRefreshToken = null;

// Google Sign-In using OAuth
ipcMain.handle('google:signIn', async (event) => {
    try {
        const { BrowserWindow } = require('electron');

        // Create OAuth URL
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${GOOGLE_CLIENT_ID}` +
            `&redirect_uri=http://localhost:8085/callback` +
            `&response_type=code` +
            `&scope=email%20profile%20https://www.googleapis.com/auth/firebase%20https://www.googleapis.com/auth/cloud-platform` +
            `&access_type=offline` +
            `&prompt=consent`;

        // Create auth window
        const authWindow = new BrowserWindow({
            width: 500,
            height: 700,
            show: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // Start local server to handle callback
        const http = require('http');

        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const url = new URL(req.url, 'http://localhost:8085');

                if (url.pathname === '/callback' && url.searchParams.has('code')) {
                    const code = url.searchParams.get('code');

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>Sign-in successful!</h1><p>You can close this window.</p><script>window.close();</script></body></html>');

                    server.close();
                    authWindow.close();

                    try {
                        // Exchange code for tokens
                        const fetch = require('node-fetch');
                        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                client_id: GOOGLE_CLIENT_ID,
                                client_secret: GOOGLE_CLIENT_SECRET,
                                code: code,
                                grant_type: 'authorization_code',
                                redirect_uri: 'http://localhost:8085/callback'
                            })
                        });

                        const tokens = await tokenResponse.json();

                        if (tokens.access_token) {
                            googleAccessToken = tokens.access_token;
                            // Save refresh token if provided
                            if (tokens.refresh_token) {
                                googleRefreshToken = tokens.refresh_token;
                            }

                            // Get user info
                            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                                headers: { Authorization: `Bearer ${tokens.access_token}` }
                            });
                            const userInfo = await userResponse.json();

                            resolve({
                                success: true,
                                accessToken: tokens.access_token,
                                refreshToken: tokens.refresh_token || null,
                                email: userInfo.email,
                                name: userInfo.name
                            });
                        } else {
                            resolve({ success: false, error: 'Failed to get access token' });
                        }
                    } catch (err) {
                        resolve({ success: false, error: err.message });
                    }
                }
            });

            server.listen(8085, () => {
                authWindow.loadURL(authUrl);
            });

            authWindow.on('closed', () => {
                server.close();
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Google Sign-Out
ipcMain.handle('google:signOut', async () => {
    googleAccessToken = null;
    googleRefreshToken = null;
    return { success: true };
});

// Refresh access token using refresh token
ipcMain.handle('google:refreshToken', async (event, refreshToken) => {
    try {
        if (!refreshToken) {
            return { success: false, error: 'No refresh token provided' };
        }

        const fetch = require('node-fetch');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.access_token) {
            googleAccessToken = tokens.access_token;
            googleRefreshToken = refreshToken; // Keep the same refresh token

            // Get user info
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const userInfo = await userResponse.json();

            return {
                success: true,
                accessToken: tokens.access_token,
                email: userInfo.email,
                name: userInfo.name
            };
        } else {
            return { success: false, error: tokens.error_description || 'Failed to refresh token' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get user's Firebase projects
ipcMain.handle('google:getUserProjects', async () => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in' };
        }

        const fetch = require('node-fetch');

        // Get Firebase projects
        const response = await fetch('https://firebase.googleapis.com/v1beta1/projects', {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });

        const data = await response.json();

        if (data.results) {
            // For each project, try to get collections
            const projects = [];
            for (const p of data.results) {
                // Try to get collections for this project using REST API
                let collections = [];
                try {
                    const collectionsResponse = await fetch(
                        `https://firestore.googleapis.com/v1/projects/${p.projectId}/databases/(default)/documents:listCollectionIds`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${googleAccessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({})
                        }
                    );
                    const collectionsData = await collectionsResponse.json();
                    if (collectionsData.collectionIds) {
                        collections = collectionsData.collectionIds;
                    }
                } catch (e) {
                    console.log(`Could not get collections for ${p.projectId}:`, e.message);
                }

                projects.push({
                    projectId: p.projectId,
                    displayName: p.displayName || p.projectId,
                    collections: collections
                });
            }

            return { success: true, projects };
        }

        return { success: true, projects: [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get collections for a specific project using OAuth (REST API)
ipcMain.handle('google:getCollections', async (event, projectId) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');
        const response = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:listCollectionIds`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            }
        );

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return {
            success: true,
            collections: data.collectionIds || []
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get documents from a collection using OAuth (REST API)
ipcMain.handle('google:getDocuments', async (event, { projectId, collectionPath, limit = 50 }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        // Build the parent path
        const parentPath = collectionPath.includes('/')
            ? collectionPath.split('/').slice(0, -1).join('/')
            : '';
        const collectionId = collectionPath.split('/').pop();

        const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${limit}`;

        const response = await fetch(queryUrl, {
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`
            }
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        // Parse Firestore REST API response format
        const documents = (data.documents || []).map(doc => {
            const pathParts = doc.name.split('/');
            const docId = pathParts[pathParts.length - 1];
            return {
                id: docId,
                data: parseFirestoreDocument(doc.fields || {}),
                path: collectionPath + '/' + docId
            };
        });

        return { success: true, documents };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Helper function to parse Firestore REST API document format
function parseFirestoreDocument(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields)) {
        result[key] = parseFirestoreValue(value);
    }
    return result;
}

// ============================================
// Firebase Storage Operations
// ============================================

let bucket = null;

// Initialize storage bucket
function initializeStorage(projectId) {
    if (admin && admin.apps.length > 0) {
        bucket = admin.storage().bucket(`${projectId}.appspot.com`);
        return bucket;
    }
    return null;
}

// List files in a storage path
ipcMain.handle('storage:listFiles', async (event, { path = '' }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        const prefix = path ? (path.endsWith('/') ? path : path + '/') : '';

        const [files] = await bucket.getFiles({
            prefix: prefix,
            delimiter: '/',
            autoPaginate: false
        });

        // Get folders (prefixes)
        const [, , apiResponse] = await bucket.getFiles({
            prefix: prefix,
            delimiter: '/',
            autoPaginate: false
        });

        const folders = (apiResponse?.prefixes || []).map(p => ({
            name: p.replace(prefix, '').replace(/\/$/, ''),
            path: p,
            type: 'folder',
            size: 0,
            updated: null
        }));

        // Get files (excluding the current folder itself)
        const fileList = files
            .filter(f => f.name !== prefix && !f.name.endsWith('/'))
            .map(f => ({
                name: f.name.replace(prefix, ''),
                path: f.name,
                type: 'file',
                size: parseInt(f.metadata.size || 0, 10),
                contentType: f.metadata.contentType || 'application/octet-stream',
                updated: f.metadata.updated || null,
                generation: f.metadata.generation
            }));

        return {
            success: true,
            items: [...folders, ...fileList],
            currentPath: path
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Upload a file to storage
ipcMain.handle('storage:uploadFile', async (event, { storagePath }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const { filePaths } = await dialog.showOpenDialog({
            properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) {
            return { success: false, error: 'No file selected' };
        }

        const localPath = filePaths[0];
        const fileName = path.basename(localPath);
        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        const destination = storagePath ? `${storagePath}/${fileName}` : fileName;

        await bucket.upload(localPath, {
            destination: destination,
            metadata: {
                contentType: require('mime-types').lookup(localPath) || 'application/octet-stream'
            }
        });

        return { success: true, fileName, path: destination };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Download a file from storage
ipcMain.handle('storage:downloadFile', async (event, { filePath }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const fileName = filePath.split('/').pop();
        const { filePath: savePath } = await dialog.showSaveDialog({
            defaultPath: fileName
        });

        if (!savePath) {
            return { success: false, error: 'No save location selected' };
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        await bucket.file(filePath).download({ destination: savePath });

        return { success: true, savedTo: savePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get download URL for a file
ipcMain.handle('storage:getDownloadUrl', async (event, { filePath, expiresInMs }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);
        const file = bucket.file(filePath);

        // Default to 7 days if not specified
        const expiration = expiresInMs || (7 * 24 * 60 * 60 * 1000);

        // Calculate expiration date
        const expiresDate = new Date(Date.now() + expiration);
        // Format as MM-DD-YYYY for the API
        const expiresString = `${String(expiresDate.getMonth() + 1).padStart(2, '0')}-${String(expiresDate.getDate()).padStart(2, '0')}-${expiresDate.getFullYear()}`;

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: expiresString
        });

        return { success: true, url };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a file from storage
ipcMain.handle('storage:deleteFile', async (event, { filePath }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        await bucket.file(filePath).delete();

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a folder in storage (creates a placeholder file)
ipcMain.handle('storage:createFolder', async (event, { folderPath }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        // Create an empty placeholder file to represent the folder
        const placeholderPath = folderPath.endsWith('/') ? folderPath + '.placeholder' : folderPath + '/.placeholder';

        await bucket.file(placeholderPath).save('', {
            metadata: { contentType: 'application/x-empty' }
        });

        return { success: true, folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get file metadata
ipcMain.handle('storage:getFileMetadata', async (event, { filePath }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const projectId = admin.app().options.credential?.projectId || admin.app().options.projectId;
        const bucket = admin.storage().bucket(`${projectId}.appspot.com`);

        const [metadata] = await bucket.file(filePath).getMetadata();

        return {
            success: true,
            metadata: {
                name: metadata.name,
                size: parseInt(metadata.size || 0, 10),
                contentType: metadata.contentType,
                created: metadata.timeCreated,
                updated: metadata.updated,
                generation: metadata.generation,
                md5Hash: metadata.md5Hash
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================
// Google OAuth Storage Operations (REST API)
// ============================================

// List files using Google OAuth
ipcMain.handle('google:storageListFiles', async (event, { projectId, path = '' }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');
        const bucketName = `${projectId}.appspot.com`;
        const prefix = path ? (path.endsWith('/') ? path : path + '/') : '';

        const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?` +
            `prefix=${encodeURIComponent(prefix)}&delimiter=/`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        // Parse folders (prefixes)
        const folders = (data.prefixes || []).map(p => ({
            name: p.replace(prefix, '').replace(/\/$/, ''),
            path: p,
            type: 'folder',
            size: 0,
            updated: null
        }));

        // Parse files
        const files = (data.items || [])
            .filter(f => f.name !== prefix && !f.name.endsWith('/'))
            .map(f => ({
                name: f.name.replace(prefix, ''),
                path: f.name,
                type: 'file',
                size: parseInt(f.size || 0, 10),
                contentType: f.contentType || 'application/octet-stream',
                updated: f.updated || null,
                generation: f.generation
            }));

        return {
            success: true,
            items: [...folders, ...files],
            currentPath: path
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Upload file using Google OAuth
ipcMain.handle('google:storageUploadFile', async (event, { projectId, storagePath }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const { filePaths } = await dialog.showOpenDialog({
            properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) {
            return { success: false, error: 'No file selected' };
        }

        const localPath = filePaths[0];
        const fileName = path.basename(localPath);
        const fileContent = fs.readFileSync(localPath);
        const mimeType = require('mime-types').lookup(localPath) || 'application/octet-stream';

        const bucketName = `${projectId}.appspot.com`;
        const destination = storagePath ? `${storagePath}/${fileName}` : fileName;

        const fetch = require('node-fetch');
        const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?` +
            `uploadType=media&name=${encodeURIComponent(destination)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': mimeType
            },
            body: fileContent
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, fileName, path: destination };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Download file using Google OAuth
ipcMain.handle('google:storageDownloadFile', async (event, { projectId, filePath }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fileName = filePath.split('/').pop();
        const { filePath: savePath } = await dialog.showSaveDialog({
            defaultPath: fileName
        });

        if (!savePath) {
            return { success: false, error: 'No save location selected' };
        }

        const bucketName = `${projectId}.appspot.com`;
        const fetch = require('node-fetch');
        const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, error: errorData.error?.message || 'Download failed' };
        }

        const buffer = await response.buffer();
        fs.writeFileSync(savePath, buffer);

        return { success: true, savedTo: savePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get download URL using Google OAuth - generates signed URL
ipcMain.handle('google:storageGetDownloadUrl', async (event, { projectId, filePath, expiresInMs }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');
        const crypto = require('crypto');
        const bucketName = `${projectId}.appspot.com`;

        // Calculate expiration (default 7 days)
        const expiration = expiresInMs || (7 * 24 * 60 * 60 * 1000);
        const expiresDate = new Date(Date.now() + expiration);

        // First, try to get the service account email for the project
        // The default compute service account is: firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com
        const serviceAccountEmail = `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`;

        // Build the string to sign for V4 signed URL
        const expiration_timestamp = Math.floor(expiresDate.getTime() / 1000);
        const credential_scope = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/auto/storage/goog4_request`;

        // For simplicity, use V2 signed URL format which is easier to construct
        const stringToSign = [
            'GET',
            '', // Content-MD5 (empty)
            '', // Content-Type (empty)
            expiration_timestamp.toString(),
            `/${bucketName}/${filePath}`
        ].join('\n');

        // Use IAM signBlob API to sign the string
        const signBlobUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:signBlob`;

        const signResponse = await fetch(signBlobUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                payload: Buffer.from(stringToSign).toString('base64')
            })
        });

        const signData = await signResponse.json();

        if (signData.error) {
            // Fallback: Return Firebase download URL with token if signing fails
            const metadataUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}`;
            const metadataResponse = await fetch(metadataUrl, {
                headers: { 'Authorization': `Bearer ${googleAccessToken}` }
            });
            const metadata = await metadataResponse.json();

            if (metadata.downloadTokens) {
                const token = metadata.downloadTokens.split(',')[0];
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
                return {
                    success: true,
                    url: downloadUrl,
                    note: 'Using Firebase download token. For signed URLs with custom expiration, use Service Account.'
                };
            }

            return { success: false, error: signData.error.message || 'Failed to sign URL. Try using Service Account for signed URLs.' };
        }

        // Build the signed URL
        const signature = signData.signedBlob;
        const signedUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(filePath)}?` +
            `GoogleAccessId=${encodeURIComponent(serviceAccountEmail)}` +
            `&Expires=${expiration_timestamp}` +
            `&Signature=${encodeURIComponent(signature)}`;

        return { success: true, url: signedUrl };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete file using Google OAuth
ipcMain.handle('google:storageDeleteFile', async (event, { projectId, filePath }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const bucketName = `${projectId}.appspot.com`;
        const fetch = require('node-fetch');
        const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(filePath)}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });

        if (!response.ok && response.status !== 204) {
            const errorData = await response.json();
            return { success: false, error: errorData.error?.message || 'Delete failed' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create folder using Google OAuth
ipcMain.handle('google:storageCreateFolder', async (event, { projectId, folderPath }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const bucketName = `${projectId}.appspot.com`;
        const placeholderPath = folderPath.endsWith('/') ? folderPath + '.placeholder' : folderPath + '/.placeholder';

        const fetch = require('node-fetch');
        const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?` +
            `uploadType=media&name=${encodeURIComponent(placeholderPath)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/x-empty'
            },
            body: ''
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================
// Firebase Authentication Operations
// ============================================

// List all auth users
ipcMain.handle('auth:listUsers', async (event, { maxResults = 1000 } = {}) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const listUsersResult = await admin.auth().listUsers(maxResults);
        const users = listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            disabled: user.disabled,
            metadata: {
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime
            },
            providerData: user.providerData.map(p => ({
                providerId: p.providerId,
                uid: p.uid,
                email: p.email,
                displayName: p.displayName,
                photoURL: p.photoURL,
                phoneNumber: p.phoneNumber
            }))
        }));

        return { success: true, users };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new auth user
ipcMain.handle('auth:createUser', async (event, { email, password, displayName, phoneNumber }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || undefined,
            phoneNumber: phoneNumber || undefined
        });

        return {
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Update an auth user
ipcMain.handle('auth:updateUser', async (event, { uid, email, password, displayName, phoneNumber, disabled }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const updateData = {};
        if (email !== undefined) updateData.email = email;
        if (password !== undefined) updateData.password = password;
        if (displayName !== undefined) updateData.displayName = displayName;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (disabled !== undefined) updateData.disabled = disabled;

        const userRecord = await admin.auth().updateUser(uid, updateData);

        return {
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                disabled: userRecord.disabled
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete an auth user
ipcMain.handle('auth:deleteUser', async (event, { uid }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        await admin.auth().deleteUser(uid);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get a single auth user
ipcMain.handle('auth:getUser', async (event, { uid }) => {
    try {
        if (!admin || !admin.apps.length) {
            throw new Error('Not connected to Firebase');
        }

        const userRecord = await admin.auth().getUser(uid);

        return {
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                emailVerified: userRecord.emailVerified,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                phoneNumber: userRecord.phoneNumber,
                disabled: userRecord.disabled,
                metadata: {
                    creationTime: userRecord.metadata.creationTime,
                    lastSignInTime: userRecord.metadata.lastSignInTime
                },
                providerData: userRecord.providerData
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================
// Google OAuth Authentication Operations (REST API)
// ============================================

// List auth users using Google OAuth (Identity Platform API)
ipcMain.handle('google:listAuthUsers', async (event, { projectId, maxResults = 1000 }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        // Use Identity Toolkit API to list users
        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                maxResults: maxResults
            })
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        // Transform the response to match our expected format
        const users = (data.users || []).map(user => ({
            uid: user.localId,
            email: user.email || null,
            emailVerified: user.emailVerified || false,
            displayName: user.displayName || null,
            photoURL: user.photoUrl || null,
            phoneNumber: user.phoneNumber || null,
            disabled: user.disabled || false,
            metadata: {
                creationTime: user.createdAt ? new Date(parseInt(user.createdAt)).toISOString() : null,
                lastSignInTime: user.lastLoginAt ? new Date(parseInt(user.lastLoginAt)).toISOString() : null
            },
            providerData: (user.providerUserInfo || []).map(p => ({
                providerId: p.providerId,
                uid: p.rawId,
                email: p.email,
                displayName: p.displayName,
                photoURL: p.photoUrl,
                phoneNumber: p.phoneNumber
            }))
        }));

        return { success: true, users };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create auth user using Google OAuth
ipcMain.handle('google:createAuthUser', async (event, { projectId, email, password, displayName }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                displayName: displayName || undefined
            })
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return {
            success: true,
            user: {
                uid: data.localId,
                email: data.email,
                displayName: data.displayName
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Update auth user using Google OAuth
ipcMain.handle('google:updateAuthUser', async (event, { projectId, uid, email, password, displayName, disabled }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;

        const updateData = { localId: uid };
        if (email !== undefined) updateData.email = email;
        if (password !== undefined) updateData.password = password;
        if (displayName !== undefined) updateData.displayName = displayName;
        if (disabled !== undefined) updateData.disableUser = disabled;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return {
            success: true,
            user: {
                uid: data.localId,
                email: data.email,
                displayName: data.displayName,
                disabled: data.disabled
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete auth user using Google OAuth
ipcMain.handle('google:deleteAuthUser', async (event, { projectId, uid }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                localId: uid
            })
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Execute a structured query via REST API (for Google OAuth JS Query)
ipcMain.handle('google:executeStructuredQuery', async (event, { projectId, structuredQuery }) => {
    try {
        if (!googleAccessToken) {
            return { success: false, error: 'Not signed in with Google' };
        }

        const fetch = require('node-fetch');

        const response = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ structuredQuery })
            }
        );

        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Helper function to parse Firestore REST API value format
function parseFirestoreValue(value) {
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.nullValue !== undefined) return null;
    if (value.timestampValue !== undefined) {
        const date = new Date(value.timestampValue);
        return { _seconds: Math.floor(date.getTime() / 1000), _nanoseconds: 0 };
    }
    if (value.geoPointValue !== undefined) {
        return {
            _latitude: value.geoPointValue.latitude,
            _longitude: value.geoPointValue.longitude
        };
    }
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }
    if (value.mapValue !== undefined) {
        return parseFirestoreDocument(value.mapValue.fields || {});
    }
    if (value.referenceValue !== undefined) {
        return value.referenceValue;
    }
    return value;
}
