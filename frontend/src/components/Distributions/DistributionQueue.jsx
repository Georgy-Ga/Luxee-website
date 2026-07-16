import useDistributionStore from '../../stores/distributionStore';
import { Card, Button } from '../ui';

const DistributionQueue = () => {
  const queue = useDistributionStore((state) => state.queue);
  const removeFromQueue = useDistributionStore((state) => state.removeFromQueue);
  const clearQueue = useDistributionStore((state) => state.clearQueue);

  if (queue.length === 0) {
    return (
      <Card className="flex-1">
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Очередь рассылок
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Очередь пуста</p>
          <p className="text-xs mt-2">Добавьте рассылки слева</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Очередь ({queue.length})
        </h3>
        <button
          onClick={clearQueue}
          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
        >
          Очистить всё
        </button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {queue.map((dist, index) => (
          <div
            key={dist.id}
            className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                  🔹 Рассылка #{index + 1}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {dist.profile.name} ({dist.profile.age}, {dist.profile.location})
                </div>
              </div>
              <button
                onClick={() => removeFromQueue(dist.id)}
                className="text-red-500 hover:text-red-700 text-sm ml-2"
              >
                ✖
              </button>
            </div>

            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <div>Лимит: {dist.limit || '∞'}</div>
              {dist.messages && (
                <div>Сообщений: {dist.messages.length}</div>
              )}
              {dist.mail_message && (
                <div>Письмо: {dist.mail_message.title}</div>
              )}
              {dist.only_empty_chat && <div>✓ Только новым</div>}
              {dist.only_not_empty_chat && <div>✓ Только старым</div>}
              {dist.specific_users?.length > 0 && (
                <div>👥 Конкретные: {dist.specific_users.length}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DistributionQueue;
