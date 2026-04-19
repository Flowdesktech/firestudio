/**
 * Application Menu
 * Creates and manages the application menu bar
 */

const { BrowserWindow, Menu, dialog, shell, app } = require('electron');
const { checkForUpdatesManual } = require('./autoUpdate');

// App Configuration - get version from package.json
const APP_VERSION = app.getVersion();
const APP_NAME = 'Firestudio';
const COMPANY_NAME = 'Flowdesk';
const SUPPORT_EMAIL = 'contact@flowdesk.tech';

/**
 * Creates the application menu
 */
function createAppMenu() {
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Firebase Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('open-add-project-dialog');
          },
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('open-settings-dialog');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click: () => {
            checkForUpdatesManual();
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: `About ${APP_NAME}`,
              message: APP_NAME,
              detail: `Version: ${APP_VERSION}\n\n© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.\n\nA powerful Firebase GUI client for managing Firestore, Storage, and Authentication.`,
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Contact Support',
          click: () => {
            shell.openExternal(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(APP_NAME + ' Support')}`);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

module.exports = { createAppMenu, APP_VERSION, APP_NAME };
