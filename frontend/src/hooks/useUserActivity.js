import { useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';
import useAuthStore from '../stores/authStore';

/**
 * Хук для отслеживания активности пользователя
 * Отправляет heartbeat каждые 30 секунд при активности
 */
export const useUserActivity = () => {
	const { isAuthenticated } = useAuthStore();
	const lastActivityRef = useRef(Date.now());
	const heartbeatIntervalRef = useRef(null);
	const isActiveRef = useRef(false);

	// Отправить heartbeat на сервер
	const sendHeartbeat = useCallback(async () => {
		// Не отправляем heartbeat если пользователь не авторизован
		if (!isAuthenticated) {
			return;
		}
		
		try {
			await axios.post('/user/activity');
			console.log('[User Activity] Heartbeat sent');
		} catch (error) {
			// Игнорируем ошибки 401 (не авторизован)
			if (error.response?.status !== 401) {
				console.error('[User Activity] Error sending heartbeat:', error);
			}
		}
	}, [isAuthenticated]);

	// Обработчик активности пользователя
	const handleActivity = useCallback(() => {
		const now = Date.now();
		lastActivityRef.current = now;
		
		// Если пользователь неактивен больше 30 секунд, отправляем heartbeat немедленно
		if (!isActiveRef.current) {
			isActiveRef.current = true;
			sendHeartbeat();
		}
	}, [sendHeartbeat]);

	useEffect(() => {
		// Не запускаем отслеживание если пользователь не авторизован
		if (!isAuthenticated) {
			return;
		}

		// Регистрируем обработчики активности
		const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
		
		events.forEach(event => {
			window.addEventListener(event, handleActivity, { passive: true });
		});

		// Запускаем интервал для отправки heartbeat каждые 30 секунд
		heartbeatIntervalRef.current = setInterval(() => {
			const timeSinceLastActivity = Date.now() - lastActivityRef.current;
			
			// Если активность была в последние 35 секунд, отправляем heartbeat
			if (timeSinceLastActivity < 35000) {
				sendHeartbeat();
			} else {
				// Пользователь неактивен
				isActiveRef.current = false;
			}
		}, 30000); // Каждые 30 секунд

		// Отправляем первый heartbeat при монтировании (только если авторизован)
		sendHeartbeat();

		// Cleanup
		return () => {
			events.forEach(event => {
				window.removeEventListener(event, handleActivity);
			});
			
			if (heartbeatIntervalRef.current) {
				clearInterval(heartbeatIntervalRef.current);
			}
		};
	}, [handleActivity, sendHeartbeat, isAuthenticated]);

	return {
		sendHeartbeat,
	};
};

export default useUserActivity;
