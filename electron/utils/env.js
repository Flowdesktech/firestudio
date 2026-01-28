/**
 * Environment Utilities
 * Handles loading .env file from various locations
 */

const path = require('path');
const fs = require('fs');

let envLoaded = false;

/**
 * Loads environment variables from .env file
 * Searches multiple locations to find the .env file
 * @returns {boolean} - Whether .env was found and loaded
 */
function loadEnvFile() {
    if (envLoaded) return true;

    // Get app reference - may not be ready during initial require
    let app;
    try {
        app = require('electron').app;
    } catch (e) {
        // App not ready yet
    }

    const envPaths = [
        path.join(__dirname, '../../.env'),
        path.join(__dirname, '../../../.env'),
    ];

    // Add app-dependent paths if app is available
    if (app) {
        envPaths.push(
            path.join(process.resourcesPath || '', '.env'),
            path.join(app.getPath('exe'), '..', '.env'),
            path.join(app.getAppPath(), '.env')
        );
    }

    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            try {
                require('dotenv').config({ path: envPath });
                console.log('Loaded .env from:', envPath);
                envLoaded = true;
                return true;
            } catch (e) {
                // Continue trying other paths
            }
        }
    }

    console.log('.env file not found, using environment variables or defaults');
    return false;
}

// Load immediately on require
loadEnvFile();

module.exports = { loadEnvFile };
