import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { distributionApi } from '../api/distributionApi';
import { luxeeApi } from '../api/luxeeApi';
import useDistributionStore from '../stores/distributionStore';
import { useDistributionSync } from '../hooks/useDistributionSync';
import Header from '../components/layout/Header';
import DistributionForm from '../components/Distributions/DistributionForm';
import DistributionQueue from '../components/Distributions/DistributionQueue';
import DistributionProgress from '../components/Distributions/DistributionProgress';
import { Button } from '../components/ui';
import { toast } from 'react-hot-toast';

const Distributions = () => {
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Store
  const queue = useDistributionStore((state) => state.queue);
  const clearQueue = useDistributionStore((state) => state.clearQueue);
  const setDistributions = useDistributionStore((state) => state.setDistributions);
  const addDistribution = useDistributionStore((state) => state.addDistribution);
  const hasActiveDistribution = useDistributionStore((state) => state.hasActiveDistribution);

  // WebSocket sync
  useDistributionSync();

  // Получаем аккаунты
  const { 
    data: accountsData, 
    isLoading: isLoadingAccounts,
    error: accountsError 
  } = useQuery({
    queryKey: ['luxee-accounts'],
    queryFn: async () => {
      console.log('[Distributions] 🔄 Загрузка аккаунтов...');
      try {
        const data = await luxeeApi.getAccounts();
        console.log('[Distributions] ✅ Аккаунты загружены:', data);
        return data;
      } catch (error) {
        console.error('[Distributions] ❌ Ошибка загрузки аккаунтов:', error);
        toast.error('Ошибка загрузки аккаунтов');
        throw error;
      }
    },
  });

  // Получаем рассылки
  const { 
    data: distributionsData, 
    isLoading: isLoadingDistributions,
    error: distributionsError,
    refetch: refetchDistributions 
  } = useQuery({
    queryKey: ['distributions'],
    queryFn: async () => {
      console.log('[Distributions] 🔄 Загрузка рассылок...');
      try {
        const data = await distributionApi.getAll();
        console.log('[Distributions] ✅ Рассылки загружены:', data);
        setDistributions(data.distributions || []);
        return data;
      } catch (error) {
        console.error('[Distributions] ❌ Ошибка загрузки рассылок:', error);
        toast.error('Ошибка загрузки рассылок');
        throw error;
      }
    },
  });

  // Выбираем первый аккаунт по умолчанию АВТОМАТИЧЕСКИ
  useEffect(() => {
    console.log('[Distributions] 📊 accountsData:', accountsData);
    console.log('[Distributions] 📊 selectedAccountId:', selectedAccountId);
    
    // Backend возвращает массив напрямую, не {accounts: []}
    if (accountsData && Array.isArray(accountsData) && accountsData.length > 0) {
      // Если аккаунт НЕ выбран - выбираем первый
      if (!selectedAccountId) {
        const firstAccountId = accountsData[0]._id;
        console.log('[Distributions] ✅ Автоматически выбран первый аккаунт:', firstAccountId);
        setSelectedAccountId(firstAccountId);
      }
    }
  }, [accountsData]); // Убираем selectedAccountId из зависимостей

  // Запуск всех рассылок из очереди
  const handleStartDistributions = async () => {
    if (queue.length === 0) {
      toast.error('Добавьте хотя бы одну рассылку!');
      return;
    }

    if (hasActiveDistribution()) {
      toast.error('Уже есть активная рассылка!');
      return;
    }

    try {
      console.log('[Distributions] 🚀 Запуск рассылок из очереди:', queue.length);
      
      // Создаём и СРАЗУ запускаем рассылки
      for (const config of queue) {
        console.log('[Distributions] 📝 Создание рассылки для профиля:', config.profile.name);
        
        // 1. Создаём рассылку
        const createResult = await distributionApi.create(config);
        if (!createResult.success) {
          throw new Error(`Не удалось создать рассылку: ${createResult.error}`);
        }
        
        console.log('[Distributions] ✅ Рассылка создана:', createResult.distribution._id);
        addDistribution(createResult.distribution);
        
        // 2. ЗАПУСКАЕМ рассылку
        console.log('[Distributions] ▶️ Запуск рассылки:', createResult.distribution._id);
        const startResult = await distributionApi.start(createResult.distribution._id);
        
        if (!startResult.success) {
          throw new Error(`Не удалось запустить рассылку: ${startResult.error}`);
        }
        
        console.log('[Distributions] ✅ Рассылка запущена:', createResult.distribution._id);
      }

      // Очищаем очередь
      clearQueue();

      // Обновляем список
      await refetchDistributions();

      toast.success(`Рассылки запущены! (${queue.length})`);
    } catch (error) {
      console.error('[Distributions] ❌ Ошибка при запуске рассылок:', error);
      toast.error(error.response?.data?.error || error.message || 'Ошибка при запуске рассылок');
    }
  };

  // Backend возвращает массив напрямую
  const selectedAccount = Array.isArray(accountsData) 
    ? accountsData.find((a) => a._id === selectedAccountId) 
    : null;

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      <Header />

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 p-4">
        {/* Левая колонка: Форма создания рассылки */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Выбор аккаунта */}
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-sm p-4 mb-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Luxee аккаунт:
              </label>
              
              {isLoadingAccounts ? (
                <div className="text-center py-2 text-gray-500 dark:text-gray-400">
                  Загрузка аккаунтов...
                </div>
              ) : accountsError ? (
                <div className="text-center py-2 text-red-500">
                  Ошибка загрузки аккаунтов
                </div>
              ) : !accountsData || !Array.isArray(accountsData) || accountsData.length === 0 ? (
                <div className="text-center py-2 text-gray-500 dark:text-gray-400">
                  Нет доступных аккаунтов. Добавьте аккаунт на странице Dashboard.
                </div>
              ) : (
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => {
                    console.log('[Distributions] 🔄 Выбран аккаунт:', e.target.value);
                    setSelectedAccountId(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 dark:text-gray-100 font-medium"
                >
                  {accountsData.map((account) => (
                    <option key={account._id} value={account._id} className="bg-white dark:bg-gray-800">
                      {account.luxeeEmail}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Форма создания рассылки */}
            {selectedAccount && (
              <DistributionForm
                accountId={selectedAccountId}
                account={selectedAccount}
              />
            )}
          </div>
        </div>

        {/* Средняя колонка: Прогресс активной рассылки (между формой и очередью) */}
        {hasActiveDistribution() && (
          <div className="lg:w-96 overflow-y-auto">
            <DistributionProgress />
          </div>
        )}

        {/* Правая панель: Очередь рассылок */}
        <div className="lg:w-96 flex flex-col">
          <DistributionQueue />

          {/* Кнопка запуска */}
          <div className="mt-4">
            <Button
              onClick={handleStartDistributions}
              disabled={queue.length === 0 || hasActiveDistribution()}
              fullWidth
              className="h-12 text-lg font-semibold"
            >
              🚀 Начать рассылку ({queue.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Distributions;
