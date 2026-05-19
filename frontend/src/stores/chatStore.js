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
  aiEnabledByAccount: {}, // { accountId: boolean }

  setSelectedAccount: (account) => set({ selectedAccount: account, selectedProfile: null, selectedChat: null }),
  
  setSelectedProfile: (profile) => set({ selectedProfile: profile, selectedChat: null }),
  
  setSelectedChat: (chat) => set({ selectedChat: chat }),

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

  reset: () => set({
    selectedAccount: null,
    selectedProfile: null,
    selectedChat: null,
  }),
}));

export default useChatStore;
