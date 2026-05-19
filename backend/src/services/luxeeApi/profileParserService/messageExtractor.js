// Модуль для извлечения сообщений из чатов
import chatNavigationService from '../chatNavigationService.js';

/**
 * Получить сообщения конкретного чата
 */
export const getChatMessages = async ({ page, profileUid, chatId }) => {
	try {
		console.log(`[Profile Parser] Getting messages for chat ${chatId}`);

		// Убедимся что мы на странице чатов
		if (!chatNavigationService.isOnChatsPage(page)) {
			await chatNavigationService.navigateToChats({ page });
		}

		// Получаем сообщения чата
		const messagesData = await page.evaluate(({ pUid, cId }) => {
			// Переключаемся на профиль
			if (typeof modelsChat === 'undefined' || !modelsChat.selectProfile) {
				throw new Error('modelsChat.selectProfile not available');
			}

			modelsChat.selectProfile(pUid);

			// Ждём немного чтобы чаты загрузились
			return new Promise(resolve => {
				setTimeout(() => {
					if (!modelsChat.getChats || !modelsChat.getChats.list) {
						resolve({ messages: [], chat: null, profileUid: pUid });
						return;
					}

					const chat = modelsChat.getChats.list[cId];
					
					if (!chat) {
						resolve({ messages: [], chat: null, profileUid: pUid });
						return;
					}

					// Определяем UID профиля из chatId (формат: profileUid_memberUid)
					// Первая часть до _ - это UID профиля
					let profileUidFromChat = null;
					if (cId && typeof cId === 'string' && cId.includes('_')) {
						profileUidFromChat = cId.split('_')[0];
					}

					// Также пробуем найти из members для надежности
					let profileMemberUid = null;
					if (chat.members && Array.isArray(chat.members)) {
						const profileMember = chat.members.find(m => m.type === 2);
						if (profileMember) {
							profileMemberUid = profileMember.uid;
						}
					}

					// Используем UID из chatId как приоритетный
					const profileUid = profileUidFromChat || profileMemberUid || pUid;

					// Получаем сообщения из чата (массив называется message, не messages!)
					const messages = [];
					
					if (chat.message && Array.isArray(chat.message)) {
						chat.message.forEach(msg => {
							// ПРАВИЛЬНОЕ определение: сравниваем uid сообщения с uid профиля
							// Используем UID из chatId (формат: profileUid_memberUid)
							const isFromProfile = msg.uid === profileUid;
							
							// Находим данные отправителя из members
							let senderData = null;
							if (chat.members && Array.isArray(chat.members)) {
								senderData = chat.members.find(m => m.uid === msg.uid);
							}

							messages.push({
								id: msg.messageId || msg._id,
								text: msg.body || msg.bodyOrigin || '',
								timestamp: msg.createdAt || null,
								isFromMe: isFromProfile,
								sender: {
									uid: msg.uid,
									username: senderData?.username || senderData?.first_name || 'Unknown',
									avatar: senderData?.avatar?.thumbnail || senderData?.avatar?.src || null,
									type: senderData?.type || null,
								},
							});
						});
					}

					// Получаем данные мужчины из members
					let memberData = null;
					if (chat.members && Array.isArray(chat.members)) {
						memberData = chat.members.find(m => m.type === 10);
					}

					resolve({
						messages,
						chat: {
							chatId: cId,
							memberUid: memberData?.uid,
							memberUsername: memberData?.username || memberData?.first_name,
							memberAvatar: memberData?.avatar?.thumbnail || memberData?.avatar?.src || null,
							profileUid: pUid,
							profileUsername: chat.members?.find(m => m.type === 2)?.username,
							profileAvatar: chat.members?.find(m => m.type === 2)?.avatar?.thumbnail || null,
							lastMessage: chat.lastActivity,
							newMessages: 0,
							unAnswered: chat.unAnswered === true,
						},
					});
				}, 1000);
			});
		}, { pUid: profileUid, cId: chatId });

		console.log(`[Profile Parser] Found ${messagesData.messages.length} messages in chat ${chatId}`);

		return messagesData;
	} catch (error) {
		console.error('[Profile Parser] Error getting chat messages:', error);
		throw error;
	}
};
