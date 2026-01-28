/**
 * Google OAuth Controller
 * Handles Google OAuth authentication and REST API operations
 */

// Load env first before accessing process.env
require('../utils/env');

const { ipcMain, shell, BrowserWindow } = require('electron');
const http = require('http');
const net = require('net');
const fetch = require('node-fetch');
const { convertToFirestoreValue, parseFirestoreDocument } = require('../utils/firestoreHelpers');

// OAuth Configuration (loaded after env)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET_HERE';

// State
let googleAccessToken = null;
let googleRefreshToken = null;
let activeSignInResolve = null;

function getAccessToken() { return googleAccessToken; }
function setAccessToken(token) { googleAccessToken = token; }

/**
 * Finds an available port starting from the given port
 */
function findAvailablePort(startPort = 8085) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            // Port in use, try next one
            findAvailablePort(startPort + 1).then(resolve).catch(reject);
        });
    });
}

/**
 * Registers all Google OAuth IPC handlers
 */
function registerHandlers() {
    // Sign In
    ipcMain.handle('google:signIn', async () => {
        try {
            // Find an available port dynamically
            const port = await findAvailablePort(8085);
            const redirectUri = `http://localhost:${port}/callback`;

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${GOOGLE_CLIENT_ID}` +
                `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                `&response_type=code` +
                `&scope=email%20profile%20https://www.googleapis.com/auth/firebase%20https://www.googleapis.com/auth/cloud-platform` +
                `&access_type=offline&prompt=consent`;

            return new Promise((resolve) => {
                let resolved = false;
                let server = null;

                activeSignInResolve = (result) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        try { server?.close(); } catch (e) { }
                        activeSignInResolve = null;
                        resolve(result);
                    }
                };

                const timeout = setTimeout(() => {
                    if (!resolved) activeSignInResolve({ success: false, error: 'Sign-in timed out', cancelled: true });
                }, 5 * 60 * 1000);

                server = http.createServer(async (req, res) => {
                    const url = new URL(req.url, `http://localhost:${port}`);
                    if (url.pathname === '/callback') {
                        if (url.searchParams.has('code')) {
                            const code = url.searchParams.get('code');
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end('<html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a2e;color:white"><div style="text-align:center"><h1 style="color:#4caf50">✓ Sign-in Successful!</h1><p>You can close this tab.</p></div></body></html>');

                            clearTimeout(timeout);
                            try { server.close(); } catch (e) { }
                            if (resolved) return;
                            resolved = true;

                            const mainWindow = BrowserWindow.getAllWindows()[0];
                            if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }

                            try {
                                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: new URLSearchParams({
                                        client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
                                        code, grant_type: 'authorization_code', redirect_uri: redirectUri
                                    })
                                });
                                const tokens = await tokenResponse.json();

                                if (tokens.access_token) {
                                    googleAccessToken = tokens.access_token;
                                    if (tokens.refresh_token) googleRefreshToken = tokens.refresh_token;

                                    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                                        headers: { Authorization: `Bearer ${tokens.access_token}` }
                                    });
                                    const userInfo = await userResponse.json();

                                    resolve({ success: true, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null, email: userInfo.email, name: userInfo.name });
                                } else {
                                    resolve({ success: false, error: tokens.error_description || 'Failed to get access token' });
                                }
                            } catch (err) { resolve({ success: false, error: err.message }); }
                        } else if (url.searchParams.has('error')) {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end('<html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a2e;color:white"><div style="text-align:center"><h1 style="color:#ff9800">✕ Sign-in Cancelled</h1><p>You can close this tab.</p></div></body></html>');
                            clearTimeout(timeout);
                            try { server.close(); } catch (e) { }
                            if (!resolved) { resolved = true; resolve({ success: false, error: url.searchParams.get('error_description') || 'Cancelled', cancelled: true }); }
                        }
                    }
                });

                server.listen(port, () => shell.openExternal(authUrl));
                server.on('error', (err) => {
                    clearTimeout(timeout);
                    if (!resolved) { resolved = true; resolve({ success: false, error: err.message }); }
                });
            });
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:cancelSignIn', async () => {
        if (activeSignInResolve) { activeSignInResolve({ success: false, error: 'Cancelled', cancelled: true }); return { success: true }; }
        return { success: false, error: 'No sign-in in progress' };
    });

    ipcMain.handle('google:signOut', async () => { googleAccessToken = null; googleRefreshToken = null; return { success: true }; });

    ipcMain.handle('google:refreshToken', async (event, refreshToken) => {
        try {
            if (!refreshToken) return { success: false, error: 'No refresh token' };
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' })
            });
            const tokens = await tokenResponse.json();
            if (tokens.access_token) {
                googleAccessToken = tokens.access_token;
                googleRefreshToken = refreshToken;
                const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
                const userInfo = await userResponse.json();
                return { success: true, accessToken: tokens.access_token, email: userInfo.email, name: userInfo.name };
            }
            return { success: false, error: tokens.error_description || 'Failed to refresh' };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:getUserProjects', async () => {
        try {
            if (!googleAccessToken) return { success: false, error: 'Not signed in' };
            const response = await fetch('https://firebase.googleapis.com/v1beta1/projects', { headers: { Authorization: `Bearer ${googleAccessToken}` } });
            const data = await response.json();
            if (data.results) {
                const projects = [];
                for (const p of data.results) {
                    let collections = [];
                    try {
                        const collectionsResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${p.projectId}/databases/(default)/documents:listCollectionIds`, {
                            method: 'POST', headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({})
                        });
                        const collectionsData = await collectionsResponse.json();
                        if (collectionsData.collectionIds) collections = collectionsData.collectionIds;
                    } catch (e) { }
                    projects.push({ projectId: p.projectId, displayName: p.displayName || p.projectId, collections });
                }
                return { success: true, projects };
            }
            return { success: true, projects: [] };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:getCollections', async (event, projectId) => {
        try {
            if (!googleAccessToken) return { success: false, error: 'Not signed in' };
            const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:listCollectionIds`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, collections: data.collectionIds || [] };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:getDocuments', async (event, { projectId, collectionPath, limit = 50 }) => {
        try {
            if (!googleAccessToken) return { success: false, error: 'Not signed in' };
            const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${limit}`, {
                headers: { 'Authorization': `Bearer ${googleAccessToken}` }
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            const documents = (data.documents || []).map(doc => {
                const pathParts = doc.name.split('/');
                const docId = pathParts[pathParts.length - 1];
                return { id: docId, data: parseFirestoreDocument(doc.fields || {}), path: collectionPath + '/' + docId };
            });
            return { success: true, documents };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:setDocument', async (event, { projectId, collectionPath, documentId, data }) => {
        try {
            if (!googleAccessToken) return { success: false, error: 'Not signed in' };
            const fields = {};
            for (const [key, value] of Object.entries(data)) { fields[key] = convertToFirestoreValue(value); }
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
            const response = await fetch(url, {
                method: 'PATCH', headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
            });
            const responseData = await response.json();
            if (responseData.error) return { success: false, error: responseData.error.message };
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:executeStructuredQuery', async (event, { projectId, structuredQuery }) => {
        try {
            if (!googleAccessToken) return { success: false, error: 'Not signed in' };
            const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery })
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, data };
        } catch (error) { return { success: false, error: error.message }; }
    });
}

module.exports = { registerHandlers, getAccessToken, setAccessToken };
