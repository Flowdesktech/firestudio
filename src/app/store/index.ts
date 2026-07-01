import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

// App-level slices
import uiReducer from './slices/uiSlice';
import logsReducer, { addLog } from './slices/logsSlice';
import settingsReducer from './slices/settingsSlice';
import favoritesReducer, { addFavorite, removeFavorite, toggleFavorite } from './slices/favoritesSlice';
import { loadFavorites, saveFavorites } from './favoritesPersistence';
import {
  addTab,
  closeTab,
  setActiveTab,
  closeTabsForProject,
  setSidebarOpen,
  setSidebarItemExpanded,
} from './slices/uiSlice';
import { loadUiState, saveUiState } from './uiPersistence';
import { updateSetting, resetSettings, SettingsState } from './slices/settingsSlice';
import { loadSettings, saveSettings } from './settingsPersistence';
import { electronService } from '../../shared/services/electronService';

// Feature slices
import projectsReducer, {
  addProject,
  removeProject,
  updateProject,
  addGoogleAccount,
  connectServiceAccount,
  connectEmulatorProject,
  refreshCollections,
  Project,
  GoogleAccount,
} from '../../features/projects/store/projectsSlice';
import { saveProjectsToStorage } from '../../features/projects/store/projectsPersistence';
import collectionReducer, { fetchDocuments } from '../../features/collections/store/collectionSlice';
import savedQueriesReducer, { addSavedQuery, removeSavedQuery } from '../../features/console/store/savedQueriesSlice';
import { loadSavedQueriesState, saveSavedQueriesState } from '../../features/console/store/savedQueriesPersistence';

const uiPersistenceListener = createListenerMiddleware();

uiPersistenceListener.startListening({
  matcher: isAnyOf(addTab, closeTab, setActiveTab, closeTabsForProject, setSidebarOpen, setSidebarItemExpanded),
  effect: (_, api) => {
    const state = api.getState() as { ui: ReturnType<typeof loadUiState> };
    saveUiState(state.ui);
  },
});

const projectsPersistenceListener = createListenerMiddleware();

projectsPersistenceListener.startListening({
  matcher: isAnyOf(
    addProject,
    removeProject,
    updateProject,
    addGoogleAccount,
    connectServiceAccount.fulfilled,
    connectEmulatorProject.fulfilled,
    refreshCollections.fulfilled,
  ),
  effect: (_, api) => {
    const state = api.getState() as { projects: { items: (Project | GoogleAccount)[] } };
    saveProjectsToStorage(state.projects.items);
  },
});

const favoritesPersistenceListener = createListenerMiddleware();

favoritesPersistenceListener.startListening({
  matcher: isAnyOf(addFavorite, removeFavorite, toggleFavorite),
  effect: (_, api) => {
    const state = api.getState() as { favorites: ReturnType<typeof loadFavorites> };
    saveFavorites(state.favorites);
  },
});

const savedQueriesPersistenceListener = createListenerMiddleware();

savedQueriesPersistenceListener.startListening({
  matcher: isAnyOf(addSavedQuery, removeSavedQuery),
  effect: (_, api) => {
    const state = api.getState() as { savedQueries: ReturnType<typeof loadSavedQueriesState> };
    saveSavedQueriesState(state.savedQueries);
  },
});

const collectionLogsListener = createListenerMiddleware();

collectionLogsListener.startListening({
  actionCreator: fetchDocuments.fulfilled,
  effect: (action, api) => {
    const state = api.getState() as {
      collection?: { cache?: Record<string, { queryMode?: 'simple' | 'js' }> };
    };
    const key = action.meta.arg.key;
    const queryMode = state.collection?.cache?.[key]?.queryMode ?? 'simple';
    const count = action.payload.documents.length;
    const message =
      queryMode === 'js'
        ? `JS Query returned ${count} documents`
        : `Loaded ${count} documents from ${action.meta.arg.collection}`;
    api.dispatch(addLog({ type: 'success', message }));
  },
});

collectionLogsListener.startListening({
  actionCreator: fetchDocuments.rejected,
  effect: (action, api) => {
    if (action.meta.aborted) return;
    const message =
      typeof action.payload === 'string' ? action.payload : action.error?.message || 'Failed to load documents';
    api.dispatch(addLog({ type: 'error', message }));
  },
});

const settingsPersistenceListener = createListenerMiddleware();

const applyNativeTheme = (theme: SettingsState['theme']) => {
  const nativeTheme = theme === 'auto' ? 'system' : theme;
  electronService.api.setNativeTheme(nativeTheme);
};

settingsPersistenceListener.startListening({
  matcher: isAnyOf(updateSetting, resetSettings),
  effect: (action, api) => {
    const state = api.getState() as { settings: SettingsState };
    saveSettings(state.settings);

    if (updateSetting.match(action) && action.payload.key === 'theme') {
      applyNativeTheme(action.payload.value as SettingsState['theme']);
    }
    if (resetSettings.match(action)) {
      applyNativeTheme(state.settings.theme);
    }
  },
});

export const store = configureStore({
  preloadedState: {
    ui: loadUiState(),
    favorites: loadFavorites(),
    savedQueries: loadSavedQueriesState(),
    settings: loadSettings(),
  },
  reducer: {
    projects: projectsReducer,
    ui: uiReducer,
    logs: logsReducer,
    settings: settingsReducer,
    favorites: favoritesReducer,
    collection: collectionReducer,
    savedQueries: savedQueriesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['collection/fetchDocuments/fulfilled', 'collection/updateDocument/fulfilled'],
        ignoredPaths: ['collection.cache'],
      },
      thunk: {
        extraArgument: { electron: electronService },
      },
    }).prepend(
      collectionLogsListener.middleware,
      uiPersistenceListener.middleware,
      projectsPersistenceListener.middleware,
      favoritesPersistenceListener.middleware,
      savedQueriesPersistenceListener.middleware,
      settingsPersistenceListener.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
