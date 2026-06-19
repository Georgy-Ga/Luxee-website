/**
 * Hook для глобальной AI кнопки (пользовательский интерфейс)
 * Управляет включением/выключением AI на всех аккаунтах сразу
 */

import { useState, useCallback, useMemo } from 'react';
import useAiStateStore from '../../stores/aiStateStore';
import { aiApi } from '../../api/aiApi';

export const useGlobalAIButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const userAccounts = useAiStateStore((state) => state.userAccounts);
  const processingBulk = useAiStateStore((state) => state.processingBulk);
  const processingAccounts = useAiStateStore((state) => state.processingAccounts);
  const startBulkOperation = useAiStateStore((state) => state.startBulkOperation);
  const endBulkOperation = useAiStateStore((state) => state.endBulkOperation);
  const loadUserAiData = useAiStateStore((state) => state.loadUserAiData);

  // Вычисляем актуальный статус (реактивно обновляется при изменении userAccounts)
  const status = useMemo(() => {
    if (userAccounts.size === 0) return 'off';
    
    let enabledCount = 0;
    userAccounts.forEach((acc) => {
      if (acc.aiEnabled) enabledCount++;
    });
    
    return enabledCount === userAccounts.size ? 'on' : 'off';
  }, [userAccounts]);

  const isDisabled = status === 'off';

  // Обработчик клика
  const handleToggle = useCallback(async () => {
    if (isLoading || isDisabled || processingBulk || processingAccounts.size > 0) {
      return { success: false, error: 'Operation in progress or disabled' };
    }
    
    setIsLoading(true);
    startBulkOperation();
    
    try {
      await aiApi.toggleAllMyAccountsAi();
      await loadUserAiData();
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка при переключении AI на всех аккаунтах';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      endBulkOperation();
    }
  }, [
    isLoading,
    isDisabled,
    processingBulk,
    processingAccounts.size,
    startBulkOperation,
    endBulkOperation,
    loadUserAiData,
  ]);

  // Кнопка заблокирована если идёт операция
  const isButtonDisabled = isLoading || processingBulk || processingAccounts.size > 0;

  return {
    status,
    isEnabled: status === 'on',
    isDisabled,
    isLoading,
    isButtonDisabled,
    handleToggle,
  };
};

export default useGlobalAIButton;
