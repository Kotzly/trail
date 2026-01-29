import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UiState = {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  toggleSidebarMobile: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarWidth: 240,
      sidebarMobileOpen: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      toggleSidebarMobile: () =>
        set((state) => ({ sidebarMobileOpen: !state.sidebarMobileOpen }))
    }),
    {
      name: "trail-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth
      })
    }
  )
);
