/**
 * Auth Controller
 * Handles Firebase Authentication user management via IPC (Admin SDK / Emulator REST)
 * Note: Google OAuth auth operations are handled by googleController.js
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');

let adminRef = null;
let authEmulatorHost = null;

function setAdminRef(admin) {
  adminRef = admin;
}

function setAuthEmulatorHost(host) {
  authEmulatorHost = host;
}

function getProjectId() {
  if (adminRef?.apps?.length > 0) {
    return adminRef.app().options.projectId;
  }
  return null;
}

async function getAuthEmulatorBase() {
  if (authEmulatorHost) return `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`;
  return null;
}

function normalizeUserRecord(user) {
  return {
    uid: user.localId || user.uid,
    email: user.email || null,
    emailVerified: user.emailVerified || false,
    displayName: user.displayName || null,
    photoURL: user.photoUrl || null,
    phoneNumber: user.phoneNumber || null,
    disabled: user.disabled || false,
    metadata: user.createdAt
      ? {
          creationTime: new Date(Number(user.createdAt)).toISOString(),
          lastSignInTime: user.lastLoginAt ? new Date(Number(user.lastLoginAt)).toISOString() : null,
        }
      : { creationTime: null, lastSignInTime: null },
    providerData: (user.providerUserInfo || []).map((p) => ({
      providerId: p.providerId,
      uid: p.rawId || p.federatedId,
      email: p.email || null,
      displayName: p.displayName || null,
      photoURL: p.photoUrl || null,
    })),
  };
}

function registerHandlers() {
  // List users
  ipcMain.handle('auth:listUsers', async (event, { maxResults = 1000 } = {}) => {
    try {
      const baseUrl = await getAuthEmulatorBase();
      const projectId = getProjectId();
      if (!projectId) throw new Error('Not connected to Firebase');

      if (baseUrl) {
        const response = await fetch(`${baseUrl}/projects/${projectId}/accounts:query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
          body: JSON.stringify({ returnUserInfo: true, maxResults }),
        });
        const data = await response.json();
        if (data.error) {
          return { success: false, error: data.error.message || 'List users failed' };
        }
        const users = (data.userInfo || []).map(normalizeUserRecord);
        return { success: true, users };
      }

      if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
      const listUsersResult = await adminRef.auth().listUsers(maxResults);
      const users = listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
        metadata: { creationTime: user.metadata.creationTime, lastSignInTime: user.metadata.lastSignInTime },
        providerData: user.providerData.map((p) => ({
          providerId: p.providerId,
          uid: p.uid,
          email: p.email,
          displayName: p.displayName,
          photoURL: p.photoURL,
          phoneNumber: p.phoneNumber,
        })),
      }));
      return { success: true, users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Create user
  ipcMain.handle(
    'auth:createUser',
    async (event, { email, password, displayName, phoneNumber, uid, photoURL, disabled, emailVerified }) => {
      try {
        const baseUrl = await getAuthEmulatorBase();
        const projectId = getProjectId();
        if (!projectId) throw new Error('Not connected to Firebase');

        if (baseUrl) {
          const body = { email, password };
          if (displayName) body.displayName = displayName;
          if (phoneNumber) body.phoneNumber = phoneNumber;
          if (uid) body.localId = uid;
          if (disabled !== undefined) body.disabled = disabled;
          if (emailVerified !== undefined) body.emailVerified = emailVerified;
          const response = await fetch(`${baseUrl}/projects/${projectId}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (data.error) {
            return { success: false, error: data.error.message || 'Create user failed' };
          }
          return {
            success: true,
            user: { uid: data.localId, email: data.email, displayName: data.displayName || null },
          };
        }

        if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
        const userData = { email, password };
        if (displayName) userData.displayName = displayName;
        if (phoneNumber) userData.phoneNumber = phoneNumber;
        if (uid) userData.uid = uid;
        if (photoURL) userData.photoURL = photoURL;
        if (disabled) userData.disabled = disabled;
        if (emailVerified) userData.emailVerified = emailVerified;
        const userRecord = await adminRef.auth().createUser(userData);
        return {
          success: true,
          user: { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName },
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  );

  // Update user
  ipcMain.handle(
    'auth:updateUser',
    async (event, { uid, email, password, displayName, phoneNumber, disabled, photoURL, emailVerified }) => {
      try {
        const baseUrl = await getAuthEmulatorBase();
        const projectId = getProjectId();
        if (!projectId) throw new Error('Not connected to Firebase');

        if (baseUrl) {
          const body = { localId: uid };
          if (email !== undefined) body.email = email;
          if (password !== undefined) body.password = password;
          if (displayName !== undefined) body.displayName = displayName;
          if (phoneNumber !== undefined) body.phoneNumber = phoneNumber;
          if (disabled !== undefined) body.disableUser = disabled;
          const response = await fetch(`${baseUrl}/projects/${projectId}/accounts:update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (data.error) {
            return { success: false, error: data.error.message || 'Update user failed' };
          }
          const updated = data.localId ? normalizeUserRecord(data) : null;
          return {
            success: true,
            user: updated || { uid, email, displayName, disabled },
          };
        }

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
        return {
          success: true,
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            disabled: userRecord.disabled,
          },
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  );

  // Delete user
  ipcMain.handle('auth:deleteUser', async (event, { uid }) => {
    try {
      const baseUrl = await getAuthEmulatorBase();
      const projectId = getProjectId();
      if (!projectId) throw new Error('Not connected to Firebase');

      if (baseUrl) {
        const response = await fetch(`${baseUrl}/projects/${projectId}/accounts:delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
          body: JSON.stringify({ localId: uid }),
        });
        const data = await response.json();
        if (data.error) {
          return { success: false, error: data.error.message || 'Delete user failed' };
        }
        return { success: true };
      }

      if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
      await adminRef.auth().deleteUser(uid);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get user
  ipcMain.handle('auth:getUser', async (event, { uid }) => {
    try {
      const baseUrl = await getAuthEmulatorBase();
      const projectId = getProjectId();
      if (!projectId) throw new Error('Not connected to Firebase');

      if (baseUrl) {
        const response = await fetch(`${baseUrl}/projects/${projectId}/accounts:lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
          body: JSON.stringify({ localId: [uid] }),
        });
        const data = await response.json();
        if (data.error) {
          return { success: false, error: data.error.message || 'User not found' };
        }
        if (!data.users || data.users.length === 0) {
          return { success: false, error: 'User not found' };
        }
        return { success: true, user: normalizeUserRecord(data.users[0]) };
      }

      if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
      const userRecord = await adminRef.auth().getUser(uid);
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
            lastSignInTime: userRecord.metadata.lastSignInTime,
          },
          providerData: userRecord.providerData,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerHandlers, setAdminRef, setAuthEmulatorHost };
