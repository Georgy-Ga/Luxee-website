import { useAccordion } from '../../../hooks/useAccordion';
import { Spinner, Alert } from '../../ui';
import { useAiManagement } from './useAiManagement';
import UserAiCard from './UserAiCard';

/**
 * Вкладка управления AI для всех пользователей и их аккаунтов
 * Позволяет администратору включать/выключать AI для каждого аккаунта
 */
const AiTab = () => {
  const {
    users,
    loading,
    error,
    processingUsers,
    processingAccounts,
    loadData,
    getAccountsStatus,
    toggleAllAccounts,
    toggleAccountAi,
    clearError,
  } = useAiManagement();

  const { expanded: expandedUsers, toggle: toggleUserExpand } = useAccordion({}, true);

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
        <Spinner size="lg" text="Загрузка данных AI..." />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light">
          Управление AI ({users.length} пользователей)
        </h3>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
          title="Обновить данные"
        >
          🔄 Обновить
        </button>
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="mb-4">
          <Alert variant="error" onClose={clearError}>
            {error}
          </Alert>
        </div>
      )}

      {/* Список пользователей */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {users.map((user) => (
          <UserAiCard
            key={user._id}
            user={user}
            isExpanded={expandedUsers.has(user._id)}
            onToggleExpand={() => toggleUserExpand(user._id)}
            accountsStatus={getAccountsStatus(user.accounts)}
            isProcessing={processingUsers.has(user._id)}
            onToggleAllAccounts={toggleAllAccounts}
            processingAccounts={processingAccounts}
            onToggleAccountAi={toggleAccountAi}
          />
        ))}
      </div>
    </div>
  );
};

export default AiTab;
