// Keep-Alive сервис для поддержания активности контекстов
// Проверяет alert окна и закрывает их нажатием OK

import aiAuto from '../aiAuto/index.js';

const keepAliveIntervals = new Map(); // accountId -> intervalId
const keepAliveQueue = []; // Очередь для последовательной обработки
let isProcessingQueue = false;

const keepAliveService = {
	// Запустить keep-alive для контекста
	start: async ({ accountId, context }) => {
		try {
			// Если уже запущен - не запускаем повторно
			if (keepAliveIntervals.has(accountId)) {
				console.log(`[Keep-Alive] Already running for account ${accountId}`);
				return;
			}

			console.log(`[Keep-Alive] Starting for account ${accountId}`);

			// Функция для выполнения keep-alive действия
			const performKeepAlive = async () => {
				// Добавляем в очередь
				keepAliveQueue.push({ accountId, context });
				
				// Запускаем обработку очереди если ещё не запущена
				if (!isProcessingQueue) {
					keepAliveService.processQueue();
				}
			};

			// Запускаем интервал каждые 45 секунд
			const intervalId = setInterval(performKeepAlive, 45000);
			keepAliveIntervals.set(accountId, intervalId);

			console.log(
				`[Keep-Alive] Started for account ${accountId} (every 45 seconds)`,
			);
		} catch (error) {
			console.error(
				`[Keep-Alive] Error starting for account ${accountId}:`,
				error,
			);
			throw error;
		}
	},

	// Обработка очереди последовательно
	processQueue: async () => {
		if (isProcessingQueue) return;
		
		isProcessingQueue = true;

		while (keepAliveQueue.length > 0) {
			const { accountId, context } = keepAliveQueue.shift();

			try {
				const pages = context.pages();
				if (pages.length === 0) {
					console.log(`[Keep-Alive] No pages for account ${accountId}`);
					continue;
				}

				const page = pages[0];

				// Проверяем есть ли alert/dialog
				try {
					// Устанавливаем обработчик для dialog
					const dialogPromise = new Promise((resolve) => {
						const handler = async (dialog) => {
							console.log(`[Keep-Alive] Dialog detected for account ${accountId}: ${dialog.message()}`);
							await dialog.accept(); // Нажимаем OK
							console.log(`[Keep-Alive] Dialog accepted for account ${accountId}`);
							page.off('dialog', handler);
							resolve(true);
						};
						page.on('dialog', handler);
						
						// Таймаут 2 секунды - если нет dialog, продолжаем
						setTimeout(() => {
							page.off('dialog', handler);
							resolve(false);
						}, 2000);
					});

					await dialogPromise;
				} catch (error) {
					console.error(`[Keep-Alive] Error checking dialog for ${accountId}:`, error.message);
				}

				// Проверяем popup "You're inactive"
				try {
					const popupButton = page.locator('button:has-text("I am online")');
					const count = await popupButton.count();

					if (count > 0) {
						const isVisible = await popupButton.isVisible().catch(() => false);
						if (isVisible) {
							console.log(`[Keep-Alive] 🔔 Closing "You're inactive" popup for account ${accountId}`);
							
							// 🛡️ БЕЗОПАСНОСТЬ: Проверка #1 - AI Auto не работает?
							const lockStatus = aiAuto.getAccountLockStatus(accountId);
							if (lockStatus?.isLocked) {
								console.log(`[Keep-Alive] ⏸️  AI Auto is processing ${accountId}, skipping offline→online fix`);
								continue; // Пропускаем этот аккаунт
							}
							
							await popupButton.click({ timeout: 3000 });
							await page.waitForTimeout(500);
							
							// 🛡️ БЕЗОПАСНОСТЬ: Проверка #2 - AI Auto не начал работу?
							const lockAfterClick = aiAuto.getAccountLockStatus(accountId);
							if (lockAfterClick?.isLocked) {
								console.log(`[Keep-Alive] ⚠️  AI Auto started during click, canceling reload`);
								continue; // Пропускаем reload
							}
							
							// ✅ RELOAD: Обновляем страницу для восстановления соединения
							console.log(`[Keep-Alive] 🔄 Reloading page for account ${accountId} (offline→online recovery)`);
							const currentUrl = page.url();
							await page.goto(currentUrl, { 
								waitUntil: 'domcontentloaded', 
								timeout: 30000 
							});
							await page.waitForTimeout(3000); // Ждём загрузки
							console.log(`[Keep-Alive] ✅ Page reloaded for account ${accountId}`);
						}
					}
				} catch (error) {
					console.error(`[Keep-Alive] ⚠️  Error handling offline→online for ${accountId}:`, error.message);
				}

				console.log(`[Keep-Alive] Check completed for account ${accountId}`);
			} catch (error) {
				console.error(`[Keep-Alive] Error for account ${accountId}:`, error.message);
			}

			// Небольшая задержка между аккаунтами
			await new Promise(resolve => setTimeout(resolve, 1000));
		}

		isProcessingQueue = false;
	},

	// Остановить keep-alive для контекста
	stop: accountId => {
		try {
			const intervalId = keepAliveIntervals.get(accountId);
			if (intervalId) {
				clearInterval(intervalId);
				keepAliveIntervals.delete(accountId);
				console.log(`[Keep-Alive] Stopped for account ${accountId}`);
			}
		} catch (error) {
			console.error(
				`[Keep-Alive] Error stopping for account ${accountId}:`,
				error,
			);
		}
	},

	// Остановить все keep-alive
	stopAll: () => {
		try {
			const accountIds = Array.from(keepAliveIntervals.keys());
			for (const accountId of accountIds) {
				keepAliveService.stop(accountId);
			}
			console.log('[Keep-Alive] All stopped');
		} catch (error) {
			console.error('[Keep-Alive] Error stopping all:', error);
		}
	},

	// Получить статистику
	getStats: () => ({
		activeKeepAlives: keepAliveIntervals.size,
		accountIds: Array.from(keepAliveIntervals.keys()),
	}),
};

export default keepAliveService;
