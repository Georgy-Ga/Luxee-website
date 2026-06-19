/**
 * Централизованное хранилище состояний AI для всех аккаунтов
 * Разделяет пользовательские данные (Sidebar) и админские данные (AdminModal)
 */

import { create } from 'zustand';
import { aiApi } from '../api/aiApi';

const useAiStateStore = create((set, get) => ({
  // ============ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ ============
  // Map<accountId, {aiEnabled, aiEnabledByAdmin}>
  userAccounts: new Map(),
  userDataLoading: false,
  userDataError: null,

  // ============ АДМИНСКИЕ ДАННЫЕ ============
  adminData: {
    users: [], // [{_id, email, aiEnabled, aiEnabledByAdmin, accounts: [...]}]
    loading: false,
    error: null,
  },

  // ============ СОСТОЯНИЯ ОБРАБОТКИ ============
  processingBulk: false,
  processingAccounts: new Set(),

  // ============ ПОЛЬЗОВАТЕЛЬСКИЕ ДЕЙСТВИЯ ============

  /**
   * Загрузить AI данные текущего пользователя
   */
  loadUserAiData: async () => {
    set({ userDataLoading: true, userDataError: null });
    try {
      const response = await aiApi.getMyAccountsAiStatus();
      console.log('[AI State] Loaded user AI data:', response);

      const accountsMap = new Map();
      response.accounts?.forEach((acc) => {
        accountsMap.set(acc._id, {
          aiEnabled: acc.aiEnabled,
          aiEnabledByAdmin: acc.aiEnabledByAdmin,
        });
      });

      set({
        userAccounts: accountsMap,
        userDataLoading: false,
      });
    } catch (error) {
      console.error('[AI State] Failed to load user AI data:', error);
      set({
        userDataError: error.message,
        userDataLoading: false,
      });
    }
  },

  /**
   * Обновить состояние аккаунта в пользовательских данных
   */
  updateUserAccount: (accountId, updates) => {
    const { userAccounts } = get();
    const newMap = new Map(userAccounts);
    const current = newMap.get(accountId) || {};
    newMap.set(accountId, { ...current, ...updates });

    console.log('[AI State] Updated user account:', accountId, updates);
    set({ userAccounts: newMap });
  },

  /**
   * Добавить новый аккаунт в пользовательские данные
   */
  addUserAccount: (accountId, aiEnabled = false, aiEnabledByAdmin = false) => {
    const { userAccounts } = get();
    const newMap = new Map(userAccounts);
    newMap.set(accountId, { aiEnabled, aiEnabledByAdmin });

    console.log('[AI State] Added user account:', accountId);
    set({ userAccounts: newMap });
  },

  /**
   * Удалить аккаунт из пользовательских данных
   */
  removeUserAccount: (accountId) => {
    const { userAccounts } = get();
    const newMap = new Map(userAccounts);
    newMap.delete(accountId);

    console.log('[AI State] Removed user account:', accountId);
    set({ userAccounts: newMap });
  },

  // ============ АДМИНСКИЕ ДЕЙСТВИЯ ============

  /**
   * Загрузить AI данные всех пользователей (для админов)
   */
  loadAllUsersAiData: async () => {
    console.log('[AI State] 🔄 Loading all users AI data for admin panel...');
    set((state) => ({
      adminData: { ...state.adminData, loading: true, error: null },
    }));

    try {
      const response = await aiApi.getAllUsersAiStatus();
      console.log('[AI State] 📊 Received admin data:', response);
      console.log('[AI State] 👥 Users count:', response.users?.length || 0);

      set((state) => ({
        adminData: {
          users: response.users || [],
          loading: false,
          error: null,
        },
      }));

      console.log('[AI State] ✅ Admin data updated in store');
    } catch (error) {
      console.error('[AI State] ❌ Failed to load admin data:', error);
      set((state) => ({
        adminData: {
          ...state.adminData,
          loading: false,
          error: error.message,
        },
      }));
    }
  },

  /**
   * Обновить аккаунт в админских данных
   */
  updateAccountInAdminData: ({ accountId, aiEnabled, aiEnabledByAdmin }) => {
    console.log('[AI State] 🔄 Updating account in admin data:', {
      accountId,
      aiEnabled,
      aiEnabledByAdmin,
    });

    set((state) => {
      const updatedUsers = state.adminData.users.map((user) => ({
        ...user,
        accounts: user.accounts.map((acc) =>
          acc._id === accountId
            ? { ...acc, aiEnabled, aiEnabledByAdmin }
            : acc
        ),
      }));

      console.log('[AI State] ✅ Admin data updated for account:', accountId);
      return {
        adminData: {
          ...state.adminData,
          users: updatedUsers,
        },
      };
    });
  },

  /**
   * Добавить новый аккаунт в админские данные
   */
  addAccountToAdminData: ({ accountId, userId, luxeeEmail }) => {
    console.log('[AI State] ➕ Adding account to admin data:', accountId);

    set((state) => {
      const updatedUsers = state.adminData.users.map((user) => {
        if (user._id === userId) {
          return {
            ...user,
            accounts: [
              ...user.accounts,
              {
                _id: accountId,
                luxeeEmail,
                aiEnabled: false,
                aiEnabledByAdmin: false,
              },
            ],
          };
        }
        return user;
      });

      return {
        adminData: {
          ...state.adminData,
          users: updatedUsers,
        },
      };
    });
  },

  /**
   * Удалить аккаунт из админских данных
   */
  removeAccountFromAdminData: ({ accountId, userId }) => {
    console.log('[AI State] ➖ Removing account from admin data:', accountId);

    set((state) => {
      const updatedUsers = state.adminData.users.map((user) => {
        if (user._id === userId) {
          return {
            ...user,
            accounts: user.accounts.filter((acc) => acc._id !== accountId),
          };
        }
        return user;
      });

      return {
        adminData: {
          ...state.adminData,
          users: updatedUsers,
        },
      };
    });
  },

  /**
   * Очистить ошибку админских данных
   */
  clearAdminDataError: () => {
    set((state) => ({
      adminData: { ...state.adminData, error: null },
    }));
  },

  // ============ УПРАВЛЕНИЕ ОБРАБОТКОЙ ============

  /**
   * Начать bulk операцию (блокирует все кнопки)
   */
  startBulkOperation: () => {
    console.log('[AI State] 🔒 Starting bulk operation - blocking all buttons');
    set({ processingBulk: true });
  },

  /**
   * Завершить bulk операцию
   */
  endBulkOperation: () => {
    console.log('[AI State] 🔓 Ending bulk operation - unblocking buttons');
    set({ processingBulk: false });
  },

  /**
   * Начать обработку конкретного аккаунта
   */
  startAccountProcessing: (accountId) => {
    set((state) => {
      const newSet = new Set(state.processingAccounts);
      newSet.add(accountId);
      console.log(
        `[AI State] 🔒 Account processing started: ${accountId} Total processing: ${newSet.size}`
      );
      return { processingAccounts: newSet };
    });
  },

  /**
   * Завершить обработку конкретного аккаунта
   */
  endAccountProcessing: (accountId) => {
    set((state) => {
      const newSet = new Set(state.processingAccounts);
      newSet.delete(accountId);
      console.log(
        `[AI State] 🔓 Account processing ended: ${accountId} Remaining: ${newSet.size}`
      );
      return { processingAccounts: newSet };
    });
  },

  /**
   * Проверить, обрабатывается ли аккаунт
   */
  isAccountProcessing: (accountId) => {
    return get().processingAccounts.has(accountId);
  },
}));

export default useAiStateStore;
