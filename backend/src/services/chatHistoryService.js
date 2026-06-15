// Сервис для работы с историей чатов
// ✅ Фильтрация по времени (15 минут)
// ✅ Merge unanswered + newMessages + answered
// ✅ Удаление старых если >= 10 total

import answeredChatService from './answeredChatService.js';

const ANSWERED_CHAT_TTL_MS = 15 * 60 * 1000; // 15 минут в миллисекундах

const chatHistoryService = {
	/**
	 * Проверить должен ли answered чат показываться (< 15 минут)
	 */
	shouldShowAnsweredChat(chat, currentTime = Date.now()) {
		if (!chat.savedAt) {
			return false;
		}

		const chatTime = new Date(chat.savedAt).getTime();
		const age = currentTime - chatTime;
		
		return age < ANSWERED_CHAT_TTL_MS;
	},

	/**
	 * Фильтровать answered чаты по времени (только < 15 минут)
	 */
	filterRecentAnsweredChats(answeredChats, currentTime = Date.now()) {
		return answeredChats.filter(chat => 
			this.shouldShowAnsweredChat(chat, currentTime)
		);
	},

	/**
	 * Merge чатов: unanswered + newMessages + answered (с учётом времени)
	 * Возвращает до 10 чатов
	 */
	mergeChatsWithHistory({ unansweredChats = [], newMessagesChats = [], answeredChats = [] }) {
		const currentTime = Date.now();
		
		// 1. Фильтруем answered чаты (только < 15 минут)
		const recentAnsweredChats = this.filterRecentAnsweredChats(answeredChats, currentTime);
		
		console.log(`[Chat History] Merging: ${unansweredChats.length} unanswered, ${newMessagesChats.length} new, ${recentAnsweredChats.length} answered (recent)`);

		// 2. Создаём Set для отслеживания уникальных chatId
		const chatIds = new Set();
		const mergedChats = [];

		// 3. Добавляем unanswered (приоритет 1)
		for (const chat of unansweredChats) {
			if (!chatIds.has(chat.chatId)) {
				chatIds.add(chat.chatId);
				mergedChats.push({ ...chat, source: 'unanswered' });
			}
		}

		// 4. Добавляем newMessages (приоритет 2)
		for (const chat of newMessagesChats) {
			if (!chatIds.has(chat.chatId)) {
				chatIds.add(chat.chatId);
				mergedChats.push({ ...chat, source: 'newMessages' });
			}
		}

		// 5. Добавляем answered если < 10 total (приоритет 3)
		for (const chat of recentAnsweredChats) {
			if (mergedChats.length >= 10) {
				break;
			}
			
			if (!chatIds.has(chat.chatId)) {
				chatIds.add(chat.chatId);
				mergedChats.push({ 
					...chat, 
					source: 'answered',
					unAnswered: false // Явно помечаем как answered
				});
			}
		}

		console.log(`[Chat History] Merged total: ${mergedChats.length} chats`);
		
		return mergedChats;
	},

	/**
	 * Очистить старые answered чаты если total >= 10
	 * Удаляет самые старые answered чаты (старше 15 минут)
	 */
	async cleanupOldAnsweredChats({ accountId, profileUid, totalChats, answeredChats }) {
		try {
			// Если total < 10, не удаляем
			if (totalChats < 10) {
				console.log(`[Chat History] No cleanup needed (total: ${totalChats})`);
				return { removed: 0 };
			}

			const currentTime = Date.now();
			
			// Находим answered чаты старше 15 минут
			const oldChats = answeredChats.filter(chat => 
				!this.shouldShowAnsweredChat(chat, currentTime)
			);

			if (oldChats.length === 0) {
				console.log(`[Chat History] No old answered chats to remove`);
				return { removed: 0 };
			}

			// Удаляем старые чаты из MongoDB
			const chatIdsToRemove = oldChats.map(c => c.chatId);
			
			console.log(`[Chat History] Removing ${chatIdsToRemove.length} old answered chats (>15 min)`);
			
			await answeredChatService.removeAnsweredChats({
				accountId,
				profileUid,
				chatIds: chatIdsToRemove,
			});

			return { 
				removed: chatIdsToRemove.length,
				chatIds: chatIdsToRemove
			};
		} catch (error) {
			console.error('[Chat History] Error cleaning up old chats:', error);
			return { removed: 0 };
		}
	},
};

export default chatHistoryService;
