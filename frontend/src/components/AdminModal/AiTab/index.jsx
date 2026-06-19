import { useAccordion } from '../../../hooks/useAccordion';
import { Spinner, Alert } from '../../ui';
import { useAiManagement } from './useAiManagement';
import UserAiCard from './UserAiCard';

/**
 * Вкладка управления AI для всех пользователей и их аккаунтов
 * Позволяет администратору включать/выключать AI для каждого аккаунта
 */
const AiTab = () => {
  const { userCardProps, isLoading, error } = useAiManagement();

  if (isLoading) {
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
          Управление AI ({userCardProps.length} пользователей)
        </h3>
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="mb-4">
          <Alert variant="error">
            {error}
          </Alert>
        </div>
      )}

      {/* Список пользователей */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {userCardProps.map((props) => (
          <UserAiCard key={props.user._id} {...props} />
        ))}
      </div>
    </div>
  );
};

export default AiTab;
