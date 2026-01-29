import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const defaultSettings = {
    theme: 'light', // 'light', 'dark', 'auto'
    defaultDocLimit: 50,
    defaultViewType: 'tree', // 'table', 'tree', 'json'
    autoExpandDocuments: true,
    showTypeColumn: true,
    fontSize: 'medium', // 'small', 'medium', 'large'
    // Data Type Display Settings
    timestampFormat: 'iso', // 'iso', 'unix', 'local', 'relative', 'utc'
    numberFormat: 'auto', // 'auto', 'fixed', 'scientific', 'thousands'
    numberDecimalPlaces: 2, // 0-10
    geopointFormat: 'decimal', // 'decimal', 'dms', 'compact'
};

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => {
        // Load from localStorage
        try {
            const saved = localStorage.getItem('firefoo-settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    });

    // Save to localStorage whenever settings change
    useEffect(() => {
        localStorage.setItem('firefoo-settings', JSON.stringify(settings));
    }, [settings]);

    // Sync native theme with settings
    useEffect(() => {
        if (window.electronAPI?.setNativeTheme) {
            // Map our theme setting to Electron's nativeTheme
            // 'auto' maps to 'system' in Electron
            const nativeTheme = settings.theme === 'auto' ? 'system' : settings.theme;
            window.electronAPI.setNativeTheme(nativeTheme);
        }
    }, [settings.theme]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const resetSettings = () => {
        setSettings(defaultSettings);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
