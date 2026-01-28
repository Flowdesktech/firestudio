/**
 * Controllers Index
 * Central registration point for all IPC handlers
 */

const firebaseController = require('./firebaseController');
const firestoreController = require('./firestoreController');
const googleController = require('./googleController');
const storageController = require('./storageController');
const authController = require('./authController');

module.exports = {
    firebaseController,
    firestoreController,
    googleController,
    storageController,
    authController,

    /**
     * Registers all IPC handlers from all controllers
     */
    registerAllHandlers() {
        // Set up connection change callback to update references in other controllers
        firebaseController.setConnectionChangeCallback((admin, db) => {
            firestoreController.setRefs(admin, db);
            storageController.setAdminRef(admin);
            authController.setAdminRef(admin);
        });

        // Register all handlers
        firebaseController.registerHandlers();
        firestoreController.registerHandlers();
        googleController.registerHandlers();
        storageController.registerHandlers();
        authController.registerHandlers();
    }
};
