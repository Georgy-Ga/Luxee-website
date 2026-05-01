import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { luxeeApi } from '../api/luxeeApi';

const AdminModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [luxeeEmail, setLuxeeEmail] = useState('');
  const [luxeePassword, setLuxeePassword] = useState('');
  const [showLuxeePassword, setShowLuxeePassword] = useState(false);

  // Получить пользователей
  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
    enabled: activeTab === 'users',
  });

  // Получить Luxee аккаунты
  const { data: luxeeAccounts, refetch: refetchLuxee } = useQuery({
    queryKey: ['luxeeAccounts'],
    queryFn: luxeeApi.getAccounts,
    enabled: activeTab === 'luxee',
  });

  // Регистрация пользователя
  const registerMutation = useMutation({
    mutationFn: () => authApi.register(newUserEmail, newUserPassword),
    onSuccess: () => {
      setNewUserEmail('');
      setNewUserPassword('');
      refetchUsers();
      alert('Пользователь создан');
    },
  });

  // Добавление Luxee аккаунта
  const addLuxeeMutation = useMutation({
    mutationFn: () => luxeeApi.loginLuxee(luxeeEmail, luxeePassword),
    onSuccess: () => {
      setLuxeeEmail('');
      setLuxeePassword('');
      refetchLuxee();
      alert('Luxee аккаунт добавлен');
    },
  });

  // Удаление Luxee аккаунта
  const deleteLuxeeMutation = useMutation({
    mutationFn: (accountId) => luxeeApi.deleteAccount(accountId),
    onSuccess: () => {
      refetchLuxee();
      alert('Аккаунт удалён');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Админ панель</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">×</button>
        </div>

        {/* Табы */}
        <div className="flex gap-2 mb-6 border-b border-light-border dark:border-dark-border">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-purple dark:text-accent border-b-2 border-purple dark:border-accent'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab('luxee')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'luxee'
                ? 'text-purple dark:text-accent border-b-2 border-purple dark:border-accent'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Luxee Аккаунты
          </button>
        </div>

        {/* Контент */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-bold mb-3 text-gray-900 dark:text-white">Создать пользователя</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="input-field"
                />
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    placeholder="Пароль"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="input-field pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    {showNewUserPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <button
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                  className="btn-primary w-full"
                >
                  {registerMutation.isPending ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-bold mb-3 text-gray-900 dark:text-white">Список пользователей</h3>
              <div className="space-y-2">
                {users?.map((user) => (
                  <div key={user._id} className="p-3 bg-light-bg dark:bg-dark-bg rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Роль: {user.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'luxee' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-bold mb-3 text-gray-900 dark:text-white">Добавить Luxee аккаунт</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Luxee Email"
                  value={luxeeEmail}
                  onChange={(e) => setLuxeeEmail(e.target.value)}
                  className="input-field"
                />
                <div className="relative">
                  <input
                    type={showLuxeePassword ? 'text' : 'password'}
                    placeholder="Luxee Пароль"
                    value={luxeePassword}
                    onChange={(e) => setLuxeePassword(e.target.value)}
                    className="input-field pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLuxeePassword(!showLuxeePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    {showLuxeePassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <button
                  onClick={() => addLuxeeMutation.mutate()}
                  disabled={addLuxeeMutation.isPending}
                  className="btn-primary w-full"
                >
                  {addLuxeeMutation.isPending ? 'Добавление...' : 'Добавить'}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-bold mb-3 text-gray-900 dark:text-white">Luxee аккаунты</h3>
              <div className="space-y-2">
                {luxeeAccounts?.map((account) => (
                  <div key={account.id} className="p-3 bg-light-bg dark:bg-dark-bg rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{account.luxeeEmail}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Статус: {account.isActive ? '✅ Активен' : '❌ Неактивен'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        console.log('Deleting account with ID:', account.id);
                        deleteLuxeeMutation.mutate(account.id);
                      }}
                      className="btn-secondary text-red-600 dark:text-red-400"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModal;
