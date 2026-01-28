import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const defaultSettings = {
    theme: 'light', // 'light', 'dark', 'auto'
    defaultDocLimit: 50,
    defaultViewType: 'tree', // 'table', 'tree', 'json'
    autoExpandDocuments: true,
    showTypeColumn: true,
    fontSize: 'medium', // 'small', 'medium', 'large'
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
