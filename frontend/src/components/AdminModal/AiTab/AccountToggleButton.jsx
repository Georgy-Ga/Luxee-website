import PropTypes from 'prop-types';

/**
 * Кнопка переключения AI для всех аккаунтов пользователя
 */
const AccountToggleButton = ({ status, isProcessing, onClick }) => {
  const getButtonConfig = () => {
    if (status === 'all') {
      return {
        className: 'bg-green-500 hover:bg-green-600',
        text: '✅ Все включены',
        title: 'Все аккаунты включены. Нажмите чтобы выключить все',
      };
    }
    if (status === 'partial') {
      return {
        className: 'bg-yellow-500 hover:bg-yellow-600',
        text: '🟡 Частично',
        title: 'Часть аккаунтов включена. Нажмите чтобы включить все',
      };
    }
    return {
      className: 'bg-gray-400 hover:bg-gray-500',
      text: '⚪ Все выключены',
      title: 'Все аккаунты выключены. Нажмите чтобы включить все',
    };
  };

  const config = getButtonConfig();

  return (
    <button
      onClick={onClick}
      disabled={isProcessing}
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
  status: PropTypes.oneOf(['all', 'partial', 'none']).isRequired,
  isProcessing: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default AccountToggleButton;
