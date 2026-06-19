import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import useAiStateStore from '../stores/aiStateStore';

/**
 * Hook для синхронизации создания/удаления Luxee аккаунтов через WebSocket
 * Обновляет список аккаунтов в админ-панели и сайдбаре динамически
 */
export const useAccountCreatedSync = () => {
  const { socket, isConnected } = useSocket();
  const addAccountToAdminData = useAiStateStore((state) => state.addAccountToAdminData);
  const removeAccountFromAdminData = useAiStateStore((state) => state.removeAccountFromAdminData);
  const addUserAccount = useAiStateStore((state) => state.addUserAccount);
  const removeUserAccount = useAiStateStore((state) => state.removeUserAccount);

  useEffect(() => {
    console.log('[Account Sync] 🎬 Hook mounted/updated');
    console.log('[Account Sync] Socket status:', {
      socketExists: !!socket,
      isConnected,
      socketId: socket?.id,
    });

    if (!socket || !isConnected) {
      console.log('[Account Sync] ⚠️ Socket not ready or not connected, waiting...');
      return;
    }

    console.log('[Account Sync] ✓ Socket ready and connected, registering listeners');

    // Обработчик создания аккаунта
    const handleAccountCreated = (data) => {
      console.log('[Account Sync] Received account created event:', data);

      const { userId, account } = data;

      // Добавляем аккаунт в админские данные (для AdminModal)
      addAccountToAdminData({
        accountId: account._id,
        userId,
        luxeeEmail: account.luxeeEmail,
      });

      // Также добавляем в пользовательские данные (для Sidebar, если это текущий пользователь)
      addUserAccount(account._id, account.aiEnabled || false, account.aiEnabledByAdmin || false);

      console.log('[Account Sync] ✓ Account added to stores:', {
        userId,
        accountId: account._id,
        luxeeEmail: account.luxeeEmail,
      });
    };

    // Обработчик удаления аккаунта
    const handleAccountDeleted = (data) => {
      console.log('[Account Sync] Received account deleted event:', data);

      const { userId, accountId } = data;

      // Удаляем аккаунт из админских данных (для AdminModal)
      removeAccountFromAdminData({
        accountId,
        userId,
      });

      // Также удаляем из пользовательских данных (для Sidebar)
      removeUserAccount(accountId);

      console.log('[Account Sync] ✓ Account removed from stores:', {
        userId,
        accountId,
      });
    };

    // Слушаем события создания и удаления аккаунтов
    socket.on('luxee:account:created', handleAccountCreated);
    socket.on('luxee:account:deleted', handleAccountDeleted);

    console.log('[Account Sync] ✓ Listeners registered (created + deleted)');

    // Cleanup
    return () => {
      if (socket && socket.off) {
        socket.off('luxee:account:created', handleAccountCreated);
        socket.off('luxee:account:deleted', handleAccountDeleted);
        console.log('[Account Sync] ✓ Listeners removed');
      }
    };
  }, [socket, isConnected, addAccountToAdminData, removeAccountFromAdminData, addUserAccount, removeUserAccount]);
};

export default useAccountCreatedSync;
