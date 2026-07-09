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

	try {
		// ========== НАВИГАЦИЯ К ЧАТУ ==========
		const [profileUidOuter, userUid] = chat.chatId.split('_');
		const url = `https://luxee.io/chats/?ownerUid=${profile.uid}&profileUid=${profileUidOuter}&userUid=${userUid}`;

		utils.log('Chat Processor', `🌐 Navigating to: ${url}`);

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

		if (!shouldReply.shouldReply) {
			utils.log('Chat Processor', `⏭️  ${shouldReply.reason}`);
			return { sent: false, reason: 'shouldnt_reply' };
		}

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

		// ========== ГЕНЕРАЦИЯ ОТВЕТА ==========
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
			formattedHistory: formattedHistory, // ← ТОЛЬКО formattedHistory!
			profileName: profile.username,
			manName: history.manName,
			typeInstructions: typeInstructions,
			messageType: history.lastMessage.messageType,
			// НЕ передаём conversationHistory отдельно - это создаёт дубли!
			skipSending: true, // Генерируем, но НЕ отправляем сразу
		});

		if (!aiResponse || !aiResponse.text) {
			utils.logError('Chat Processor', `❌ Failed to generate response`);
			return { sent: false, reason: 'generation_failed' };
		}

		utils.log(
			'Chat Processor',
			`✅ Generated response: "${aiResponse.text.substring(0, 50)}..."`,
		);

		// ========== ПРОВЕРКА #2: Полная проверка перед отправкой ==========
		utils.log(
			'Chat Processor',
			`🔍 Full check before sending (with fallback)...`,
		);
		const fullCheck = await chatValidator.fullCheck(
			page,
			chat.chatId,
			profile.uid,
		);

		if (!fullCheck.shouldReply) {
			utils.log('Chat Processor', `⏭️  ${fullCheck.reason} - skipping send`);
			return { sent: false, reason: fullCheck.reason };
		}

		utils.log('Chat Processor', `✅ All checks passed: ${fullCheck.reason}`);

		// ========== ОТПРАВИТЬ ==========
		utils.log('Chat Processor', `📤 Sending response...`);
		const sendResult = await messageSendService.sendMessage({
			page,
			profileUid: profile.uid,
			chatId: chat.chatId,
			message: aiResponse.text,
		});

		if (sendResult.success) {
			const elapsed = Date.now() - startTime;
			utils.log(
				'Chat Processor',
				`✅ Successfully sent to ${chat.manName} (${Math.round(elapsed / 1000)}s)`,
			);
			return { sent: true };
		} else {
			utils.logError(
				'Chat Processor',
				`❌ Failed to send: ${sendResult.error}`,
			);
			return { sent: false, reason: 'send_failed', error: sendResult.error };
		}
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
