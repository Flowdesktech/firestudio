import React, { useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useSettings } from './context/SettingsContext';
import App from './App';

function ThemedApp() {
    const { settings } = useSettings();

    const theme = useMemo(() => {
        let mode = settings.theme;
        if (mode === 'auto') {
            mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        const isDark = mode === 'dark';

        // Modern dark theme - GitHub/Vercel inspired
        const darkPalette = {
            background: {
                default: '#0d1117',
                paper: '#161b22',
                elevated: '#21262d',
            },
            primary: {
                main: '#58a6ff',
                light: '#79c0ff',
                dark: '#388bfd',
                contrastText: '#ffffff',
            },
            secondary: {
                main: '#f0883e',
                light: '#f4a460',
                dark: '#db6d28',
            },
            success: {
                main: '#3fb950',
                light: '#56d364',
                dark: '#238636',
            },
            error: {
                main: '#f85149',
                light: '#ff7b72',
                dark: '#da3633',
            },
            warning: {
                main: '#d29922',
                light: '#e3b341',
                dark: '#9e6a03',
            },
            info: {
                main: '#58a6ff',
                light: '#79c0ff',
                dark: '#388bfd',
            },
            text: {
                primary: '#e6edf3',
                secondary: '#8b949e',
                disabled: '#888b8fff',
            },
            divider: '#30363d',
            action: {
                hover: 'rgba(177, 186, 196, 0.12)',
                selected: 'rgba(177, 186, 196, 0.16)',
                disabled: 'rgba(110, 118, 129, 0.4)',
                disabledBackground: 'rgba(110, 118, 129, 0.1)',
            },
        };

        // Light theme - clean and professional
        const lightPalette = {
            background: {
                default: '#f6f8fa',
                paper: '#ffffff',
                elevated: '#ffffff',
            },
            primary: {
                main: '#0969da',
                light: '#218bff',
                dark: '#0550ae',
                contrastText: '#ffffff',
            },
            secondary: {
                main: '#cf222e',
                light: '#fa4549',
                dark: '#a40e26',
            },
            success: {
                main: '#1a7f37',
                light: '#2da44e',
                dark: '#116329',
            },
            error: {
                main: '#cf222e',
                light: '#fa4549',
                dark: '#a40e26',
            },
            warning: {
                main: '#9a6700',
                light: '#bf8700',
                dark: '#7d4e00',
            },
            info: {
                main: '#0969da',
                light: '#218bff',
                dark: '#0550ae',
            },
            text: {
                primary: '#1f2328',
                secondary: '#656d76',
                disabled: '#8c959f',
            },
            divider: '#d0d7de',
            action: {
                hover: 'rgba(208, 215, 222, 0.32)',
                selected: 'rgba(208, 215, 222, 0.48)',
                disabled: 'rgba(175, 184, 193, 0.4)',
                disabledBackground: 'rgba(175, 184, 193, 0.2)',
            },
        };

        const palette = isDark ? darkPalette : lightPalette;

        // Syntax highlighting colors (VS Code inspired)
        const syntaxColors = isDark ? {
            // JSON colors
            string: '#ce9178',       // orange
            number: '#b5cea8',       // light green
            boolean: '#569cd6',      // blue (true/false)
            null: '#569cd6',         // blue
            key: '#9cdcfe',          // light blue (object keys)
            bracket: '#d4d4d4',      // light gray
            comment: '#6a9955',      // green
            // JavaScript colors
            keyword: '#c586c0',      // purple
            function: '#dcdcaa',     // yellow
            operator: '#d4d4d4',     // light gray
            variable: '#9cdcfe',     // light blue
            property: '#9cdcfe',     // light blue
            builtin: '#4ec9b0',      // cyan
            params: '#9cdcfe',       // light blue
            literal: '#569cd6',      // blue
            attr: '#9cdcfe',         // light blue
        } : {
            // JSON colors
            string: '#a31515',       // red
            number: '#098658',       // green
            boolean: '#0000ff',      // blue
            null: '#0000ff',         // blue
            key: '#001080',          // dark blue (object keys)
            bracket: '#000000',      // black
            comment: '#008000',      // green
            // JavaScript colors
            keyword: '#af00db',      // purple
            function: '#795e26',     // brown
            operator: '#000000',     // black
            variable: '#001080',     // dark blue
            property: '#001080',     // dark blue
            builtin: '#267f99',      // teal
            params: '#001080',       // dark blue
            literal: '#0000ff',      // blue
            attr: '#001080',         // dark blue
        };

        // Table colors
        const tableColors = isDark ? {
            headerBg: '#161b22',
            headerText: '#e6edf3',
            rowBg: '#0d1117',
            rowAltBg: '#161b22',
            rowHover: '#1f2428',
            rowSelected: '#1f6feb33',
            border: '#30363d',
            cellText: '#e6edf3',
        } : {
            headerBg: '#f6f8fa',
            headerText: '#1f2328',
            rowBg: '#ffffff',
            rowAltBg: '#f6f8fa',
            rowHover: '#f3f4f6',
            rowSelected: '#ddf4ff',
            border: '#d0d7de',
            cellText: '#1f2328',
        };

        return createTheme({
            palette: {
                mode: isDark ? 'dark' : 'light',
                ...palette,
            },
            custom: {
                syntax: syntaxColors,
                table: tableColors,
                sidebar: {
                    bg: isDark ? '#161b22' : '#f6f8fa',
                    hover: isDark ? '#1f2428' : '#eaeef2',
                    selected: isDark ? '#1f6feb33' : '#ddf4ff',
                    border: isDark ? '#30363d' : '#d0d7de',
                },
                editor: {
                    bg: isDark ? '#0d1117' : '#ffffff',
                    gutter: isDark ? '#161b22' : '#f6f8fa',
                    lineNumber: isDark ? '#484f58' : '#8c959f',
                    selection: isDark ? '#1f6feb66' : '#ddf4ff',
                },
            },
            typography: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: settings.fontSize === 'small' ? 12 : settings.fontSize === 'large' ? 14 : 13,
                mono: {
                    fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
                },
            },
            shape: { borderRadius: 6 },
            components: {
                MuiCssBaseline: {
                    styleOverrides: {
                        body: { margin: 0, padding: 0, overflow: 'hidden' },
                        '*::-webkit-scrollbar': { width: '8px', height: '8px' },
                        '*::-webkit-scrollbar-track': { background: 'transparent' },
                        '*::-webkit-scrollbar-thumb': {
                            background: isDark ? '#30363d' : '#d0d7de',
                            borderRadius: '4px',
                        },
                        '*::-webkit-scrollbar-thumb:hover': {
                            background: isDark ? '#484f58' : '#afb8c1',
                        },
                        '::selection': {
                            background: isDark ? '#1f6feb66' : '#0969da33',
                            color: isDark ? '#e6edf3' : '#1f2328',
                        },
                    },
                },
                MuiButton: {
                    styleOverrides: {
                        root: { textTransform: 'none', fontWeight: 500 },
                        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
                    },
                },
                MuiToggleButton: {
                    styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
                },
                MuiIconButton: {
                    styleOverrides: { root: { borderRadius: 6 } },
                },
                MuiDialog: {
                    styleOverrides: {
                        paper: { backgroundColor: palette.background.elevated, backgroundImage: 'none' },
                    },
                },
                MuiMenu: {
                    styleOverrides: {
                        paper: {
                            backgroundColor: palette.background.elevated,
                            backgroundImage: 'none',
                            border: `1px solid ${palette.divider}`,
                        },
                    },
                },
                MuiTooltip: {
                    styleOverrides: {
                        tooltip: {
                            backgroundColor: isDark ? '#484f58' : '#1f2328',
                            fontSize: '0.75rem',
                        },
                    },
                },
                MuiPaper: {
                    styleOverrides: { root: { backgroundImage: 'none' } },
                },
                MuiDrawer: {
                    styleOverrides: {
                        paper: { backgroundColor: palette.background.paper, backgroundImage: 'none' },
                    },
                },
                MuiTableCell: {
                    styleOverrides: {
                        root: { borderColor: tableColors.border },
                        head: { backgroundColor: tableColors.headerBg, fontWeight: 600 },
                    },
                },
                MuiChip: {
                    styleOverrides: { root: { fontWeight: 500 } },
                },
                MuiTextField: {
                    styleOverrides: {
                        root: {
                            '& .MuiOutlinedInput-root fieldset': { borderColor: palette.divider },
                        },
                    },
                },
                MuiDivider: {
                    styleOverrides: { root: { borderColor: palette.divider } },
                },
                MuiListItemButton: {
                    styleOverrides: {
                        root: {
                            '&.Mui-selected': { backgroundColor: palette.action.selected },
                            '&:hover': { backgroundColor: palette.action.hover },
                        },
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
