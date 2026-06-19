import PropTypes from 'prop-types';
import { useAdminAccountAIToggle } from '../../../hooks/ai/useAdminAccountAIToggle';

/**
 * Кнопка переключения AI для отдельного аккаунта (админка)
 * Управляет полем aiEnabledByAdmin (админ разрешает/запрещает AI)
 */
const AccountAIToggleButton = ({ accountId }) => {
  const { account, isEnabled, isProcessing, isDisabled, handleToggle } = useAdminAccountAIToggle(accountId);

  if (!account) {
    return null; // Аккаунт не найден в store
  }

  const onClick = async () => {
    await handleToggle();
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        isEnabled
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-gray-400 hover:bg-gray-500 text-white'
      } ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={
        isProcessing
          ? 'Обработка...'
          : isEnabled
          ? 'AI включен админом. Нажмите чтобы выключить'
          : 'AI выключен админом. Нажмите чтобы включить'
      }
    >
      {isProcessing ? (
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></span>
          ...
        </span>
      ) : (
        <>{isEnabled ? '✅ Вкл' : '⚪ Выкл'}</>
      )}
    </button>
  );
};

AccountAIToggleButton.propTypes = {
  accountId: PropTypes.string.isRequired,
};

export default AccountAIToggleButton;
