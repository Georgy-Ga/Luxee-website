import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import useDistributionStore from '../stores/distributionStore';

/**
 * Hook для синхронизации рассылок через WebSocket
 */
export const useDistributionSync = () => {
  const { socket, isConnected } = useSocket();
  const updateProgress = useDistributionStore((state) => state.updateProgress);
  const updateDistributionStatus = useDistributionStore((state) => state.updateDistributionStatus);
  const updateDistribution = useDistributionStore((state) => state.updateDistribution);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Запуск рассылки
    const handleStarted = (data) => {
      console.log('[Distribution] Started:', data);
      updateDistributionStatus(data.distributionId, 'running');
    };

    // Обновление прогресса
    const handleProgress = (data) => {
      console.log('[Distribution] Progress:', data);
      updateProgress(data.distributionId, data.progress);
    };

    // Завершение рассылки
    const handleCompleted = (data) => {
      console.log('[Distribution] Completed:', data);
      updateDistribution(data.distributionId, {
        status: data.status,
        progress: data.progress,
        error: data.error,
      });
    };

    // Остановка рассылки
    const handleStopped = (data) => {
      console.log('[Distribution] Stopped:', data);
      updateDistributionStatus(data.distributionId, 'stopped');
    };

    // Подписываемся на события
    socket.on('distribution:started', handleStarted);
    socket.on('distribution:progress', handleProgress);
    socket.on('distribution:completed', handleCompleted);
    socket.on('distribution:stopped', handleStopped);

    // Отписываемся при размонтировании
    return () => {
      socket.off('distribution:started', handleStarted);
      socket.off('distribution:progress', handleProgress);
      socket.off('distribution:completed', handleCompleted);
      socket.off('distribution:stopped', handleStopped);
    };
  }, [socket, isConnected, updateProgress, updateDistributionStatus, updateDistribution]);
};
