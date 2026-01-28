/**
 * Firestudio - Electron Main Process
 * Entry point for the Electron application
 */

// Load environment variables first
require('./utils/env');

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Modules
const { createAppMenu } = require('./menu');
const controllers = require('./controllers');

// ============================================
// Configuration
// ============================================

const isDev = process.env.NODE_ENV === 'development';

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
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'default',
        icon: path.join(__dirname, '../assets/icon.png')
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
