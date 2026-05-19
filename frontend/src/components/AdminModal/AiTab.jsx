import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';
import { luxeeApi } from '../../api/luxeeApi';
import { aiApi } from '../../api/aiApi';

const AiTab = () => {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
  });

  const { data: luxeeAccounts } = useQuery({
    queryKey: ['luxeeAccounts'],
    queryFn: luxeeApi.getAccounts,
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: aiApi.getMyAiStatus,
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          AI Статус
        </h3>
        {aiStatus && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-gray-900 dark:text-white">
              Статус AI: {aiStatus.aiEnabled ? '🟢 Включен' : '🔴 Выключен'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Разрешено админом: {aiStatus.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Пользователи ({users?.length || 0})
        </h3>
        <div className="space-y-2">
          {users?.map((u) => (
            <div
              key={u._id}
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <p className="font-medium text-gray-900 dark:text-white">{u.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI: {u.aiEnabled ? '🟢' : '🔴'} | 
                Админ разрешил: {u.aiEnabledByAdmin ? '✅' : '❌'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Luxee аккаунты ({luxeeAccounts?.length || 0})
        </h3>
        <div className="space-y-2">
          {luxeeAccounts?.map((acc) => (
            <div
              key={acc._id}
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <p className="font-medium text-gray-900 dark:text-white">{acc.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI: {acc.aiEnabled ? '🟢' : '🔴'} | 
                Админ разрешил: {acc.aiEnabledByAdmin ? '✅' : '❌'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AiTab;
