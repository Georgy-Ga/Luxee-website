import { useGlobalAIButton } from '../../hooks/ai/useGlobalAIButton';

/**
 * Глобальная кнопка переключения AI для всех аккаунтов
 * Показывает текущий статус: "Все включены" или "Все выключены"
 */
const GlobalAIButton = ({ onSuccess, onError }) => {
  const { 
    status, 
    isEnabled,
    isDisabled,
    isLoading, 
    isButtonDisabled, 
    handleToggle 
  } = useGlobalAIButton();

  // Конфигурация кнопки: только 2 состояния
  const getButtonConfig = () => {
    if (status === 'on') {
      return {
        className: 'bg-green-500 hover:bg-green-600 text-white cursor-pointer',
        text: 'AI',
        title: 'AI включен на всех аккаунтах. Нажмите чтобы выключить',
      };
    }
    
    // status === 'off' - заблокирован
    return {
      className: 'bg-gray-400 text-white cursor-not-allowed opacity-60',
      text: 'AI',
      title: 'AI выключен. Включить может только админ',
    };
  };

  const config = getButtonConfig();

  const handleClick = async () => {
    if (isButtonDisabled || isDisabled) return;
    
    const result = await handleToggle();
    
    if (result.success) {
      onSuccess?.();
    } else if (result.error) {
      onError?.(result.error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isButtonDisabled}
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
