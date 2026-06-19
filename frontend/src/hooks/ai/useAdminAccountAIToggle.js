/**
 * Hook для кнопки AI отдельного аккаунта в админ панели
 * Админ может включать/выключать AI для конкретного аккаунта
 */

import { useState, useCallback } from 'react';
import useAiStateStore from '../../stores/aiStateStore';
import { aiApi } from '../../api/aiApi';

export const useAdminAccountAIToggle = (accountId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const processingBulk = useAiStateStore((state) => state.processingBulk);
  const processingAccounts = useAiStateStore((state) => state.processingAccounts);
  const startAccountProcessing = useAiStateStore(
    (state) => state.startAccountProcessing
  );
  const endAccountProcessing = useAiStateStore(
    (state) => state.endAccountProcessing
  );
  const clearAdminDataError = useAiStateStore(
    (state) => state.clearAdminDataError
  );

  // ✅ FIX: Возвращаем ссылку на объект напрямую из store, не создаем новый
  // Это предотвращает infinite loop и правильно отслеживает изменения
  const account = useAiStateStore((state) => {
    for (const user of state.adminData.users) {
      const acc = user.accounts?.find((a) => a._id === accountId);
      if (acc) {
        return acc; // Возвращаем ссылку на объект из store
      }
    }
    return null;
  });

  // ✅ FIX: Показываем реальное состояние AI (aiEnabled), а не разрешение админа
  // Когда user выключает AI, кнопка должна стать серой
  const isEnabled = account?.aiEnabled || false;
  const aiEnabledByAdmin = account?.aiEnabledByAdmin || false;

  // Обработчик клика
  const handleToggle = useCallback(async () => {
    if (isProcessing || processingAccounts.has(accountId) || processingBulk) {
      return { success: false, error: 'Operation in progress' };
    }
    
    setIsProcessing(true);
    startAccountProcessing(accountId);
    clearAdminDataError();
    
    try {
      const newStatus = !isEnabled;
      await aiApi.setAccountAiByAdmin(accountId, newStatus);
      
      // Данные обновятся автоматически через WebSocket (useAiSync)
      return { success: true };
    } catch (error) {
      console.error('[useAdminAccountAIToggle] Failed to toggle account AI:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
      endAccountProcessing(accountId);
    }
  }, [
    accountId,
    isEnabled,
    isProcessing,
    processingAccounts,
    processingBulk,
    startAccountProcessing,
    endAccountProcessing,
    clearAdminDataError,
  ]);

  return {
    account,
    isEnabled,
    isProcessing,
    isDisabled: isProcessing || processingAccounts.has(accountId) || processingBulk,
    handleToggle,
  };
};

export default useAdminAccountAIToggle;
