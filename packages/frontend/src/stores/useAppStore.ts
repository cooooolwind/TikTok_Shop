import { create } from 'zustand';
import type { UIState, NotificationItem } from '../types';

let notificationId = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  globalLoading: false,
  notifications: [],
  themeMode: 'system',

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  pushNotification: (notif) => {
    const id = `notif_${++notificationId}`;
    set((s) => ({
      notifications: [
        ...s.notifications,
        { ...notif, id, timestamp: Date.now() },
      ],
    }));
  },

  dismissNotification: (id) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    }));
  },

  setThemeMode: (mode) => set({ themeMode: mode }),
}));
