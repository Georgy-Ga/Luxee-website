import { create } from 'zustand';
import { aiApi } from '../api/aiApi';

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

  toggleAIForAccount: async (accountId) => {
    try {
      // Вызываем API для переключения AI аккаунта
      await aiApi.toggleMyAccountAi(accountId);
      
      // Обновляем локальное состояние
      set((state) => ({
        aiEnabledByAccount: {
          ...state.aiEnabledByAccount,
          [accountId]: !state.aiEnabledByAccount[accountId],
        },
      }));
      
      return { success: true };
    } catch (error) {
      console.error('Error toggling account AI:', error);
      // Не меняем состояние если ошибка
      throw error;
    }
  },

  setAIForAccount: (accountId, enabled) => set((state) => ({
    aiEnabledByAccount: {
      ...state.aiEnabledByAccount,
      [accountId]: enabled,
    },
  })),

  // Загрузить AI статусы всех аккаунтов пользователя
  loadAccountAIStatuses: async () => {
    try {
      const data = await aiApi.getMyAccountsAiStatus();
      const statuses = {};
      
      if (data.accounts && Array.isArray(data.accounts)) {
        data.accounts.forEach(account => {
          // AI аккаунта включен если и aiEnabled и aiEnabledByAdmin = true
          statuses[account._id] = account.aiEnabled && account.aiEnabledByAdmin;
        });
      }
      
      set({ aiEnabledByAccount: statuses });
      return statuses;
    } catch (error) {
      console.error('Error loading account AI statuses:', error);
      return {};
    }
  },

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
