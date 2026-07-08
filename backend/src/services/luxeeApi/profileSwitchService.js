// Profile Switch Service - Promise Queue (Event Loop Style)
// Глобальный сервис для переключения профилей с очередью и дедупликацией
// КРИТИЧНО: Все переключения профилей ДОЛЖНЫ идти через этот сервис!

// Глобальная очередь для каждого аккаунта (Event Loop Style)
// accountId → { isProcessing, currentProfileUid, queue: [{ profileUid, caller, resolve, reject, timestamp }] }
const profileSwitchQueues = new Map();

/**
 * Переключить профиль через Promise Queue (Event Loop Style)
 * @param {Object} page - Playwright page
 * @param {string} accountId - ID аккаунта (для изоляции очереди)
 * @param {number} profileUid - UID профиля для переключения
 * @param {string} caller - Название вызывающего сервиса (для логов)
 * @returns {Promise<boolean>} - Успешность переключения
 */
const switchProfile = async (page, accountId, profileUid, caller = 'unknown') => {
	// ========== ИНИЦИАЛИЗАЦИЯ ОЧЕРЕДИ ==========
	if (!profileSwitchQueues.has(accountId)) {
		profileSwitchQueues.set(accountId, {
			isProcessing: false,
			currentProfileUid: null,
			queue: [],
		});
		console.log(
			`[Profile Switch] 🆕 Created queue for account ${accountId}`,
		);
	}

	const q = profileSwitchQueues.get(accountId);

	// ========== БЫСТРАЯ ПРОВЕРКА: УЖЕ НА НУЖНОМ ПРОФИЛЕ? ==========
	if (q.currentProfileUid === profileUid && !q.isProcessing) {
		console.log(
			`[Profile Switch] ⚡ Already on profile ${profileUid} (${caller}) - skipping`,
		);
		return true;
	}

	// ========== ДЕДУПЛИКАЦИЯ: УЖЕ В ОЧЕРЕДИ? ==========
	const alreadyQueued = q.queue.some(
		item => item.profileUid === profileUid,
	);

	if (alreadyQueued) {
		console.log(
			`[Profile Switch] 🔄 Profile ${profileUid} already queued by another caller - waiting for it...`,
		);
		console.log(
			`[Profile Switch] 📊 Current caller: ${caller}, Queue size: ${q.queue.length}`,
		);

		// Ждём когда этот профиль станет активным
		return new Promise((resolve, reject) => {
			const startWait = Date.now();
			const maxWait = 15000; // 15 секунд для ожидания дубля

			const checkInterval = setInterval(() => {
				const elapsed = Date.now() - startWait;

				// Успех: профиль стал активным
				if (q.currentProfileUid === profileUid) {
					clearInterval(checkInterval);
					console.log(
						`[Profile Switch] ✅ Profile ${profileUid} ready (waited ${elapsed}ms) - ${caller}`,
					);
					resolve(true);
					return;
				}

				// Timeout
				if (elapsed > maxWait) {
					clearInterval(checkInterval);
					console.error(
						`[Profile Switch] ⏱️  Timeout waiting for queued profile ${profileUid} (${caller})`,
					);
					reject(new Error('Timeout waiting for queued profile'));
				}
			}, 500);
		});
	}

	// ========== ДОБАВЛЕНИЕ В ОЧЕРЕДЬ ==========
	return new Promise((resolve, reject) => {
		const request = {
			profileUid,
			caller,
			resolve,
			reject,
			timestamp: Date.now(),
		};

		q.queue.push(request);

		console.log(
			`[Profile Switch] 📥 Queued profile ${profileUid} (${caller}) - queue size: ${q.queue.length}`,
		);

		// Если очередь не обрабатывается - запускаем
		if (!q.isProcessing) {
			processQueue(page, accountId).catch(error => {
				console.error(
					`[Profile Switch] ❌ Critical error in queue processor:`,
					error,
				);
			});
		}
	});
};

/**
 * Обработать очередь переключений (Event Loop Processor)
 * @param {Object} page - Playwright page
 * @param {string} accountId - ID аккаунта
 */
const processQueue = async (page, accountId) => {
	const q = profileSwitchQueues.get(accountId);

	if (!q) {
		console.error(
			`[Profile Switch] ❌ Queue not found for account ${accountId}`,
		);
		return;
	}

	// Защита от параллельного запуска
	if (q.isProcessing) {
		console.log(
			`[Profile Switch] ⏸️  Queue already processing for account ${accountId}`,
		);
		return;
	}

	if (q.queue.length === 0) {
		console.log(
			`[Profile Switch] 📭 Queue empty for account ${accountId}`,
		);
		return;
	}

	q.isProcessing = true;
	console.log(
		`[Profile Switch] 🚀 Starting queue processor for account ${accountId} (${q.queue.length} items)`,
	);

	// ========== ОБРАБОТКА ОЧЕРЕДИ (FIFO) ==========
	while (q.queue.length > 0) {
		const request = q.queue.shift(); // FIFO: первый пришёл - первый выполнился
		const queueWaitTime = Date.now() - request.timestamp;

		console.log(
			`[Profile Switch] 🔄 Processing: profile ${request.profileUid} (${request.caller})`,
		);
		console.log(
			`[Profile Switch] ⏱️  Request waited in queue: ${queueWaitTime}ms`,
		);

		try {
			// ========== ВЫПОЛНЕНИЕ ПЕРЕКЛЮЧЕНИЯ ==========
			const switchStartTime = Date.now();

			// 1. Вызов selectProfile в браузере
			console.log(
				`[Browser] 🔄 Switching to profile ${request.profileUid} (caller: ${request.caller})`,
			);

			await page.evaluate(
				({ uid, callerName }) => {
					try {
						if (!window.modelsChat?.selectProfile) {
							throw new Error('modelsChat.selectProfile not available');
						}
						window.modelsChat.selectProfile(uid);
					} catch (error) {
						console.error(
							`[Browser] Error in selectProfile: ${error.message}`,
						);
						throw error;
					}
				},
				{ uid: request.profileUid, callerName: request.caller },
			);

			// 2. Ждём загрузки чатов (3 секунды)
			await new Promise(resolve => setTimeout(resolve, 3000));

			// 3. Проверка что переключились
			const activeUid = await page.evaluate(() => {
				return window.modelsChat?.getProfile?.active?.inner?.uid || null;
			});

			const switchElapsed = Date.now() - switchStartTime;

			if (activeUid === request.profileUid) {
				// ========== УСПЕХ ==========
				q.currentProfileUid = request.profileUid;
				request.resolve(true);
				console.log(
					`[Profile Switch] ✅ Success: profile ${request.profileUid} (${request.caller}) in ${switchElapsed}ms`,
				);
				console.log(
					`[Profile Switch] 📊 Remaining in queue: ${q.queue.length}`,
				);
			} else {
				// ========== ОШИБКА: НЕ ПЕРЕКЛЮЧИЛОСЬ ==========
				const errorMsg = `Switch failed: expected ${request.profileUid}, got ${activeUid}`;
				console.error(
					`[Profile Switch] ❌ ${errorMsg} (${request.caller})`,
				);
				request.reject(new Error(errorMsg));
			}
		} catch (error) {
			// ========== ИСКЛЮЧЕНИЕ ==========
			console.error(
				`[Profile Switch] ❌ Exception during switch (${request.caller}):`,
				error.message,
			);
			request.reject(error);
		}

		// Небольшая задержка между переключениями (антиспам)
		if (q.queue.length > 0) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}
	}

	// ========== ОЧЕРЕДЬ ПУСТА ==========
	q.isProcessing = false;
	console.log(
		`[Profile Switch] 🏁 Queue processor finished for account ${accountId}`,
	);
};

/**
 * Получить текущий активный профиль
 * @param {Object} page - Playwright page
 * @returns {Promise<number|null>} - UID активного профиля
 */
const getCurrentProfile = async page => {
	try {
		const uid = await page.evaluate(() => {
			return window.modelsChat?.getProfile?.active?.inner?.uid || null;
		});
		return uid;
	} catch (error) {
		console.error('[Profile Switch] Error getting current profile:', error);
		return null;
	}
};

/**
 * Получить статус очереди для аккаунта
 * @param {string} accountId - ID аккаунта
 * @returns {Object|null} - Информация о очереди
 */
const getQueueStatus = accountId => {
	if (!profileSwitchQueues.has(accountId)) {
		return null;
	}

	const q = profileSwitchQueues.get(accountId);
	return {
		isProcessing: q.isProcessing,
		currentProfileUid: q.currentProfileUid,
		queueLength: q.queue.length,
		queuedProfiles: q.queue.map(item => ({
			profileUid: item.profileUid,
			caller: item.caller,
			waitingMs: Date.now() - item.timestamp,
		})),
	};
};

/**
 * Принудительно очистить очередь (для экстренных случаев)
 * @param {string} accountId - ID аккаунта
 * @param {string} reason - Причина очистки
 * @returns {number} - Количество отменённых запросов
 */
const clearQueue = (accountId, reason = 'Manual clear') => {
	if (!profileSwitchQueues.has(accountId)) {
		return 0;
	}

	const q = profileSwitchQueues.get(accountId);
	const cancelledCount = q.queue.length;

	// Отклоняем все запросы в очереди
	q.queue.forEach(request => {
		request.reject(new Error(`Queue cleared: ${reason}`));
	});

	q.queue = [];
	q.isProcessing = false;

	console.log(
		`[Profile Switch] 🗑️  Cleared queue for account ${accountId}: ${cancelledCount} requests cancelled (${reason})`,
	);

	return cancelledCount;
};

/**
 * Принудительно разблокировать процессор (для отладки)
 * @param {string} accountId - ID аккаунта
 * @returns {boolean} - Был ли процессор заблокирован
 */
const forceUnlock = accountId => {
	if (!profileSwitchQueues.has(accountId)) {
		return false;
	}

	const q = profileSwitchQueues.get(accountId);
	if (q.isProcessing) {
		q.isProcessing = false;
		console.log(
			`[Profile Switch] 🔓 Force unlocked processor for account ${accountId}`,
		);
		return true;
	}

	return false;
};

/**
 * Удалить очередь аккаунта (вызывать при отключении аккаунта)
 * @param {string} accountId - ID аккаунта
 */
const deleteQueue = accountId => {
	if (!profileSwitchQueues.has(accountId)) {
		return;
	}

	// Отменяем все запросы
	clearQueue(accountId, 'Account disconnected');

	// Удаляем очередь
	profileSwitchQueues.delete(accountId);
	console.log(
		`[Profile Switch] 🗑️  Deleted queue for account ${accountId}`,
	);
};

/**
 * Получить статистику по всем очередям
 * @returns {Object} - Общая статистика
 */
const getGlobalStats = () => {
	const stats = {
		totalAccounts: profileSwitchQueues.size,
		activeProcessors: 0,
		totalQueuedRequests: 0,
		accounts: [],
	};

	profileSwitchQueues.forEach((q, accountId) => {
		if (q.isProcessing) stats.activeProcessors++;
		stats.totalQueuedRequests += q.queue.length;

		stats.accounts.push({
			accountId,
			isProcessing: q.isProcessing,
			currentProfileUid: q.currentProfileUid,
			queueLength: q.queue.length,
		});
	});

	return stats;
};

export default {
	switchProfile,
	getCurrentProfile,
	getQueueStatus,
	clearQueue,
	forceUnlock,
	deleteQueue,
	getGlobalStats,
};
