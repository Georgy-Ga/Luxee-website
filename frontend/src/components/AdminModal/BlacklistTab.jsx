import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { luxeeApi } from '../../api/luxeeApi';
import { Button, Input, Toggle, Alert } from '../ui';
import useAiStateStore from '../../stores/aiStateStore';

const BlacklistTab = () => {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Получить всех пользователей и их аккаунты из store (как в AiTab)
  const users = useAiStateStore((state) => state.adminData.users);
  const loading = useAiStateStore((state) => state.adminData.loading);
  const loadAllUsersAiData = useAiStateStore((state) => state.loadAllUsersAiData);

  // Загрузить данные при монтировании компонента
  useEffect(() => {
    const currentUsers = useAiStateStore.getState().adminData.users;
    if (currentUsers.length === 0) {
      loadAllUsersAiData();
    }
  }, [loadAllUsersAiData]);

  // Собрать все аккаунты из всех пользователей
  const allAccounts = useMemo(() => {
    const accounts = [];
    users.forEach((user) => {
      const userAccounts = user.luxeeAccounts || user.accounts || [];
      userAccounts.forEach((account) => {
        accounts.push({
          ...account,
          userEmail: user.email,
        });
      });
    });
    return accounts;
  }, [users]);

  // Автоматически выбрать первый аккаунт когда они загрузятся
  useEffect(() => {
    if (allAccounts.length > 0 && !selectedAccount) {
      setSelectedAccount(allAccounts[0]._id);
    }
  }, [allAccounts, selectedAccount]);

  // Получить черный список выбранного аккаунта
  const { data: blacklist, refetch: refetchBlacklist } = useQuery({
    queryKey: ['blacklist', selectedAccount],
    queryFn: async () => {
      const data = await luxeeApi.getBlacklist(selectedAccount);
      console.log('[BlacklistTab] Loaded blacklist:', data);
      return data;
    },
    enabled: !!selectedAccount,
  });

  // Логировать изменения blacklist
  useEffect(() => {
    if (blacklist) {
      console.log('[BlacklistTab] Blacklist updated:', blacklist);
    }
  }, [blacklist]);

  // Обновить черный список
  const updateMutation = useMutation({
    mutationFn: ({ enabled, categories }) =>
      luxeeApi.updateBlacklist(selectedAccount, { enabled, categories }),
    onSuccess: async () => {
      // Перезагрузить данные сразу после успеха
      await refetchBlacklist();
      showMessage('success', '✅ Настройки сохранены');
    },
    onError: (error) => {
      showMessage('error', `❌ ${error.response?.data?.message || 'Ошибка сохранения'}`);
    },
  });

  // Добавить userIds
  const addMutation = useMutation({
    mutationFn: (userIds) => luxeeApi.addToBlacklist(selectedAccount, userIds),
    onSuccess: () => {
      setNewUserId('');
      refetchBlacklist();
      showMessage('success', '✅ ID добавлен в черный список');
    },
    onError: (error) => {
      showMessage('error', `❌ ${error.response?.data?.message || 'Ошибка добавления'}`);
    },
  });

  // Удалить userIds
  const removeMutation = useMutation({
    mutationFn: (userIds) => luxeeApi.removeFromBlacklist(selectedAccount, userIds),
    onSuccess: () => {
      refetchBlacklist();
      showMessage('success', '✅ ID удален из черного списка');
    },
    onError: (error) => {
      showMessage('error', `❌ ${error.response?.data?.message || 'Ошибка удаления'}`);
    },
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleToggleEnabled = () => {
    const newEnabled = !blacklist.enabled;
    updateMutation.mutate({
      enabled: newEnabled,
      categories: blacklist.categories,
    });
  };

  const handleToggleCategory = (category) => {
    const newCategories = {
      ...blacklist.categories,
      [category]: !blacklist.categories[category],
    };
    updateMutation.mutate({
      enabled: blacklist.enabled,
      categories: newCategories,
    });
  };

  const handleAddUserId = (e) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      showMessage('error', '❌ Введите ID');
      return;
    }
    
    // Разделить по пробелам и удалить пустые строки
    const userIds = newUserId
      .trim()
      .split(/\s+/)
      .filter(id => id.length > 0);
    
    if (userIds.length === 0) {
      showMessage('error', '❌ Введите ID');
      return;
    }
    
    addMutation.mutate(userIds);
  };

  const handleRemoveUserId = (userId) => {
    if (confirm(`Удалить ${userId} из черного списка?`)) {
      removeMutation.mutate([userId]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-4 lg:space-y-6">
        {/* Заголовок */}
        <div>
          <h3 className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white mb-2">
            🚫 Черные списки AI
          </h3>
          <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">
            Игнорировать определенных мужчин во всех разделах (новые сообщения, Catch Up, Activity Center)
          </p>
        </div>

        {/* Сообщения */}
        {message.text && (
          <Alert type={message.type}>
            {message.text}
          </Alert>
        )}

        {/* Выбор аккаунта */}
        {loading ? (
          <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
            <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка аккаунтов...</p>
          </div>
        ) : allAccounts.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
            <p className="text-sm text-gray-500 dark:text-gray-400">Нет доступных аккаунтов</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Аккаунт:
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full p-2 lg:p-3 text-sm lg:text-base border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-800 dark:text-white focus:ring-2 focus:ring-purple dark:focus:ring-accent focus:border-transparent"
            >
              {allAccounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.luxeeEmail}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Настройки черного списка */}
        {selectedAccount && blacklist && (
          <>
            {/* Включить/выключить */}
            <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-white text-sm lg:text-base">
                    Включить черный список
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    AI будет игнорировать мужчин из списка
                  </p>
                </div>
                <Toggle
                  enabled={blacklist.enabled}
                  onChange={handleToggleEnabled}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* Категории */}
            <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
              <h4 className="font-medium text-gray-800 dark:text-white mb-3 text-sm lg:text-base">
                Категории игнорирования:
              </h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm lg:text-base text-gray-700 dark:text-gray-200">
                      Новые сообщения
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Игнорировать в обычных чатах
                    </p>
                  </div>
                  <Toggle
                    enabled={blacklist.categories.newMessages}
                    onChange={() => handleToggleCategory('newMessages')}
                    disabled={updateMutation.isPending}
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm lg:text-base text-gray-700 dark:text-gray-200">
                      Catch Up
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Игнорировать в разделе Catch Up
                    </p>
                  </div>
                  <Toggle
                    enabled={blacklist.categories.catchUp}
                    onChange={() => handleToggleCategory('catchUp')}
                    disabled={updateMutation.isPending}
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm lg:text-base text-gray-700 dark:text-gray-200">
                      Activity Center
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Игнорировать уведомления (лайки, избранное)
                    </p>
                  </div>
                  <Toggle
                    enabled={blacklist.categories.activityCenter}
                    onChange={() => handleToggleCategory('activityCenter')}
                    disabled={updateMutation.isPending}
                  />
                </label>
              </div>
            </div>

            {/* Список userIds */}
            <div className="bg-white dark:bg-dark-surface p-3 lg:p-4 rounded-lg border border-light-border dark:border-dark-border">
              <h4 className="font-medium text-gray-800 dark:text-white mb-3 text-sm lg:text-base">
                Список мужчин ({blacklist.userIds.length}):
              </h4>

              {/* Добавить новый ID */}
              <form onSubmit={handleAddUserId} className="flex gap-2 mb-4">
                <Input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="ID через пробел (например: 2814785 2814786 2814787)"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={addMutation.isPending || !newUserId.trim()}
                  className="whitespace-nowrap"
                >
                  {addMutation.isPending ? 'Добавление...' : 'Добавить'}
                </Button>
              </form>

              {/* Список */}
              {blacklist.userIds.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Список пуст
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {blacklist.userIds.map((userId) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between p-2 lg:p-3 bg-gray-50 dark:bg-dark-bg rounded border border-light-border dark:border-dark-border"
                    >
                      <span className="text-sm lg:text-base text-gray-800 dark:text-white font-mono">
                        {userId}
                      </span>
                      <button
                        onClick={() => handleRemoveUserId(userId)}
                        disabled={removeMutation.isPending}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm lg:text-base transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Информация */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 lg:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 text-sm lg:text-base">
                💡 Как это работает:
              </h4>
              <ul className="text-xs lg:text-sm text-blue-700 dark:text-blue-200 space-y-1">
                <li>• AI проверяет черный список перед обработкой каждого чата</li>
                <li>• Если userUid мужчины в списке → AI пропускает его</li>
                <li>• Можно включить игнорирование только для определенных категорий</li>
                <li>• Защита от зацикливания: если счетчик сообщений не меняется → skip 5 минут</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BlacklistTab;
