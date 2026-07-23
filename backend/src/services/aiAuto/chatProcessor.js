// AI Auto Response - Chat Processor
// Обработка одного чата: навигация, извлечение истории, генерация, отправка

import aiResponseService from '../aiResponseService.js';
import chatMessagesExtractorService from '../luxeeApi/chatMessagesExtractorService.js';
import profileScanner from './profileScanner.js';
import utils from './utils.js';

/**
 * Обработать один чат
 * @param {Object} params - Параметры
 * @param {string} params.accountId - ID аккаунта
 * @param {string} params.userId - ID пользователя
 * @param {Object} params.page - Playwright page
 * @param {Object} params.profile - Данные профиля
 * @param {Object} params.chat - Данные чата
 * @param {boolean} params.isCatchUp - Флаг что чат из Catch Up (опционально)
 * @returns {Promise<Object>} - { sent: boolean, reason: string }
 */
const processSingleChat = async ({
	accountId,
	userId,
	page,
	profile,
	chat,
	isCatchUp = false,
}) => {
	const startTime = Date.now();

	utils.log('Chat Processor', `📝 Processing chat ${chat.chatId}...`);
	utils.log(
		'Chat Processor',
		`Profile: ${profile.username}, Man: ${chat.manName}`,
	);

	console.log('[🔧 PROCESSOR] ========== PROCESSING CHAT ==========');
	console.log('[🔧 PROCESSOR] Chat:', {
		chatId: chat.chatId,
		manName: chat.manName,
		manUid: chat.manUid,
		lastActivity: chat.lastActivity,
	});
	console.log('[🔧 PROCESSOR] Profile:', {
		uid: profile.uid,
		username: profile.username,
		allUids: profile.allUids,
	});

	try {
		// ========== НАВИГАЦИЯ К ЧАТУ ==========
		const [profileUidOuter, userUid] = chat.chatId.split('_');
		const url = `https://luxee.io/chats/?ownerUid=${profile.uid}&profileUid=${profileUidOuter}&userUid=${userUid}`;

		console.log('[🚦 CHAT PROCESSOR] ========================================');
		console.log('[🚦 CHAT PROCESSOR] 🌐 NAVIGATION START');
		console.log('[🚦 CHAT PROCESSOR] From URL:', page.url());
		console.log('[🚦 CHAT PROCESSOR] To URL:', url);
		console.log('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		console.log('[🚦 CHAT PROCESSOR] Profile:', profile.username, `(${profile.uid})`);
		console.log('[🚦 CHAT PROCESSOR] Man:', chat.manName);
		console.log('[🚦 CHAT PROCESSOR] isCatchUp:', isCatchUp);
		console.log('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());

		utils.log('Chat Processor', `🌐 Navigating to: ${url}`);
		console.log('[🔧 PROCESSOR] Navigation URL:', url);

		try {
			console.log('[🚦 CHAT PROCESSOR] ⏳ Executing page.goto()...');
			await page.goto(url, {
				waitUntil: 'domcontentloaded',
				timeout: 10000,
			});
			console.log('[🚦 CHAT PROCESSOR] ✅ page.goto() completed');
		} catch (navError) {
			console.log('[🚦 CHAT PROCESSOR] ❌ page.goto() FAILED:', navError.message);
			utils.logError(
				'Chat Processor',
				`❌ Navigation error: ${navError.message}`,
			);
			return { sent: false, reason: 'navigation_timeout' };
		}

		console.log('[🚦 CHAT PROCESSOR] ⏳ Sleeping 3 seconds...');
		await utils.sleep(3000);
		console.log('[🚦 CHAT PROCESSOR] ✅ Sleep completed');
		console.log('[🚦 CHAT PROCESSOR] Current URL after navigation:', page.url());

		// Проверка успешности навигации
		const activeChatId = await page.evaluate(() => {
			return window.modelsChat?.getChats?.active?.identity;
		});

		if (activeChatId !== chat.chatId) {
			utils.logError(
				'Chat Processor',
				`❌ Navigation failed: expected ${chat.chatId}, got ${activeChatId}`,
			);
			return { sent: false, reason: 'navigation_failed' };
		}

		utils.log('Chat Processor', `✅ Navigated successfully`);

		// ========== ПРОВЕРКА unAnswered (ТОЛЬКО ДЛЯ ОБЫЧНЫХ ЧАТОВ!) ==========
		if (!isCatchUp) {
			// 📋 ОБЫЧНЫЕ ЧАТЫ: проверяем unAnswered
			utils.log('Chat Processor', `🔍 Checking unAnswered status...`);
			const unAnsweredCheck = await profileScanner.checkActiveChatUnAnswered(
				page,
				chat.chatId,
			);

			if (unAnsweredCheck.error) {
				utils.logError(
					'Chat Processor',
					`❌ unAnswered check failed: ${unAnsweredCheck.error}`,
				);
				return { sent: false, reason: 'unanswered_check_failed' };
			}

			if (!unAnsweredCheck.isUnAnswered) {
				utils.log(
					'Chat Processor',
					`⏭️  Chat already answered (unAnswered = false) - skipping`,
				);
				return { sent: false, reason: 'already_answered' };
			}

			utils.log('Chat Processor', `✅ unAnswered = true, proceeding...`);
		} else {
			// 🔥 CATCH UP: НЕ проверяем unAnswered - пишем в любом случае!
			utils.log(
				'Chat Processor',
				`🎯 Catch Up mode: skipping unAnswered check`,
			);
		}

	// ========== ИЗВЛЕЧЬ ИСТОРИЮ С RETRY (3 попытки) ==========
	let history = null;
	let retryCount = 0;
	const maxRetries = 3;

	while (retryCount < maxRetries && !history) {
		utils.log(
			'Chat Processor',
			`📜 Extracting history (attempt ${retryCount + 1}/${maxRetries})...`,
		);

		const result = await chatMessagesExtractorService.getChatHistory(page, 10);

		if (!result.error) {
			history = result;
			utils.log(
				'Chat Processor',
				`✅ Extracted ${history.messages.length} messages`,
			);
			break;
		}

		retryCount++;
		if (retryCount < maxRetries) {
			utils.log('Chat Processor', `⏳ Retry in 2 seconds...`);
			await utils.sleep(2000);
		} else {
			utils.logError(
				'Chat Processor',
				`❌ Failed to extract history after ${maxRetries} attempts: ${result.error}`,
			);
		}
	}

	// ========== FALLBACK ДЛЯ CATCH UP: ПЕРВОЕ СООБЩЕНИЕ ==========
	if (!history && isCatchUp) {
		utils.log(
			'Chat Processor',
			'🎯 Catch Up: No history found, will send FIRST MESSAGE...',
		);

		// Создаём минимальную "историю" для первого сообщения
		history = {
			messages: [],
			lastMessage: null,
			formattedHistory: '',
		};

		utils.log('Chat Processor', '💬 Using first message mode for Catch Up');
	}

	// ========== ОБЫЧНЫЕ ЧАТЫ: ПРОПУСКАЕМ ЕСЛИ НЕТ ИСТОРИИ ==========
	if (!history) {
		utils.logError(
			'Chat Processor',
			`❌ Failed to extract history after ${maxRetries} attempts`,
		);
		return { sent: false, reason: 'history_extraction_failed' };
	}

	// ========== ОПРЕДЕЛЯЕМ ТИП ПРОМТА ==========
	let typeInstructions = '';

	if (isCatchUp) {
		// 🔥 CATCH UP ЛОГИКА
		utils.log('Chat Processor', '🎯 Processing Catch Up chat...');

		// ✅ ПРОВЕРКА: есть ли история?
		if (!history.lastMessage) {
			// 📭 НЕТ ИСТОРИИ → ПЕРВОЕ СООБЩЕНИЕ
			typeInstructions = `This is a FIRST MESSAGE to start a conversation. Write a short, friendly, and natural greeting that shows interest in getting to know him. Keep it simple, warm, and inviting (1-2 sentences max). Don't ask too many questions at once.`;
			utils.log('Chat Processor', '💬 Catch Up: FIRST MESSAGE (no history)');
		} else {
			// 📬 ЕСТЬ ИСТОРИЯ → СТАНДАРТНЫЙ ПРОМТ
			typeInstructions =
				chatMessagesExtractorService.getAIInstructionsForMessageType(
					history.lastMessage.messageType,
				);

			// Если последнее от девушки → добавляем короткую подсказку
			if (history.lastMessage.isFromProfile) {
				typeInstructions += `\n\nNOTE: The man saw your last message but didn't reply. Re-engage him with a fresh question based on chat history.`;
				utils.log(
					'Chat Processor',
					'💬 Catch Up: last from profile, added re-engagement note',
				);
			} else {
				utils.log(
					'Chat Processor',
					'📬 Catch Up: last from man, standard reply',
				);
			}
		}
	} else {
			// 📋 ОБЫЧНЫЙ ЧАТ: проверяем shouldReply
			const shouldReply = chatMessagesExtractorService.shouldReplyToChat(
				history.lastMessage,
			);

			console.log('[🔧 PROCESSOR] Should reply check:', {
				shouldReply: shouldReply.shouldReply,
				reason: shouldReply.reason,
				lastMessageAuthor: history.lastMessage?.author,
				lastMessageIsFromProfile: history.lastMessage?.isFromProfile,
				lastMessageIsFromMan: history.lastMessage?.isFromMan,
			});

			if (!shouldReply.shouldReply) {
				utils.log('Chat Processor', `⏭️  ${shouldReply.reason}`);
				console.log('[🔧 PROCESSOR] ❌ SKIPPING CHAT:', shouldReply.reason);
				return { sent: false, reason: 'shouldnt_reply' };
			}

			typeInstructions =
				chatMessagesExtractorService.getAIInstructionsForMessageType(
					history.lastMessage.messageType,
				);
		}

		console.log('[🔧 PROCESSOR] ✅ Will generate AI response');

		// Форматирование истории для AI
		const formattedHistory = chatMessagesExtractorService.formatHistoryForAI(
			history.messages,
			profile.username,
			history.manName,
		);

		// 📊 ЛОГИРОВАНИЕ ПРОМТА
		utils.log(
			'Chat Processor',
			`📋 Type instructions length: ${typeInstructions.length} chars`,
		);
		if (typeInstructions) {
			const preview = typeInstructions.substring(0, 100).replace(/\n/g, ' ');
			utils.log(
				'Chat Processor',
				`📄 Type instructions preview: ${preview}...`,
			);
		} else {
			utils.log('Chat Processor', `⚠️  NO type instructions provided!`);
		}

		const messageType = history.lastMessage?.messageType || 'text';
		utils.log(
			'Chat Processor',
			`🤖 Generating response (type: ${messageType})...`,
		);

	// ========== АДАПТИВНАЯ ЗАДЕРЖКА НА "ПЕЧАТАНИЕ" ==========
	const MIN_DELAY = 7000;  // 7 секунд
	const MAX_DELAY = 13000; // 13 секунд
	const MIN_REALISTIC_TIME = 25000; // 25 секунд - минимальное реалистичное время ответа
	const URGENT_THRESHOLD = 45000;   // 45 секунд - порог "срочности" (было 50000)
	const MIN_TECHNICAL_DELAY = 500;  // 0.5 секунды - технический минимум

	console.log('[🚦 CHAT PROCESSOR] ========================================');
	console.log('[🚦 CHAT PROCESSOR] ⏱️  ADAPTIVE TYPING DELAY START');
	
	let typingDelay;
	
	// АДАПТИВНАЯ ЗАДЕРЖКА ТОЛЬКО ДЛЯ ОБЫЧНЫХ ЧАТОВ (НЕ CATCH UP)
	if (!isCatchUp) {
		// ✅ ПЕРЕСЧИТЫВАЕМ elapsed ЗДЕСЬ (после всех проверок/навигации)
		// Это даёт более точное время, учитывая overhead на обработку
		const elapsed = Date.now() - chat.lastActivity;
			const targetDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
			const calculatedDelay = targetDelay - elapsed;
			
			// Проверяем минимальное реалистичное время (25 секунд)
			const projectedResponseTime = elapsed + Math.max(0, calculatedDelay);
			
		if (elapsed >= URGENT_THRESHOLD) {
			// СРОЧНО: Сообщение висит 45+ секунд - отвечаем максимально быстро
			typingDelay = MIN_TECHNICAL_DELAY;
			console.log('[🚦 ADAPTIVE DELAY] ⚠️  URGENT MODE: Message is 45+ seconds old');
			} else if (projectedResponseTime < MIN_REALISTIC_TIME) {
				// Если ответим слишком быстро - ждём до 25 секунд
				const additionalWait = MIN_REALISTIC_TIME - elapsed;
				typingDelay = Math.max(MIN_TECHNICAL_DELAY, additionalWait);
				console.log('[🚦 ADAPTIVE DELAY] ⏱️  Extending delay to meet 25s minimum');
			} else {
				// Используем вычисленную задержку
				typingDelay = Math.max(MIN_TECHNICAL_DELAY, calculatedDelay);
			}
			
			console.log(`[🚦 ADAPTIVE DELAY] Message age: ${Math.round(elapsed / 1000)}s`);
			console.log(`[🚦 ADAPTIVE DELAY] Target delay range: ${MIN_DELAY / 1000}-${MAX_DELAY / 1000}s`);
			console.log(`[🚦 ADAPTIVE DELAY] Random target: ${Math.round(targetDelay / 1000)}s`);
			console.log(`[🚦 ADAPTIVE DELAY] Calculated delay: ${Math.round(calculatedDelay / 1000)}s`);
			console.log(`[🚦 ADAPTIVE DELAY] Actual delay: ${Math.round(typingDelay / 1000)}s`);
			console.log(`[🚦 ADAPTIVE DELAY] Projected response time: ${Math.round((elapsed + typingDelay) / 1000)}s from message`);
			
			utils.log(
				'Chat Processor',
				`⏱️  Adaptive typing delay: ${Math.round(typingDelay / 1000)}s (message age: ${Math.round(elapsed / 1000)}s)`,
			);
		} else {
			// CATCH UP: обычная случайная задержка (БЕЗ адаптивной логики)
			typingDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
			
			console.log('[🚦 CATCH UP DELAY] Using standard random delay');
			console.log(`[🚦 CATCH UP DELAY] Range: ${MIN_DELAY / 1000}-${MAX_DELAY / 1000}s`);
			console.log(`[🚦 CATCH UP DELAY] Actual delay: ${Math.round(typingDelay / 1000)}s`);
			
			utils.log(
				'Chat Processor',
				`⏱️  Catch Up typing delay: ${Math.round(typingDelay / 1000)}s`,
			);
		}
		
		console.log(`[🚦 CHAT PROCESSOR] 💭 TYPING DELAY: ${Math.round(typingDelay / 1000)} seconds`);
		await utils.sleep(typingDelay);
		console.log('[🚦 CHAT PROCESSOR] ✅ Typing delay completed');

		// ========== ГЕНЕРАЦИЯ И ОТПРАВКА ОТВЕТА ==========
		console.log('[🚦 CHAT PROCESSOR] ========================================');
		console.log('[🚦 CHAT PROCESSOR] 🤖 AI GENERATION & SEND START');
		console.log('[🚦 CHAT PROCESSOR] Current URL:', page.url());
		console.log('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		console.log('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());
		
		utils.log('Chat Processor', `🤖 Generating and sending AI response...`);

		console.log('[🚦 CHAT PROCESSOR] ⏳ Calling aiResponseService.generateAndSend()...');
		const aiResponse = await aiResponseService.generateAndSend({
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
			manMessage: history.lastMessage?.text || '',
			formattedHistory: formattedHistory,
			profileName: profile.username,
			manName: chat.manName || history.manName || 'there',
			typeInstructions: typeInstructions,
			messageType: messageType,
			// skipSending убран - функция всегда генерирует И отправляет
		});

		// ========== ПРОВЕРКА РЕЗУЛЬТАТА ==========
		console.log('[🔧 PROCESSOR] ========== AI RESPONSE RESULT ==========');
		console.log('[🔧 PROCESSOR] Response structure:', {
			hasResponse: !!aiResponse,
			success: aiResponse?.success,
			hasGeneratedResponse: !!aiResponse?.generatedResponse,
			generatedText: aiResponse?.generatedResponse?.response?.substring(0, 50),
			hasSendResult: !!aiResponse?.sendResult,
			sendSuccess: aiResponse?.sendResult?.success,
			sendTimestamp: aiResponse?.sendResult?.timestamp,
		});

		utils.log('Chat Processor', `🔍 Checking AI response result...`);

		// ✅ ИСПРАВЛЕНО: Проверяем ПРАВИЛЬНЫЕ поля
		if (!aiResponse || !aiResponse.success) {
			utils.logError('Chat Processor', `❌ AI generation failed`);
			console.log(
				'[🔧 PROCESSOR] ❌ GENERATION FAILED - Full response:',
				aiResponse,
			);
			return { sent: false, reason: 'generation_failed' };
		}
		utils.log('Chat Processor', `   ✓ Generation: SUCCESS`);

		if (!aiResponse.sendResult || !aiResponse.sendResult.success) {
			utils.logError('Chat Processor', `❌ Message sending failed`);
			console.log(
				'[🔧 PROCESSOR] ❌ SEND FAILED - sendResult:',
				aiResponse.sendResult,
			);
			return { sent: false, reason: 'send_failed' };
		}
		utils.log('Chat Processor', `   ✓ Sending: SUCCESS`);

		// Извлекаем сгенерированный текст из правильного места
		const generatedText = aiResponse.generatedResponse?.response || 'N/A';
		const sendTime = new Date(
			aiResponse.sendResult.timestamp,
		).toLocaleTimeString();

		utils.log(
			'Chat Processor',
			`✅ Generated and sent: "${generatedText.substring(0, 50)}..."`,
		);
		utils.log('Chat Processor', `✅ Message delivered at ${sendTime}`);

		console.log('[🔧 PROCESSOR] ✅ MESSAGE SENT SUCCESSFULLY');
		console.log(
			'[🔧 PROCESSOR] Generated text:',
			generatedText.substring(0, 100),
		);
		console.log(
			'[🔧 PROCESSOR] Send timestamp:',
			aiResponse.sendResult.timestamp,
		);

		// ✅ Сообщение УЖЕ отправлено - возвращаем успех
		const elapsed = Date.now() - startTime;
		
		console.log('[🚦 CHAT PROCESSOR] ========================================');
		console.log('[🚦 CHAT PROCESSOR] ✅ MESSAGE SENT SUCCESSFULLY');
		console.log('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		console.log('[🚦 CHAT PROCESSOR] Man:', chat.manName);
		console.log('[🚦 CHAT PROCESSOR] Profile:', profile.username);
		console.log('[🚦 CHAT PROCESSOR] Duration:', Math.round(elapsed / 1000), 'seconds');
		console.log('[🚦 CHAT PROCESSOR] Current URL after send:', page.url());
		console.log('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());
		console.log('[🚦 CHAT PROCESSOR] ========================================');
		
		utils.log(
			'Chat Processor',
			`✅ Successfully processed chat with ${chat.manName} (${Math.round(elapsed / 1000)}s)`,
		);

		return {
			sent: true,
			chatId: chat.chatId,
			profileUid: profile.uid,
			manName: chat.manName,
			generatedText: generatedText.substring(0, 100),
			timestamp: aiResponse.sendResult.timestamp,
		};
	} catch (error) {
		utils.logError('Chat Processor', `❌ Unexpected error:`, error);
		return {
			sent: false,
			reason: 'exception',
			error: error.message,
		};
	}
};

export default {
	processSingleChat,
};
