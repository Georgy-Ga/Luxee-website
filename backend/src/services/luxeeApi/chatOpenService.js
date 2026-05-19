// Сервис для открытия чата и получения последнего сообщения
// ✅ Переключается на профиль через очередь
// ✅ Открывает чат с мужчиной
// ✅ Получает последнее сообщение и определяет от кого оно

import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import requestQueueService from '../browser/requestQueueService.js';

const chatOpenService = {
	/**
	 * Открыть чат и получить последнее сообщение
	 */
	openChat: async ({ accountId, profileUid, chatId }) => {
		console.log(`[Chat Open] Opening chat ${chatId} for profile ${profileUid} on account ${accountId}`);

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

				// Переключаемся на профиль, открываем чат и получаем данные
				const chatData = await page.evaluate(async ({ uid, cId }) => {
					if (typeof modelsChat === 'undefined') {
						throw new Error('modelsChat API not available');
					}

					// 1. Переключаемся на профиль
					modelsChat.selectProfile(uid);
					
					// Ждем загрузки профиля
					await new Promise(resolve => setTimeout(resolve, 500));

					// 2. Открываем чат
					if (!modelsChat.selectChat) {
						throw new Error('modelsChat.selectChat not available');
					}
					
					modelsChat.selectChat(cId);
					
					// Ждем загрузки чата
					await new Promise(resolve => setTimeout(resolve, 800));

					// 3. Получаем данные активного чата
					const activeChat = modelsChat.getChats?.active;
					
					if (!activeChat) {
						throw new Error('Active chat data not available');
					}

					// 4. Парсим данные чата
					const messages = activeChat.message || [];
					
					console.log('[Chat Open Browser] unAnswered:', activeChat.unAnswered);
					console.log('[Chat Open Browser] Total messages:', messages.length);
					
					// Логируем все сообщения для отладки
					messages.forEach((msg, idx) => {
						console.log(`[Chat Open Browser] Message ${idx}:`, {
							uid: msg.uid,
							uType: msg.uType,
							type: msg.type,
							body: msg.body?.substring(0, 50),
							media: msg.media?.length || 0,
							createdAt: msg.createdAt,
						});
					});
					
					// Определяем от кого последнее сообщение через unAnswered
					// unAnswered === true → последнее от мужчины (uType: 2)
					// unAnswered === false → последнее от девушки (uType: 10)
					const lastMessageFrom = activeChat.unAnswered ? 'man' : 'woman';
					
					console.log('[Chat Open Browser] lastMessageFrom:', lastMessageFrom);
					
					// Находим последнее сообщение от нужного отправителя
					// uType: 10 = девушка (модель), uType: 2 = мужчина
					const targetUType = activeChat.unAnswered ? 2 : 10;
					let lastMessage = null;
					
					console.log('[Chat Open Browser] Looking for uType:', targetUType);
					
					// Ищем с конца массива последнее сообщение с нужным uType
					for (let i = messages.length - 1; i >= 0; i--) {
						console.log(`[Chat Open Browser] Checking message ${i}: uType=${messages[i].uType}`);
						if (messages[i].uType === targetUType) {
							lastMessage = messages[i];
							console.log('[Chat Open Browser] Found last message:', {
								body: lastMessage.body?.substring(0, 50),
								uType: lastMessage.uType,
							});
							break;
						}
					}

					// Находим данные мужчины и девушки
					// type: 10 = девушка (модель), type: 2 = мужчина
					console.log('[Chat Open Browser] Members:', activeChat.members?.map(m => ({
						uid: m.uid,
						type: m.type,
						username: m.username,
						avatar: m.avatar?.thumbnail || m.avatar?.preview || m.avatar?.src,
					})));
					
					const manMember = activeChat.members?.find(m => m.type === 2);
					const womanMember = activeChat.members?.find(m => m.type === 10);
					
					console.log('[Chat Open Browser] Man member:', manMember?.uid);
					console.log('[Chat Open Browser] Woman member:', womanMember?.uid);

					return {
						chatId: activeChat.identity || cId,
						sid: activeChat.sid,
						unAnswered: activeChat.unAnswered || false,
						lastActivity: activeChat.lastActivity,
						
						// Последнее сообщение
						lastMessage: lastMessage ? {
							id: lastMessage._id,
							uid: lastMessage.uid,
							body: lastMessage.body,
							createdAt: lastMessage.createdAt,
							index: lastMessage.index,
							from: lastMessageFrom,
						} : null,
						
						// От кого последнее (по unAnswered)
						lastMessageFrom: lastMessageFrom,
						
					// Данные участников
					man: manMember ? {
						uid: manMember.uid,
						username: manMember.username || manMember.first_name,
						avatar: manMember.avatar?.preview || manMember.avatar?.thumbnail || manMember.avatar?.src || null,
						age: manMember.age,
						country: manMember.country,
						city: manMember.city,
					} : null,
					
					woman: womanMember ? {
						uid: womanMember.uid,
						username: womanMember.username || womanMember.first_name,
						avatar: womanMember.avatar?.preview || womanMember.avatar?.thumbnail || womanMember.avatar?.src || null,
					} : null,
						
						// Все сообщения (последние 10)
						// uType: 10 = девушка (модель), uType: 2 = мужчина
						messages: messages.slice(-10).map(msg => {
							// Определяем текст сообщения
							let messageBody = msg.body || '';
							let messageType = msg.type || 1;
							
							console.log('[Chat Open Browser] Processing message:', {
								body: msg.body,
								type: msg.type,
								bodyOrigin: msg.bodyOrigin,
								media: msg.media?.length,
							});
							
							// Если body пустой, проверяем тип сообщения
							if (!messageBody || messageBody.trim() === '') {
								// type: 1 = обычное, 2 = wink, 3 = media и т.д.
								if (msg.type === 2 || msg.type === '2') {
									messageBody = '😉 Wink';
									messageType = 2;
								} else if (msg.media && msg.media.length > 0) {
									messageBody = `📷 ${msg.media.length} фото`;
									messageType = 3;
								}
								// Убираем "(пустое сообщение)" - просто оставляем пустым
							}
							
							return {
								id: msg._id,
								uid: msg.uid,
								body: messageBody,
								type: messageType,
								media: msg.media || [],
								createdAt: msg.createdAt,
								index: msg.index,
								from: msg.uType === 10 ? 'woman' : 'man',
							};
						}),
					};
				}, { uid: profileUid, cId: chatId });

				console.log(`[Chat Open] ===== CHAT DATA =====`);
				console.log(`[Chat Open] Chat ID: ${chatData.chatId}`);
				console.log(`[Chat Open] unAnswered: ${chatData.unAnswered}`);
				console.log(`[Chat Open] Last message from: ${chatData.lastMessageFrom}`);
				console.log(`[Chat Open] Last message:`, chatData.lastMessage);
				console.log(`[Chat Open] Man:`, chatData.man);
				console.log(`[Chat Open] Woman:`, chatData.woman);
				console.log(`[Chat Open] Total messages: ${chatData.messages.length}`);
				chatData.messages.forEach((msg, idx) => {
					console.log(`[Chat Open] Message ${idx}: from=${msg.from}, body=${msg.body?.substring(0, 50)}`);
				});
				console.log(`[Chat Open] =====================`);

				return chatData;
			} catch (error) {
				console.error(`[Chat Open] Error opening chat ${chatId}:`, error);
				throw error;
			}
		});
	},
};

export default chatOpenService;
