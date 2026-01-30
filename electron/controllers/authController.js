/**
 * Auth Controller
 * Handles Firebase Authentication user management via IPC (Admin SDK only)
 * Note: Google OAuth auth operations are handled by googleController.js
 */

const { ipcMain } = require('electron');

let adminRef = null;

function setAdminRef(admin) { adminRef = admin; }

function registerHandlers() {
    // List users (Admin SDK)
    ipcMain.handle('auth:listUsers', async (event, { maxResults = 1000 } = {}) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const listUsersResult = await adminRef.auth().listUsers(maxResults);
            const users = listUsersResult.users.map(user => ({
                uid: user.uid, email: user.email, emailVerified: user.emailVerified, displayName: user.displayName,
                photoURL: user.photoURL, phoneNumber: user.phoneNumber, disabled: user.disabled,
                metadata: { creationTime: user.metadata.creationTime, lastSignInTime: user.metadata.lastSignInTime },
                providerData: user.providerData.map(p => ({ providerId: p.providerId, uid: p.uid, email: p.email, displayName: p.displayName, photoURL: p.photoURL, phoneNumber: p.phoneNumber }))
            }));
            return { success: true, users };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Create user (Admin SDK)
    ipcMain.handle('auth:createUser', async (event, { email, password, displayName, phoneNumber, uid, photoURL, disabled, emailVerified }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const userData = { email, password };
            if (displayName) userData.displayName = displayName;
            if (phoneNumber) userData.phoneNumber = phoneNumber;
            if (uid) userData.uid = uid;
            if (photoURL) userData.photoURL = photoURL;
            if (disabled) userData.disabled = disabled;
            if (emailVerified) userData.emailVerified = emailVerified;
            const userRecord = await adminRef.auth().createUser(userData);
            return { success: true, user: { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Update user (Admin SDK)
    ipcMain.handle('auth:updateUser', async (event, { uid, email, password, displayName, phoneNumber, disabled, photoURL, emailVerified }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const updateData = {};
            if (email !== undefined) updateData.email = email;
            if (password !== undefined) updateData.password = password;
            if (displayName !== undefined) updateData.displayName = displayName;
            if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
            if (disabled !== undefined) updateData.disabled = disabled;
            if (photoURL !== undefined) updateData.photoURL = photoURL;
            if (emailVerified !== undefined) updateData.emailVerified = emailVerified;
            const userRecord = await adminRef.auth().updateUser(uid, updateData);
            return { success: true, user: { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName, disabled: userRecord.disabled } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Delete user (Admin SDK)
    ipcMain.handle('auth:deleteUser', async (event, { uid }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            await adminRef.auth().deleteUser(uid);
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Get user (Admin SDK)
    ipcMain.handle('auth:getUser', async (event, { uid }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const userRecord = await adminRef.auth().getUser(uid);
            return {
                success: true,
                user: {
                    uid: userRecord.uid, email: userRecord.email, emailVerified: userRecord.emailVerified,
                    displayName: userRecord.displayName, photoURL: userRecord.photoURL, phoneNumber: userRecord.phoneNumber, disabled: userRecord.disabled,
                    metadata: { creationTime: userRecord.metadata.creationTime, lastSignInTime: userRecord.metadata.lastSignInTime },
                    providerData: userRecord.providerData
                }
            };
        } catch (error) { return { success: false, error: error.message }; }
    });

}

module.exports = { registerHandlers, setAdminRef };
