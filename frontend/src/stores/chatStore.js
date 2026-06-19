import { create } from 'zustand';

/**
 * Store для управления чатами и выбранными элементами
 * НЕ содержит AI логику - она в aiStateStore.js
 */
const useChatStore = create((set) => ({
  // Выбранный аккаунт Luxee
  selectedAccount: null,
  // Выбранный профиль (анкета)
  selectedProfile: null,
  // Выбранный мужчина (чат)
  selectedChat: null,
  // Состояние sidebar для мобильных устройств
  sidebarOpen: false,

  setSelectedAccount: (account) => set({ 
    selectedAccount: account, 
    selectedProfile: null, 
    selectedChat: null 
  }),
  
  setSelectedProfile: (profile) => set({ 
    selectedProfile: profile, 
    selectedChat: null 
  }),
  
  setSelectedChat: (chat) => set({ selectedChat: chat }),

  // Toggle sidebar для мобильных
  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

export default useChatStore;
