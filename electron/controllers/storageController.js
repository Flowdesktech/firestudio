/**
 * Storage Controller
 * Handles Firebase Storage operations via IPC (both Admin SDK and Google OAuth)
 */

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const googleController = require('./googleController');

let adminRef = null;

function setAdminRef(admin) { adminRef = admin; }

function getProjectId() {
    if (adminRef?.apps?.length > 0) {
        return adminRef.app().options.credential?.projectId || adminRef.app().options.projectId;
    }
    return null;
}

function registerHandlers() {
    // List files (Admin SDK)
    ipcMain.handle('storage:listFiles', async (event, { path: storagePath = '' }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected to Firebase');
            const projectId = getProjectId();
            const bucket = adminRef.storage().bucket(`${projectId}.appspot.com`);
            const prefix = storagePath ? (storagePath.endsWith('/') ? storagePath : storagePath + '/') : '';

            const [files] = await bucket.getFiles({ prefix, delimiter: '/', autoPaginate: false });
            const [, , apiResponse] = await bucket.getFiles({ prefix, delimiter: '/', autoPaginate: false });

            const folders = (apiResponse?.prefixes || []).map(p => ({ name: p.replace(prefix, '').replace(/\/$/, ''), path: p, type: 'folder', size: 0, updated: null }));
            const fileList = files.filter(f => f.name !== prefix && !f.name.endsWith('/')).map(f => ({
                name: f.name.replace(prefix, ''), path: f.name, type: 'file', size: parseInt(f.metadata.size || 0, 10),
                contentType: f.metadata.contentType || 'application/octet-stream', updated: f.metadata.updated || null, generation: f.metadata.generation
            }));
            return { success: true, items: [...folders, ...fileList], currentPath: storagePath };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Upload file (Admin SDK)
    ipcMain.handle('storage:uploadFile', async (event, { storagePath }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
            if (!filePaths?.length) return { success: false, error: 'No file selected' };

            const localPath = filePaths[0];
            const fileName = path.basename(localPath);
            const bucket = adminRef.storage().bucket(`${getProjectId()}.appspot.com`);
            const destination = storagePath ? `${storagePath}/${fileName}` : fileName;

            await bucket.upload(localPath, { destination, metadata: { contentType: require('mime-types').lookup(localPath) || 'application/octet-stream' } });
            return { success: true, fileName, path: destination };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Download file (Admin SDK)
    ipcMain.handle('storage:downloadFile', async (event, { filePath }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            const { filePath: savePath } = await dialog.showSaveDialog({ defaultPath: filePath.split('/').pop() });
            if (!savePath) return { success: false, error: 'No save location' };

            const bucket = adminRef.storage().bucket(`${getProjectId()}.appspot.com`);
            await bucket.file(filePath).download({ destination: savePath });
            return { success: true, savedTo: savePath };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Get signed URL (Admin SDK)
    ipcMain.handle('storage:getDownloadUrl', async (event, { filePath, expiresInMs }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            const bucket = adminRef.storage().bucket(`${getProjectId()}.appspot.com`);
            const expiration = expiresInMs || (7 * 24 * 60 * 60 * 1000);
            const expiresDate = new Date(Date.now() + expiration);
            const expiresString = `${String(expiresDate.getMonth() + 1).padStart(2, '0')}-${String(expiresDate.getDate()).padStart(2, '0')}-${expiresDate.getFullYear()}`;
            const [url] = await bucket.file(filePath).getSignedUrl({ action: 'read', expires: expiresString });
            return { success: true, url };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Delete file (Admin SDK)
    ipcMain.handle('storage:deleteFile', async (event, { filePath }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            await adminRef.storage().bucket(`${getProjectId()}.appspot.com`).file(filePath).delete();
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Create folder (Admin SDK)
    ipcMain.handle('storage:createFolder', async (event, { folderPath }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            const placeholderPath = folderPath.endsWith('/') ? folderPath + '.placeholder' : folderPath + '/.placeholder';
            await adminRef.storage().bucket(`${getProjectId()}.appspot.com`).file(placeholderPath).save('', { metadata: { contentType: 'application/x-empty' } });
            return { success: true, folderPath };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // Get file metadata (Admin SDK)
    ipcMain.handle('storage:getFileMetadata', async (event, { filePath }) => {
        try {
            if (!adminRef?.apps?.length) throw new Error('Not connected');
            const [metadata] = await adminRef.storage().bucket(`${getProjectId()}.appspot.com`).file(filePath).getMetadata();
            return { success: true, metadata: { name: metadata.name, size: parseInt(metadata.size || 0, 10), contentType: metadata.contentType, created: metadata.timeCreated, updated: metadata.updated, generation: metadata.generation, md5Hash: metadata.md5Hash } };
        } catch (error) { return { success: false, error: error.message }; }
    });

    // ===== Google OAuth Storage Operations =====

    ipcMain.handle('google:storageListFiles', async (event, { projectId, path: storagePath = '' }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const bucketName = `${projectId}.appspot.com`;
            const prefix = storagePath ? (storagePath.endsWith('/') ? storagePath : storagePath + '/') : '';
            const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?prefix=${encodeURIComponent(prefix)}&delimiter=/`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            const folders = (data.prefixes || []).map(p => ({ name: p.replace(prefix, '').replace(/\/$/, ''), path: p, type: 'folder', size: 0, updated: null }));
            const files = (data.items || []).filter(f => f.name !== prefix && !f.name.endsWith('/')).map(f => ({
                name: f.name.replace(prefix, ''), path: f.name, type: 'file', size: parseInt(f.size || 0, 10), contentType: f.contentType || 'application/octet-stream', updated: f.updated || null, generation: f.generation
            }));
            return { success: true, items: [...folders, ...files], currentPath: storagePath };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:storageUploadFile', async (event, { projectId, storagePath }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
            if (!filePaths?.length) return { success: false, error: 'No file selected' };
            const localPath = filePaths[0];
            const fileName = path.basename(localPath);
            const fileContent = fs.readFileSync(localPath);
            const mimeType = require('mime-types').lookup(localPath) || 'application/octet-stream';
            const bucketName = `${projectId}.appspot.com`;
            const destination = storagePath ? `${storagePath}/${fileName}` : fileName;
            const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(destination)}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mimeType }, body: fileContent });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, fileName, path: destination };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:storageDownloadFile', async (event, { projectId, filePath }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const { filePath: savePath } = await dialog.showSaveDialog({ defaultPath: filePath.split('/').pop() });
            if (!savePath) return { success: false, error: 'No save location' };
            const bucketName = `${projectId}.appspot.com`;
            const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (!response.ok) { const err = await response.json(); return { success: false, error: err.error?.message || 'Download failed' }; }
            const buffer = await response.buffer();
            fs.writeFileSync(savePath, buffer);
            return { success: true, savedTo: savePath };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:storageGetDownloadUrl', async (event, { projectId, filePath }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const bucketName = `${projectId}.appspot.com`;
            const metadataUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}`;
            const metadataResponse = await fetch(metadataUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const metadata = await metadataResponse.json();
            if (metadata.downloadTokens) {
                const token = metadata.downloadTokens.split(',')[0];
                return { success: true, url: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}` };
            }
            return { success: false, error: 'Could not generate download URL' };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:storageDeleteFile', async (event, { projectId, filePath }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const url = `https://storage.googleapis.com/storage/v1/b/${projectId}.appspot.com/o/${encodeURIComponent(filePath)}`;
            const response = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (!response.ok && response.status !== 204) { const err = await response.json(); return { success: false, error: err.error?.message || 'Delete failed' }; }
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('google:storageCreateFolder', async (event, { projectId, folderPath }) => {
        try {
            const accessToken = googleController.getAccessToken();
            if (!accessToken) return { success: false, error: 'Not signed in' };
            const placeholderPath = folderPath.endsWith('/') ? folderPath + '.placeholder' : folderPath + '/.placeholder';
            const url = `https://storage.googleapis.com/upload/storage/v1/b/${projectId}.appspot.com/o?uploadType=media&name=${encodeURIComponent(placeholderPath)}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/x-empty' }, body: '' });
            const data = await response.json();
            if (data.error) return { success: false, error: data.error.message };
            return { success: true, folderPath };
        } catch (error) { return { success: false, error: error.message }; }
    });
}

module.exports = { registerHandlers, setAdminRef };
