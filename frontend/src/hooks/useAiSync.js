/**
 * Hook для синхронизации AI статусов через WebSocket
 * Слушает события от сервера и обновляет локальное состояние в aiStateStore
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import useAiStateStore from '../stores/aiStateStore';
import useAuthStore from '../stores/authStore';

/**
 * Hook для синхронизации AI статусов в реальном времени
 * Автоматически подписывается на события при подключении Socket
 */
export const useAiSync = () => {
  const { socket, isConnected } = useSocket();

  // Получаем функции из нового AI store
  const updateAccountInAdminData = useAiStateStore(
    (state) => state.updateAccountInAdminData
  );
  const updateUserAccount = useAiStateStore((state) => state.updateUserAccount);
  const addUserAccount = useAiStateStore((state) => state.addUserAccount);
  const removeUserAccount = useAiStateStore((state) => state.removeUserAccount);
  const addAccountToAdminData = useAiStateStore(
    (state) => state.addAccountToAdminData
  );
  const removeAccountFromAdminData = useAiStateStore(
    (state) => state.removeAccountFromAdminData
  );
  const startAccountProcessing = useAiStateStore(
    (state) => state.startAccountProcessing
  );
  const endAccountProcessing = useAiStateStore(
    (state) => state.endAccountProcessing
  );
  const startBulkOperation = useAiStateStore((state) => state.startBulkOperation);
  const endBulkOperation = useAiStateStore((state) => state.endBulkOperation);
  const loadUserAiData = useAiStateStore((state) => state.loadUserAiData);
  const loadAllUsersAiData = useAiStateStore(
    (state) => state.loadAllUsersAiData
  );
  const userRole = useAuthStore((state) => state.user?.role);
  const wasConnected = useRef(false);

  /**
   * Обработчик события изменения AI статуса
   */
  const handleAiStatusChanged = useCallback(
    (data) => {
      console.log('[AI Sync] Received AI status change:', data);

      const {
        type,
        accountId,
        userId,
        aiEnabled,
        aiEnabledByAdmin,
        accounts,
        changedBy,
        luxeeEmail,
      } = data;

      if (type === 'bulk') {
        // Массовое изменение - обновляем все аккаунты
        startBulkOperation();

        if (Array.isArray(accounts)) {
          accounts.forEach((account) => {
            // Обновляем и в админских данных, и в пользовательских
            updateAccountInAdminData({
              accountId: account.accountId,
              aiEnabled: account.aiEnabled,
              aiEnabledByAdmin: account.aiEnabledByAdmin,
            });
            updateUserAccount(account.accountId, {
              aiEnabled: account.aiEnabled,
              aiEnabledByAdmin: account.aiEnabledByAdmin,
            });
          });

          console.log(
            `[AI Sync] ✓ Updated ${accounts.length} accounts (bulk change by ${changedBy})`
          );
        }

        endBulkOperation();
      } else if (type === 'account_added') {
        // Новый аккаунт добавлен
        console.log('[AI Sync] ➕ New account added:', accountId);

        // Добавляем в пользовательские данные
        addUserAccount(accountId, aiEnabled, aiEnabledByAdmin);

        // Добавляем в админские данные
        addAccountToAdminData({
          accountId,
          userId,
          luxeeEmail,
        });
      } else if (type === 'account_removed') {
        // Аккаунт удалён
        console.log('[AI Sync] ➖ Account removed:', accountId);

        // Удаляем из пользовательских данных
        removeUserAccount(accountId);

        // Удаляем из админских данных
        removeAccountFromAdminData({
          accountId,
          userId,
        });
      } else if (type === 'account' && accountId) {
        // Изменение одного аккаунта
        startAccountProcessing(accountId);

        // Обновляем и в админских данных, и в пользовательских
        updateAccountInAdminData({
          accountId,
          aiEnabled,
          aiEnabledByAdmin,
        });
        updateUserAccount(accountId, {
          aiEnabled,
          aiEnabledByAdmin,
        });

        endAccountProcessing(accountId);

        console.log(
          `[AI Sync] ✓ Updated account ${accountId} (changed by ${changedBy})`
        );
      }
    },
    [
      updateAccountInAdminData,
      updateUserAccount,
      addUserAccount,
      removeUserAccount,
      addAccountToAdminData,
      removeAccountFromAdminData,
      startAccountProcessing,
      endAccountProcessing,
      startBulkOperation,
      endBulkOperation,
    ]
  );

  /**
   * Подписка на Socket события
   */
  useEffect(() => {
    if (!socket || !isConnected) {
      wasConnected.current = false;
      console.log('[AI Sync] Socket not connected, skipping event subscription');
      return;
    }

    console.log('[AI Sync] ✓ Subscribing to AI status events');

    // Подписываемся на событие изменения AI статуса
    socket.on('ai:status:changed', handleAiStatusChanged);

    // Cleanup при размонтировании
    return () => {
      console.log('[AI Sync] Unsubscribing from AI status events');
      socket.off('ai:status:changed', handleAiStatusChanged);
    };
  }, [socket, isConnected, handleAiStatusChanged]);

  /**
   * Сверка с сервером при (пере)подключении.
   * События, пропущенные за время дисконнекта (протухший jwt, обрыв сети,
   * рестарт бэкенда), иначе остаются дырой навсегда — кнопка врёт до
   * ручного обновления. Поэтому при каждом новом соединении подтягиваем
   * свежее состояние из API (идемпотентно, стор просто перезаписывается).
   */
  useEffect(() => {
    if (!isConnected) {
      wasConnected.current = false;
      return;
    }
    if (wasConnected.current) return; // уже сверялись на этом соединении
    wasConnected.current = true;

    console.log('[AI Sync] 🔄 (Re)connected — reconciling AI state with server');
    loadUserAiData();
    if (userRole === 'admin') {
      loadAllUsersAiData();
    }
  }, [isConnected, userRole, loadUserAiData, loadAllUsersAiData]);

  return {
    isConnected,
    isSyncing: isConnected,
  };
};

export default useAiSync;
