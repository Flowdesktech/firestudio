import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsProvider } from './context/SettingsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { ProjectsProvider } from './context/ProjectsContext';
import ThemedApp from './ThemedApp';
import { initElectronMock } from './utils/electronMock';

// Initialize mock electronAPI if not running in Electron
initElectronMock();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SettingsProvider>
            <ProjectsProvider>
                <FavoritesProvider>
                    <ThemedApp />
                </FavoritesProvider>
            </ProjectsProvider>
        </SettingsProvider>
    </React.StrictMode>
);
