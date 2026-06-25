// AI Auto Response Service
// Автоматические ответы AI на новые сообщения
// Работает через отдельные AI контексты для каждого аккаунта

// 🚨🚨🚨 MASTER KILL SWITCH - ГЛОБАЛЬНОЕ ОТКЛЮЧЕНИЕ AI АВТООТВЕТОВ 🚨🚨🚨
// Установите в false для включения AI автоответов
// Установите в true для полного отключения (РЕКОМЕНДУЕТСЯ во время разработки)
// ⚠️ ВКЛЮЧЕНО ДЛЯ ТЕСТИРОВАНИЯ - отправка всё равно заблокирована AI_DEBUG_MODE
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = false;

import aiResponseService from './aiResponseService.js';
import aiManagementService from './aiManagementService/index.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import answeredChatService from './answeredChatService.js';
import pageHelpers from './browser/pageHelpers.js';
import chatNavigationService from './luxeeApi/chatNavigationService.js';
import pendingResponseService from './pendingResponseService.js';

// Хранилище активных процессов автоответов
const activeAutoResponders = new Map(); // accountId -> { intervalId, isProcessing }

const aiAutoResponseService = {
	/**
	 * Запустить автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	start: async (accountId) => {
		// 🚨 УРОВЕНЬ 1 ЗАЩИТЫ: Блокировка запуска
		if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
			console.log(`🛑 [AI Auto Response] GLOBALLY DISABLED - not starting for account ${accountId}`);
			return;
		}

		try {
			// Проверяем что автоответы ещё не запущены
			if (activeAutoResponders.has(accountId)) {
				console.log(`[AI Auto Response] Already running for account ${accountId}`);
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
				accountId
			);

			if (!canUse) {
				console.log(`[AI Auto Response] AI disabled for account ${accountId}, not starting`);
				return;
			}

			// Создаём или получаем AI контекст
			console.log(`[AI Auto Response] Creating AI context for account ${accountId}...`);
			await aiBrowserContextService.getOrCreateAiContext(accountId);
			console.log(`[AI Auto Response] AI context ready for account ${accountId}`);

			// Функция обработки сообщений
			const processMessages = async () => {
				const state = activeAutoResponders.get(accountId);
				
				// Если уже обрабатываем - пропускаем
				if (state?.isProcessing) {
					console.log(`[AI Auto Response] Account ${accountId} is already processing, skipping...`);
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
						error.message
					);
				} finally {
					// Снимаем флаг обработки
					if (state) {
						state.isProcessing = false;
					}
				}
			};

			// Первая обработка сразу
			processMessages();

			// Запускаем интервал каждые 10 секунд
			const intervalId = setInterval(processMessages, 10000);

			// Сохраняем в Map
			activeAutoResponders.set(accountId, {
				intervalId,
				isProcessing: false,
			});

			console.log(`[AI Auto Response] Started for account ${accountId} (every 10 seconds)`);
		} catch (error) {
			console.error(`[AI Auto Response] Error starting for account ${accountId}:`, error);
			throw error;
		}
	},

	/**
	 * Остановить автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	stop: async (accountId) => {
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

			// Закрываем AI контекст
			await aiBrowserContextService.closeAiContext(accountId);

			console.log(`[AI Auto Response] Stopped for account ${accountId}`);
		} catch (error) {
			console.error(`[AI Auto Response] Error stopping for account ${accountId}:`, error);
		}
	},

	/**
	 * Обработать профиль с повторными попытками
	 * Использует правильную логику с allProfileUids (inner + outer)
	 * @private
	 */
	_processProfileWithRetries: async ({ accountId, userId, page, profile, maxAttempts = 5 }) => {
		try {
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				console.log(`[AI Auto] 🔄 Attempt ${attempt}/${maxAttempts} to find unanswered chats on ${profile.username}...`);

				// ✅ ИСПРАВЛЕНИЕ: Получаем ВСЕ UIDs профиля (inner + outer) - как в profileDataExtractor
				const profileData = await page.evaluate((pUid) => {
					if (typeof modelsChat === 'undefined' || !modelsChat.getProfile) {
						return null;
					}

					const profile = modelsChat.getProfile.data?.[pUid];
					if (!profile) return null;

					// Собираем ВСЕ UIDs профиля (inner + outer)
					const allUids = [profile.inner.uid];
					if (profile.outer) {
						for (const outerUid in profile.outer) {
							allUids.push(profile.outer[outerUid].uid);
						}
					}

					return {
						allUids: allUids,
						hasOuter: profile.outer ? Object.keys(profile.outer).length : 0,
					};
				}, profile.uid);

				if (!profileData) {
					console.log(`[AI Auto] ⚠️ Profile ${profile.uid} not found in modelsChat`);
					return;
				}

				console.log(`[AI Auto] Profile ${profile.username} has ${profileData.allUids.length} UIDs (${profileData.hasOuter} outer)`);

				// Получаем unanswered чаты используя ВСЕ UIDs
				const unansweredChats = await page.evaluate((allUids) => {
					if (typeof modelsChat === 'undefined' || !modelsChat.getChats) {
						return [];
					}

					// ✅ FIX: Используем .data вместо .list!
					const chats = modelsChat.getChats.data || {};
					const result = [];

					for (const chatId in chats) {
						const chat = chats[chatId];
						const chatProfileUid = parseInt(chatId.split('_')[0]);

						// Проверяем что чат принадлежит ЛЮБОМУ из UIDs профиля
						if (!allUids.includes(chatProfileUid)) continue;

						// Простая проверка как в рабочей версии
						if (chat.unAnswered === true) {
							const manMember = chat.members?.find((m) => m.type === 10);
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
				}, profileData.allUids);

				// Если нашли - обрабатываем и выходим
				if (unansweredChats.length > 0) {
					console.log(`[AI Auto] ✅ Found ${unansweredChats.length} unanswered chats on ${profile.username} (attempt ${attempt})`);

					// Обрабатываем каждый чат ПО ОДНОМУ
					for (let i = 0; i < unansweredChats.length; i++) {
						const chat = unansweredChats[i];

						console.log(
							`[AI Auto] Processing chat ${i + 1}/${unansweredChats.length}: ${chat.memberUsername} (${chat.chatId})`
						);

						try {
							// Проверяем не отвечали ли уже
							const answeredChats = await answeredChatService.getAnsweredChats({
								accountId,
								profileUid: profile.uid,
							});

							const isAlreadyAnswered = answeredChats.some((ac) => ac.chatId === chat.chatId);

							if (isAlreadyAnswered) {
								console.log(`[AI Auto] Chat ${chat.chatId} already answered, skipping`);
								continue;
							}

							// ⏰ Создаём отложенный ответ с рандомной задержкой 23-30 сек
							const randomDelay = Math.floor(Math.random() * (30000 - 23000 + 1)) + 23000; // 23-30 секунд
							
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
							}, randomDelay); // Рандомная задержка 23-30 сек

							if (scheduled.scheduled) {
								console.log(`[AI Auto] ⏰ Response scheduled for ${chat.memberUsername} in ${Math.round(randomDelay / 1000)} seconds`);
							} else {
								console.log(`[AI Auto] ⚠️  Could not schedule response: ${scheduled.reason}`);
							}

							// ВАЖНО: Задержка 3 сек перед следующим чатом
							console.log(`[AI Auto] ⏸️  Waiting 3 seconds before next chat...`);
							await new Promise((resolve) => setTimeout(resolve, 3000));
						} catch (error) {
							console.error(`[AI Auto] Error processing chat ${chat.chatId}:`, error.message);
							// Продолжаем со следующим чатом
						}
					}

					// Успешно обработали - выходим
					return;
				}

				// Если НЕ нашли и это не последняя попытка - ждём 3 секунды
				if (attempt < maxAttempts) {
					console.log(`[AI Auto] ⏳ No unanswered found, waiting 3 sec before retry...`);
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}

			// После всех попыток ничего не нашли
			console.log(`[AI Auto] ❌ No unanswered chats found on ${profile.username} after ${maxAttempts} attempts`);
		} catch (error) {
			console.error(`[AI Auto] Error in _processProfileWithRetries for ${profile.username}:`, error);
		}
	},

	/**
	 * Обработать unanswered чаты конкретного профиля
	 * СТРОГО ПО ОДНОМУ
	 * @private
	 * @deprecated Используйте _processProfileWithRetries вместо этого
	 */
	_processProfileChats: async ({ accountId, userId, page, profile, isActiveProfile }) => {
		try {
			// Получаем unanswered чаты через page.evaluate
			const unansweredChats = await page.evaluate((pUid) => {
				if (typeof modelsChat === 'undefined' || !modelsChat.getChats) {
					return [];
				}

				// ✅ FIX: Используем .data вместо .list!
				const chats = modelsChat.getChats.data || {};
				const result = [];

				for (const chatId in chats) {
					const chat = chats[chatId];
					const chatProfileUid = parseInt(chatId.split('_')[0]);

					// Проверяем что чат принадлежит этому профилю
					if (chatProfileUid !== pUid) continue;

					// Проверяем unAnswered
					if (chat.unAnswered === true) {
						const manMember = chat.members?.find((m) => m.type === 10);
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
			}, profile.uid);

			if (unansweredChats.length === 0) {
				console.log(
					`[AI Auto] No unanswered chats on profile ${profile.username}${isActiveProfile ? ' (ACTIVE)' : ''}`
				);
				return;
			}

			console.log(
				`[AI Auto] Found ${unansweredChats.length} unanswered chats on ${profile.username}${isActiveProfile ? ' (ACTIVE)' : ''}`
			);

			// Обрабатываем каждый чат ПО ОДНОМУ
			for (let i = 0; i < unansweredChats.length; i++) {
				const chat = unansweredChats[i];

				console.log(
					`[AI Auto] Processing chat ${i + 1}/${unansweredChats.length}: ${chat.memberUsername} (${chat.chatId})`
				);

				try {
					// Проверяем не отвечали ли уже
					const answeredChats = await answeredChatService.getAnsweredChats({
						accountId,
						profileUid: profile.uid,
					});

					const isAlreadyAnswered = answeredChats.some((ac) => ac.chatId === chat.chatId);

					if (isAlreadyAnswered) {
						console.log(`[AI Auto] Chat ${chat.chatId} already answered, skipping`);
						continue;
					}

					// 🐛 DEBUG: Детальные логи обнаруженного чата
					console.log('');
					console.log('🔍 [AI DEBUG] ===== UNANSWERED CHAT FOUND =====');
					console.log('  👤 Profile:', profile.username, `(UID: ${profile.uid})`);
					console.log('  💬 Chat ID:', chat.chatId);
					console.log('  👨 Man:', chat.memberUsername, `(UID: ${chat.memberUid})`);
					console.log('  📝 Last man message:', chat.lastManMessage.body);
					console.log('  🕐 Message time:', new Date(chat.lastManMessage.createdAt).toLocaleString());
					console.log('  📊 Profile data:', {
						age: profile.age,
						country: profile.country,
						city: profile.city,
					});
					console.log('═'.repeat(80));
					console.log('');

					// Генерируем и отправляем ответ
					const result = await aiResponseService.generateAndSend({
						userId,
						accountId,
						profileUid: profile.uid,
						chatId: chat.chatId,
						profile: {
							username: profile.username,
							age: profile.age,
							country: profile.country,
							city: profile.city,
						},
						manMessage: chat.lastManMessage.body,
						messageType: 1,
						conversationHistory: [],
					});

					if (result.success) {
						console.log(`[AI Auto] ✓ Sent to ${chat.memberUsername}`);
					} else {
						console.log(`[AI Auto] ✗ Failed to send: ${result.reason}`);
					}

					// ВАЖНО: Задержка 3 сек после каждого ответа
					await new Promise((resolve) => setTimeout(resolve, 3000));
				} catch (error) {
					console.error(`[AI Auto] Error processing chat ${chat.chatId}:`, error.message);
					// Продолжаем со следующим чатом
				}
			}
		} catch (error) {
			console.error(`[AI Auto] Error processing profile ${profile.uid}:`, error);
		}
	},

	/**
	 * Обработать сообщения для аккаунта
	 * Новая логика: проверка about:blank, приоритет активному профилю, переключение профилей
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	processAccountMessages: async (accountId) => {
		// 🚨 УРОВЕНЬ 2 ЗАЩИТЫ: Блокировка обработки сообщений
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

			// ✅ FIX: Используем ObjectId напрямую без populate
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

			// ШАГ 1: Проверка URL (fix about:blank)
			const currentUrl = page.url();
			console.log(`[AI Auto] Current URL: ${currentUrl}`);

			if (currentUrl === 'about:blank' || !currentUrl.includes('luxee.io')) {
				console.log('[AI Auto] Page is about:blank, navigating to chats...');
				await chatNavigationService.navigateToChats({ page });
				await new Promise((resolve) => setTimeout(resolve, 3000));
				console.log('[AI Auto] ✓ Navigated to chats page');
			}

			// ШАГ 2: Получить активный профиль через modelsChat.getProfile.active
			const activeProfileData = await page.evaluate(() => {
				if (
					typeof modelsChat === 'undefined' ||
					!modelsChat.getProfile ||
					!modelsChat.getProfile.active
				) {
					return null;
				}

				const active = modelsChat.getProfile.active;
				return {
					uid: active.inner.uid,
					username: active.inner.username,
					age: active.inner.age,
					country: active.inner.country,
					city: active.inner.city,
					newMessages: active.newMessages || 0,
				};
			});

			if (!activeProfileData) {
				console.log('[AI Auto] No active profile found');
				return;
			}

		console.log(`[AI Auto] Active profile: ${activeProfileData.username} (${activeProfileData.uid})`);

		// ШАГ 3: ПРИОРИТЕТ - Обработать ТЕКУЩИЙ активный профиль (1 попытка - он уже активен)
		console.log('[AI Auto] ===== PRIORITY: Processing CURRENT active profile =====');
		await aiAutoResponseService._processProfileWithRetries({
			accountId,
			userId,
			page,
			profile: activeProfileData,
			maxAttempts: 1, // ← 1 попытка для текущего профиля
		});

		// ШАГ 4: Получить ДРУГИЕ профили с NEW MESSAGES (кроме текущего)
		const otherProfilesWithNewMessages = await page.evaluate((currentUid) => {
			if (
				typeof modelsChat === 'undefined' ||
				!modelsChat.getProfile ||
				!modelsChat.getProfile.data
			) {
				return [];
			}

			const profilesData = modelsChat.getProfile.data;
			const profiles = [];

			for (const uid in profilesData) {
				const profile = profilesData[uid];
				const profileUid = profile.inner.uid;
				const newMessages = profile.newMessages || 0;

				// Пропускаем текущий профиль
				if (profileUid === currentUid) {
					continue;
				}

				// ✅ FIX: Проверяем ВСЕ профили, не только с newMessages > 0
				// Потому что чат может быть unanswered, но уже прочитан (newMessages=0)
				profiles.push({
					uid: profileUid,
					username: profile.inner.username,
					age: profile.inner.age,
					country: profile.inner.country,
					city: profile.inner.city,
					newMessages: newMessages,
				});
			}

			return profiles;
		}, activeProfileData.uid);

		console.log(`[AI Auto] Total OTHER profiles to check: ${otherProfilesWithNewMessages.length}`);

		// Выводим статистику
		if (otherProfilesWithNewMessages.length > 0) {
			otherProfilesWithNewMessages.forEach((p) => {
				console.log(`[AI Auto]   - ${p.username} (${p.uid}): ${p.newMessages} new (will check for unanswered)`);
			});
		}

		// ШАГ 5: Для каждого другого профиля - переключаемся и обрабатываем с 5 попытками
		if (otherProfilesWithNewMessages.length === 0) {
			console.log('[AI Auto] No other profiles to check');
		} else {
			for (let i = 0; i < otherProfilesWithNewMessages.length; i++) {
				const profile = otherProfilesWithNewMessages[i];
				
				console.log(`[AI Auto] ===== Processing profile ${i + 1}/${otherProfilesWithNewMessages.length}: ${profile.username} =====`);
				console.log(`[AI Auto] Switching to ${profile.username} (${profile.newMessages} new)...`);

				// Переключаемся на профиль
				await page.evaluate((pUid) => {
					if (modelsChat && modelsChat.selectProfile) {
						modelsChat.selectProfile(pUid);
					}
				}, profile.uid);

				// Ждем загрузки чатов (2-3 секунды)
				const loadDelay = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;
				await new Promise((resolve) => setTimeout(resolve, loadDelay));
				console.log(`[AI Auto] ✓ Switched, waiting ${Math.round(loadDelay / 1000)}s for chats to load...`);

				// Если есть new messages - 5 попыток, если нет - 1 попытка
				const attempts = profile.newMessages > 0 ? 5 : 1;
				console.log(`[AI Auto] Profile has ${profile.newMessages} new messages, will try ${attempts} times`);
				
				await aiAutoResponseService._processProfileWithRetries({
					accountId,
					userId,
					page,
					profile,
					maxAttempts: attempts,
				});

				// Задержка перед следующим профилем
				if (i < otherProfilesWithNewMessages.length - 1) {
					console.log('[AI Auto] Waiting 3 sec before next profile...');
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}

			console.log(`[AI Auto] ✓ Processed all ${otherProfilesWithNewMessages.length} other profiles with new messages`);
		}

			console.log(`[AI Auto] ========== Finished processing ${accountEmail} ==========`);
		} catch (error) {
			console.error(`[AI Auto] Error in processAccountMessages for ${accountId}:`, error);
		}
	},

	/**
	 * Запустить автоответы для всех аккаунтов пользователя с включенным AI
	 * @param {string} userId - ID пользователя
	 */
	startForUser: async (userId) => {
		try {
			console.log(`[AI Auto Response] Starting for all accounts of user ${userId}`);

			// Получаем все аккаунты пользователя с включенным AI
			const accounts = await LuxeeAccountModel.find({
				user: userId,
				isActive: true,
				aiEnabled: true,
				aiEnabledByAdmin: true,
			});

			console.log(
				`[AI Auto Response] Found ${accounts.length} accounts with AI enabled for user ${userId}`
			);

			for (const account of accounts) {
				try {
					await aiAutoResponseService.start(account._id.toString());
				} catch (error) {
					console.error(
						`[AI Auto Response] Failed to start for account ${account._id}:`,
						error.message
					);
					// Продолжаем с другими аккаунтами
				}
			}
		} catch (error) {
			console.error(`[AI Auto Response] Error starting for user ${userId}:`, error);
		}
	},

	/**
	 * Остановить автоответы для всех аккаунтов пользователя
	 * @param {string} userId - ID пользователя
	 */
	stopForUser: async (userId) => {
		try {
			console.log(`[AI Auto Response] Stopping for all accounts of user ${userId}`);

			const accounts = await LuxeeAccountModel.find({
				user: userId,
			});

			for (const account of accounts) {
				try {
					await aiAutoResponseService.stop(account._id.toString());
				} catch (error) {
					console.error(
						`[AI Auto Response] Failed to stop for account ${account._id}:`,
						error.message
					);
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
	isRunning: (accountId) => {
		return activeAutoResponders.has(accountId);
	},
};

export default aiAutoResponseService;
