import PropTypes from 'prop-types';
import { useAiToggle } from '../../../hooks/useAiToggle';
import { useToast } from '../../../hooks/useToast';

/**
 * Кнопка переключения AI в хедере
 */
const AIToggleButton = () => {
  const { aiEnabled, isLoading, error, toggleMyAi } = useAiToggle();
  const { showToast } = useToast();

  const handleToggle = async () => {
    const success = await toggleMyAi();
    if (!success && error) {
      showToast(error, 'error');
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium transition-colors ${
        aiEnabled
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-red-500 hover:bg-red-600 text-white'
      } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      title={`AI: ${aiEnabled ? 'ON' : 'OFF'}`}
    >
      <span className="hidden sm:inline">AI: {aiEnabled ? 'ON' : 'OFF'}</span>
      <span className="sm:hidden">{aiEnabled ? '🤖' : '🚫'}</span>
    </button>
  );
};

export default AIToggleButton;
