import { Button } from '../ui';

/**
 * Карточка Luxee аккаунта
 */
const LuxeeAccountCard = ({ account, onRestore, onDelete, isRestoring, isDeleting }) => {
  // Debug: логируем структуру аккаунта для проверки
  console.log('LuxeeAccountCard account:', account);
  
  // Поддержка разных форматов API response
  const email = account.email || account.accountEmail || account.luxeeEmail || account.login || 'Email не указан';
  const isActive = account.isActive ?? true;
  const accountId = account._id || account.accountId;

  return (
    <div className="flex items-center justify-between p-3 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {email || 'Email не указан'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Статус: {isActive ? '🟢 Активен' : '🔴 Неактивен'}
        </p>
      </div>
      
      <div className="flex gap-2 ml-3">
        {!isActive && (
          <Button
            variant="success"
            size="sm"
            loading={isRestoring}
            onClick={() => onRestore(accountId)}
          >
            Восстановить
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          loading={isDeleting}
          onClick={() => onDelete(accountId)}
        >
          Удалить
        </Button>
      </div>
    </div>
  );
};

export default LuxeeAccountCard;
