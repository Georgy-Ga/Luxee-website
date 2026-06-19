import PropTypes from 'prop-types';
import { useAdminAccountToggle } from '../../../hooks/ai/useAdminAccountToggle';

/**
 * Кнопка переключения AI для всех аккаунтов пользователя
 */
const AccountToggleButton = ({ userId }) => {
  const { status, isProcessing, isDisabled, handleToggle } = useAdminAccountToggle(userId);

  // Защита от множественных кликов
  const handleClick = async (e) => {
    e.stopPropagation(); // Останавливаем всплытие события
    
    if (isDisabled || isProcessing) {
      return;
    }
    
    await handleToggle();
  };

  const getButtonConfig = () => {
    if (status === 'all') {
      return {
        className: 'bg-green-500 hover:bg-green-600',
        text: '✅ ВКЛ',
        title: 'Все аккаунты включены. Нажмите чтобы выключить все',
      };
    }
    
    // status === 'none'
    return {
      className: 'bg-gray-400 hover:bg-gray-500',
      text: '⚪ ВЫКЛ',
      title: 'Нажмите чтобы включить все аккаунты',
    };
  };

  const config = getButtonConfig();

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`px-3 py-1 rounded text-sm font-medium text-white transition-colors ${
        config.className
      } ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={isProcessing ? 'Обработка...' : config.title}
    >
      {isProcessing ? (
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Обработка...
        </span>
      ) : (
        config.text
      )}
    </button>
  );
};

AccountToggleButton.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default AccountToggleButton;
