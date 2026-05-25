// AI Browser Context Service
// Управление отдельными браузерными контекстами для AI
// Позволяет AI работать параллельно с пользователем без конфликтов

import browserService from './browserService.js';
import pageHelpers from './pageHelpers.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';

const aiBrowserContextService = {
	/**
	 * Создать отдельный контекст для AI
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<string>} - ID созданного AI контекста
	 */
	createAiContext: async (accountId) => {
		try {
			console.log(`[AI Browser Context] Creating AI context for account ${accountId}`);

			// Получаем основной аккаунт
			const account = await LuxeeAccountModel.findById(accountId);
			if (!account) {
				throw new Error('Account not found');
			}

			// Проверяем что у аккаунта есть сессия
			if (!account.sessionData) {
				throw new Error('Account has no session data. Please login first.');
			}

			// Создаём ID для AI контекста
			const aiContextId = `${accountId}_ai`;

			// Проверяем что AI контекст ещё не создан
			const existingContext = browserService.getContext(aiContextId);
			if (existingContext) {
				console.log(`[AI Browser Context] AI context already exists for account ${accountId}`);
				return aiContextId;
			}

			// Парсим sessionData основного аккаунта
			let sessionData;
			try {
				sessionData = JSON.parse(account.sessionData);
			} catch (error) {
				throw new Error('Invalid session data format');
			}

			// Создаём новый контекст с той же сессией
			const aiContext = await browserService.createContext({
				accountId: aiContextId,
				sessionData: sessionData,
			});

			console.log(`[AI Browser Context] AI context created: ${aiContextId}`);

			// Сохраняем ID AI контекста в модели
			account.aiContext = aiContextId;
			await account.save();

			// Навигируем на страницу чатов
			const page = await pageHelpers.getOrCreatePage(aiContext);
			await pageHelpers.navigateTo({
				page,
				url: 'https://luxee.io/chats/',
			});

			console.log(`[AI Browser Context] AI context ready for account ${accountId}`);

			return aiContextId;
		} catch (error) {
			console.error('[AI Browser Context] Error creating AI context:', error);
			throw error;
		}
	},

	/**
	 * Получить AI контекст для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object|null>} - Playwright контекст или null
	 */
	getAiContext: async (accountId) => {
		try {
			const account = await LuxeeAccountModel.findById(accountId);
			if (!account || !account.aiContext) {
				return null;
			}

			const context = browserService.getContext(account.aiContext);
			
			// Проверить что контекст действительно работает
			if (context) {
				try {
					await context.pages();
					return context;
				} catch (error) {
					console.warn(`[AI Browser Context] Context for account ${accountId} is broken, will recreate`);
					// Контекст сломан, очистить его
					account.aiContext = null;
					await account.save();
					return null;
				}
			}
			
			return null;
		} catch (error) {
			console.error('[AI Browser Context] Error getting AI context:', error);
			return null;
		}
	},

	/**
	 * Получить или создать AI контекст
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object>} - Playwright контекст
	 */
	getOrCreateAiContext: async (accountId) => {
		try {
			// Проверить что браузер работает
			const isBrowserHealthy = await browserService.isBrowserHealthy();
			if (!isBrowserHealthy) {
				console.log('[AI Browser Context] Browser not healthy, waiting for recovery...');
				// Подождать немного для восстановления браузера
				await new Promise(resolve => setTimeout(resolve, 3000));
			}

			// Пытаемся получить существующий контекст
			let context = await aiBrowserContextService.getAiContext(accountId);

			// Если контекста нет - создаём
			if (!context) {
				const aiContextId = await aiBrowserContextService.createAiContext(accountId);
				context = browserService.getContext(aiContextId);
			}

			if (!context) {
				throw new Error('Failed to get or create AI context');
			}

			return context;
		} catch (error) {
			console.error('[AI Browser Context] Error in getOrCreateAiContext:', error);
			throw error;
		}
	},

	/**
	 * Закрыть AI контекст
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	closeAiContext: async (accountId) => {
		try {
			console.log(`[AI Browser Context] Closing AI context for account ${accountId}`);

			const account = await LuxeeAccountModel.findById(accountId);
			if (!account || !account.aiContext) {
				console.log('[AI Browser Context] No AI context to close');
				return;
			}

			// Закрываем контекст
			await browserService.closeContext(account.aiContext);

			// Удаляем ID из модели
			account.aiContext = null;
			await account.save();

			console.log(`[AI Browser Context] AI context closed for account ${accountId}`);
		} catch (error) {
			console.error('[AI Browser Context] Error closing AI context:', error);
			throw error;
		}
	},

	/**
	 * Проверить доступен ли AI контекст
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<boolean>}
	 */
	isAiContextAvailable: async (accountId) => {
		try {
			const context = await aiBrowserContextService.getAiContext(accountId);
			return context !== null;
		} catch (error) {
			console.error('[AI Browser Context] Error checking AI context availability:', error);
			return false;
		}
	},

	/**
	 * Восстановить AI контекст после перезапуска
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	restoreAiContext: async (accountId) => {
		try {
			console.log(`[AI Browser Context] Restoring AI context for account ${accountId}`);

			const account = await LuxeeAccountModel.findById(accountId);
			if (!account) {
				throw new Error('Account not found');
			}

			// Если AI включен для аккаунта - восстанавливаем контекст
			if (account.aiEnabled && account.sessionData) {
				await aiBrowserContextService.createAiContext(accountId);
				console.log(`[AI Browser Context] AI context restored for account ${accountId}`);
			} else {
				console.log(`[AI Browser Context] AI not enabled for account ${accountId}, skipping`);
			}
		} catch (error) {
			console.error('[AI Browser Context] Error restoring AI context:', error);
			// Не бросаем ошибку - продолжаем работу без AI контекста
		}
	},

	/**
	 * Восстановить все AI контексты для пользователя
	 * @param {string} userId - ID пользователя
	 */
	restoreAllAiContexts: async (userId) => {
		try {
			console.log(`[AI Browser Context] Restoring all AI contexts for user ${userId}`);

			const accounts = await LuxeeAccountModel.find({
				user: userId,
				isActive: true,
				aiEnabled: true,
			});

			console.log(`[AI Browser Context] Found ${accounts.length} accounts with AI enabled`);

			for (const account of accounts) {
				try {
					await aiBrowserContextService.restoreAiContext(account._id.toString());
				} catch (error) {
					console.error(
						`[AI Browser Context] Failed to restore AI context for account ${account._id}:`,
						error.message,
					);
					// Продолжаем с другими аккаунтами
				}
			}

			console.log(`[AI Browser Context] AI contexts restoration completed for user ${userId}`);
		} catch (error) {
			console.error('[AI Browser Context] Error restoring all AI contexts:', error);
		}
	},
};

export default aiBrowserContextService;
