// Сервис для управления очередью запросов к аккаунтам
// Предотвращает одновременное выполнение запросов на одном аккаунте

class RequestQueueService {
	constructor() {
		// Очереди для каждого аккаунта: accountId -> Promise
		this.queues = new Map();
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
		// Получаем текущую очередь или создаем resolved промис
		const currentQueue = this.queues.get(accountId) || Promise.resolve();
		
		// Создаем новый промис в цепочке (атомарная операция)
		const newQueue = currentQueue
			.then(async () => {
				console.log(`[Request Queue] Starting request for account ${accountId}`);
				const result = await fn();
				console.log(`[Request Queue] Completed request for account ${accountId}`);
				return result;
			})
			.catch(error => {
				console.error(`[Request Queue] Error in request for account ${accountId}:`, error.message);
				throw error;
			});
		
		// Сохраняем новый промис в очередь
		this.queues.set(accountId, newQueue);
		
		return newQueue;
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
	 * Проверить, есть ли активная очередь для аккаунта
	 * @param {string} accountId - ID аккаунта
	 * @returns {boolean}
	 */
	isLocked(accountId) {
		return this.queues.has(accountId);
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
	}

	/**
	 * Очистить все очереди
	 */
	clearAll() {
		this.queues.clear();
		this.globalSendQueue = Promise.resolve();
		this.globalSendLock = false;
	}
}

// Экспортируем синглтон
const requestQueueService = new RequestQueueService();
export default requestQueueService;
