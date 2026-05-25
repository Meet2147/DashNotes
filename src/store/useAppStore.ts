import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewType = 'all' | 'collection' | 'calendar' | 'tags';
export type SortType = 'updatedAt' | 'createdAt' | 'title';
export type MobilePanel = 'sidebar' | 'notes' | 'editor';

interface AppState {
  selectedNoteId: number | null;
  selectedCollectionId: number | null;
  searchQuery: string;
  view: ViewType;
  darkMode: boolean;
  sidebarOpen: boolean;
  sortBy: SortType;
  mobilePanel: MobilePanel;
  calendarSelectedDate: string | null; // ISO date string

  setSelectedNoteId: (id: number | null) => void;
  setSelectedCollectionId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
  setView: (view: ViewType) => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSortBy: (sort: SortType) => void;
  setMobilePanel: (panel: MobilePanel) => void;
  setCalendarSelectedDate: (date: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedNoteId: null,
      selectedCollectionId: null,
      searchQuery: '',
      view: 'all',
      darkMode: false,
      sidebarOpen: true,
      sortBy: 'updatedAt',
      mobilePanel: 'notes',
      calendarSelectedDate: null,

      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setView: (view) => set({ view }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSortBy: (sort) => set({ sortBy: sort }),
      setMobilePanel: (panel) => set({ mobilePanel: panel }),
      setCalendarSelectedDate: (date) => set({ calendarSelectedDate: date }),
    }),
    {
      name: 'dashnotes-app-store',
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarOpen: state.sidebarOpen,
        sortBy: state.sortBy,
        view: state.view,
      }),
    }
  )
);
