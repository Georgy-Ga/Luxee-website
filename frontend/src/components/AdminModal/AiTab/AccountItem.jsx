import PropTypes from 'prop-types';

/**
 * Отдельный Luxee аккаунт с кнопкой управления AI
 */
const AccountItem = ({ account, isProcessing, onToggle }) => {
  return (
    <div className="border border-light-border dark:border-dark-border rounded p-2 bg-light-surface dark:bg-dark-surface flex items-center justify-between">
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {account.luxeeEmail}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>AI: {account.aiEnabled ? '🟢 Вкл' : '⚪ Выкл'}</span>
          <span className="mx-2">|</span>
          <span>Админ: {account.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}</span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={isProcessing}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          account.aiEnabledByAdmin
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-400 hover:bg-gray-500 text-white'
        } ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
        title={
          isProcessing
            ? 'Обработка...'
            : account.aiEnabledByAdmin
            ? 'Нажмите чтобы выключить'
            : 'Нажмите чтобы включить'
        }
      >
        {isProcessing ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></span>
            ...
          </span>
        ) : (
          <>{account.aiEnabledByAdmin ? '✅ Вкл' : '⚪ Выкл'}</>
        )}
      </button>
    </div>
  );
};

AccountItem.propTypes = {
  account: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    luxeeEmail: PropTypes.string.isRequired,
    aiEnabled: PropTypes.bool,
    aiEnabledByAdmin: PropTypes.bool,
  }).isRequired,
  isProcessing: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default AccountItem;
