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

// Token expiry buffer (refresh 5 minutes before actual expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// State
let googleAccessToken = null;
let googleRefreshToken = null;
let tokenExpiryTime = null; // Track when token expires
let activeSignInResolve = null;

function getAccessToken() {
  return googleAccessToken;
}
function setAccessToken(token) {
  googleAccessToken = token;
}
function getRefreshToken() {
  return googleRefreshToken;
}
function setRefreshToken(token) {
  googleRefreshToken = token;
}

/**
 * Check if token is expired or about to expire
 */
function isTokenExpired() {
  if (!tokenExpiryTime) return true;
  return Date.now() >= tokenExpiryTime - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Refresh the access token using refresh token
 */
async function refreshAccessToken() {
  if (!googleRefreshToken) {
    return { success: false, error: 'No refresh token available', requiresReauth: true };
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: googleRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.access_token) {
      googleAccessToken = tokens.access_token;
      // Set expiry time (tokens.expires_in is in seconds)
      tokenExpiryTime = Date.now() + tokens.expires_in * 1000;
      console.log('[GoogleAuth] Token refreshed successfully, expires at:', new Date(tokenExpiryTime).toISOString());
      return { success: true, accessToken: tokens.access_token };
    }

    // Check for invalid_grant error (refresh token is invalid/revoked)
    if (tokens.error === 'invalid_grant') {
      console.log('[GoogleAuth] Refresh token is invalid/revoked');
      googleAccessToken = null;
      googleRefreshToken = null;
      tokenExpiryTime = null;
      return { success: false, error: 'Session expired. Please sign in again.', requiresReauth: true };
    }

    return { success: false, error: tokens.error_description || 'Failed to refresh token', requiresReauth: true };
  } catch (error) {
    console.error('[GoogleAuth] Token refresh error:', error.message);
    return { success: false, error: error.message, requiresReauth: true };
  }
}

/**
 * Ensure we have a valid access token, refreshing if necessary
 */
async function ensureValidToken() {
  if (!googleAccessToken) {
    return { success: false, error: 'Not signed in', requiresReauth: true };
  }

  if (isTokenExpired()) {
    console.log('[GoogleAuth] Token expired or about to expire, refreshing...');
    return await refreshAccessToken();
  }

  return { success: true, accessToken: googleAccessToken };
}

/**
 * Make an authenticated API call with automatic token refresh
 */
async function authenticatedFetch(url, options = {}) {
  // First, ensure we have a valid token
  const tokenResult = await ensureValidToken();
  if (!tokenResult.success) {
    return { ok: false, error: tokenResult };
  }

  // Make the request
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${googleAccessToken}`,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  // Check for auth errors ONLY (401 = Unauthorized, not 403 which is permission denied)
  // Also check for specific auth-related error messages
  const isAuthError =
    data.error &&
    (data.error.code === 401 ||
      data.error.status === 'UNAUTHENTICATED' ||
      (data.error.message &&
        (data.error.message.includes('Request had invalid authentication credentials') ||
          data.error.message.includes('The request does not have valid authentication credentials') ||
          data.error.message.includes('Invalid Credentials') ||
          data.error.message.includes('Token has been expired or revoked'))));

  if (isAuthError) {
    console.log('[GoogleAuth] API returned auth error:', data.error.message || data.error.code);

    // Try to refresh token
    const refreshResult = await refreshAccessToken();
    if (!refreshResult.success) {
      return { ok: false, error: refreshResult };
    }

    // Retry the request with new token
    headers['Authorization'] = `Bearer ${googleAccessToken}`;
    const retryResponse = await fetch(url, { ...options, headers });
    return { ok: true, response: retryResponse, data: await retryResponse.json() };
  }

  return { ok: true, response, data };
}

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
      findAvailablePort(startPort + 1)
        .then(resolve)
        .catch(reject);
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
      const port = await findAvailablePort(8085);
      const redirectUri = `http://localhost:${port}/callback`;

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
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
            try {
              server?.close();
            } catch (error) {
              void error;
            }
            activeSignInResolve = null;
            resolve(result);
          }
        };

        const timeout = setTimeout(
          () => {
            if (!resolved) activeSignInResolve({ success: false, error: 'Sign-in timed out', cancelled: true });
          },
          5 * 60 * 1000,
        );

        server = http.createServer(async (req, res) => {
          const url = new URL(req.url, `http://localhost:${port}`);
          if (url.pathname === '/callback') {
            if (url.searchParams.has('code')) {
              const code = url.searchParams.get('code');
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(
                '<html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a2e;color:white"><div style="text-align:center"><h1 style="color:#4caf50">✓ Sign-in Successful!</h1><p>You can close this tab.</p></div></body></html>',
              );

              clearTimeout(timeout);
              try {
                server.close();
              } catch (error) {
                void error;
              }
              if (resolved) return;
              resolved = true;

              const mainWindow = BrowserWindow.getAllWindows()[0];
              if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
              }

              try {
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri,
                  }),
                });
                const tokens = await tokenResponse.json();

                if (tokens.access_token) {
                  googleAccessToken = tokens.access_token;
                  if (tokens.refresh_token) googleRefreshToken = tokens.refresh_token;
                  // Set token expiry time
                  tokenExpiryTime = Date.now() + tokens.expires_in * 1000;
                  console.log('[GoogleAuth] Signed in, token expires at:', new Date(tokenExpiryTime).toISOString());

                  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${tokens.access_token}` },
                  });
                  const userInfo = await userResponse.json();

                  resolve({
                    success: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresIn: tokens.expires_in,
                    email: userInfo.email,
                    name: userInfo.name,
                  });
                } else {
                  resolve({
                    success: false,
                    error: tokens.error_description || 'Failed to get access token',
                  });
                }
              } catch (err) {
                resolve({ success: false, error: err.message });
              }
            } else if (url.searchParams.has('error')) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(
                '<html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#1a1a2e;color:white"><div style="text-align:center"><h1 style="color:#ff9800">✕ Sign-in Cancelled</h1><p>You can close this tab.</p></div></body></html>',
              );
              clearTimeout(timeout);
              try {
                server.close();
              } catch (error) {
                void error;
              }
              if (!resolved) {
                resolved = true;
                resolve({
                  success: false,
                  error: url.searchParams.get('error_description') || 'Cancelled',
                  cancelled: true,
                });
              }
            }
          }
        });

        server.listen(port, '127.0.0.1', () => shell.openExternal(authUrl));
        server.on('error', (err) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: err.message });
          }
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('google:cancelSignIn', async () => {
    if (activeSignInResolve) {
      activeSignInResolve({ success: false, error: 'Cancelled', cancelled: true });
      return { success: true };
    }
    return { success: false, error: 'No sign-in in progress' };
  });

  ipcMain.handle('google:signOut', async () => {
    googleAccessToken = null;
    googleRefreshToken = null;
    tokenExpiryTime = null;
    return { success: true };
  });

  // Set refresh token (called from frontend on app start to restore session)
  ipcMain.handle('google:setRefreshToken', async (event, refreshToken) => {
    if (refreshToken) {
      googleRefreshToken = refreshToken;
      // Immediately try to refresh to get a new access token
      const result = await refreshAccessToken();
      if (result.success) {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        });
        const userInfo = await userResponse.json();
        return { success: true, accessToken: result.accessToken, email: userInfo.email, name: userInfo.name };
      }
      return result;
    }
    return { success: false, error: 'No refresh token provided' };
  });

  ipcMain.handle('google:refreshToken', async (event, refreshToken) => {
    try {
      if (!refreshToken && !googleRefreshToken) {
        return { success: false, error: 'No refresh token', requiresReauth: true };
      }

      if (refreshToken) googleRefreshToken = refreshToken;

      const result = await refreshAccessToken();
      if (!result.success) return result;

      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      const userInfo = await userResponse.json();
      return { success: true, accessToken: result.accessToken, email: userInfo.email, name: userInfo.name };
    } catch (error) {
      return { success: false, error: error.message, requiresReauth: true };
    }
  });

  ipcMain.handle('google:getUserProjects', async () => {
    try {
      const result = await authenticatedFetch('https://firebase.googleapis.com/v1beta1/projects');
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

      if (data.results) {
        const projects = [];
        for (const p of data.results) {
          let collections = [];
          try {
            const colResult = await authenticatedFetch(
              `https://firestore.googleapis.com/v1/projects/${p.projectId}/databases/(default)/documents:listCollectionIds`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              },
            );
            if (colResult.ok && colResult.data.collectionIds) {
              collections = colResult.data.collectionIds;
            }
          } catch (error) {
            void error;
          }
          projects.push({ projectId: p.projectId, displayName: p.displayName || p.projectId, collections });
        }
        return { success: true, projects };
      }
      return { success: true, projects: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('google:getCollections', async (event, params) => {
    try {
      const rawProjectId = typeof params === 'string' ? params : params?.projectId;
      const projectId = typeof rawProjectId === 'string' ? rawProjectId : rawProjectId?.projectId;
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid project ID' };
      }
      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:listCollectionIds`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      );
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };
      return { success: true, collections: data.collectionIds || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('google:getDocuments', async (event, { projectId, collectionPath, limit = 50 }) => {
    try {
      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${limit}`,
      );
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

      const documents = (data.documents || []).map((doc) => {
        const pathParts = doc.name.split('/');
        const docId = pathParts[pathParts.length - 1];
        return {
          id: docId,
          data: parseFirestoreDocument(doc.fields || {}),
          path: collectionPath + '/' + docId,
        };
      });
      return { success: true, documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('google:setDocument', async (event, { projectId, collectionPath, documentId, data }) => {
    try {
      const fields = {};
      for (const [key, value] of Object.entries(data)) {
        fields[key] = convertToFirestoreValue(value);
      }

      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) },
      );
      if (!result.ok) return result.error;

      const responseData = result.data;
      if (responseData.error)
        return {
          success: false,
          error: responseData.error.message,
          requiresReauth: responseData.error.code === 401,
        };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('google:executeStructuredQuery', async (event, { projectId, structuredQuery }) => {
    try {
      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery }),
        },
      );
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Count Documents using Aggregation Query
  ipcMain.handle('google:countDocuments', async (event, { projectId, collectionPath }) => {
    try {
      const structuredAggregationQuery = {
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: collectionPath }],
          },
          aggregations: [
            {
              alias: 'count',
              count: {},
            },
          ],
        },
      };

      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(structuredAggregationQuery),
        },
      );

      if (!result.ok) return result.error;

      const data = result.data;
      if (Array.isArray(data) && data.length > 0 && data[0].result?.aggregateFields?.count) {
        const countValue = data[0].result.aggregateFields.count.integerValue;
        return { success: true, count: parseInt(countValue, 10) };
      }

      // Fallback if aggregation didn't work
      return { success: false, error: 'Aggregation not supported' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete Document
  ipcMain.handle('google:deleteDocument', async (event, { projectId, collectionPath, documentId }) => {
    try {
      const result = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`,
        { method: 'DELETE' },
      );
      if (!result.ok) return result.error;

      const data = result.data;
      // DELETE returns empty response on success
      if (data && data.error) {
        return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Firebase Authentication (Identity Toolkit API)
  // ============================================

  // List Auth Users
  ipcMain.handle('google:listAuthUsers', async (event, { projectId, maxResults = 1000 }) => {
    try {
      const result = await authenticatedFetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            returnUserInfo: true,
            maxResults: maxResults,
          }),
        },
      );
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

      // Transform the response to match Firebase Admin SDK format
      const users = (data.userInfo || []).map((user) => ({
        uid: user.localId,
        email: user.email || null,
        emailVerified: user.emailVerified || false,
        displayName: user.displayName || null,
        photoURL: user.photoUrl || null,
        phoneNumber: user.phoneNumber || null,
        disabled: user.disabled || false,
        metadata: {
          creationTime: user.createdAt ? new Date(parseInt(user.createdAt)).toISOString() : null,
          lastSignInTime: user.lastLoginAt ? new Date(parseInt(user.lastLoginAt)).toISOString() : null,
          lastRefreshTime: user.lastRefreshAt ? new Date(parseInt(user.lastRefreshAt)).toISOString() : null,
        },
        providerData: (user.providerUserInfo || []).map((p) => ({
          providerId: p.providerId,
          uid: p.rawId || p.federatedId,
          displayName: p.displayName,
          email: p.email,
          photoURL: p.photoUrl,
        })),
      }));

      return { success: true, users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Create Auth User
  ipcMain.handle(
    'google:createAuthUser',
    async (event, { projectId, email, password, displayName, uid, phoneNumber, photoURL, disabled, emailVerified }) => {
      try {
        const userData = {
          email,
          password,
          returnSecureToken: false,
        };
        if (displayName) userData.displayName = displayName;
        if (uid) userData.localId = uid;
        if (phoneNumber) userData.phoneNumber = phoneNumber;
        if (photoURL) userData.photoUrl = photoURL;
        if (disabled) userData.disabled = disabled;
        if (emailVerified) userData.emailVerified = emailVerified;

        const result = await authenticatedFetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          },
        );
        if (!result.ok) return result.error;

        const data = result.data;
        if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

        return { success: true, uid: data.localId, email: data.email };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  );

  // Delete Auth User
  ipcMain.handle('google:deleteAuthUser', async (event, { projectId, uid }) => {
    try {
      const result = await authenticatedFetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localId: uid }),
        },
      );
      if (!result.ok) return result.error;

      const data = result.data;
      if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Update Auth User (enable/disable, update email, etc.)
  ipcMain.handle(
    'google:updateAuthUser',
    async (event, { projectId, uid, disabled, email, displayName, password, phoneNumber, photoURL, emailVerified }) => {
      try {
        const updateData = { localId: uid };
        if (typeof disabled === 'boolean') updateData.disableUser = disabled;
        if (email) updateData.email = email;
        if (displayName !== undefined) updateData.displayName = displayName;
        if (password) updateData.password = password;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (photoURL !== undefined) updateData.photoUrl = photoURL;
        if (typeof emailVerified === 'boolean') updateData.emailVerified = emailVerified;

        const result = await authenticatedFetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          },
        );
        if (!result.ok) return result.error;

        const data = result.data;
        if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  );

  // ============================================
  // Export Functions (Google OAuth)
  // ============================================

  // Export single collection (with pagination to get all documents)
  ipcMain.handle('google:exportCollection', async (event, { projectId, collectionPath }) => {
    try {
      const documents = {};
      let nextPageToken = null;
      const pageSize = 300; // Firestore REST API max page size

      do {
        let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;
        if (nextPageToken) {
          url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        }

        const result = await authenticatedFetch(url);
        if (!result.ok) return result.error;

        const data = result.data;
        if (data.error) return { success: false, error: data.error.message, requiresReauth: data.error.code === 401 };

        (data.documents || []).forEach((doc) => {
          const pathParts = doc.name.split('/');
          const docId = pathParts[pathParts.length - 1];
          documents[docId] = parseFirestoreDocument(doc.fields || {});
        });

        nextPageToken = data.nextPageToken || null;
      } while (nextPageToken);

      return { success: true, documents, count: Object.keys(documents).length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Export all collections (with pagination for each collection)
  ipcMain.handle('google:exportCollections', async (event, { projectId }) => {
    try {
      // First get all collection IDs
      const colResult = await authenticatedFetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:listCollectionIds`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      );
      if (!colResult.ok) return colResult.error;

      const colData = colResult.data;
      if (colData.error)
        return { success: false, error: colData.error.message, requiresReauth: colData.error.code === 401 };

      const collectionIds = colData.collectionIds || [];
      const allData = {};
      const pageSize = 300;

      // Fetch documents from each collection with pagination
      for (const collectionId of collectionIds) {
        const documents = {};
        let nextPageToken = null;

        do {
          let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=${pageSize}`;
          if (nextPageToken) {
            url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
          }

          const docsResult = await authenticatedFetch(url);
          if (docsResult.ok && !docsResult.data.error) {
            (docsResult.data.documents || []).forEach((doc) => {
              const pathParts = doc.name.split('/');
              const docId = pathParts[pathParts.length - 1];
              documents[docId] = parseFirestoreDocument(doc.fields || {});
            });
            nextPageToken = docsResult.data.nextPageToken || null;
          } else {
            nextPageToken = null;
          }
        } while (nextPageToken);

        allData[collectionId] = documents;
      }

      return { success: true, data: allData, collectionsCount: collectionIds.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerHandlers, getAccessToken, setAccessToken, getRefreshToken, setRefreshToken };
