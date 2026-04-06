/**
 * Common Utilities
 * Shared utility functions used across multiple components
 */

import Swal from 'sweetalert2';

interface ConfirmOptions {
  icon?: 'warning' | 'error' | 'success' | 'info' | 'question';
  confirmText?: string;
  cancelText?: string;
  isDark?: boolean;
}

/**
 * Shows a confirmation dialog using SweetAlert2
 */
export const confirmAction = async (title: string, message: string, options: ConfirmOptions = {}): Promise<boolean> => {
  const {
    icon = 'warning',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDark = document.body.classList.contains('dark-mode') ||
      window.matchMedia?.('(prefers-color-scheme: dark)')?.matches,
  } = options;

  const result = await Swal.fire({
    title,
    html: message,
    icon,
    showCancelButton: true,
    confirmButtonColor: icon === 'warning' || icon === 'error' ? '#d33' : '#3085d6',
    cancelButtonColor: '#6c757d',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: isDark ? '#1e1e1e' : '#fff',
    color: isDark ? '#fff' : '#333',
  });

  return result.isConfirmed;
};

/**
 * Copies text to clipboard
 */
export const copyToClipboard = async (text: string, onSuccess?: () => void): Promise<boolean> => {
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
 */
export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '—';
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return date.toLocaleString();
  } catch {
    return typeof dateString === 'string' ? dateString : 'Invalid Date';
  }
};

/**
 * Formats a timestamp (seconds) for display
 */
export const formatTimestamp = (seconds: number | null | undefined): string => {
  if (!seconds) return '—';
  return new Date(seconds * 1000).toISOString();
};

/**
 * Formats file size in bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validates a JSON string
 */
export const validateJson = (jsonString: string): { valid: boolean; error: string | null; data: unknown } => {
  try {
    const data: unknown = JSON.parse(jsonString);
    return { valid: true, error: null, data };
  } catch (error) {
    return { valid: false, error: (error as Error).message, data: null };
  }
};

/**
 * Debounces a function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
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
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Truncates a string to a maximum length
 */
export const truncateString = (str: string, maxLength: number = 50): string => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

/**
 * Formats unknown errors into readable messages
 */
export const getErrorMessage = (error: unknown, fallback: string = 'Unknown error'): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

/**
 * Downloads data as a JSON file
 */
export const downloadJson = (data: unknown, filename: string): void => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Count lines without splitting the whole string (avoids huge arrays on large files). */
export const countLines = (text: string): number => {
  if (!text) return 1;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
};
