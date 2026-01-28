/**
 * Auth Controller
 * Handles Firebase Authentication user management via IPC (both Admin SDK and Google OAuth)
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const googleController = require('./googleController');

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
    ipcMain.handle('auth:createUser', async (event, { email, password, displayName, phoneNumber }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const userRecord = await adminRef.auth().createUser({ email, password, displayName: displayName || undefined, phoneNumber: phoneNumber || undefined });
            return { success: true, user: { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Update user (Admin SDK)
    ipcMain.handle('auth:updateUser', async (event, { uid, email, password, displayName, phoneNumber, disabled }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const updateData = {};
            if (email !== undefined) updateData.email = email;
            if (password !== undefined) updateData.password = password;
            if (displayName !== undefined) updateData.displayName = displayName;
            if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
            if (disabled !== undefined) updateData.disabled = disabled;
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

    // ===== Google OAuth Auth Operations =====

    ipcMain.handle('google:listAuthUsers', async (event, { projectId, maxResults = 1000 }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`;
            const response = await fetch(url, {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ maxResults })
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            const users = (data.users || []).map(user => ({
                uid: user.localId, email: user.email || null, emailVerified: user.emailVerified || false,
                displayName: user.displayName || null, photoURL: user.photoUrl || null, phoneNumber: user.phoneNumber || null, disabled: user.disabled || false,
                metadata: { creationTime: user.createdAt ? new Date(parseInt(user.createdAt)).toISOString() : null, lastSignInTime: user.lastLoginAt ? new Date(parseInt(user.lastLoginAt)).toISOString() : null },
                providerData: (user.providerUserInfo || []).map(p => ({ providerId: p.providerId, uid: p.rawId, email: p.email, displayName: p.displayName, photoURL: p.photoUrl, phoneNumber: p.phoneNumber }))
            }));
            return { success: true, users };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:createAuthUser', async (event, { projectId, email, password, displayName }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
            const response = await fetch(url, {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName: displayName || undefined })
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, user: { uid: data.localId, email: data.email, displayName: data.displayName } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:updateAuthUser', async (event, { projectId, uid, email, password, displayName, disabled }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
            const updateData = { localId: uid };
            if (email !== undefined) updateData.email = email;
            if (password !== undefined) updateData.password = password;
            if (displayName !== undefined) updateData.displayName = displayName;
            if (disabled !== undefined) updateData.disableUser = disabled;
            const response = await fetch(url, {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(updateData)
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, user: { uid: data.localId, email: data.email, displayName: data.displayName, disabled: data.disabled } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:deleteAuthUser', async (event, { projectId, uid }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
            const response = await fetch(url, {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid })
            });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });
}

module.exports = { registerHandlers, setAdminRef };
