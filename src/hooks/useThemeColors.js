/**
 * Custom Hook: useThemeColors
 * Provides consistent theme colors across components
 */

import { useMemo } from 'react';
import { useTheme } from '@mui/material';

/**
 * Returns theme-aware colors for consistent styling
 * @returns {Object} - Theme colors object
 */
export const useThemeColors = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return useMemo(() => ({
        isDark,
        borderColor: isDark ? '#333' : '#e0e0e0',
        bgColor: isDark ? '#1e1e1e' : '#fafafa',
        hoverBg: isDark ? '#333' : '#f5f5f5',
        textColor: isDark ? '#ccc' : '#333',
        mutedColor: isDark ? '#888' : '#666',
        selectedBg: isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd',
        chipBg: isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd',
        cardBg: isDark ? '#2d2d2d' : '#f5f5f5',
        tableBg: isDark ? '#0f1729' : '#fafafa'
    }), [isDark]);
};

export default useThemeColors;
