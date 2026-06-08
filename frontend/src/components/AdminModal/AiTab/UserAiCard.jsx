import PropTypes from 'prop-types';
import { Badge } from '../../ui';
import AccountToggleButton from './AccountToggleButton';
import AccountsList from './AccountsList';

/**
 * Карточка пользователя с управлением AI для его аккаунтов
 */
const UserAiCard = ({
  user,
  isExpanded,
  onToggleExpand,
  accountsStatus,
  isProcessing,
  onToggleAllAccounts,
  processingAccounts,
  onToggleAccountAi,
}) => {
  const hasAccounts = user.accounts && user.accounts.length > 0;

  return (
    <div className="card p-3">
      {/* Заголовок пользователя */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {/* Кнопка раскрытия */}
          {hasAccounts && (
            <button
              onClick={onToggleExpand}
              className="text-gray-600 dark:text-gray-300 hover:text-purple dark:hover:text-accent-light transition-colors"
              disabled={isProcessing}
              aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {/* Email пользователя */}
          <span className="font-medium text-gray-900 dark:text-white">
            {user.email}
          </span>

          {/* Бейдж ADMIN */}
          {user.role === 'admin' && (
            <Badge variant="purple" size="sm">
              ADMIN
            </Badge>
          )}
        </div>

        {/* Статусы и кнопки */}
        <div className="flex items-center gap-2">
          {hasAccounts && (
            <>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span>Аккаунтов: {user.accounts.length}</span>
              </div>

              <AccountToggleButton
                status={accountsStatus}
                isProcessing={isProcessing}
                onClick={() => onToggleAllAccounts(user._id, user.accounts)}
              />
            </>
          )}
        </div>
      </div>

      {/* Раскрывающийся список Luxee аккаунтов */}
      {isExpanded && hasAccounts && (
        <AccountsList
          accounts={user.accounts}
          processingAccounts={processingAccounts}
          onToggleAccountAi={onToggleAccountAi}
        />
      )}
    </div>
  );
};

UserAiCard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    role: PropTypes.string,
    accounts: PropTypes.array,
  }).isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  accountsStatus: PropTypes.oneOf(['all', 'partial', 'none']).isRequired,
  isProcessing: PropTypes.bool.isRequired,
  onToggleAllAccounts: PropTypes.func.isRequired,
  processingAccounts: PropTypes.instanceOf(Set).isRequired,
  onToggleAccountAi: PropTypes.func.isRequired,
};

export default UserAiCard;
