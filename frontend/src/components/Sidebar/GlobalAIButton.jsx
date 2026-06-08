import { useState } from 'react';

/**
 * Глобальная кнопка переключения AI для всех аккаунтов
 */
const GlobalAIButton = ({ onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { default: { aiApi } } = await import('../../api/aiApi');
      await aiApi.toggleAllMyAccountsAi();
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
      className="px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium bg-purple hover:bg-purple-600 dark:bg-accent-light dark:hover:bg-accent-light/80 text-white transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Переключить AI на всех аккаунтах сразу"
    >
      {isLoading ? (
        <>
          <span className="animate-spin">⏳</span>
          <span>AI: Все</span>
        </>
      ) : (
        'AI: Все'
      )}
    </button>
  );
};

export default GlobalAIButton;
