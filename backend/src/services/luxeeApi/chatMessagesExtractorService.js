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

					console.log(
						'[💬 HISTORY] ========== EXTRACTING CHAT HISTORY ==========',
					);
					console.log('[💬 HISTORY] Active chat ID:', activeChatId);

					if (!chat || !chat.members) {
						console.log('[💬 HISTORY] ❌ ERROR: Chat data not found');
						return {
							error: 'Chat data not found',
							messages: [],
							lastMessage: null,
						};
					}

					console.log('[💬 HISTORY] Chat data:', {
						chatId: chat.identity,
						unAnswered: chat.unAnswered,
						lastActivity: chat.lastActivity,
						membersCount: chat.members?.length,
					});

					console.log(
						'[💬 HISTORY] All members:',
						chat.members.map(m => ({
							uid: m.uid,
							username: m.username,
							firstName: m.first_name,
							type: m.type,
							gender: m.gender,
						})),
					);

					// Определяем участников
					const profileMember = chat.members.find(m => m.type === 2); // Девушка
					const manMember = chat.members.find(m => m.type === 10); // Мужчина

					console.log('[💬 HISTORY] Found by type:', {
						profileMember: profileMember
							? {
									uid: profileMember.uid,
									username: profileMember.username,
									type: profileMember.type,
									gender: profileMember.gender,
								}
							: 'NOT_FOUND',
						manMember: manMember
							? {
									uid: manMember.uid,
									username: manMember.username,
									type: manMember.type,
									gender: manMember.gender,
								}
							: 'NOT_FOUND',
					});

					// Пробуем найти по gender если не нашли по type
					const profileByGender = chat.members.find(m => m.gender === 2);
					const manByGender = chat.members.find(m => m.gender === 1);

					console.log('[💬 HISTORY] Found by gender:', {
						profileByGender: profileByGender
							? {
									uid: profileByGender.uid,
									username: profileByGender.username,
									type: profileByGender.type,
									gender: profileByGender.gender,
								}
							: 'NOT_FOUND',
						manByGender: manByGender
							? {
									uid: manByGender.uid,
									username: manByGender.username,
									type: manByGender.type,
									gender: manByGender.gender,
								}
							: 'NOT_FOUND',
					});

					if (!profileMember || !manMember) {
						console.log(
							'[💬 HISTORY] ❌ ERROR: Chat members not found by type',
						);
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
					console.log(
						'[💬 HISTORY] Total DOM messages found:',
						messageElements.length,
					);

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
					const hasGift = textEl && textEl.querySelector('.chat-gift-icon');
					const hasEmojione = textEl && textEl.querySelector('img.emojione');

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
					} else if (hasGift) {
						// 🎁 Подарок - убираем цифры (цену) и оставляем только текст
						messageType = 'gift';
						// Убираем начальные цифры (цена подарка типа "29", "55")
						const giftText = text.replace(/^\d+\s*/, '').trim();
						displayText = giftText || 'sent a gift';
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

					console.log('[💬 HISTORY] ========== MESSAGES EXTRACTED ==========');
					console.log('[💬 HISTORY] Total messages:', messages.length);
					console.log('[💬 HISTORY] Recent messages:', recentMessages.length);
					console.log(
						'[💬 HISTORY] Last message:',
						lastMessage
							? {
									author: lastMessage.author,
									isFromProfile: lastMessage.isFromProfile,
									isFromMan: lastMessage.isFromMan,
									text: lastMessage.text.substring(0, 50) + '...',
									messageType: lastMessage.messageType,
									cssClasses:
										'owner=' +
										lastMessage.isFromProfile +
										', opponent=' +
										lastMessage.isFromMan,
								}
							: 'NO_LAST_MESSAGE',
					);

					// Логируем последние 3 сообщения для контекста
					console.log('[💬 HISTORY] Last 3 messages:');
					messages.slice(-3).forEach((msg, i) => {
						console.log(
							`  [${i + 1}] ${msg.author} (profile=${msg.isFromProfile}, man=${msg.isFromMan}): ${msg.text.substring(0, 40)}...`,
						);
					});

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

	messages.forEach(msg => {
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
const shouldReplyToChat = lastMessage => {
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
 * @param {string} messageType - Тип сообщения (text, wink, video, image, emoji, gift)
 * @returns {string} - Дополнительные инструкции для AI
 */
const getAIInstructionsForMessageType = messageType => {
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

		case 'gift':
			return `
Note: Man sent you a virtual gift! This is a very special gesture that shows his affection and interest.
React warmly and genuinely - thank him sweetly and show your appreciation! 
This is a romantic moment, so respond with warmth, gratitude, and maybe a little flirtiness.
Make him feel good about his gesture!`;

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
