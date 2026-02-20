import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { AppState } from '@/types';

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Loading
        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),

        // Sidebar
        sidebarOpen: true,
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

        // Theme
        theme: 'system',
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'app-storage',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      },
    ),
    { name: 'app-store' },
  ),
);
