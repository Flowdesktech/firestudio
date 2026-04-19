/**
 * GitHub Releases auto-update (electron-updater).
 * - Checks on startup and every 24h (packaged app only).
 * - Downloads only after the user confirms; restart after download when they agree.
 */

const { app, dialog, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

const DAILY_MS = 24 * 60 * 60 * 1000;

let dailyTimer = null;
/** When true, next `update-not-available` shows a dialog (Help → Check for Updates). */
let manualCheckPending = false;

function getParentWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
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

/**
 * Call once after app is ready. No-op in development / unpackaged runs.
 */
function setupAutoUpdate() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-not-available', () => {
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

  autoUpdater.on('update-available', async (info) => {
    manualCheckPending = false;
    const win = getParentWindow();
    const notes = formatReleaseNotes(info.releaseNotes).trim();
    const detail =
      (notes ? `${notes.slice(0, 4000)}${notes.length > 4000 ? '\n…' : ''}\n\n` : '') +
      'Download the update now? You can install it after the download finishes.';

    const { response } = win
      ? await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Update available',
          message: `Firestudio ${info.version} is available.`,
          detail: `You are on ${app.getVersion()}.\n\n${detail}`,
          buttons: ['Download', 'Not now'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        })
      : await dialog.showMessageBox({
          type: 'info',
          title: 'Update available',
          message: `Firestudio ${info.version} is available.`,
          detail: `You are on ${app.getVersion()}.\n\n${detail}`,
          buttons: ['Download', 'Not now'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });

    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        dialog.showErrorBox('Download failed', err?.message || String(err));
      }
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    const win = getParentWindow();
    const { response } = win
      ? await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Update ready',
          message: 'The new version has been downloaded.',
          detail: 'Restart Firestudio now to finish installing?',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        })
      : await dialog.showMessageBox({
          type: 'info',
          title: 'Update ready',
          message: 'The new version has been downloaded.',
          detail: 'Restart Firestudio now to finish installing?',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });

    if (response === 0) {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    }
  });

  autoUpdater.on('error', (err) => {
    manualCheckPending = false;
    console.warn('[autoUpdate]', err?.message || err);
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
