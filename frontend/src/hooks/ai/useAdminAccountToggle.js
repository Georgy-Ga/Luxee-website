/**
 * Hook для кнопки "Все аккаунты" пользователя в админ панели
 * Переключает AI на всех аккаунтах пользователя сразу
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import useAiStateStore from '../../stores/aiStateStore';
import { aiApi } from '../../api/aiApi';

export const useAdminAccountToggle = (userId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const lastCallRef = useRef(0);
  const DEBOUNCE_MS = 300; // Минимальная задержка между кликами
  
  // Получаем данные из нового AI store БЕЗ shallow - для глубокого сравнения
  const user = useAiStateStore(
    state => state.adminData.users.find(u => u._id === userId)
  );
  const processingBulkOperation = useAiStateStore(state => state.processingBulk);

  // Получаем аккаунты напрямую из юзера
  const accounts = user?.accounts || [];

  // Вычисляем статус: 'all' если ВСЕ включены, иначе 'none'
  // ✅ FIX: Проверяем aiEnabled (реальное состояние), а не aiEnabledByAdmin
  const status = useMemo(() => {
    if (!accounts || accounts.length === 0) return 'none';
    const enabledCount = accounts.filter(acc => acc.aiEnabled).length;
    return enabledCount === accounts.length ? 'all' : 'none';
  }, [accounts]);

  // Обработчик клика - НЕ добавляем функции store в зависимости
  const handleToggle = useCallback(async () => {
    // Защита от дребезга (debounce)
    const now = Date.now();
    if (now - lastCallRef.current < DEBOUNCE_MS) {
      console.log('[useAdminAccountToggle] Debounced - too fast click');
      return { success: false, error: 'Too fast' };
    }
    lastCallRef.current = now;
    
    const store = useAiStateStore.getState();
    
    if (isProcessing || store.processingBulk) {
      console.log('[useAdminAccountToggle] Already processing');
      return { success: false, error: 'Operation in progress' };
    }
    
    console.log('[useAdminAccountToggle] Starting toggle for user:', userId);
    setIsProcessing(true);
    store.startBulkOperation();
    store.clearAdminDataError();
    
    try {
      // Читаем текущий статус напрямую из store в момент клика
      // ✅ FIX: Проверяем aiEnabled (реальное состояние), а не aiEnabledByAdmin
      const currentUser = store.adminData.users.find(u => u._id === userId);
      const currentAccounts = currentUser?.accounts || [];
      const enabledCount = currentAccounts.filter(acc => acc.aiEnabled).length;
      const currentStatus = enabledCount === currentAccounts.length ? 'all' : 'none';
      
      const newStatus = currentStatus === 'all' ? false : true;
      await aiApi.setAllUserAccountsAiByAdmin(userId, newStatus);
      
      // Данные обновятся автоматически через WebSocket (useAiSync)
      return { success: true };
    } catch (error) {
      console.error('[useAdminAccountToggle] Failed to toggle all accounts AI:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
      useAiStateStore.getState().endBulkOperation();
    }
  }, [userId, isProcessing]);

  return {
    status,
    isProcessing,
    isDisabled: isProcessing || processingBulkOperation,
    handleToggle,
  };
};

export default useAdminAccountToggle;
