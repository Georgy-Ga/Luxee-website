// Сервис для управления очередью запросов к аккаунтам
// Предотвращает одновременное выполнение запросов на одном аккаунте

class RequestQueueService {
	constructor() {
		// Очереди для каждого аккаунта: accountId -> Promise
		this.queues = new Map();
		// Блокировки для каждого аккаунта: accountId -> boolean
		this.locks = new Map();
		// Глобальная очередь для отправки сообщений
		this.globalSendQueue = Promise.resolve();
		this.globalSendLock = false;
	}

	/**
	 * Выполнить функцию в очереди для аккаунта
	 * @param {string} accountId - ID аккаунта
	 * @param {Function} fn - Функция для выполнения
	 * @returns {Promise} Результат выполнения функции
	 */
	async executeInQueue(accountId, fn) {
		// Ждем пока предыдущий запрос завершится
		while (this.locks.get(accountId)) {
			await this.queues.get(accountId);
			// Небольшая задержка для предотвращения гонки
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		// Устанавливаем блокировку
		this.locks.set(accountId, true);

		// Создаем промис для текущего запроса
		const promise = (async () => {
			try {
				console.log(`[Request Queue] Starting request for account ${accountId}`);
				const result = await fn();
				console.log(`[Request Queue] Completed request for account ${accountId}`);
				return result;
			} catch (error) {
				console.error(`[Request Queue] Error in request for account ${accountId}:`, error.message);
				throw error;
			} finally {
				// Снимаем блокировку
				this.locks.set(accountId, false);
			}
		})();

		// Сохраняем промис в очередь
		this.queues.set(accountId, promise);

		return promise;
	}

	/**
	 * Выполнить отправку сообщения в глобальной очереди
	 * Гарантирует что сообщения отправляются строго по очереди
	 * @param {Function} fn - Функция отправки сообщения
	 * @returns {Promise} Результат выполнения функции
	 */
	async executeMessageSend(fn) {
		// Добавляем в глобальную очередь
		this.globalSendQueue = this.globalSendQueue.then(async () => {
			this.globalSendLock = true;
			try {
				console.log('[Global Send Queue] Starting message send');
				const result = await fn();
				console.log('[Global Send Queue] Message sent successfully');
				// Задержка между отправками для стабильности
				await new Promise(resolve => setTimeout(resolve, 1000));
				return result;
			} catch (error) {
				console.error('[Global Send Queue] Error sending message:', error.message);
				throw error;
			} finally {
				this.globalSendLock = false;
			}
		});

		return this.globalSendQueue;
	}

	/**
	 * Проверить, заблокирован ли аккаунт
	 * @param {string} accountId - ID аккаунта
	 * @returns {boolean}
	 */
	isLocked(accountId) {
		return this.locks.get(accountId) || false;
	}

	/**
	 * Проверить, идет ли отправка сообщения
	 * @returns {boolean}
	 */
	isSendingMessage() {
		return this.globalSendLock;
	}

	/**
	 * Очистить очередь для аккаунта
	 * @param {string} accountId - ID аккаунта
	 */
	clearQueue(accountId) {
		this.queues.delete(accountId);
		this.locks.set(accountId, false);
	}

	/**
	 * Очистить все очереди
	 */
	clearAll() {
		this.queues.clear();
		this.locks.clear();
		this.globalSendQueue = Promise.resolve();
		this.globalSendLock = false;
	}
}

// Экспортируем синглтон
const requestQueueService = new RequestQueueService();
export default requestQueueService;
