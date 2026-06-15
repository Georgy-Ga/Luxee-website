// Сервис для работы с отвеченными чатами в MongoDB
import AnsweredChat from '../models/AnsweredChat.js';

const answeredChatService = {
	/**
	 * Сохранить отвеченный чат в MongoDB
	 * Максимум 5 чатов на профиль
	 */
	saveAnsweredChat: async ({ accountId, profileUid, chatData }) => {
		try {
			console.log(`[Answered Chat] Saving chat ${chatData.chatId} for profile ${profileUid}`);

			// Находим или создаем документ для этого профиля
			let answeredChat = await AnsweredChat.findOne({ accountId, profileUid });

			if (!answeredChat) {
				// Создаем новый документ
				answeredChat = new AnsweredChat({
					accountId,
					profileUid,
					chats: [],
				});
			}

			// Проверяем есть ли уже этот чат
			const existingChatIndex = answeredChat.chats.findIndex(
				c => c.chatId === chatData.chatId
			);

			const newChatData = {
				chatId: chatData.chatId,
				memberUid: chatData.memberUid,
				memberUsername: chatData.memberUsername,
				memberAvatar: chatData.memberAvatar,
				lastManMessage: chatData.lastManMessage,
				lastWomanMessage: chatData.lastWomanMessage,
				lastActivity: chatData.lastActivity,
				savedAt: new Date(),
			};

			if (existingChatIndex !== -1) {
				// Обновляем существующий чат
				answeredChat.chats[existingChatIndex] = newChatData;
				console.log(`[Answered Chat] Updated existing chat ${chatData.chatId}`);
			} else {
				// Добавляем новый чат
				answeredChat.chats.push(newChatData);
				console.log(`[Answered Chat] Added new chat ${chatData.chatId}`);

			// Сортируем по savedAt (новые сверху)
			answeredChat.chats.sort((a, b) => b.savedAt - a.savedAt);

			// Ограничиваем до 10 чатов (история)
			if (answeredChat.chats.length > 10) {
				const removed = answeredChat.chats.splice(10);
				console.log(`[Answered Chat] Removed ${removed.length} old chats (limit 10)`);
			}
			}

			await answeredChat.save();
			console.log(`[Answered Chat] Saved successfully. Total chats: ${answeredChat.chats.length}`);

			return answeredChat;
		} catch (error) {
			console.error('[Answered Chat] Error saving chat:', error);
			throw error;
		}
	},

	/**
	 * Получить отвеченные чаты для профиля
	 */
	getAnsweredChats: async ({ accountId, profileUid }) => {
		try {
			const answeredChat = await AnsweredChat.findOne({ accountId, profileUid });
			
			if (!answeredChat) {
				return [];
			}

			// Сортируем по savedAt (новые сверху)
			const sortedChats = answeredChat.chats.sort((a, b) => b.savedAt - a.savedAt);
			
			console.log(`[Answered Chat] Found ${sortedChats.length} answered chats for profile ${profileUid}`);
			
			return sortedChats;
		} catch (error) {
			console.error('[Answered Chat] Error getting chats:', error);
			return [];
		}
	},

	/**
	 * Удалить чат из отвеченных (когда мужчина написал снова)
	 */
	removeAnsweredChat: async ({ accountId, profileUid, chatId }) => {
		try {
			console.log(`[Answered Chat] Removing chat ${chatId} from profile ${profileUid}`);

			const answeredChat = await AnsweredChat.findOne({ accountId, profileUid });
			
			if (!answeredChat) {
				return;
			}

			const initialLength = answeredChat.chats.length;
			answeredChat.chats = answeredChat.chats.filter(c => c.chatId !== chatId);

			if (answeredChat.chats.length < initialLength) {
				await answeredChat.save();
				console.log(`[Answered Chat] Removed chat ${chatId}. Remaining: ${answeredChat.chats.length}`);
			} else {
				console.log(`[Answered Chat] Chat ${chatId} not found in answered chats`);
			}
		} catch (error) {
			console.error('[Answered Chat] Error removing chat:', error);
		}
	},

	/**
	 * Удалить несколько чатов из отвеченных
	 */
	removeAnsweredChats: async ({ accountId, profileUid, chatIds }) => {
		try {
			console.log(`[Answered Chat] Removing ${chatIds.length} chats from profile ${profileUid}`);

			const answeredChat = await AnsweredChat.findOne({ accountId, profileUid });
			
			if (!answeredChat) {
				return;
			}

			const initialLength = answeredChat.chats.length;
			answeredChat.chats = answeredChat.chats.filter(c => !chatIds.includes(c.chatId));

			if (answeredChat.chats.length < initialLength) {
				await answeredChat.save();
				const removed = initialLength - answeredChat.chats.length;
				console.log(`[Answered Chat] Removed ${removed} chats. Remaining: ${answeredChat.chats.length}`);
			}
		} catch (error) {
			console.error('[Answered Chat] Error removing chats:', error);
		}
	},
};

export default answeredChatService;
