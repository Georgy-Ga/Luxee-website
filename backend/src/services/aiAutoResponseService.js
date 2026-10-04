// AI Auto Response Service
// Автоматические ответы AI на новые сообщения
// Работает через отдельные AI контексты для каждого аккаунта

// 🚨🚨🚨 MASTER KILL SWITCH - ГЛОБАЛЬНОЕ ОТКЛЮЧЕНИЕ AI АВТООТВЕТОВ 🚨🚨🚨
// Установите в false для включения AI автоответов
// Установите в true для полного отключения (РЕКОМЕНДУЕТСЯ во время разработки)
// ⚠️ ВКЛЮЧЕНО ДЛЯ ТЕСТИРОВАНИЯ - отправка всё равно заблокирована AI_DEBUG_MODE
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = false;

import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import aiAuto from './aiAuto/index.js';
import cycleLogger from './aiAuto/cycleLogger.js';
import aiManagementService from './aiManagementService/index.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import pageHelpers from './browser/pageHelpers.js';
import chatNavigationService from './luxeeApi/chatNavigationService.js';
import keepAliveService from './luxeeApi/keepAliveService.js';
import onlineKeeperService from './onlineKeeperService.js';
import { vlog } from './verbose.js';
import { setAllOfflineViaNewContext } from './luxeeApi/onlineRecoveryService.js';

// Хранилище активных процессов автоответов
const activeAutoResponders = new Map(); // accountId -> { intervalId, isProcessing }


const aiAutoResponseService = {
	/**
	 * Запустить автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	start: async accountId => {
		// 🚨 УРОВЕНЬ 1 ЗАЩИТЫ: Блокировка запуска
		if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
			console.log(
				`🛑 [AI Auto Response] GLOBALLY DISABLED - not starting for account ${accountId}`,
			);
			return;
		}

		try {
			// Проверяем что автоответы ещё не запущены
			if (activeAutoResponders.has(accountId)) {
				console.log(
					`[AI Auto Response] Already running for account ${accountId}`,
				);
				return;
			}

			console.log(`[AI Auto Response] Starting for account ${accountId}`);

			// Получаем аккаунт
			const account = await LuxeeAccountModel.findById(accountId);
			if (!account) {
				throw new Error('Account not found');
			}

			// Проверяем что AI включен для аккаунта
			const canUse = await aiManagementService.canAccountUseAi(
				account.user.toString(),
				accountId,
			);

			if (!canUse) {
				console.log(
					`[AI Auto Response] AI disabled for account ${accountId}, not starting`,
				);
				return;
			}

			// Создаём или получаем AI контекст
			console.log(
				`[AI Auto Response] Creating AI context for account ${accountId}...`,
			);
			await aiBrowserContextService.getOrCreateAiContext(accountId);
			console.log(
				`[AI Auto Response] AI context ready for account ${accountId}`,
			);

			// 🛡️ Запускаем keep-alive для AI контекста (защита от AFK popup)
			const aiContext = await aiBrowserContextService.getAiContext(accountId);
			await keepAliveService.start({
				accountId: `${accountId}_ai`,
				context: aiContext,
			});
			console.log(
				`[AI Auto Response] Keep-alive started for AI context ${accountId}`,
			);

			// Функция обработки сообщений
			const processMessages = async () => {
				const state = activeAutoResponders.get(accountId);

				// Если уже обрабатываем - пропускаем (тихий скип: тикает каждые 5с)
				if (state?.isProcessing) {
					vlog(
						`[AI Auto Response] Account ${accountId} is already processing, skipping...`,
					);
					return;
				}

				try {
					// Устанавливаем флаг обработки
					if (state) {
						state.isProcessing = true;
					}

					await aiAutoResponseService.processAccountMessages(accountId);
				} catch (error) {
					console.error(
						`[AI Auto Response] Error processing messages for account ${accountId}:`,
						error.message,
					);
				} finally {
					// Снимаем флаг обработки
					if (state) {
						state.isProcessing = false;
					}
				}
			};

		// Регистрируем ДО первого тика: иначе guard по isProcessing на самый
		// долгий (первый) цикл не действует и возможен второй конкурентный цикл
		const intervalId = setInterval(processMessages, 5000);

		// Сохраняем в Map
		activeAutoResponders.set(accountId, {
			intervalId,
			isProcessing: false,
		});

		// Первая обработка сразу (уже под флагом)
		processMessages();

		console.log(
			`[AI Auto Response] Started for account ${accountId} (every 5 seconds)`,
		);

		// 🟢 ИИ включён (кнопка оператора / recovery при рестарте):
		// сразу ставим ВСЕ анкеты аккаунта в онлайн + запускаем кипер (~5 мин).
		// Отдельный временный контекст, chats не трогаем.
		try {
			onlineKeeperService.start(accountId, { immediate: true });
		} catch (e) {
			console.error(`[AI Auto Response] ⚠️  Online keeper failed to start for ${accountId}:`, e.message);
		}
	} catch (error) {
			console.error(
				`[AI Auto Response] Error starting for account ${accountId}:`,
				error,
			);
			throw error;
		}
	},

	/**
	 * Остановить автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	stop: async accountId => {
		try {
			const state = activeAutoResponders.get(accountId);
			if (!state) {
				console.log(`[AI Auto Response] Not running for account ${accountId}`);
				return;
			}

			console.log(`[AI Auto Response] Stopping for account ${accountId}`);

			// Останавливаем интервал
			clearInterval(state.intervalId);

			// Удаляем из Map
			activeAutoResponders.delete(accountId);

			// 🛡️ Останавливаем keep-alive для AI контекста
			keepAliveService.stop(`${accountId}_ai`);
			console.log(
				`[AI Auto Response] Keep-alive stopped for AI context ${accountId}`,
			);

		// Закрываем AI контекст
		await aiBrowserContextService.closeAiContext(accountId);

		// 🛑 Кипер больше не нужен — останавливаем ПЕРВЫМ, чтобы он не вернул
		// анкеты в онлайн после оффлайна ниже
		try {
			onlineKeeperService.stop(accountId);
		} catch (e) {}

		// ⚫ ИИ полностью остановлен — ТЕПЕРЬ ставим все анкеты в оффлайн
		// (тот же /profile/, value 4). Порядок важен: сначала стоп ИИ, потом оффлайн.
		// Best-effort: stop() не должен падать из-за этого.
		try {
			const offOk = await setAllOfflineViaNewContext(accountId).catch(() => false);
			console.log(
				`[AI Auto Response] Offline-all after stop for ${accountId}: ${offOk ? 'OK' : 'FAILED (will retry on next start)'}`,
			);
		} catch (e) {
			console.error(`[AI Auto Response] ⚠️  Offline-all failed for ${accountId}:`, e.message);
		}

		console.log(`[AI Auto Response] Stopped for account ${accountId}`);
		} catch (error) {
			console.error(
				`[AI Auto Response] Error stopping for account ${accountId}:`,
				error,
			);
		}
	},

	/**
	 * Обработать сообщения для аккаунта
	 * Новая логика: проверка about:blank, приоритет активному профилю, переключение профилей
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	processAccountMessages: async accountId => {
		// 🚨 ЗАЩИТА: Глобальное отключение
		if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
			console.log(
				`🛑 [AI Auto] GLOBALLY DISABLED - skipping message processing for account ${accountId}`,
			);
			cycleLogger.logEvent(accountId, 'precheck', 'skipped', {
				reason: 'globally_disabled',
			});
			return;
		}

		try {
			// Получить аккаунт
			const account =
				await LuxeeAccountModel.findById(accountId).populate('user');
			if (!account) {
				console.log(`[AI Auto] Account ${accountId} not found, stopping...`);
				await aiAutoResponseService.stop(accountId);
				return;
			}

			// Проверка: User может быть удалён
			if (!account.user) {
				console.log(
					`[AI Auto] User deleted for account ${accountId}, stopping AI...`,
				);
				await aiAutoResponseService.stop(accountId);
				return;
			}

			const userId = account.user._id.toString();
			const accountEmail = account.luxeeEmail;

			// Проверить что AI включен
			const canUse = await aiManagementService.canAccountUseAi(
				userId,
				accountId,
			);
		if (!canUse) {
			console.log(
				`[AI Auto] AI disabled for account ${accountEmail}, stopping...`,
			);
			cycleLogger.logEvent(accountId, 'precheck', 'skipped', {
				reason: 'ai_disabled',
			});
			await aiAutoResponseService.stop(accountId);
			return;
		}

			// Получить AI контекст
			const aiContext = await aiBrowserContextService.getAiContext(accountId);
		if (!aiContext) {
			console.log(
				`[AI Auto] No AI context for ${accountEmail}, recreating...`,
			);
			cycleLogger.logEvent(accountId, 'precheck', 'skipped', {
				reason: 'no_ai_context',
			});
			await aiBrowserContextService.getOrCreateAiContext(accountId);
			return;
		}

			const page = await pageHelpers.getOrCreatePage(aiContext);

			// Проверка URL (fix about:blank)
			const currentUrl = page.url();
			if (currentUrl === 'about:blank' || !currentUrl.includes('luxee.io')) {
				console.log('[AI Auto] Page is about:blank, navigating to chats...');
				await chatNavigationService.navigateToChats({ page });
				await new Promise(resolve => setTimeout(resolve, 3000));
			}

			// 🎯 НОВАЯ ЛОГИКА: Вызов рефакторенного модуля с Mutex защитой
			await aiAuto.processAccountMessages(accountId, userId, page);
		} catch (error) {
			console.error(
				`[AI Auto] Error in processAccountMessages for ${accountId}:`,
				error,
			);
		}
	},

	/**
	 * Запустить автоответы для всех аккаунтов пользователя с включенным AI
	 * @param {string} userId - ID пользователя
	 */
	startForUser: async userId => {
		try {
			console.log(
				`[AI Auto Response] Starting for all accounts of user ${userId}`,
			);

			// Получаем все аккаунты пользователя с включенным AI
			const accounts = await LuxeeAccountModel.find({
				user: userId,
				isActive: true,
				aiEnabled: true,
				aiEnabledByAdmin: true,
			});

			console.log(
				`[AI Auto Response] Found ${accounts.length} accounts with AI enabled for user ${userId}`,
			);

			for (const account of accounts) {
				try {
					await aiAutoResponseService.start(account._id.toString());
				} catch (error) {
					console.error(
						`[AI Auto Response] Failed to start for account ${account._id}:`,
						error.message,
					);
					// Продолжаем с другими аккаунтами
				}
			}
		} catch (error) {
			console.error(
				`[AI Auto Response] Error starting for user ${userId}:`,
				error,
			);
		}
	},

	/**
	 * Остановить автоответы для всех аккаунтов пользователя
	 * @param {string} userId - ID пользователя
	 */
	stopForUser: async userId => {
		try {
			console.log(
				`[AI Auto Response] Stopping for all accounts of user ${userId}`,
			);

			const accounts = await LuxeeAccountModel.find({
				user: userId,
			});

			for (const account of accounts) {
				try {
					await aiAutoResponseService.stop(account._id.toString());
				} catch (error) {
					console.error(
						`[AI Auto Response] Failed to stop for account ${account._id}:`,
						error.message,
					);
				}
			}
		} catch (error) {
			console.error(
				`[AI Auto Response] Error stopping for user ${userId}:`,
				error,
			);
		}
	},

	/**
	 * Получить статус автоответов
	 */
	getStatus: () => {
		const status = [];
		for (const [accountId, state] of activeAutoResponders.entries()) {
			status.push({
				accountId,
				isProcessing: state.isProcessing,
			});
		}
		return {
			activeCount: activeAutoResponders.size,
			accounts: status,
		};
	},

	/**
	 * Проверить запущены ли автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {boolean}
	 */
	isRunning: accountId => {
		return activeAutoResponders.has(accountId);
	},
};

export default aiAutoResponseService;
