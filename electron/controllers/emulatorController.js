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
 * Normalizes a host that is not directly reachable from a client.
 * Emulators bind to 0.0.0.0 (IPv4) or [::] (IPv6) by default and report those
 * addresses back via the environment. Browsers (and some runtimes) cannot
 * connect to 0.0.0.0 / [::] as a destination, which breaks discovery on macOS
 * in particular. Map those wildcard addresses to the loopback interface.
 */
function normalizeHost(host) {
  if (!host) return host;
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host === '[::]' || host === '::' || host === '::1' || host === '[::1]') return '127.0.0.1';
  return host;
}

/**
 * Best-effort project ID guess for emulators discovered via environment
 * variables (which do not carry a project ID). Reads .firebaserc by walking up
 * from the current directory, then falls back to Firebase's conventional
 * emulator placeholder.
 */
function readProjectIdGuess() {
  // Honor the project id the emulator was started with. The gcloud Firestore
  // emulator (and the Firebase Emulator Suite) advertise it via these vars;
  // without this, discovery falls back to the generic `demo-project` and the
  // connection's project id won't match the emulator's, returning no data.
  const envProject = process.env.FIRESTORE_EMULATOR_PROJECT || process.env.GCLOUD_PROJECT;
  if (envProject) return envProject;

  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const rc = readJsonSafely(path.join(dir, '.firebaserc'));
    if (rc && rc.projects) {
      const id = rc.projects.default || Object.keys(rc.projects)[0];
      if (id) return id;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'demo-project';
}

/**
 * Parses a host:port string, normalizing the host. Returns null if malformed.
 */
function parseHostPort(value) {
  if (!value) return null;
  const idx = value.lastIndexOf(':');
  if (idx === -1) return null;
  const host = normalizeHost(value.slice(0, idx)) || '127.0.0.1';
  const port = parseInt(value.slice(idx + 1), 10);
  if (!Number.isFinite(port)) return null;
  return { host, port };
}

/**
 * Discovers emulators from standard Firebase Emulator environment variables
 * (FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST,
 * FIREBASE_STORAGE_EMULATOR_HOST). These are exported by the Emulator Suite and
 * are an authoritative signal of a running emulator.
 */
function scanEnv() {
  const firestore = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST);
  if (!firestore) return null;

  const services = { firestore };
  const auth = parseHostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (auth) services.auth = auth;
  const storage = parseHostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  if (storage) services.storage = storage;

  return {
    projectId: readProjectIdGuess(),
    host: firestore.host,
    port: firestore.port,
    services,
  };
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
 * Merges all discovery strategies (hub locator files and environment
 * variables), de-duplicating by Firestore host:port so a single running
 * emulator is not reported multiple times.
 */
async function scanRunningEmulators() {
  const results = [];
  const seen = new Set();
  const add = (emulator) => {
    if (!emulator) return;
    const key = `${emulator.host}:${emulator.port}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(emulator);
  };

  const fromFiles = await scanHubFiles();
  fromFiles.forEach(add);

  add(scanEnv());

  return results;
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
  // Scans for running emulators via hub files and environment variables
  ipcMain.handle('emulators:scanHub', async () => {
    try {
      const emulators = await scanRunningEmulators();
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
  scanRunningEmulators,
};
