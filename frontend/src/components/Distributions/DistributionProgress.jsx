import { useState } from 'react';
import useDistributionStore from '../../stores/distributionStore';
import { distributionApi } from '../../api/distributionApi';
import { Button } from '../ui';
import { toast } from 'react-hot-toast';

const DistributionProgress = () => {
  const getActiveDistribution = useDistributionStore((state) => state.getActiveDistribution);
  const progress = useDistributionStore((state) => state.progress);
  const updateDistribution = useDistributionStore((state) => state.updateDistribution);
  const [stopping, setStopping] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const activeDistribution = getActiveDistribution();

  if (!activeDistribution) {
    return null;
  }

  const distProgress = progress[activeDistribution._id] || {
    sent_count: 0,
    skipped_count: 0,
  };

  const totalProcessed = (distProgress.sent_count || 0) + (distProgress.skipped_count || 0);
  const statusEmoji = {
    pending: '⏳',
    running: '🚀',
    completed: '✅',
    stopped: '⏹️',
    error: '❌',
  };

  const statusText = {
    pending: 'Ожидание',
    running: 'Выполняется',
    completed: 'Завершена',
    stopped: 'Остановлена',
    error: 'Ошибка',
  };

  const handleStop = async () => {
    if (stopping) return;
    
    setStopping(true);
    try {
      await distributionApi.stop(activeDistribution._id);
      toast.success('Отправлен сигнал остановки');
    } catch (error) {
      console.error('Error stopping distribution:', error);
      toast.error('Ошибка при остановке');
    } finally {
      setStopping(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    try {
      console.log('[DistributionProgress] 🔄 Syncing status for:', activeDistribution._id);
      const result = await distributionApi.sync(activeDistribution._id);
      
      if (result.success) {
        if (result.fixed) {
          toast.success(`Статус исправлен: ${result.old_status} → ${result.new_status}`);
          // Обновляем локальное состояние
          updateDistribution(activeDistribution._id, {
            status: result.new_status,
            error: 'Рассылка не была запущена в spambot (десинхронизация)'
          });
        } else {
          toast.success('Статус в порядке');
        }
      }
    } catch (error) {
      console.error('[DistributionProgress] Error syncing:', error);
      toast.error(error.response?.data?.error || 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-lg p-6 border border-light-border dark:border-dark-border">
      <div className="space-y-4">
        {/* Статус */}
        <div className="text-center">
          <div className="text-4xl mb-2">
            {statusEmoji[activeDistribution.status]}
          </div>
          <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {statusText[activeDistribution.status]}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {activeDistribution.profile?.name}
          </div>
        </div>

        {/* Прогресс */}
        <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {distProgress.sent_count || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Отправлено
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {distProgress.skipped_count || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Пропущено
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalProcessed}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Всего обработано
              </div>
            </div>
          </div>

          {/* Лимит */}
          {activeDistribution.limit && (
            <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Лимит: {activeDistribution.limit}
            </div>
          )}
        </div>

        {/* Ошибка (если есть) */}
        {activeDistribution.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              Ошибка:
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">
              {activeDistribution.error}
            </div>
          </div>
        )}

        {/* Информация */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>Создана: {new Date(activeDistribution.createdAt).toLocaleString('ru-RU')}</div>
          {activeDistribution.startedAt && (
            <div>Запущена: {new Date(activeDistribution.startedAt).toLocaleString('ru-RU')}</div>
          )}
          {activeDistribution.completedAt && (
            <div>Завершена: {new Date(activeDistribution.completedAt).toLocaleString('ru-RU')}</div>
          )}
        </div>

        {/* Кнопки действий */}
        {activeDistribution.status === 'running' && (
          <div className="flex gap-2">
            <Button
              onClick={handleStop}
              disabled={stopping || syncing}
              variant="danger"
              className="flex-1"
            >
              {stopping ? 'Остановка...' : '⏹️ Остановить'}
            </Button>
            <Button
              onClick={handleSync}
              disabled={stopping || syncing}
              variant="secondary"
              className="flex-shrink-0"
              title="Проверить реальный статус и исправить если застряла"
            >
              {syncing ? '🔄' : '🔄'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistributionProgress;
