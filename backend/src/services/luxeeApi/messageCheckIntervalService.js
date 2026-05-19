// Сервис для автоматической проверки сообщений каждые 8 секунд
// ✅ Работает независимо от очереди
// ✅ Не мешает отправке сообщений

import messageCheckService from './messageCheckService/index.js';

const checkIntervals = new Map(); // userId -> intervalId
const lastCheckResults = new Map(); // userId -> lastResult

const messageCheckIntervalService = {
	/**
	 * Запустить автоматическую проверку для пользователя
	 */
	start: ({ userId }) => {
		try {
			// Если уже запущен - не запускаем повторно
			if (checkIntervals.has(userId)) {
				console.log(`[Message Check Interval] Already running for user ${userId}`);
				return;
			}

			console.log(`[Message Check Interval] Starting for user ${userId}`);

			// Функция проверки
			const performCheck = async () => {
				try {
					const result = await messageCheckService.checkAllMessages({ userId });
					lastCheckResults.set(userId, {
						timestamp: Date.now(),
						result,
					});

					// Подсчитываем unanswered
					const totalUnanswered = result.accounts.reduce((sum, account) => {
						return sum + account.profiles.reduce((pSum, profile) => {
							return pSum + (profile.unansweredMessages || 0);
						}, 0);
					}, 0);

					// Логируем только если есть новые сообщения или неотвеченные
					if (result.totalUnread > 0 || totalUnanswered > 0) {
						console.log(
							`[Message Check Interval] User ${userId}: ${result.totalUnread} unread, ${totalUnanswered} unanswered`,
						);
					}
				} catch (error) {
					console.error(
						`[Message Check Interval] Error checking messages for user ${userId}:`,
						error.message,
					);
				}
			};

			// Первая проверка сразу
			performCheck();

			// Запускаем интервал каждые 8 секунд
			const intervalId = setInterval(performCheck, 8000);
			checkIntervals.set(userId, intervalId);

			console.log(
				`[Message Check Interval] Started for user ${userId} (every 8 seconds)`,
			);
		} catch (error) {
			console.error(
				`[Message Check Interval] Error starting for user ${userId}:`,
				error,
			);
			throw error;
		}
	},

	/**
	 * Остановить автоматическую проверку для пользователя
	 */
	stop: userId => {
		try {
			const intervalId = checkIntervals.get(userId);
			if (intervalId) {
				clearInterval(intervalId);
				checkIntervals.delete(userId);
				lastCheckResults.delete(userId);
				console.log(`[Message Check Interval] Stopped for user ${userId}`);
			}
		} catch (error) {
			console.error(
				`[Message Check Interval] Error stopping for user ${userId}:`,
				error,
			);
		}
	},

	/**
	 * Остановить все проверки
	 */
	stopAll: () => {
		try {
			const userIds = Array.from(checkIntervals.keys());
			for (const userId of userIds) {
				messageCheckIntervalService.stop(userId);
			}
			console.log('[Message Check Interval] All stopped');
		} catch (error) {
			console.error('[Message Check Interval] Error stopping all:', error);
		}
	},

	/**
	 * Получить последний результат проверки
	 */
	getLastResult: userId => {
		return lastCheckResults.get(userId);
	},

	/**
	 * Получить статистику
	 */
	getStats: () => ({
		activeChecks: checkIntervals.size,
		userIds: Array.from(checkIntervals.keys()),
	}),
};

export default messageCheckIntervalService;
