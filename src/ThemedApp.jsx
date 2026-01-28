import React, { useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useSettings } from './context/SettingsContext';
import App from './App';

function ThemedApp() {
    const { settings } = useSettings();

    const theme = useMemo(() => {
        // Determine actual theme mode
        let mode = settings.theme;
        if (mode === 'auto') {
            mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        const isDark = mode === 'dark';

        return createTheme({
            palette: {
                mode: isDark ? 'dark' : 'light',
                primary: {
                    main: '#1976d2',
                },
                secondary: {
                    main: '#ff9800',
                },
                background: isDark ? {
                    default: '#1e1e1e',
                    paper: '#252526',
                } : {
                    default: '#ffffff',
                    paper: '#ffffff',
                },
            },
            typography: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: settings.fontSize === 'small' ? 12 : settings.fontSize === 'large' ? 14 : 13,
            },
            components: {
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            margin: 0,
                            padding: 0,
                            overflow: 'hidden',
                        },
                        '*::-webkit-scrollbar': {
                            width: '8px',
                            height: '8px',
                        },
                        '*::-webkit-scrollbar-track': {
                            background: isDark ? '#2d2d2d' : '#f1f1f1',
                        },
                        '*::-webkit-scrollbar-thumb': {
                            background: isDark ? '#555' : '#c1c1c1',
                            borderRadius: '4px',
                        },
                        '*::-webkit-scrollbar-thumb:hover': {
                            background: isDark ? '#666' : '#a1a1a1',
                        },
                    },
                },
                MuiButton: {
                    styleOverrides: {
                        root: {
                            textTransform: 'none',
                        },
                    },
                },
                MuiToggleButton: {
                    styleOverrides: {
                        root: {
                            textTransform: 'none',
                        },
                    },
                },
                MuiDialog: {
                    styleOverrides: {
                        paper: isDark ? {
                            backgroundColor: '#2d2d2d',
                        } : {},
                    },
                },
            },
        });
    }, [settings.theme, settings.fontSize]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    );
}

export default ThemedApp;
