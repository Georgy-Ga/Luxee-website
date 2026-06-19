import { useState, useEffect, useCallback, useMemo } from 'react';
import useAiStateStore from '../../../stores/aiStateStore';

/**
 * Упрощённый хук для управления UI админ-панели
 * Вся бизнес-логика теперь в специализированных хуках кнопок
 * 
 * ПРИМЕЧАНИЕ: WebSocket синхронизация аккаунтов подключена глобально в Dashboard.jsx,
 * поэтому здесь не нужно дублировать useAccountCreatedSync()
 */
export const useAiManagement = () => {
  const [expandedUsers, setExpandedUsers] = useState(new Set());

  const users = useAiStateStore((state) => state.adminData.users);
  const loading = useAiStateStore((state) => state.adminData.loading);
  const error = useAiStateStore((state) => state.adminData.error);
  const loadAllUsersAiData = useAiStateStore((state) => state.loadAllUsersAiData);

  // Загружаем данные только если store пуст (при первом открытии)
  // Все последующие обновления приходят через WebSocket автоматически
  useEffect(() => {
    const currentUsers = useAiStateStore.getState().adminData.users;
    
    if (currentUsers.length > 0) {
      console.log('[useAiManagement] Data already loaded from WebSocket, skipping API call');
      return;
    }

    console.log('[useAiManagement] 🚀 First load - fetching admin data from API...');
    loadAllUsersAiData();
  }, []); // Пустой массив зависимостей - только при монтировании

  // Переключение развёрнутости пользователя
  const toggleUserExpanded = useCallback((userId) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // Мемоизированные пропсы для UserAiCard
  const getUserCardProps = useMemo(() => {
    return users.map((user) => ({
      user,
      isExpanded: expandedUsers.has(user._id),
      onToggleExpand: () => toggleUserExpanded(user._id),
    }));
  }, [users, expandedUsers, toggleUserExpanded]);

  return {
    users,
    userCardProps: getUserCardProps,
    isLoading: loading,
    error,
  };
};

export default useAiManagement;
