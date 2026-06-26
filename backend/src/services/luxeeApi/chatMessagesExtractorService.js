// Chat History Service
// Сервис для извлечения истории сообщений из активного чата

/**
 * Получить историю сообщений из активного чата
 * @param {Object} page - Playwright page
 * @param {number} limit - Максимальное количество сообщений (по умолчанию 10)
 * @returns {Promise<Object>} - История сообщений с метаданными
 */
const getChatHistory = async (page, limit = 10) => {
	try {
		const history = await page.evaluate(
			({ maxMessages }) => {
				try {
					// Получаем контейнер сообщений через API
					const container = modelsChat?.getChat?.container?.[0];
					if (!container) {
						return {
							error: 'Message container not found',
							messages: [],
							lastMessage: null,
						};
					}

					// Получаем данные чата для определения участников
					const activeChatId = modelsChat?.getChats?.active?.identity;
					const chat = modelsChat?.getChats?.list?.[activeChatId];

					if (!chat || !chat.members) {
						return {
							error: 'Chat data not found',
							messages: [],
							lastMessage: null,
						};
					}

					// Определяем участников
					const profileMember = chat.members.find((m) => m.type === 2); // Девушка
					const manMember = chat.members.find((m) => m.type === 10); // Мужчина

					if (!profileMember || !manMember) {
						return {
							error: 'Chat members not found',
							messages: [],
							lastMessage: null,
						};
					}

					// Получаем все элементы сообщений
					const messageElements = container.querySelectorAll('.messages');
					if (!messageElements || messageElements.length === 0) {
						return {
							error: 'No messages found',
							messages: [],
							lastMessage: null,
							profileName: profileMember.username || profileMember.first_name,
							manName: manMember.username || manMember.first_name,
						};
					}

					// Извлекаем данные из каждого сообщения
					const messages = [];
					messageElements.forEach((msgEl, index) => {
						const isFromProfile = msgEl.classList.contains('message-owner');
						const isFromMan = msgEl.classList.contains('message-opponent');

						const textEl = msgEl.querySelector('.chat-full-message');
						const timeEl = msgEl.querySelector('.message_read-at-time');
						const dateEl = msgEl.querySelector('.message_created');
						const sidAttr = msgEl.getAttribute('data-sid');

						// Определяем тип сообщения
						const hasWink =
							textEl && textEl.querySelector('.chat-member__wink');
						const hasVideo = textEl && textEl.querySelector('video');
						const hasImage = msgEl.querySelector('.message_media img');
						const hasEmojione =
							textEl && textEl.querySelector('img.emojione');

						let text = textEl ? textEl.textContent.trim() : '';
						let messageType = 'text';
						let displayText = text;

						if (hasWink) {
							messageType = 'wink';
							displayText = '[WINK]';
						} else if (hasVideo) {
							messageType = 'video';
							displayText = '[VIDEO]';
						} else if (hasImage) {
							messageType = 'image';
							displayText = '[IMAGE]';
						} else if (hasEmojione && text.trim() === '') {
							// Только эмодзи без текста
							messageType = 'emoji';
							const emojiAlt = hasEmojione.alt || hasEmojione.title || '❓';
							displayText = emojiAlt;
						} else if (hasEmojione) {
							// Текст + эмодзи
							messageType = 'text_with_emoji';
							displayText = text;
						}

						// Если текст пустой
						if (text.trim() === '' && messageType === 'text') {
							displayText = '';
						}

						const time = timeEl ? timeEl.textContent.trim() : '';
						const date = dateEl ? dateEl.textContent.trim() : '';
						const authorName = isFromProfile
							? profileMember.username || profileMember.first_name
							: manMember.username || manMember.first_name;

						messages.push({
							index: index + 1,
							sid: sidAttr,
							author: authorName,
							isFromProfile,
							isFromMan,
							text: displayText,
							rawText: text,
							messageType,
							time,
							date,
							fullDateTime: `${date} ${time}`,
						});
					});

					// Берём последние N сообщений
					const recentMessages =
						messages.length > maxMessages
							? messages.slice(-maxMessages)
							: messages;

					// Последнее сообщение
					const lastMessage = messages[messages.length - 1] || null;

					return {
						messages: recentMessages,
						lastMessage,
						profileName: profileMember.username || profileMember.first_name,
						manName: manMember.username || manMember.first_name,
						totalInChat: messages.length,
						error: null,
					};
				} catch (error) {
					return {
						error: error.message,
						messages: [],
						lastMessage: null,
					};
				}
			},
			{ maxMessages: limit },
		);

		return history;
	} catch (error) {
		console.error('[Chat History Service] Error getting chat history:', error);
		return {
			error: error.message,
			messages: [],
			lastMessage: null,
		};
	}
};

/**
 * Форматировать историю для AI промпта
 * @param {Array} messages - Массив сообщений
 * @param {string} profileName - Имя девушки
 * @param {string} manName - Имя мужчины
 * @returns {string} - Отформатированная история
 */
const formatHistoryForAI = (messages, profileName, manName) => {
	if (!messages || messages.length === 0) {
		return '';
	}

	let formatted = '=== CONVERSATION HISTORY (recent messages) ===\n\n';

	messages.forEach((msg) => {
		const authorName = msg.isFromProfile ? profileName : manName;
		const typeLabel =
			msg.messageType !== 'text' && msg.messageType !== 'text_with_emoji'
				? ` [${msg.messageType.toUpperCase()}]`
				: '';

		formatted += `[${msg.date} ${msg.time}] ${authorName}${typeLabel}: ${msg.text}\n`;
	});

	formatted += '\n=== END OF HISTORY ===\n';

	return formatted;
};

/**
 * Проверить нужно ли отвечать на чат
 * @param {Object} lastMessage - Последнее сообщение в чате
 * @returns {Object} - { shouldReply: boolean, reason: string }
 */
const shouldReplyToChat = (lastMessage) => {
	if (!lastMessage) {
		return {
			shouldReply: false,
			reason: 'No messages in chat',
		};
	}

	// Если последнее сообщение от девушки - не отвечаем
	if (lastMessage.isFromProfile) {
		return {
			shouldReply: false,
			reason: `Last message is from profile (${lastMessage.author}) - already replied`,
		};
	}

	// Если последнее сообщение от мужчины - отвечаем
	if (lastMessage.isFromMan) {
		return {
			shouldReply: true,
			reason: `Last message is from man (${lastMessage.author}) - need to reply`,
			messageType: lastMessage.messageType,
		};
	}

	return {
		shouldReply: false,
		reason: 'Unknown message author',
	};
};

/**
 * Получить инструкции для AI в зависимости от типа сообщения
 * @param {string} messageType - Тип сообщения (text, wink, video, image, emoji)
 * @returns {string} - Дополнительные инструкции для AI
 */
const getAIInstructionsForMessageType = (messageType) => {
	switch (messageType) {
		case 'wink':
			return `
Note: Man sent a wink. Instead of just acknowledging it, 
continue the conversation topic from the history above or start a new engaging topic.
Don't just say "Hi" - be creative and engaging!`;

		case 'emoji':
			return `
Note: Man sent an emoji. Respond naturally and continue the conversation 
based on the context from previous messages. Match his playful mood!`;

		case 'image':
			return `
Note: Man sent an image. React to it positively and keep the conversation flowing.
Show interest and ask engaging questions!`;

		case 'video':
			return `
Note: Man sent a video. React to it enthusiastically and keep the conversation going.
Show you're interested in what he shared!`;

		default:
			return '';
	}
};

export default {
	getChatHistory,
	formatHistoryForAI,
	shouldReplyToChat,
	getAIInstructionsForMessageType,
};
