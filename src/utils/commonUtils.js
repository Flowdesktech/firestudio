/**
 * Common Utilities
 * Shared utility functions used across multiple components
 */

/**
 * Copies text to clipboard
 * @param {string} text - Text to copy
 * @param {Function} onSuccess - Optional callback on success
 * @returns {Promise<boolean>} - Success status
 */
export const copyToClipboard = async (text, onSuccess) => {
    try {
        await navigator.clipboard.writeText(text);
        onSuccess?.();
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

/**
 * Formats a date string for display
 * @param {string|Date} dateString - Date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
        return new Date(dateString).toLocaleString();
    } catch {
        return dateString;
    }
};

/**
 * Formats a timestamp (seconds) for display
 * @param {number} seconds - Unix timestamp in seconds
 * @returns {string} - ISO date string
 */
export const formatTimestamp = (seconds) => {
    if (!seconds) return '—';
    return new Date(seconds * 1000).toISOString();
};

/**
 * Formats file size in bytes to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
export const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validates a JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {Object} - { valid: boolean, error: string|null, data: any|null }
 */
export const validateJson = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        return { valid: true, error: null, data };
    } catch (error) {
        return { valid: false, error: error.message, data: null };
    }
};

/**
 * Debounces a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Generates a unique ID
 * @returns {string} - Unique ID string
 */
export const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Truncates a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
export const truncateString = (str, maxLength = 50) => {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};
