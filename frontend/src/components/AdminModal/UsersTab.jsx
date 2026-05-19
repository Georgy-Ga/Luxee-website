import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';

const UsersTab = () => {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [userMessage, setUserMessage] = useState({ type: '', text: '' });

  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
  });

  const registerMutation = useMutation({
    mutationFn: () => authApi.register(newUserEmail, newUserPassword),
    onSuccess: () => {
      setNewUserEmail('');
      setNewUserPassword('');
      refetchUsers();
      setUserMessage({ type: 'success', text: '✅ Пользователь успешно создан' });
      setTimeout(() => setUserMessage({ type: '', text: '' }), 5000);
    },
    onError: (error) => {
      setUserMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка при создании пользователя'}` });
      setTimeout(() => setUserMessage({ type: '', text: '' }), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) => authApi.deleteUser(userId),
    onSuccess: () => {
      refetchUsers();
      setUserMessage({ type: 'success', text: '✅ Пользователь удалён' });
      setTimeout(() => setUserMessage({ type: '', text: '' }), 3000);
    },
    onError: (error) => {
      setUserMessage({ type: 'error', text: `❌ ${error.response?.data?.message || 'Ошибка при удалении'}` });
      setTimeout(() => setUserMessage({ type: '', text: '' }), 5000);
    },
  });

  const handleRegister = (e) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      setUserMessage({ type: 'error', text: '❌ Заполните все поля' });
      setTimeout(() => setUserMessage({ type: '', text: '' }), 3000);
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleRegister} className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Создать нового пользователя
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Пароль
          </label>
          <div className="relative">
            <input
              type={showNewUserPassword ? 'text' : 'password'}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Минимум 3 символа"
            />
            <button
              type="button"
              onClick={() => setShowNewUserPassword(!showNewUserPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showNewUserPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {userMessage.text && (
          <div className={`p-3 rounded-lg ${userMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {userMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {registerMutation.isPending ? 'Создание...' : 'Создать пользователя'}
        </button>
      </form>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Список пользователей
        </h3>
        <div className="space-y-2">
          {users?.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{u.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Роль: {u.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}
                </p>
              </div>
              {u.role !== 'admin' && (
                <button
                  onClick={() => deleteMutation.mutate(u._id)}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsersTab;
