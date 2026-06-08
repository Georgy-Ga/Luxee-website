import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { luxeeApi } from '../../api/luxeeApi';
import { Button, Input } from '../ui';
import LuxeeAccountCard from './LuxeeAccountCard';

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
      <form onSubmit={handleAddLuxee} className="card p-4 space-y-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light">
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
            className="input-field"
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
              className="input-field pr-10"
              placeholder="Пароль от Luxee"
            />
            <button
              type="button"
              onClick={() => setShowLuxeePassword(!showLuxeePassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple dark:text-gray-400 dark:hover:text-accent-light transition-colors"
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
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addLuxeeMutation.isPending ? 'Добавление...' : 'Добавить аккаунт'}
        </button>
      </form>

      <div className="card p-4">
        <h3 className="text-lg font-semibold text-purple dark:text-accent-light mb-4">
          Мои Luxee аккаунты ({luxeeAccounts?.length || 0})
        </h3>
        <div className="space-y-2">
          {luxeeAccounts?.map((acc) => (
            <LuxeeAccountCard
              key={acc._id || acc.accountId}
              account={acc}
              onRestore={(id) => restoreMutation.mutate(id)}
              onDelete={(id) => deleteLuxeeMutation.mutate(id)}
              isRestoring={restoreMutation.isPending}
              isDeleting={deleteLuxeeMutation.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LuxeeTab;
