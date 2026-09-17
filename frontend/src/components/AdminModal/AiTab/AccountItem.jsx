import PropTypes from 'prop-types';
import AccountAIToggleButton from './AccountAIToggleButton';
import AccountSectionsToggle from './AccountSectionsToggle';

/**
 * Отдельный Luxee аккаунт с кнопкой управления AI и разделами
 */
const AccountItem = ({ account }) => {
  return (
    <div className="border border-light-border dark:border-dark-border rounded p-2 bg-light-surface dark:bg-dark-surface flex items-start justify-between gap-2">
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

      <div className="flex flex-col items-end gap-1">
        <AccountAIToggleButton accountId={account._id} />
        <AccountSectionsToggle accountId={account._id} />
      </div>
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
