/**
 * GitHub Releases auto-update (electron-updater).
 * - Checks on startup and every 24h (packaged app only).
 * - Downloads only after the user confirms; restart after download when they agree.
 */

const { app, dialog, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const DAILY_MS = 24 * 60 * 60 * 1000;

let dailyTimer = null;
let ipcHandlersRegistered = false;
let downloadRequested = false;
/** When true, next `update-not-available` shows a dialog (Help → Check for Updates). */
let manualCheckPending = false;
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
};

function getParentWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function broadcastState() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('auto-update:state', updateState);
    }
  });
}

function setUpdateState(nextState) {
  updateState = {
    ...updateState,
    ...nextState,
    currentVersion: app.getVersion(),
  };
  broadcastState();
}

function formatReleaseNotes(releaseNotes) {
  if (!releaseNotes) return '';
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((block) => (typeof block === 'string' ? block : block?.note || ''))
      .filter(Boolean)
      .join('\n\n');
  }
  return String(releaseNotes);
}

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  ipcMain.handle('auto-update:getState', () => updateState);

  ipcMain.handle('auto-update:download', async () => {
    if (updateState.status !== 'available' && updateState.status !== 'error') {
      return { success: false, error: 'No update is ready to download.' };
    }

    downloadRequested = true;
    setUpdateState({
      status: 'downloading',
      progress: {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
      error: undefined,
    });

    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      const message = err?.message || String(err);
      setUpdateState({ status: 'error', error: message });
      return { success: false, error: message };
    }
  });

  ipcMain.handle('auto-update:install', () => {
    if (updateState.status !== 'downloaded') {
      return { success: false, error: 'The update has not finished downloading.' };
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { success: true };
  });
}

/**
 * Call once after app is ready. No-op in development / unpackaged runs.
 */
function setupAutoUpdate() {
  registerIpcHandlers();

  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-not-available', () => {
    setUpdateState({ status: 'idle', version: undefined, releaseNotes: undefined, progress: undefined });
    if (!manualCheckPending) return;
    manualCheckPending = false;
    const win = getParentWindow();
    const opts = {
      type: 'info',
      title: 'No updates',
      message: 'You are running the latest release.',
      detail: `Current version: ${app.getVersion()}`,
      buttons: ['OK'],
    };
    if (win) dialog.showMessageBox(win, opts);
    else dialog.showMessageBox(opts);
  });

  autoUpdater.on('update-available', (info) => {
    manualCheckPending = false;
    downloadRequested = false;
    setUpdateState({
      status: 'available',
      version: info.version,
      releaseName: info.releaseName || '',
      releaseNotes: formatReleaseNotes(info.releaseNotes).trim(),
      releaseDate: info.releaseDate,
      progress: undefined,
      error: undefined,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      progress: {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', () => {
    downloadRequested = false;
    setUpdateState({
      status: 'downloaded',
      progress: {
        ...(updateState.progress || {}),
        percent: 100,
      },
      error: undefined,
    });
  });

  autoUpdater.on('error', (err) => {
    manualCheckPending = false;
    console.warn('[autoUpdate]', err?.message || err);
    if (downloadRequested || updateState.status === 'downloading') {
      downloadRequested = false;
      setUpdateState({ status: 'error', error: err?.message || String(err) });
    }
  });

  const runCheck = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[autoUpdate] checkForUpdates:', err?.message || err);
    });
  };

  runCheck();
  if (dailyTimer) clearInterval(dailyTimer);
  dailyTimer = setInterval(runCheck, DAILY_MS);
}

/** Help menu: manual check (also useful if user dismissed startup). */
function checkForUpdatesManual() {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Updates',
      message: 'Auto-update runs only in the packaged app.',
      detail: 'Install a release build from GitHub to receive updates.',
      buttons: ['OK'],
    });
    return;
  }

  manualCheckPending = true;
  autoUpdater.checkForUpdates().catch((err) => {
    manualCheckPending = false;
    dialog.showErrorBox('Update check failed', err?.message || String(err));
  });
}

function stopDailyUpdateCheck() {
  if (dailyTimer) {
    clearInterval(dailyTimer);
    dailyTimer = null;
  }
}

module.exports = { setupAutoUpdate, checkForUpdatesManual, stopDailyUpdateCheck };
