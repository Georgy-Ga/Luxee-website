import { create } from 'zustand';

const useChatStore = create((set) => ({
  // Выбранный аккаунт Luxee
  selectedAccount: null,
  // Выбранный профиль (анкета)
  selectedProfile: null,
  // Выбранный мужчина (чат)
  selectedChat: null,
  // Статус AI (глобальный и по аккаунтам)
  aiEnabled: false,
  aiEnabledByAdmin: false, // Разрешил ли админ AI
  aiEnabledByAccount: {}, // { accountId: boolean }
  // Состояние sidebar для мобильных устройств
  sidebarOpen: false,

  setSelectedAccount: (account) => set({ selectedAccount: account, selectedProfile: null, selectedChat: null }),
  
  setSelectedProfile: (profile) => set({ selectedProfile: profile, selectedChat: null }),
  
  setSelectedChat: (chat) => set({ selectedChat: chat }),

  // Установить AI статус из user data
  setAIStatus: (aiEnabled, aiEnabledByAdmin) => set({ aiEnabled, aiEnabledByAdmin }),

  toggleAI: () => set((state) => ({ aiEnabled: !state.aiEnabled })),

  toggleAIForAccount: (accountId) => set((state) => ({
    aiEnabledByAccount: {
      ...state.aiEnabledByAccount,
      [accountId]: !state.aiEnabledByAccount[accountId],
    },
  })),

  setAIForAccount: (accountId, enabled) => set((state) => ({
    aiEnabledByAccount: {
      ...state.aiEnabledByAccount,
      [accountId]: enabled,
    },
  })),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  closeSidebar: () => set({ sidebarOpen: false }),

  reset: () => set({
    selectedAccount: null,
    selectedProfile: null,
    selectedChat: null,
    sidebarOpen: false,
  }),
}));

export default useChatStore;
