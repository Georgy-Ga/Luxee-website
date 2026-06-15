// AI Auto Response Service
// Автоматические ответы AI на новые сообщения
// Работает через отдельные AI контексты для каждого аккаунта

import aiResponseService from './aiResponseService.js';
import aiManagementService from './aiManagementService/index.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import answeredChatService from './answeredChatService.js';
import pageHelpers from './browser/pageHelpers.js';

// Хранилище активных процессов автоответов
const activeAutoResponders = new Map(); // accountId -> { intervalId, isProcessing }

const aiAutoResponseService = {
	/**
	 * Запустить автоответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	start: async (accountId) => {
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
	 * Обработать сообщения для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 */
	processAccountMessages: async (accountId) => {
		try {
			const account = await LuxeeAccountModel.findById(accountId).populate('user');
			if (!account) {
				console.log(`[AI Auto Response] Account ${accountId} not found`);
				return;
			}

			const userId = account.user._id.toString();

			// Проверяем что AI всё ещё включен
			const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
			if (!canUse) {
				console.log(`[AI Auto Response] AI disabled for account ${accountId}, stopping...`);
				await aiAutoResponseService.stop(accountId);
				return;
			}

			// Получаем AI контекст
			const aiContext = await aiBrowserContextService.getAiContext(accountId);
			if (!aiContext) {
				console.log(`[AI Auto Response] No AI context for account ${accountId}, recreating...`);
				await aiBrowserContextService.getOrCreateAiContext(accountId);
				return;
			}

			const page = await pageHelpers.getOrCreatePage(aiContext);

			// Получаем список профилей и чатов через AI контекст
			// ✅ ИСПОЛЬЗУЕМ ТУ ЖЕ ЛОГИКУ ЧТО И messageCheckService
			const profilesData = await page.evaluate(() => {
				if (typeof modelsChat === 'undefined' || !modelsChat.getProfile?.data) {
					return [];
				}

				const profiles = [];
				const profilesData = modelsChat.getProfile.data;
				const chatsData = modelsChat.getChats?.list || {};

				for (const uid in profilesData) {
					const profile = profilesData[uid];
					const profileUid = profile.inner.uid;

					// Получаем все outer UIDs для этого профиля
					const allProfileUids = [profile.inner.uid];
					if (profile.outer) {
						for (const outerUid in profile.outer) {
							allProfileUids.push(profile.outer[outerUid].uid);
						}
					}

					// Собираем чаты с неотвеченными сообщениями
					const unansweredChats = [];

					for (const chatId in chatsData) {
						const chat = chatsData[chatId];

						// ✅ ПРАВИЛЬНО: парсим profileUid из chatId (формат: "profileUid_memberUid")
						const chatProfileUid = parseInt(chatId.split('_')[0]);

						// Проверяем что чат принадлежит одному из UID профиля
						if (!allProfileUids.includes(chatProfileUid)) continue;

						// Проверяем что есть неотвеченное сообщение ИЛИ новые сообщения
						// unAnswered=true - явно помечен как неотвеченный
						// newMessages > 0 - есть новые сообщения (которые могут требовать ответа)
						if (chat.unAnswered === true || (chat.newMessages && chat.newMessages > 0)) {
							// Находим данные мужчины (type: 10)
							const manMember = chat.members?.find(m => m.type === 10);
							const memberUid = manMember?.uid || parseInt(chatId.split('_')[1]);

							// Получаем последнее сообщение
							const messages = chat.message || [];
							let lastManMessage = null;

							// Ищем последнее сообщение от мужчины (uType: 2)
							for (let i = messages.length - 1; i >= 0; i--) {
								if (messages[i].uType === 2) {
									lastManMessage = messages[i];
									break;
								}
							}

							if (lastManMessage && manMember) {
								unansweredChats.push({
									chatId: chat.identity || chatId,
									memberUid: memberUid,
									memberUsername: manMember.username || manMember.first_name,
									lastManMessage: {
										body: lastManMessage.body,
										createdAt: lastManMessage.createdAt,
									},
									unAnswered: chat.unAnswered,
								});
							}
						}
					}

					if (unansweredChats.length > 0) {
						profiles.push({
							profileUid: profileUid,
							profileName: profile.inner.username,
							profileAge: profile.inner.age,
							profileCountry: profile.inner.country,
							profileCity: profile.inner.city,
							unansweredChats,
						});
					}
				}

				return profiles;
			});

			if (profilesData.length === 0) {
				console.log(`[AI Auto Response] No unanswered messages for account ${accountId}`);
				return;
			}

			console.log(
				`[AI Auto Response] Found ${profilesData.length} profiles with unanswered messages for account ${accountId}`
			);

			// Обрабатываем каждый профиль
			for (const profile of profilesData) {
				console.log(
					`[AI Auto Response] Processing profile ${profile.profileUid} (${profile.unansweredChats.length} chats)`
				);

				// Обрабатываем каждый чат по очереди
				for (const chat of profile.unansweredChats) {
					try {
						// Проверяем что мы ещё не отвечали на этот чат
						const answeredChats = await answeredChatService.getAnsweredChats({
							accountId,
							profileUid: profile.profileUid,
						});

						const isAlreadyAnswered = answeredChats.some(
							ac => ac.chatId === chat.chatId
						);

						if (isAlreadyAnswered) {
							console.log(
								`[AI Auto Response] Chat ${chat.chatId} already answered, skipping`
							);
							continue;
						}

						console.log(
							`[AI Auto Response] Generating response for chat ${chat.chatId}...`
						);

						// Генерируем и отправляем ответ
						const result = await aiResponseService.generateAndSend({
							userId,
							accountId,
							profileUid: profile.profileUid,
							chatId: chat.chatId,
							profile: {
								username: profile.profileName,
								age: profile.profileAge,
								country: profile.profileCountry,
								city: profile.profileCity,
							},
							manMessage: chat.lastManMessage.body,
							messageType: 1, // Всегда считаем текстом для auto-response
							conversationHistory: [], // TODO: можно добавить историю если нужно
						});

						if (result.success) {
							console.log(
								`[AI Auto Response] Successfully sent response to chat ${chat.chatId}`
							);

							// Задержка между ответами (чтобы не спамить)
							await new Promise(resolve => setTimeout(resolve, 3000));
						} else {
							console.log(
								`[AI Auto Response] Failed to send response to chat ${chat.chatId}: ${result.reason}`
							);
						}
					} catch (error) {
						console.error(
							`[AI Auto Response] Error processing chat ${chat.chatId}:`,
							error.message
						);
						// Продолжаем со следующим чатом
					}
				}
			}

			console.log(`[AI Auto Response] Finished processing account ${accountId}`);
		} catch (error) {
			console.error(
				`[AI Auto Response] Error in processAccountMessages for ${accountId}:`,
				error
			);
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
