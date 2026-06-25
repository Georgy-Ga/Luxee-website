// AI Auto Response Service
// Автоматические ответы AI на новые сообщения
// Работает через отдельные AI контексты для каждого аккаунта
// ✅ ОДНОПОТОЧНАЯ МОДЕЛЬ - использует modelsChat.getChats.list

// 🚨🚨🚨 MASTER KILL SWITCH - ГЛОБАЛЬНОЕ ОТКЛЮЧЕНИЕ AI АВТООТВЕТОВ 🚨🚨🚨
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = false;

import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import aiManagementService from './aiManagementService/index.js';
import answeredChatService from './answeredChatService.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import pageHelpers from './browser/pageHelpers.js';
import chatNavigationService from './luxeeApi/chatNavigationService.js';
import pendingResponseService from './pendingResponseService.js';

// Хранилище активных процессов автоответов
const activeAutoResponders = new Map(); // accountId -> { intervalId, isProcessing }

const aiAutoResponseService = {
	/**
	 * Запустить автоответы для аккаунта
	 */
	start: async accountId => {
		if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
			console.log(`🛑 [AI Auto Response] GLOBALLY DISABLED - not starting for account ${accountId}`);
			return;
		}

		try {
			if (activeAutoResponders.has(accountId)) {
				console.log(`[AI Auto Response] Already running for account ${accountId}`);
				return;
			}

			console.log(`[AI Auto Response] Starting for account ${accountId}`);

			const account = await LuxeeAccountModel.findById(accountId);
			if (!account) throw new Error('Account not found');

			const canUse = await aiManagementService.canAccountUseAi(account.user.toString(), accountId);
			if (!canUse) {
				console.log(`[AI Auto Response] AI disabled for account ${accountId}, not starting`);
				return;
			}

			console.log(`[AI Auto Response] Creating AI context for account ${accountId}...`);
			await aiBrowserContextService.getOrCreateAiContext(accountId);
			console.log(`[AI Auto Response] AI context ready for account ${accountId}`);

			const processMessages = async () => {
				const state = activeAutoResponders.get(accountId);
				if (state?.isProcessing) {
					console.log(`[AI Auto Response] Account ${accountId} is already processing, skipping...`);
					return;
				}

				try {
					if (state) state.isProcessing = true;
					await aiAutoResponseService.processAccountMessages(accountId);
				} catch (error) {
					console.error(`[AI Auto Response] Error processing messages for account ${accountId}:`, error.message);
				} finally {
					if (state) state.isProcessing = false;
				}
			};

			processMessages();
			const intervalId = setInterval(processMessages, 10000);

			activeAutoResponders.set(accountId, { intervalId, isProcessing: false });
			console.log(`[AI Auto Response] Started for account ${accountId} (every 10 seconds)`);
		} catch (error) {
			console.error(`[AI Auto Response] Error starting for account ${accountId}:`, error);
			throw error;
		}
	},

	/**
	 * Остановить автоответы для аккаунта
	 */
	stop: async accountId => {
		try {
			const state = activeAutoResponders.get(accountId);
			if (!state) {
				console.log(`[AI Auto Response] Not running for account ${accountId}`);
				return;
			}

			console.log(`[AI Auto Response] Stopping for account ${accountId}`);
			clearInterval(state.intervalId);
			activeAutoResponders.delete(accountId);
			await aiBrowserContextService.closeAiContext(accountId);
			console.log(`[AI Auto Response] Stopped for account ${accountId}`);
		} catch (error) {
			console.error(`[AI Auto Response] Error stopping for account ${accountId}:`, error);
		}
	},

	/**
	 * Найти и обработать unanswered чат на текущем профиле
	 * Использует modelsChat.getChats.data[profileUid] (чаты КОНКРЕТНОГО профиля)
	 * @returns {boolean} true если нашёл и запланировал ответ
	 * @private
	 */
	_findAndProcessUnanswered: async ({ accountId, userId, page, profile, maxAttempts = 1 }) => {
		try {
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				console.log(`[AI Auto] 🔄 Attempt ${attempt}/${maxAttempts} to find unanswered on ${profile.username} (UID: ${profile.uid})...`);

				// ✅ Используем .data[profileUid] - чаты ТОЛЬКО этого профиля
				const unansweredChats = await page.evaluate((profileUid) => {
					if (typeof modelsChat === 'undefined' || !modelsChat.getChats || !modelsChat.getChats.data) {
						console.warn('[AI Auto] modelsChat.getChats.data not available');
						return [];
					}

					// Берём чаты ТОЛЬКО этого профиля
					const profileChats = modelsChat.getChats.data[profileUid];
					if (!profileChats) {
						console.warn('[AI Auto] No chats found for profile:', profileUid);
						return [];
					}

					console.log('[AI Auto] Profile', profileUid, 'has', Object.keys(profileChats).length, 'chats');

					const result = [];

					for (const chatId in profileChats) {
						const chat = profileChats[chatId];

						if (chat.unAnswered === true) {
							const manMember = chat.members?.find(m => m.type === 10);
							const messages = chat.message || [];
							let lastManMessage = null;

							for (let i = messages.length - 1; i >= 0; i--) {
								if (messages[i].uType === 2) {
									lastManMessage = messages[i];
									break;
								}
							}

							if (lastManMessage && manMember) {
								result.push({
									chatId: chat.identity || chatId,
									memberUid: manMember.uid,
									memberUsername: manMember.username || manMember.first_name,
									lastManMessage: {
										body: lastManMessage.body,
										createdAt: lastManMessage.createdAt,
									},
								});
							}
						}
					}

					return result;
				}, profile.uid); // ← Передаём profileUid в evaluate

				// Если нашли - планируем ответ и возвращаем true
				if (unansweredChats.length > 0) {
					console.log(`[AI Auto] ✅ Found ${unansweredChats.length} unanswered on ${profile.username}`);

					// Берём ПЕРВЫЙ чат
					const chat = unansweredChats[0];

					// Проверяем не отвечали ли уже
					const answeredChats = await answeredChatService.getAnsweredChats({
						accountId,
						profileUid: profile.uid,
					});

					const isAlreadyAnswered = answeredChats.some(ac => ac.chatId === chat.chatId);
					if (isAlreadyAnswered) {
						console.log(`[AI Auto] Chat ${chat.chatId} already answered, skipping`);
						return false;
					}

					// ⏰ Планируем ответ через 23-30 сек
					const randomDelay = Math.floor(Math.random() * (30000 - 23000 + 1)) + 23000;
					
					const scheduled = await pendingResponseService.schedule({
						accountId,
						userId,
						profileUid: profile.uid,
						chatId: chat.chatId,
						chat: chat,
						profile: {
							username: profile.username,
							age: profile.age,
							country: profile.country,
							city: profile.city,
						}
					}, randomDelay);

					if (scheduled.scheduled) {
						console.log(`[AI Auto] ⏰ Response scheduled for ${chat.memberUsername} in ${Math.round(randomDelay / 1000)}s`);
						return true; // ✅ НАШЛИ И ЗАПЛАНИРОВАЛИ
					} else {
						console.log(`[AI Auto] ⚠️ Could not schedule: ${scheduled.reason}`);
						return false;
					}
				}

				// Если не нашли и есть ещё попытки - ждём
				if (attempt < maxAttempts) {
					console.log(`[AI Auto] ⏳ No unanswered, waiting 3s before retry...`);
					await new Promise(resolve => setTimeout(resolve, 3000));
				}
			}

			console.log(`[AI Auto] ❌ No unanswered found on ${profile.username} after ${maxAttempts} attempts`);
			return false;
		} catch (error) {
			console.error(`[AI Auto] Error finding unanswered on ${profile.username}:`, error);
			return false;
		}
	},

	/**
	 * Обработать сообщения для аккаунта - ОДНОПОТОЧНАЯ МОДЕЛЬ
	 * 1. Цикл по профилям (последовательно)
	 * 2. Для каждого: переключение → задержка → поиск → если нашёл → ВЫХОД
	 */
	processAccountMessages: async accountId => {
		if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
			console.log(`🛑 [AI Auto] GLOBALLY DISABLED - skipping message processing for account ${accountId}`);
			return;
		}

		try {
			const account = await LuxeeAccountModel.findById(accountId);
			if (!account) {
				console.log(`[AI Auto] Account ${accountId} not found`);
				return;
			}

			const userId = account.user.toString();
			const accountEmail = account.luxeeEmail;

			console.log(`[AI Auto] ========== Starting processing for ${accountEmail} ==========`);

			// Проверяем что AI всё ещё включен
			const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
			if (!canUse) {
				console.log(`[AI Auto] AI disabled for account ${accountEmail}, stopping...`);
				await aiAutoResponseService.stop(accountId);
				return;
			}

			// Получаем AI контекст
			const aiContext = await aiBrowserContextService.getAiContext(accountId);
			if (!aiContext) {
				console.log(`[AI Auto] No AI context for ${accountEmail}, recreating...`);
				await aiBrowserContextService.getOrCreateAiContext(accountId);
				return;
			}

			const page = await pageHelpers.getOrCreatePage(aiContext);

			// Проверка URL
			const currentUrl = page.url();
			console.log(`[AI Auto] Current URL: ${currentUrl}`);

			if (currentUrl === 'about:blank' || !currentUrl.includes('luxee.io')) {
				console.log('[AI Auto] Page is about:blank, navigating to chats...');
				await chatNavigationService.navigateToChats({ page });
				await new Promise(resolve => setTimeout(resolve, 3000));
				console.log('[AI Auto] ✓ Navigated to chats page');
			}

			// Получить ВСЕ профили
			const allProfiles = await page.evaluate(() => {
				if (typeof modelsChat === 'undefined' || !modelsChat.getProfile || !modelsChat.getProfile.data) {
					return [];
				}

				const profilesData = modelsChat.getProfile.data;
				const profiles = [];

				for (const uid in profilesData) {
					const profile = profilesData[uid];
					profiles.push({
						uid: profile.inner.uid,
						username: profile.inner.username,
						age: profile.inner.age,
						country: profile.inner.country,
						city: profile.inner.city,
						newMessages: profile.newMessages || 0,
					});
				}

				return profiles;
			});

			if (allProfiles.length === 0) {
				console.log('[AI Auto] No profiles found');
				return;
			}

			console.log(`[AI Auto] Total profiles: ${allProfiles.length}`);

			// ОДНОПОТОЧНЫЙ ЦИКЛ по профилям
			for (let i = 0; i < allProfiles.length; i++) {
				const profile = allProfiles[i];
				
				console.log(`[AI Auto] ===== Processing profile ${i + 1}/${allProfiles.length}: ${profile.username} =====`);
				console.log(`[AI Auto] Switching to ${profile.username} (${profile.newMessages} new)...`);

				// Переключаемся на профиль
				await page.evaluate(pUid => {
					if (modelsChat && modelsChat.selectProfile) {
						modelsChat.selectProfile(pUid);
					}
				}, profile.uid);

				// Ждем загрузки 2-3 секунды
				const loadDelay = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;
				await new Promise(resolve => setTimeout(resolve, loadDelay));
				console.log(`[AI Auto] ✓ Switched, waiting ${Math.round(loadDelay / 1000)}s for chats to load...`);

				// Если есть new messages - 5 попыток, иначе - 1 попытка
				const attempts = profile.newMessages > 0 ? 5 : 1;
				console.log(`[AI Auto] Profile has ${profile.newMessages} new messages, will try ${attempts} times`);

				// ✅ ИЩЕМ И ПЛАНИРУЕМ
				const found = await aiAutoResponseService._findAndProcessUnanswered({
					accountId,
					userId,
					page,
					profile,
					maxAttempts: attempts,
				});

				// ✅ ЕСЛИ НАШЛИ И ЗАПЛАНИРОВАЛИ - ВЫХОД ИЗ ЦИКЛА
				if (found) {
					console.log(`[AI Auto] 🎯 Response scheduled on ${profile.username}, stopping search`);
					break; // ← СТОП ПОСЛЕ ПЛАНИРОВАНИЯ
				}

				// Задержка перед следующим профилем
				if (i < allProfiles.length - 1) {
					console.log('[AI Auto] Waiting 3 sec before next profile...');
					await new Promise(resolve => setTimeout(resolve, 3000));
				}
			}

			console.log(`[AI Auto] ========== Finished processing ${accountEmail} ==========`);
		} catch (error) {
			console.error(`[AI Auto] Error in processAccountMessages for ${accountId}:`, error);
		}
	},

	/**
	 * Запустить автоответы для всех аккаунтов пользователя с включенным AI
	 */
	startForUser: async userId => {
		try {
			console.log(`[AI Auto Response] Starting for all accounts of user ${userId}`);

			const accounts = await LuxeeAccountModel.find({
				user: userId,
				isActive: true,
				aiEnabled: true,
				aiEnabledByAdmin: true,
			});

			console.log(`[AI Auto Response] Found ${accounts.length} accounts with AI enabled for user ${userId}`);

			for (const account of accounts) {
				try {
					await aiAutoResponseService.start(account._id.toString());
				} catch (error) {
					console.error(`[AI Auto Response] Failed to start for account ${account._id}:`, error.message);
				}
			}
		} catch (error) {
			console.error(`[AI Auto Response] Error starting for user ${userId}:`, error);
		}
	},

	/**
	 * Остановить автоответы для всех аккаунтов пользователя
	 */
	stopForUser: async userId => {
		try {
			console.log(`[AI Auto Response] Stopping for all accounts of user ${userId}`);

			const accounts = await LuxeeAccountModel.find({ user: userId });

			for (const account of accounts) {
				try {
					await aiAutoResponseService.stop(account._id.toString());
				} catch (error) {
					console.error(`[AI Auto Response] Failed to stop for account ${account._id}:`, error.message);
				}
			}
		} catch (error) {
			console.error(`[AI Auto Response] Error stopping for user ${userId}:`, error);
		}
	},

	/**
	 * Получить статус автоответов
	 */
	getStatus: () => {
		const status = [];
		for (const [accountId, state] of activeAutoResponders.entries()) {
			status.push({ accountId, isProcessing: state.isProcessing });
		}
		return {
			activeCount: activeAutoResponders.size,
			accounts: status,
		};
	},

	/**
	 * Проверить запущены ли автоответы для аккаунта
	 */
	isRunning: accountId => {
		return activeAutoResponders.has(accountId);
	},
};

export default aiAutoResponseService;
