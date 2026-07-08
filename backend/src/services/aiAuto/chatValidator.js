// AI Auto Response - Chat Validator
// Двойная проверка (API + DOM) перед отправкой ответа

/**
 * Проверка через API: modelsChat.getChats.active.unAnswered
 * @param {Object} page - Playwright page
 * @param {string} chatId - ID чата для проверки
 * @param {number} profileUid - UID профиля
 * @returns {Promise<Object>} - { shouldReply, reason, method }
 */
const checkUnAnsweredAPI = async (page, chatId, profileUid) => {
	try {
		const result = await page.evaluate(() => {
			const activeChatId = window.modelsChat?.getChats?.active?.identity;
			const unAnswered = window.modelsChat?.getChats?.active?.unAnswered;

			return {
				activeChatId,
				unAnswered,
			};
		});

		// Проверка что мы в правильном чате
		if (result.activeChatId !== chatId) {
			return {
				shouldReply: false,
				reason: `Wrong chat: expected ${chatId}, got ${result.activeChatId}`,
				method: 'API',
			};
		}

		return {
			shouldReply: result.unAnswered === true,
			reason: result.unAnswered ? 'unAnswered=true' : 'unAnswered=false',
			method: 'API',
			value: result.unAnswered,
		};
	} catch (error) {
		console.error('[Chat Validator] Error checking API:', error);
		return {
			shouldReply: false,
			reason: `API error: ${error.message}`,
			method: 'API',
			error: true,
		};
	}
};

/**
 * Резервная проверка через DOM container
 * Проверяет CSS класс последнего сообщения
 * @param {Object} page - Playwright page
 * @returns {Promise<Object>} - { shouldReply, reason, method }
 */
const checkDOM = async page => {
	try {
		const result = await page.evaluate(() => {
			const container = document.querySelector('#message-main-wrap');
			if (!container) return { error: 'No container' };

			const messages = container.querySelectorAll('.messages');
			if (messages.length === 0) return { error: 'No messages' };

			const lastMsg = messages[messages.length - 1];
			const isFromMan = lastMsg.classList.contains('message-opponent');
			const isFromProfile = lastMsg.classList.contains('message-owner');

			const textEl = lastMsg.querySelector('.chat-full-message');
			const text = textEl ? textEl.textContent?.trim() : '';

			return {
				isFromMan,
				isFromProfile,
				text: text.substring(0, 50), // Первые 50 символов
			};
		});

		if (result.error) {
			return {
				shouldReply: false,
				reason: result.error,
				method: 'DOM',
			};
		}

		return {
			shouldReply: result.isFromMan,
			reason: result.isFromMan
				? 'Last from man (DOM)'
				: 'Last from profile (DOM)',
			method: 'DOM',
			lastMessagePreview: result.text,
		};
	} catch (error) {
		console.error('[Chat Validator] Error checking DOM:', error);
		return {
			shouldReply: false,
			reason: `DOM error: ${error.message}`,
			method: 'DOM',
			error: true,
		};
	}
};

/**
 * Полная проверка с резервным вариантом
 * 1. Проверка API
 * 2. Если failed - wait 2 сек
 * 3. Повторная проверка API
 * 4. Если failed - проверка DOM
 * @param {Object} page - Playwright page
 * @param {string} chatId - ID чата
 * @param {number} profileUid - UID профиля
 * @returns {Promise<Object>} - { shouldReply, reason, checks }
 */
const fullCheck = async (page, chatId, profileUid) => {
	const checks = [];

	// Проверка #1: API
	const check1 = await checkUnAnsweredAPI(page, chatId, profileUid);
	checks.push({ step: 1, ...check1 });

	if (check1.shouldReply) {
		return {
			shouldReply: true,
			reason: 'Check #1 passed (API)',
			checks,
		};
	}

	console.log(`[Chat Validator] ⚠️  Check #1 failed: ${check1.reason}`);
	console.log(`[Chat Validator] Waiting 2 seconds...`);

	// Ждём 2 секунды
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Проверка #2: API (повторная)
	const check2 = await checkUnAnsweredAPI(page, chatId, profileUid);
	checks.push({ step: 2, ...check2 });

	if (check2.shouldReply) {
		return {
			shouldReply: true,
			reason: 'Check #2 passed (API after 2 sec)',
			checks,
		};
	}

	console.log(`[Chat Validator] ⚠️  Check #2 failed: ${check2.reason}`);
	console.log(`[Chat Validator] Trying DOM check (fallback)...`);

	// Проверка #3: DOM (резерв)
	const check3 = await checkDOM(page);
	checks.push({ step: 3, ...check3 });

	if (check3.shouldReply) {
		return {
			shouldReply: true,
			reason: 'Check #3 passed (DOM fallback)',
			checks,
		};
	}

	console.log(`[Chat Validator] ❌ All checks failed`);
	return {
		shouldReply: false,
		reason: 'All checks failed',
		checks,
	};
};

export default {
	checkUnAnsweredAPI,
	checkDOM,
	fullCheck,
};
