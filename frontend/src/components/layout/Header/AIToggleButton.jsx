import { useGlobalAIButton } from '../../../hooks/ai/useGlobalAIButton';
import { useToast } from '../../../hooks/useToast';

/**
 * Кнопка переключения AI в хедере.
 * Работает через aiStateStore (как кнопки Sidebar): показывает ON, если AI
 * включён хотя бы на одном... точнее — на всех аккаунтах; клик переключает
 * все свои аккаунты. Состояние прилетает по WebSocket (useAiSync), поэтому
 * кнопка всегда синхронна с админкой и Sidebar.
 */
const AIToggleButton = () => {
  const { isEnabled, isLoading, isButtonDisabled, handleToggle } =
    useGlobalAIButton();
  const { showToast } = useToast();

  const onClick = async () => {
    if (isButtonDisabled) return;
    const result = await handleToggle();
    if (!result.success && result.error) {
      showToast(result.error, 'error');
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isButtonDisabled}
      className={`px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium transition-colors ${
        isEnabled
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-red-500 hover:bg-red-600 text-white'
      } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      title={`AI: ${isEnabled ? 'ON' : 'OFF'}`}
    >
      <span className="hidden sm:inline">AI: {isEnabled ? 'ON' : 'OFF'}</span>
      <span className="sm:hidden">{isEnabled ? '🤖' : '🚫'}</span>
    </button>
  );
};

export default AIToggleButton;
