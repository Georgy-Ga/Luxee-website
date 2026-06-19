import { useAccountAIButton } from '../../hooks/ai/useAccountAIButton';

/**
 * Кнопка переключения AI для отдельного аккаунта (пользователь)
 * Пользователь может ТОЛЬКО выключить AI, но не может включить
 */
const AccountAIButton = ({ accountId, onError }) => {
  const { isEnabled, isLoading, isButtonDisabled, handleToggle } = useAccountAIButton(accountId);

  const handleClick = async (e) => {
    e.stopPropagation();
    
    if (isButtonDisabled) return;
    
    const result = await handleToggle();
    
    if (result.error) {
      onError?.(result.error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isButtonDisabled}
      className={`ml-1.5 lg:ml-2 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium flex-shrink-0 transition-colors ${
        isEnabled
          ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
          : 'bg-gray-400 text-white cursor-not-allowed opacity-60'
      } ${isLoading ? 'opacity-50' : ''}`}
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
