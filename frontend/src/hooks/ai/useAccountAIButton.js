/**
 * Hook для кнопки AI отдельного аккаунта (пользовательский интерфейс)
 * Пользователь может ТОЛЬКО выключить AI, но не может включить
 */

import { useState, useCallback } from 'react';
import useAiStateStore from '../../stores/aiStateStore';
import { aiApi } from '../../api/aiApi';

export const useAccountAIButton = (accountId) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const processingBulk = useAiStateStore((state) => state.processingBulk);
  const processingAccounts = useAiStateStore((state) => state.processingAccounts);
  const startAccountProcessing = useAiStateStore(
    (state) => state.startAccountProcessing
  );
  const endAccountProcessing = useAiStateStore(
    (state) => state.endAccountProcessing
  );

  // Реактивно получаем статус аккаунта из store
  const accountData = useAiStateStore((state) => state.userAccounts.get(accountId));
  const isEnabled = accountData?.aiEnabled || false;
  const aiEnabledByAdmin = accountData?.aiEnabledByAdmin || false;

  // Обработчик клика
  const handleToggle = useCallback(async () => {
    // Блокируем если:
    // 1. AI выключен (пользователь не может включить)
    // 2. Уже идёт обработка
    // 3. Идёт массовая операция
    // 4. Админ не разрешил AI для этого аккаунта
    if (!isEnabled || !aiEnabledByAdmin || isLoading || processingAccounts.has(accountId) || processingBulk) {
      return { success: false, error: 'Cannot toggle: disabled or operation in progress' };
    }

    setIsLoading(true);
    startAccountProcessing(accountId);
    
    try {
      await aiApi.toggleMyAccountAi(accountId);
      
      // ✅ FIX: Сразу обновляем локальное состояние (не ждем WebSocket)
      // WebSocket может быть отключен или задержаться
      const store = useAiStateStore.getState();
      console.log('[useAccountAIButton] Updating local state immediately');
      store.updateUserAccount(accountId, {
        aiEnabled: false, // Пользователь может только выключить
        aiEnabledByAdmin: aiEnabledByAdmin, // Не меняем
      });
      
      // Данные также обновятся через WebSocket (useAiSync) если подключен
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка при переключении AI';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      endAccountProcessing(accountId);
    }
  }, [
    accountId,
    isEnabled,
    aiEnabledByAdmin,
    isLoading,
    processingAccounts,
    processingBulk,
    startAccountProcessing,
    endAccountProcessing,
  ]);

  // Кнопка заблокирована если обрабатывается или идёт массовая операция или выключена
  const isButtonDisabled = isLoading || !isEnabled || processingAccounts.has(accountId) || processingBulk;

  return {
    isEnabled,
    aiEnabledByAdmin,
    isLoading,
    isButtonDisabled,
    handleToggle,
  };
};

export default useAccountAIButton;
