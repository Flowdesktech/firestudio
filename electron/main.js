/**
 * Firestudio - Electron Main Process
 * Entry point for the Electron application
 */

// Load environment variables first
require('./utils/env');

const { app, BrowserWindow, nativeTheme, ipcMain, shell } = require('electron');
const path = require('path');

// Modules
const { createAppMenu } = require('./menu');
const controllers = require('./controllers');

// ============================================
// Configuration
// ============================================

const isDev = process.env.NODE_ENV === 'development';

// Set app name for OS-level identification (taskbar, firewall dialogs, etc.)
app.setName('Firestudio');

// ============================================
// Window Management
// ============================================

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

// ============================================
// App Lifecycle
// ============================================

// ============================================
// Theme Handler
// ============================================

ipcMain.handle('theme:set', (event, theme) => {
  // theme can be 'dark', 'light', or 'system'
  nativeTheme.themeSource = theme;
  return { success: true };
});

ipcMain.handle('theme:get', () => {
  return {
    themeSource: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// ============================================
// Shell Handler - Open external URLs in default browser
// ============================================

ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    // Validate URL to prevent security issues
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      await shell.openExternal(url);
      return { success: true };
    }
    return { success: false, error: 'Invalid URL protocol' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createAppMenu();
  createWindow();
  controllers.registerAllHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
