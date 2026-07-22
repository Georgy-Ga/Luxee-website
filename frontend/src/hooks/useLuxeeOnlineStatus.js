import { useState, useEffect, useCallback } from 'react';
import { luxeeApi } from '../api/luxeeApi';
import { useSocket } from '../contexts/SocketContext';

/**
 * Hook для управления онлайн статусом ВСЕХ Luxee аккаунтов пользователя
 * 
 * @returns {Object} { isOnline, lastActivity, loading, trackActivity }
 */
export const useLuxeeOnlineStatus = () => {
	const [isOnline, setIsOnline] = useState(false);
	const [lastActivity, setLastActivity] = useState(null);
	const [loading, setLoading] = useState(true);
	const { socket } = useSocket();

	// Загрузить начальный статус
	const loadStatus = useCallback(async () => {
		try {
			const data = await luxeeApi.getOnlineStatus();
			setIsOnline(data.isOnline);
			setLastActivity(data.lastActivity);
		} catch (error) {
			console.error('[Luxee Online Status] Error loading status:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Отследить ручную активность
	const trackActivity = useCallback(async (accountId = null) => {
		try {
			await luxeeApi.trackManualActivity(accountId);
			// Статус обновится через WebSocket
		} catch (error) {
			console.error('[Luxee Online Status] Error tracking activity:', error);
		}
	}, []);

	// Загрузить статус при монтировании
	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	// Подписаться на WebSocket события
	useEffect(() => {
		if (!socket) return;

		const handleStatusUpdate = (data) => {
			console.log('[Luxee Online Status] WebSocket update:', data);
			setIsOnline(data.isOnline);
			if (data.isOnline) {
				setLastActivity(new Date());
			}
		};

		socket.on('luxee:accounts:online-status', handleStatusUpdate);

		return () => {
			socket.off('luxee:accounts:online-status', handleStatusUpdate);
		};
	}, [socket]);

	return {
		isOnline,
		lastActivity,
		loading,
		trackActivity,
	};
};
