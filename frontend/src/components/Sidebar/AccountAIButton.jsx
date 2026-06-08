import { useState } from 'react';

/**
 * Кнопка переключения AI для отдельного аккаунта
 */
const AccountAIButton = ({ accountId, isEnabled, onToggle, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    try {
      await onToggle(accountId);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка при переключении AI';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`ml-1.5 lg:ml-2 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isEnabled
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-gray-400 hover:bg-gray-500 text-white'
      }`}
      title={
        isEnabled 
          ? 'AI включен. Нажмите чтобы выключить' 
          : 'AI выключен. Включить может только админ'
      }
    >
      {isLoading ? '⏳' : 'AI'}
    </button>
  );
};

export default AccountAIButton;
