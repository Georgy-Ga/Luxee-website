// AI Auto Response - Chat Processor
// Обработка одного чата: навигация, извлечение истории, генерация, отправка

import aiResponseService from '../aiResponseService.js';
import chatMessagesExtractorService from '../luxeeApi/chatMessagesExtractorService.js';
import messageSendService from '../luxeeApi/messageSendService.js';
import chatValidator from './chatValidator.js';
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
 * @returns {Promise<Object>} - { sent: boolean, reason: string }
 */
const processSingleChat = async ({
	accountId,
	userId,
	page,
	profile,
	chat,
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

		utils.log('Chat Processor', `🌐 Navigating to: ${url}`);
		console.log('[🔧 PROCESSOR] Navigation URL:', url);

		try {
			await page.goto(url, {
				waitUntil: 'domcontentloaded',
				timeout: 10000,
			});
		} catch (navError) {
			utils.logError(
				'Chat Processor',
				`❌ Navigation error: ${navError.message}`,
			);
			return { sent: false, reason: 'navigation_timeout' };
		}

		await utils.sleep(3000);

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

		// ========== ПРОВЕРКА #1: unAnswered ПОСЛЕ навигации ==========
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

		// ========== ИЗВЛЕЧЬ ИСТОРИЮ (10 сообщений) ==========
		utils.log('Chat Processor', `📜 Extracting history (10 messages)...`);
		const history = await chatMessagesExtractorService.getChatHistory(page, 10);

		if (history.error) {
			utils.logError(
				'Chat Processor',
				`❌ Failed to extract history: ${history.error}`,
			);
			return { sent: false, reason: 'history_extraction_failed' };
		}

		utils.log(
			'Chat Processor',
			`✅ Extracted ${history.messages.length} messages`,
		);

		// Проверка последнего сообщения
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

		console.log('[🔧 PROCESSOR] ✅ Will generate AI response');

		// Форматирование истории для AI
		const formattedHistory = chatMessagesExtractorService.formatHistoryForAI(
			history.messages,
			profile.username,
			history.manName,
		);

		const typeInstructions =
			chatMessagesExtractorService.getAIInstructionsForMessageType(
				history.lastMessage.messageType,
			);

		utils.log(
			'Chat Processor',
			`🤖 Generating response (type: ${history.lastMessage.messageType})...`,
		);

		// ========== ГЕНЕРАЦИЯ И ОТПРАВКА ОТВЕТА ==========
		utils.log('Chat Processor', `🤖 Generating and sending AI response...`);
		
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
			manMessage: history.lastMessage.text,
			formattedHistory: formattedHistory,
			profileName: profile.username,
			manName: history.manName,
			typeInstructions: typeInstructions,
			messageType: history.lastMessage.messageType,
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
			console.log('[🔧 PROCESSOR] ❌ GENERATION FAILED - Full response:', aiResponse);
			return { sent: false, reason: 'generation_failed' };
		}
		utils.log('Chat Processor', `   ✓ Generation: SUCCESS`);

		if (!aiResponse.sendResult || !aiResponse.sendResult.success) {
			utils.logError('Chat Processor', `❌ Message sending failed`);
			console.log('[🔧 PROCESSOR] ❌ SEND FAILED - sendResult:', aiResponse.sendResult);
			return { sent: false, reason: 'send_failed' };
		}
		utils.log('Chat Processor', `   ✓ Sending: SUCCESS`);

		// Извлекаем сгенерированный текст из правильного места
		const generatedText = aiResponse.generatedResponse?.response || 'N/A';
		const sendTime = new Date(aiResponse.sendResult.timestamp).toLocaleTimeString();
		
		utils.log(
			'Chat Processor',
			`✅ Generated and sent: "${generatedText.substring(0, 50)}..."`,
		);
		utils.log('Chat Processor', `✅ Message delivered at ${sendTime}`);
		
		console.log('[🔧 PROCESSOR] ✅ MESSAGE SENT SUCCESSFULLY');
		console.log('[🔧 PROCESSOR] Generated text:', generatedText.substring(0, 100));
		console.log('[🔧 PROCESSOR] Send timestamp:', aiResponse.sendResult.timestamp);

		// ✅ Сообщение УЖЕ отправлено - возвращаем успех
		const elapsed = Date.now() - startTime;
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
