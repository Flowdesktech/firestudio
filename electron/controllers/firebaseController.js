/**
 * Firebase Controller
 * Handles Firebase Admin SDK connection and disconnection
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');

let admin = null;
let db = null;
let onConnectionChange = null;

function getAdmin() {
  return admin;
}
function getDb() {
  return db;
}

/**
 * Sets callback to notify when connection changes
 */
function setConnectionChangeCallback(callback) {
  onConnectionChange = callback;
}

/**
 * Registers Firebase connection IPC handlers
 */
function registerHandlers() {
  // Connect to Firebase with service account
  ipcMain.handle('firebase:connect', async (event, params) => {
    try {
      // Support both object params and legacy string path
      const serviceAccountPath = typeof params === 'string' ? params : params.serviceAccountPath;
      const databaseId = typeof params === 'string' ? undefined : params.databaseId;

      const adminSdk = require('firebase-admin');

      // Never call app().delete() unless an app exists — after a failed connect, `admin` may
      // still reference the SDK module while no default app was initialized, which throws:
      // "The default Firebase app does not exist".
      const existingApps = [...adminSdk.apps];
      for (const appInstance of existingApps) {
        try {
          await appInstance.delete();
        } catch (e) {
          void e;
        }
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      adminSdk.initializeApp({
        credential: adminSdk.credential.cert(serviceAccount),
      });

      admin = adminSdk;
      db = adminSdk.firestore();

      if (databaseId) {
        db.settings({ databaseId });
      }

      // Notify other controllers about the connection change
      if (onConnectionChange) {
        onConnectionChange(admin, db);
      }

      return { success: true, projectId: serviceAccount.project_id, databaseId };
    } catch (error) {
      admin = null;
      db = null;
      try {
        const adminSdk = require('firebase-admin');
        const leftover = [...adminSdk.apps];
        for (const appInstance of leftover) {
          try {
            await appInstance.delete();
          } catch (e) {
            void e;
          }
        }
      } catch (e2) {
        void e2;
      }
      if (onConnectionChange) {
        onConnectionChange(null, null);
      }
      return { success: false, error: error.message };
    }
  });

  // Disconnect from Firebase
  ipcMain.handle('firebase:disconnect', async () => {
    try {
      const adminSdk = admin || require('firebase-admin');
      const existingApps = [...adminSdk.apps];
      for (const appInstance of existingApps) {
        try {
          await appInstance.delete();
        } catch (e) {
          void e;
        }
      }
      admin = null;
      db = null;

      if (onConnectionChange) {
        onConnectionChange(null, null);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Open file dialog for service account
  ipcMain.handle('dialog:openFile', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });
}

module.exports = {
  registerHandlers,
  getAdmin,
  getDb,
  setConnectionChangeCallback,
};
