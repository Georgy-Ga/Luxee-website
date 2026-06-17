import { useState } from 'react';
import useChatStore from '../../stores/chatStore';

/**
 * Глобальная кнопка переключения AI для всех аккаунтов
 * Показывает текущий статус: "Все включены" или "Все выключены"
 */
const GlobalAIButton = ({ onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { aiEnabledByAccount, loadAccountAIStatuses } = useChatStore();

  // Вычисляем общий статус всех аккаунтов
  const getStatus = () => {
    const values = Object.values(aiEnabledByAccount);
    if (values.length === 0) return 'none';
    
    const enabledCount = values.filter(Boolean).length;
    
    // Все включены или все выключены
    if (enabledCount === values.length) return 'all';
    return 'none';
  };

  const status = getStatus();

  // Конфигурация кнопки в зависимости от статуса
  const getButtonConfig = () => {
    if (status === 'all') {
      return {
        className: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
        text: '✅ Все включены',
        title: 'Все аккаунты включены. Нажмите чтобы выключить все',
      };
    }
    
    return {
      className: 'bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700',
      text: '⚪ Все выключены',
      title: 'Все аккаунты выключены. Нажмите чтобы включить все',
    };
  };

  const config = getButtonConfig();

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { default: { aiApi } } = await import('../../api/aiApi');
      await aiApi.toggleAllMyAccountsAi();
      
      // Обновляем статусы после переключения
      await loadAccountAIStatuses();
      
      onSuccess?.();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка при переключении AI на всех аккаунтах';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium text-white transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        isLoading ? 'animate-pulse' : config.className
      }`}
      title={isLoading ? 'Обработка...' : config.title}
    >
      {isLoading ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span>Обработка...</span>
        </>
      ) : (
        config.text
      )}
    </button>
  );
};

export default GlobalAIButton;
