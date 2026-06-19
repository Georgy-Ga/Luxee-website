import PropTypes from 'prop-types';
import AccountAIToggleButton from './AccountAIToggleButton';

/**
 * Отдельный Luxee аккаунт с кнопкой управления AI
 */
const AccountItem = ({ account }) => {
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

      <AccountAIToggleButton accountId={account._id} />
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
};

export default AccountItem;
