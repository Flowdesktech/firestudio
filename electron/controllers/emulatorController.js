/**
 * Emulator Controller
 * Handles scanning for local Firebase Emulators
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');

/**
 * Reads a JSON file safely
 */
function readJsonSafely(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // Silently ignore unreadable or unparseable files
  }
  return null;
}

/**
 * Scans the OS temp directory for running emulator hub files.
 * The hub locator file (hub-<projectId>.json) only contains version, origins, and pid.
 * To get the running emulator services, we must fetch GET /emulators from the hub.
 */
async function scanHubFiles() {
  const tmpDir = os.tmpdir();
  const runningEmulators = [];

  try {
    const files = fs.readdirSync(tmpDir);
    const hubFiles = files.filter((f) => f.startsWith('hub-') && f.endsWith('.json'));

    for (const file of hubFiles) {
      // Extract projectId from filename: hub-<projectId>.json
      const projectId = file.slice(4, -5);
      if (!projectId) continue;

      const hubData = readJsonSafely(path.join(tmpDir, file));
      if (!hubData || !hubData.origins || !hubData.origins.length) continue;

      // Query the hub's /emulators endpoint to get running services
      try {
        const hubUrl = hubData.origins[0].replace(/\/$/, '');
        const response = await fetch(`${hubUrl}/emulators`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) continue;

        const emulatorsMap = await response.json();
        const firestore = emulatorsMap && emulatorsMap.firestore;
        if (firestore) {
          // Collect all available emulator services
          const services = {};
          for (const [name, info] of Object.entries(emulatorsMap)) {
            if (info && typeof info === 'object' && info.host && info.port) {
              services[name] = {
                host: info.host || 'localhost',
                port: info.port,
              };
            }
          }

          runningEmulators.push({
            projectId,
            host: firestore.host || 'localhost',
            port: firestore.port,
            services,
          });
        }
      } catch {
        // Hub not reachable, skip this one
      }
    }
  } catch (err) {
    console.error('Failed to scan for hub files:', err);
  }

  return runningEmulators;
}

/**
 * Scans the Firebase CLI configstore to map project IDs to local paths
 */
function scanConfigstore() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  let configstorePath;
  if (isMac) {
    configstorePath = path.join(os.homedir(), 'Library', 'Preferences', 'configstore', 'firebase-tools.json');
  } else if (isWin) {
    // Windows path typically %LOCALAPPDATA%\configstore\firebase-tools.json
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    configstorePath = path.join(localAppData, 'configstore', 'firebase-tools.json');
  } else {
    // Linux path
    configstorePath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  }

  const configData = readJsonSafely(configstorePath);
  if (!configData || !configData.activeProjects) {
    return {};
  }

  return configData.activeProjects;
}

/**
 * Registers all Emulator IPC handlers
 */
function registerHandlers() {
  // Scans for running emulators via hub files
  ipcMain.handle('emulators:scanHub', async () => {
    try {
      const emulators = await scanHubFiles();
      return { success: true, emulators };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Scans configstore for local project paths
  ipcMain.handle('emulators:scanConfig', async () => {
    try {
      const activeProjects = scanConfigstore();
      return { success: true, activeProjects };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerHandlers,
};
