import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define Tab interface locally to avoid cross-slice imports
export interface Tab {
  id: string;
  projectId: string;
  projectName: string;
  collectionPath?: string;
  docPath?: string | null;
  label: string;
  type: 'collection' | 'storage' | 'auth';
  /** Service account — FirestoreDatabase.id for collection tabs */
  firestoreDatabaseId?: string;
  databaseLabel?: string;
}

export interface DialogState {
  type: string;
  props?: Record<string, unknown>;
}

export interface UiState {
  openTabs: Tab[];
  activeTabId: string | null;
  activeDialog: DialogState | null;
  sidebarOpen: boolean;
  favoritesPanelOpen: boolean;
  consolePanelOpen: boolean;
  savedQueriesPanelOpen: boolean;
  expandedSidebarItems: Record<string, boolean>;
}

export const uiInitialState: UiState = {
  // Tab System
  openTabs: [],
  activeTabId: null,

  // Dialog System (Global)
  activeDialog: null, // { type: 'ADD_COLLECTION', props: { ... } }

  // Panels
  sidebarOpen: true,
  favoritesPanelOpen: false,
  consolePanelOpen: false,
  savedQueriesPanelOpen: false,

  // Sidebar State
  expandedSidebarItems: {}, // { 'itemId': true }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: uiInitialState,
  reducers: {
    // Tab Actions
    addTab: (state, action: PayloadAction<Tab>) => {
      const tab = action.payload;
      // Check if tab exists
      const existing = state.openTabs.find((t) => t.id === tab.id);
      if (!existing) {
        state.openTabs.push(tab);
      }
      state.activeTabId = tab.id;
    },
    closeTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      const tabIndex = state.openTabs.findIndex((t) => t.id === tabId);

      if (tabIndex === -1) return;

      // Calculate new active tab if we are closing the active one
      if (state.activeTabId === tabId) {
        if (state.openTabs.length > 1) {
          // Try to go to right, else left
          const newIndex = tabIndex === state.openTabs.length - 1 ? tabIndex - 1 : tabIndex + 1;
          state.activeTabId = state.openTabs[newIndex].id;
        } else {
          state.activeTabId = null;
        }
      }

      state.openTabs = state.openTabs.filter((t) => t.id !== tabId);
    },
    setActiveTab: (state, action: PayloadAction<string | null>) => {
      state.activeTabId = action.payload;
    },
    setTabs: (state, action: PayloadAction<Tab[]>) => {
      state.openTabs = action.payload;
    },
    closeTabsForProject: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      const keptTabs = state.openTabs.filter((t) => t.projectId !== projectId);

      // If active tab was removed, select the last available one
      if (keptTabs.length > 0 && !keptTabs.find((t) => t.id === state.activeTabId)) {
        state.activeTabId = keptTabs[keptTabs.length - 1].id;
      } else if (keptTabs.length === 0) {
        state.activeTabId = null;
      }

      state.openTabs = keptTabs;
    },

    // Dialog Actions
    openDialog: (state, action: PayloadAction<DialogState>) => {
      // Payload: { type: 'ADD_COLLECTION', props: { project: ... } }
      state.activeDialog = action.payload;
    },
    closeDialog: (state) => {
      state.activeDialog = null;
    },

    // Panel Actions
    toggleFavoritesPanel: (state) => {
      state.favoritesPanelOpen = !state.favoritesPanelOpen;
      if (state.favoritesPanelOpen) {
        state.consolePanelOpen = false;
        state.savedQueriesPanelOpen = false;
      }
    },
    toggleConsolePanel: (state) => {
      state.consolePanelOpen = !state.consolePanelOpen;
      if (state.consolePanelOpen) {
        state.favoritesPanelOpen = false;
        state.savedQueriesPanelOpen = false;
      }
    },
    toggleSavedQueriesPanel: (state) => {
      state.savedQueriesPanelOpen = !state.savedQueriesPanelOpen;
      if (state.savedQueriesPanelOpen) {
        state.favoritesPanelOpen = false;
        state.consolePanelOpen = false;
      }
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarItem: (state, action: PayloadAction<string>) => {
      const itemId = action.payload;
      state.expandedSidebarItems[itemId] = !state.expandedSidebarItems[itemId];
    },
    setSidebarItemExpanded: (state, action: PayloadAction<{ id: string; expanded: boolean }>) => {
      const { id, expanded } = action.payload;
      state.expandedSidebarItems[id] = expanded;
    },
  },
});

export const {
  addTab,
  closeTab,
  setActiveTab,
  setTabs,
  closeTabsForProject,
  openDialog,
  closeDialog,
  toggleFavoritesPanel,
  toggleConsolePanel,
  toggleSavedQueriesPanel,
  setSidebarOpen,
  toggleSidebarItem,
  setSidebarItemExpanded,
} = uiSlice.actions;

// Selectors
export const selectOpenTabs = (state: { ui: UiState }) => state.ui.openTabs;
export const selectActiveTabId = (state: { ui: UiState }) => state.ui.activeTabId;
export const selectActiveTab = (state: { ui: UiState }) => state.ui.openTabs.find((t) => t.id === state.ui.activeTabId);
export const selectActiveDialog = (state: { ui: UiState }) => state.ui.activeDialog;
export const selectUiState = (state: { ui: UiState }) => state.ui;
export const selectExpandedSidebarItems = (state: { ui: UiState }) => state.ui.expandedSidebarItems;

export default uiSlice.reducer;
