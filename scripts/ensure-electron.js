#!/usr/bin/env node
/**
 * Ensures the Electron binary is fully extracted.
 *
 * Electron's own install.js uses `extract-zip`, which on some systems silently
 * extracts only a stub (no Frameworks), leaving a broken install that throws
 * "Electron failed to install correctly". This postinstall detects that state
 * and re-extracts the cached archive using the system `unzip` tool.
 *
 * Root cause (upstream): https://github.com/electron/electron/issues/51619
 *   Electron extraction fails under newer Node.js versions because of a bug in
 *   `extract-zip` (yauzl/fd-slicer); the cached zip is present but `dist` is
 *   incomplete. This script is a workaround until that is fixed upstream.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');

/**
 * Reads and parses a JSON file, returning null on any failure.
 */
function readJsonSafely(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // ignore unreadable / unparseable files
  }
  return null;
}

function isUsable() {
  try {
    require('electron');
  } catch {
    return false;
  }
  // On macOS the real app bundle contains a Frameworks directory.
  if (process.platform === 'darwin') {
    return fs.existsSync(path.join(electronDir, 'dist', 'Electron.app', 'Contents', 'Frameworks'));
  }
  return true;
}

function getCacheDir() {
  if (process.env.electron_config_cache) return process.env.electron_config_cache;
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'electron');
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), 'electron');
  }
  return path.join(os.homedir(), '.cache', 'electron');
}

function findZip(version, platform, arch) {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) return null;
  let found = null;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name === `electron-v${version}-${platform}-${arch}.zip`) {
        found = full;
      }
    }
  };
  try {
    walk(dir);
  } catch {
    // ignore unreadable cache
  }
  return found;
}

/**
 * Like findZip, but matches any version (used when electron's package.json is
 * not yet available, e.g. during a partial install state).
 */
function findZipAny(platform, arch) {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) return null;
  let found = null;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name === `electron-v-${platform}-${arch}.zip` || e.name.endsWith(`-${platform}-${arch}.zip`)) {
        found = full;
      }
    }
  };
  try {
    walk(dir);
  } catch {
    // ignore
  }
  return found;
}

function hasUnzip() {
  try {
    execSync('command -v unzip >/dev/null 2>&1', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readElectronVersion() {
  const pkg = readJsonSafely(path.join(electronDir, 'package.json'));
  return (pkg && pkg.version) || null;
}

function main() {
  if (isUsable()) {
    console.log('[ensure-electron] Electron install OK');
    return;
  }

  console.log(
    '[ensure-electron] Electron install broken (see https://github.com/electron/electron/issues/51619); repairing...',
  );
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform;
  const arch = process.arch;

  // `unzip` exists on macOS and most Linux distros (and is the reliable
  // extractor here), but not on Windows. On platforms without `unzip`, fall
  // back to Electron's own installer, which extracts correctly there.
  const canUnzip = (platform === 'darwin' || platform === 'linux') && hasUnzip();

  if (canUnzip) {
    let version = readElectronVersion();
    let zip = version ? findZip(version, platform, arch) : null;
    // Under Rosetta the download may have been for the opposite arch.
    if (!zip && platform === 'darwin' && arch === 'x64') {
      zip = version ? findZip(version, 'darwin', 'arm64') : null;
    }

    // If no archive matched (e.g. electron's package.json was temporarily
    // absent during a partial install), let Electron download/refresh and then
    // look for any matching cached archive.
    if (!zip) {
      if (version) {
        // Cache may be missing; let Electron download it (extraction may fail
        // again, but the cache will then contain the archive we need).
        try {
          execSync(`node "${path.join(electronDir, 'install.js')}"`, { stdio: 'inherit' });
        } catch {
          // ignore; we only care about populating the cache
        }
        zip = findZip(version, platform, arch) || (arch === 'x64' ? findZip(version, 'darwin', 'arm64') : null);
      }
      if (!zip) {
        // package.json may be temporarily absent (partial install); match any
        // version already present in the cache.
        zip =
          findZipAny(platform, arch) ||
          (arch === 'x64' && platform === 'darwin' ? findZipAny('darwin', 'arm64') : null);
      }
    }

    if (!zip) {
      console.warn(
        '[ensure-electron] No cached Electron archive found; skipping auto-repair. Run `pnpm run ensure-electron` after install.',
      );
      return;
    }

    const dist = path.join(electronDir, 'dist');
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(dist, { recursive: true });

    console.log(`[ensure-electron] Extracting ${zip}`);
    execSync(`unzip -o -q "${zip}" -d "${dist}"`, { stdio: 'inherit' });

    const platformPath = platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
    fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath);
  } else {
    console.log('[ensure-electron] Falling back to Electron installer (unzip unavailable on this platform)');
    try {
      execSync(`node "${path.join(electronDir, 'install.js')}"`, { stdio: 'inherit' });
    } catch {
      // ignore; isUsable() below reports the outcome
    }
  }

  if (!isUsable()) {
    console.warn(
      '[ensure-electron] Electron still broken after repair attempt. Run `pnpm run ensure-electron` manually.',
    );
  } else {
    console.log('[ensure-electron] Repair complete.');
  }
}

try {
  main();
} catch (err) {
  // Never fail `pnpm install`; report the problem and continue.
  console.warn('[ensure-electron] Repair skipped due to error:', err && err.message ? err.message : err);
}
