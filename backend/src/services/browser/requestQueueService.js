// Сервис для управления очередью запросов к аккаунтам
// Предотвращает одновременное выполнение запросов на одном аккаунте

class RequestQueueService {
	constructor() {
		// Очереди для каждого аккаунта: accountId -> Promise
		this.queues = new Map();
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

		// Авточистка: когда цепочка settlement'ится и новее ничего не встало —
		// убираем запись, иначе Map растёт бесконечно, а isLocked-подобные
		// проверки по has() врут навсегда
		const cleanup = () => {
			if (this.queues.get(accountId) === newQueue) {
				this.queues.delete(accountId);
			}
		};
		newQueue.then(cleanup, cleanup);

		return newQueue;
	}

	/**
	 * Есть ли незавершённая цепочка для аккаунта
	 * @param {string} accountId - ID аккаунта
	 * @returns {boolean}
	 */
	isLocked(accountId) {
		return this.queues.has(accountId);
	}

	/**
	 * Сбросить очередь аккаунта (для удаления/отключения)
	 * @param {string} accountId - ID аккаунта
	 */
	clearQueue(accountId) {
		this.queues.delete(accountId);
	}

}

// Экспортируем синглтон
const requestQueueService = new RequestQueueService();
export default requestQueueService;
