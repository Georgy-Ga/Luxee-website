// Сервис для загрузки чатов профиля при клике
// ✅ Переключается на профиль через очередь
// ✅ Загружает до 10 чатов (неотвеченные без лимита)
// ✅ Неотвеченные сверху, отвеченные ниже (15 минут)
// ✅ Сохраняет последнее сообщение от мужчины И от девушки

import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import requestQueueService from '../browser/requestQueueService.js';
import answeredChatService from '../answeredChatService.js';
import chatHistoryService from '../chatHistoryService.js';

const profileChatsLoadService = {
	/**
	 * Загрузить чаты для профиля (при клике на профиль)
	 * Переключается на профиль и загружает чаты с умной логикой
	 */
	loadProfileChats: async ({ accountId, profileUid }) => {
		console.log(`[Profile Chats Load] Loading chats for profile ${profileUid} on account ${accountId}`);

		// Выполняем в очереди чтобы не конфликтовать с отправкой
		return await requestQueueService.executeInQueue(accountId, async () => {
			try {
				// Получаем контекст
				const context = browserService.getContext(accountId);
				if (!context) {
					throw new Error('Context not found');
				}

				// Получаем страницу
				const page = await pageHelpers.getOrCreatePage(context);

				// Переключаемся на профиль и загружаем чаты
				const chatsData = await page.evaluate(async (uid) => {
					if (typeof modelsChat === 'undefined') {
						throw new Error('modelsChat API not available');
					}

					// Переключаемся на профиль
					modelsChat.selectProfile(uid);
					
					// Ждем загрузки чатов
					await new Promise(resolve => setTimeout(resolve, 800));

					// Получаем полные данные чатов для этого профиля
					const chatsListData = modelsChat.getChats?.list || {};
					const unansweredChats = [];
					const answeredChats = [];

					// Получаем все outer UIDs для этого профиля
					const profileData = modelsChat.getProfile.data[uid];
					const allProfileUids = [uid];
					if (profileData?.outer) {
						for (const outerUid in profileData.outer) {
							allProfileUids.push(profileData.outer[outerUid].uid);
						}
					}

					console.log('[Profile Chats Load] All profile UIDs:', allProfileUids);

					// Собираем все чаты этого профиля
					for (const chatId in chatsListData) {
						const chat = chatsListData[chatId];
						
						// Парсим chatId чтобы получить profileUid
						const chatProfileUid = parseInt(chatId.split('_')[0]);
						
						// Проверяем что этот чат принадлежит одному из UID профиля
						if (allProfileUids.includes(chatProfileUid)) {
							const isUnAnswered = chat.unAnswered === true;
							
							// Находим данные мужчины (type: 2) и девушки (type: 10)
							const manMember = chat.members?.find(m => m.type === 2);
							const womanMember = chat.members?.find(m => m.type === 10);
							const memberUid = manMember?.uid || parseInt(chatId.split('_')[1]);
							
							// Получаем последние сообщения
							const messages = chat.message || [];
							let lastManMessage = null;
							let lastWomanMessage = null;
							
							// Ищем последнее сообщение от мужчины (uType: 2)
							for (let i = messages.length - 1; i >= 0; i--) {
								if (messages[i].uType === 2 && !lastManMessage) {
									lastManMessage = {
										body: messages[i].body,
										createdAt: messages[i].createdAt,
									};
								}
								if (messages[i].uType === 10 && !lastWomanMessage) {
									lastWomanMessage = {
										body: messages[i].body,
										createdAt: messages[i].createdAt,
									};
								}
								if (lastManMessage && lastWomanMessage) break;
							}
							
							const chatData = {
								chatId: chatId,
								memberUid: memberUid,
								memberUsername: manMember?.username || manMember?.first_name || null,
								memberAvatar: manMember?.avatar?.preview || manMember?.avatar?.thumbnail || manMember?.avatar?.src || null,
								newMessages: chat.newMessages || 0,
								unAnswered: isUnAnswered,
								lastActivity: chat.lastActivity || null,
								lastManMessage: lastManMessage,
								lastWomanMessage: lastWomanMessage,
							};
							
							// Разделяем на неотвеченные и отвеченные
							if (isUnAnswered) {
								unansweredChats.push(chatData);
							} else {
								answeredChats.push(chatData);
							}
						}
					}

					console.log('[Profile Chats Load] Unanswered chats:', unansweredChats.length);
					console.log('[Profile Chats Load] Answered chats:', answeredChats.length);

					// Сортируем по lastActivity (новые сверху)
					unansweredChats.sort((a, b) => parseInt(b.lastActivity) - parseInt(a.lastActivity));
					answeredChats.sort((a, b) => parseInt(b.lastActivity) - parseInt(a.lastActivity));

					// Логика хранения:
					// 1. Все неотвеченные всегда сохраняем
					// 2. Из отвеченных берем только столько, чтобы общее количество было <= 5
					const maxChats = 5;
					let finalChats = [...unansweredChats];
					
					const remainingSlots = maxChats - unansweredChats.length;
					if (remainingSlots > 0 && answeredChats.length > 0) {
						// Добавляем отвеченные чаты (самые свежие)
						finalChats = finalChats.concat(answeredChats.slice(0, remainingSlots));
					}

					console.log('[Profile Chats Load] Final chats count:', finalChats.length);
					console.log('[Profile Chats Load] Breakdown: unanswered=' + unansweredChats.length + ', answered=' + Math.min(remainingSlots, answeredChats.length));

					return {
						chats: finalChats,
						unansweredCount: unansweredChats.length,
						totalChats: finalChats.length,
					};
				}, profileUid);

				console.log(
					`[Profile Chats Load] Loaded ${chatsData.totalChats} chats from Luxee (${chatsData.unansweredCount} unanswered)`,
				);

				// Получаем неотвеченные чаты из результата
				const unansweredChats = chatsData.chats.filter(c => c.unAnswered === true);
				const unansweredChatIds = unansweredChats.map(c => c.chatId);

				console.log('[Profile Chats Load] Unanswered chat IDs:', unansweredChatIds);

				// Удаляем из MongoDB чаты которые стали неотвеченными
				if (unansweredChatIds.length > 0) {
					await answeredChatService.removeAnsweredChats({
						accountId,
						profileUid,
						chatIds: unansweredChatIds,
					});
				}

			// Загружаем отвеченные чаты из MongoDB
			const savedAnsweredChats = await answeredChatService.getAnsweredChats({
				accountId,
				profileUid,
			});

			console.log('[Profile Chats Load] Saved answered chats from MongoDB:', savedAnsweredChats.length);

			// ✅ Используем chatHistoryService для merge с учётом 15 минут
			const newMessagesChats = chatsData.chats.filter(c => c.newMessages > 0 && !c.unAnswered);
			
			const finalChats = chatHistoryService.mergeChatsWithHistory({
				unansweredChats,
				newMessagesChats,
				answeredChats: savedAnsweredChats.map(chat => ({
					chatId: chat.chatId,
					memberUid: chat.memberUid,
					memberUsername: chat.memberUsername,
					memberAvatar: chat.memberAvatar,
					newMessages: 0,
					unAnswered: false,
					lastActivity: chat.lastActivity,
					lastManMessage: chat.lastManMessage,
					lastWomanMessage: chat.lastWomanMessage,
					savedAt: chat.savedAt, // Важно для проверки 15 минут
				})),
			});

			// ✅ Очищаем старые answered чаты если total >= 10
			await chatHistoryService.cleanupOldAnsweredChats({
				accountId,
				profileUid,
				totalChats: finalChats.length,
				answeredChats: savedAnsweredChats,
			});

			console.log('[Profile Chats Load] Final result:');
			console.log(`  - Unanswered: ${unansweredChats.length}`);
			console.log(`  - NewMessages: ${newMessagesChats.length}`);
			console.log(`  - Total merged: ${finalChats.length}`);

			return {
				chats: finalChats,
				unansweredCount: unansweredChats.length,
				totalChats: finalChats.length,
			};
			} catch (error) {
				console.error(`[Profile Chats Load] Error loading chats for profile ${profileUid}:`, error);
				throw error;
			}
		});
	},
};

export default profileChatsLoadService;
