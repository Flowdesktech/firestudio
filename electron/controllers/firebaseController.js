/**
 * Firebase Controller
 * Handles Firebase Admin SDK connection and disconnection
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');

let admin = null;
let db = null;
let onConnectionChange = null;

function getAdmin() { return admin; }
function getDb() { return db; }

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

            // Notify other controllers about the connection change
            if (onConnectionChange) {
                onConnectionChange(admin, db);
            }

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

                // Notify other controllers about the disconnection
                if (onConnectionChange) {
                    onConnectionChange(null, null);
                }
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
            properties: ['openFile']
        });
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    });
}

module.exports = {
    registerHandlers,
    getAdmin,
    getDb,
    setConnectionChangeCallback
};
