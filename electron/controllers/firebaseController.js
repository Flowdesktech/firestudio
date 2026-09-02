/**
 * Firebase Controller
 * Handles Firebase Admin SDK connection and disconnection
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const { getFirestore } = require('firebase-admin/firestore');

let admin = null;
let db = null;
let onConnectionChange = null;
let currentAuthEmulatorHost = null;
let currentStorageEmulatorHost = null;

/**
 * Firebase Admin v14 uses modular service functions instead of the legacy
 * namespace methods (`apps`, `firestore()`, `auth()`, and `storage()`). Keep a
 * small compatibility facade because the remaining Electron controllers use
 * the namespace form.
 */
function getAdminCompatibilityFacade(adminSdk) {
  if (typeof adminSdk.getApps !== 'function') return adminSdk;

  const app = require('firebase-admin/app');
  const firestore = require('firebase-admin/firestore');
  const auth = require('firebase-admin/auth');
  const storage = require('firebase-admin/storage');

  return {
    ...adminSdk,
    get apps() {
      return app.getApps();
    },
    app: app.getApp,
    credential: { cert: app.cert },
    firestore: Object.assign((firebaseApp) => firestore.getFirestore(firebaseApp), {
      FieldValue: firestore.FieldValue,
      Filter: firestore.Filter,
      GeoPoint: firestore.GeoPoint,
      Timestamp: firestore.Timestamp,
    }),
    auth: (firebaseApp) => auth.getAuth(firebaseApp),
    storage: (firebaseApp) => storage.getStorage(firebaseApp),
  };
}

function getAdmin() {
  return admin;
}
function getDb() {
  return db;
}

function getStorageEmulatorHost() {
  return currentStorageEmulatorHost;
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
      const emulatorHost = typeof params === 'string' ? undefined : params.emulatorHost;
      const explicitProjectId = typeof params === 'string' ? undefined : params.projectId;
      const authEmulatorHost = typeof params === 'string' ? undefined : params.authEmulatorHost;
      const storageEmulatorHost = typeof params === 'string' ? undefined : params.storageEmulatorHost;

      if (emulatorHost) {
        process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
      } else {
        delete process.env.FIRESTORE_EMULATOR_HOST;
      }

      if (authEmulatorHost) {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulatorHost;
      } else {
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      }

      currentAuthEmulatorHost = authEmulatorHost || null;
      currentStorageEmulatorHost = storageEmulatorHost || null;

      const adminSdk = require('firebase-admin');
      const adminFacade = getAdminCompatibilityFacade(adminSdk);

      // Never call app().delete() unless an app exists — after a failed connect, `admin` may
      // still reference the SDK module while no default app was initialized, which throws:
      // "The default Firebase app does not exist".
      const existingApps = [...adminFacade.apps];
      for (const appInstance of existingApps) {
        try {
          await adminSdk.deleteApp(appInstance);
        } catch (e) {
          void e;
        }
      }

      let projectId = explicitProjectId;

      if (serviceAccountPath) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        projectId = serviceAccount.project_id;
        adminSdk.initializeApp({
          credential: adminFacade.credential.cert(serviceAccount),
          projectId,
        });
      } else if (emulatorHost && explicitProjectId) {
        // Emulator connection without service account
        adminSdk.initializeApp({ projectId: explicitProjectId });
      } else {
        throw new Error('Must provide either serviceAccountPath or emulatorHost with projectId');
      }

      admin = adminFacade;
      db = adminFacade.firestore();

      if (databaseId) {
        db.settings({ databaseId });
      }

      // Notify other controllers about the connection change
      if (onConnectionChange) {
        onConnectionChange(admin, db, currentAuthEmulatorHost, currentStorageEmulatorHost);
      }

      return { success: true, projectId, databaseId };
    } catch (error) {
      admin = null;
      db = null;
      currentAuthEmulatorHost = null;
      currentStorageEmulatorHost = null;
      try {
        const adminSdk = require('firebase-admin');
        const leftover = [...getAdminCompatibilityFacade(adminSdk).apps];
        for (const appInstance of leftover) {
          try {
            await adminSdk.deleteApp(appInstance);
          } catch (e) {
            void e;
          }
        }
      } catch (e2) {
        void e2;
      }
      if (onConnectionChange) {
        onConnectionChange(null, null, null, null);
      }
      return { success: false, error: error.message };
    }
  });

  // Disconnect from Firebase
  ipcMain.handle('firebase:disconnect', async () => {
    try {
      const adminSdk = admin || getAdminCompatibilityFacade(require('firebase-admin'));
      const existingApps = [...adminSdk.apps];
      for (const appInstance of existingApps) {
        try {
          await adminSdk.deleteApp(appInstance);
        } catch (e) {
          void e;
        }
      }
      admin = null;
      db = null;
      currentAuthEmulatorHost = null;
      currentStorageEmulatorHost = null;

      if (onConnectionChange) {
        onConnectionChange(null, null, null, null);
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
  getStorageEmulatorHost,
  setConnectionChangeCallback,
  getAdminCompatibilityFacade,
};
