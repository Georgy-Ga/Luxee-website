import { Button } from '../ui';

/**
 * Карточка Luxee аккаунта
 */
const LuxeeAccountCard = ({ account, onRestore, onDelete, isRestoring, isDeleting }) => {
  // Извлекаем данные из аккаунта
  const email = account.luxeeEmail || 'Email не указан';
  const isActive = account.isActive ?? true;
  const accountId = account._id;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">
          {email || 'Email не указан'}
        </p>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
          Статус: {isActive ? '🟢 Активен' : '🔴 Неактивен'}
        </p>
      </div>
      
      <div className="flex gap-2 button-group-mobile">
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
