import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';
import { luxeeApi } from '../../api/luxeeApi';
import { aiApi } from '../../api/aiApi';

const AiTab = () => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState({ type: '', text: '' });

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

  // Мутации для управления AI пользователей
  const toggleUserAiMutation = useMutation({
    mutationFn: ({ userId, enabled }) => aiApi.toggleUserAi(userId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
      setMessage({ type: 'success', text: '✅ AI статус пользователя обновлён' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка'}` });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    },
  });

  // Мутации для управления AI аккаунтов
  const toggleAccountAiMutation = useMutation({
    mutationFn: ({ accountId, enabled }) => aiApi.toggleAccountAi(accountId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['luxeeAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
      setMessage({ type: 'success', text: '✅ AI статус аккаунта обновлён' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка'}` });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    },
  });

  // Мутация для переключения собственного AI
  const toggleMyAiMutation = useMutation({
    mutationFn: (enabled) => aiApi.toggleMyAi(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
      setMessage({ type: 'success', text: '✅ Ваш AI статус обновлён' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка'}` });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    },
  });

  return (
    <div className="space-y-6">
      {message.text && (
        <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Мой AI статус */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light mb-4">
          Мой AI Статус
        </h3>
        {aiStatus && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  AI: {aiStatus.aiEnabled ? '🟢 Включен' : '🔴 Выключен'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Разрешено админом: {aiStatus.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
                </p>
              </div>
              {aiStatus.aiEnabledByAdmin && (
                <button
                  onClick={() => toggleMyAiMutation.mutate(!aiStatus.aiEnabled)}
                  disabled={toggleMyAiMutation.isPending}
                  className={`btn-${aiStatus.aiEnabled ? 'secondary' : 'primary'} disabled:opacity-50`}
                >
                  {aiStatus.aiEnabled ? 'Выключить' : 'Включить'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Пользователи */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light mb-4">
          Пользователи ({users?.length || 0})
        </h3>
        <div className="space-y-2">
          {users?.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between p-3 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{u.email}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  AI: {u.aiEnabled ? '🟢 Включен' : '🔴 Выключен'} | 
                  Админ разрешил: {u.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleUserAiMutation.mutate({ userId: u._id, enabled: !u.aiEnabledByAdmin })}
                  disabled={toggleUserAiMutation.isPending}
                  className={`px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                    u.aiEnabledByAdmin
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {u.aiEnabledByAdmin ? 'Запретить' : 'Разрешить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Luxee аккаунты */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light mb-4">
          Luxee аккаунты ({luxeeAccounts?.length || 0})
        </h3>
        <div className="space-y-2">
          {luxeeAccounts?.map((acc) => (
            <div
              key={acc._id}
              className="flex items-center justify-between p-3 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{acc.email}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  AI: {acc.aiEnabled ? '🟢 Включен' : '🔴 Выключен'} | 
                  Админ разрешил: {acc.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAccountAiMutation.mutate({ accountId: acc._id, enabled: !acc.aiEnabledByAdmin })}
                  disabled={toggleAccountAiMutation.isPending}
                  className={`px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                    acc.aiEnabledByAdmin
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {acc.aiEnabledByAdmin ? 'Запретить' : 'Разрешить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AiTab;
