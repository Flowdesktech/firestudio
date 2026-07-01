/**
 * Controllers Index
 * Central registration point for all IPC handlers
 */

const firebaseController = require('./firebaseController');
const firestoreController = require('./firestoreController');
const googleController = require('./googleController');
const storageController = require('./storageController');
const authController = require('./authController');
const emulatorController = require('./emulatorController');

module.exports = {
  firebaseController,
  firestoreController,
  googleController,
  storageController,
  authController,
  emulatorController,

  /**
   * Registers all IPC handlers from all controllers
   */
  registerAllHandlers() {
    // Set up connection change callback to update references in other controllers
    firebaseController.setConnectionChangeCallback((admin, db, authEmulatorHost, storageEmulatorHost) => {
      firestoreController.setRefs(admin, db);
      storageController.setAdminRef(admin);
      storageController.setStorageEmulatorHost(storageEmulatorHost);
      authController.setAdminRef(admin);
      authController.setAuthEmulatorHost(authEmulatorHost);
    });

    // Register all handlers
    firebaseController.registerHandlers();
    firestoreController.registerHandlers();
    googleController.registerHandlers();
    storageController.registerHandlers();
    authController.registerHandlers();
    emulatorController.registerHandlers();
  },
};
