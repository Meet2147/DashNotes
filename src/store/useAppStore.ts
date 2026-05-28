import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewType = 'all' | 'collection' | 'tags' | 'trash';
export type MobilePanel = 'sidebar' | 'notes' | 'editor';
export type SortBy = 'updatedAt' | 'createdAt' | 'title';

interface AppState {
  selectedNoteId: string | null;
  selectedCollectionId: string | null;
  searchQuery: string;
  view: ViewType;
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  mobilePanel: MobilePanel;
  sortBy: SortBy;

  setSelectedNoteId: (id: string | null) => void;
  setSelectedCollectionId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setView: (view: ViewType) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAiSidebarOpen: (open: boolean) => void;
  toggleAiSidebar: () => void;
  setMobilePanel: (panel: MobilePanel) => void;
  setSortBy: (sort: SortBy) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedNoteId: null,
      selectedCollectionId: null,
      searchQuery: '',
      view: 'all',
      sidebarOpen: true,
      aiSidebarOpen: false,
      mobilePanel: 'notes',
      sortBy: 'updatedAt',

      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setView: (view) => set({ view }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }),
      toggleAiSidebar: () =>
        set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),
      setMobilePanel: (panel) => set({ mobilePanel: panel }),
      setSortBy: (sortBy) => set({ sortBy }),
    }),
    {
      name: 'opennote-app-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        aiSidebarOpen: state.aiSidebarOpen,
        view: state.view,
        sortBy: state.sortBy,
      }),
    }
  )
);
