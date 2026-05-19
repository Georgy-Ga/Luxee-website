import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { luxeeApi } from '../../api/luxeeApi';

const LuxeeTab = () => {
  const [luxeeEmail, setLuxeeEmail] = useState('');
  const [luxeePassword, setLuxeePassword] = useState('');
  const [showLuxeePassword, setShowLuxeePassword] = useState(false);
  const [luxeeMessage, setLuxeeMessage] = useState({ type: '', text: '' });

  const { data: luxeeAccounts, refetch: refetchLuxee } = useQuery({
    queryKey: ['luxeeAccounts'],
    queryFn: luxeeApi.getAccounts,
  });

  const addLuxeeMutation = useMutation({
    mutationFn: () => luxeeApi.loginLuxee(luxeeEmail, luxeePassword),
    onSuccess: () => {
      setLuxeeEmail('');
      setLuxeePassword('');
      refetchLuxee();
      setLuxeeMessage({ type: 'success', text: '✅ Luxee аккаунт успешно добавлен' });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 5000);
    },
    onError: (error) => {
      setLuxeeMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка при добавлении аккаунта'}` });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 5000);
    },
  });

  const deleteLuxeeMutation = useMutation({
    mutationFn: (accountId) => luxeeApi.deleteAccount(accountId),
    onSuccess: () => {
      refetchLuxee();
      setLuxeeMessage({ type: 'success', text: '✅ Аккаунт удалён' });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setLuxeeMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка при удалении'}` });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 5000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (accountId) => luxeeApi.restoreSession(accountId),
    onSuccess: () => {
      refetchLuxee();
      setLuxeeMessage({ type: 'success', text: '✅ Сессия восстановлена' });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setLuxeeMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка восстановления'}` });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 5000);
    },
  });

  const handleAddLuxee = (e) => {
    e.preventDefault();
    if (!luxeeEmail || !luxeePassword) {
      setLuxeeMessage({ type: 'error', text: '❌ Заполните все поля' });
      setTimeout(() => setLuxeeMessage({ type: '', text: '' }), 3000);
      return;
    }
    addLuxeeMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddLuxee} className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Добавить Luxee аккаунт
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Luxee
          </label>
          <input
            type="email"
            value={luxeeEmail}
            onChange={(e) => setLuxeeEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="luxee@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Пароль Luxee
          </label>
          <div className="relative">
            <input
              type={showLuxeePassword ? 'text' : 'password'}
              value={luxeePassword}
              onChange={(e) => setLuxeePassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Пароль от Luxee"
            />
            <button
              type="button"
              onClick={() => setShowLuxeePassword(!showLuxeePassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showLuxeePassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {luxeeMessage.text && (
          <div className={`p-3 rounded-lg ${luxeeMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {luxeeMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={addLuxeeMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addLuxeeMutation.isPending ? 'Добавление...' : 'Добавить аккаунт'}
        </button>
      </form>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Мои Luxee аккаунты
        </h3>
        <div className="space-y-2">
          {luxeeAccounts?.map((acc) => (
            <div
              key={acc._id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{acc.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Статус: {acc.isActive ? '🟢 Активен' : '🔴 Неактивен'}
                </p>
              </div>
              <div className="flex gap-2">
                {!acc.isActive && (
                  <button
                    onClick={() => restoreMutation.mutate(acc._id)}
                    disabled={restoreMutation.isPending}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Восстановить
                  </button>
                )}
                <button
                  onClick={() => deleteLuxeeMutation.mutate(acc._id)}
                  disabled={deleteLuxeeMutation.isPending}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LuxeeTab;
