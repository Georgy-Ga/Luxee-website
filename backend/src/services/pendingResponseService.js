// Pending Response Service
// Система отложенных AI ответов с возможностью отмены
// Реализует 30-секундную задержку перед отправкой ответа

import aiManagementService from './aiManagementService/index.js';
import aiResponseService from './aiResponseService.js';
import answeredChatService from './answeredChatService.js';

// Хранилище отложенных ответов
// chatId -> { accountId, userId, profileUid, chatId, chat, profile, timeoutId, createdAt }
const pendingResponses = new Map();

const pendingResponseService = {
	/**
	 * Создать отложенный ответ
	 * @param {Object} params - Параметры ответа
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {string} params.userId - ID пользователя
	 * @param {number} params.profileUid - UID профиля
	 * @param {string} params.chatId - ID чата
	 * @param {Object} params.chat - Данные чата
	 * @param {Object} params.profile - Данные профиля
	 * @param {number} delay - Задержка в миллисекундах (по умолчанию 30 секунд)
	 * @returns {Promise<Object>} - { scheduled: boolean, delay?: number, reason?: string }
	 */
	schedule: async ({ accountId, userId, profileUid, chatId, chat, profile }, delay = 30000) => {
		try {
			// ✅ FIX: Приводим ID к string для консистентности
			const accountIdStr = accountId.toString();
			const userIdStr = userId.toString();

			// 1. Проверяем что этот чат уже не в очереди
			if (pendingResponses.has(chatId)) {
				console.log(`[Pending Response] Chat ${chatId} already in queue, skipping`);
				return { scheduled: false, reason: 'Already pending' };
			}

			// 2. Проверяем что не отвечали уже на этот чат
			const answeredChats = await answeredChatService.getAnsweredChats({
				accountId,
				profileUid,
			});

			const isAlreadyAnswered = answeredChats.some((ac) => ac.chatId === chatId);

			if (isAlreadyAnswered) {
				console.log(`[Pending Response] Chat ${chatId} already answered, skipping`);
				return { scheduled: false, reason: 'Already answered' };
			}

			// 3. Создаём таймер на заданную задержку
			const timeoutId = setTimeout(async () => {
				await pendingResponseService.execute(chatId);
			}, delay);

			// 4. Сохраняем в Map (используем string ID)
			pendingResponses.set(chatId, {
				accountId: accountIdStr,
				userId: userIdStr,
				profileUid,
				chatId,
				chat,
				profile,
				timeoutId,
				createdAt: Date.now(),
				delay,
			});

			console.log(
				`[Pending Response] ⏰ Scheduled for chat ${chatId} (${chat.memberUsername}) in ${delay / 1000}s`,
			);

			return { scheduled: true, delay };
		} catch (error) {
			console.error('[Pending Response] Error scheduling response:', error);
			return { scheduled: false, reason: error.message };
		}
	},

	/**
	 * Выполнить отложенный ответ
	 * @param {string} chatId - ID чата
	 * @returns {Promise<Object|null>} - Результат выполнения или null
	 */
	execute: async (chatId) => {
		const pending = pendingResponses.get(chatId);
		if (!pending) {
			console.log(`[Pending Response] Chat ${chatId} not found in queue`);
			return null;
		}

		try {
			console.log(`[Pending Response] 🚀 Executing response for chat ${chatId}...`);

			// 1. ✅ КРИТИЧНО: Проверяем AI статус ПЕРЕД генерацией
			const canUse = await aiManagementService.canAccountUseAi(
				pending.userId,
				pending.accountId,
			);

			if (!canUse) {
				console.log(
					`[Pending Response] ❌ AI disabled for account, cancelling response for ${chatId}`,
				);
				pendingResponses.delete(chatId);
				return { success: false, cancelled: true, reason: 'AI disabled' };
			}

			// 2. Проверяем что не отвечали уже на этот чат (double-check)
			const answeredChats = await answeredChatService.getAnsweredChats({
				accountId: pending.accountId,
				profileUid: pending.profileUid,
			});

			const isAlreadyAnswered = answeredChats.some((ac) => ac.chatId === chatId);

			if (isAlreadyAnswered) {
				console.log(`[Pending Response] ❌ Chat ${chatId} already answered, skipping`);
				pendingResponses.delete(chatId);
				return { success: false, cancelled: true, reason: 'Already answered' };
			}

			// ✅ 3. ФИНАЛЬНАЯ проверка перед отправкой (защита от дублирования с оператором)
			console.log(`[Pending Response] 🔍 Final check before sending to ${chatId}...`);

			// Небольшая задержка для синхронизации с MongoDB (если оператор только что ответил)
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Финальная проверка answered чатов
			try {
				const finalAnsweredChats = await answeredChatService.getAnsweredChats({
					accountId: pending.accountId,
					profileUid: pending.profileUid,
				});

				const isFinallyAnswered = finalAnsweredChats.some((ac) => ac.chatId === chatId);

				if (isFinallyAnswered) {
					console.log(
						`[Pending Response] ✋ FINAL CHECK: Chat ${chatId} answered by operator, aborting AI`,
					);
					pendingResponses.delete(chatId);
					return {
						success: false,
						cancelled: true,
						reason: 'Answered by operator (final check)',
					};
				}

				console.log(`[Pending Response] ✅ Final check passed for ${chatId}`);
			} catch (finalCheckError) {
				// При ошибке финальной проверки - ОТМЕНЯЕМ ответ (безопаснее)
				console.error(
					`[Pending Response] ❌ Final check error for ${chatId}, aborting:`,
					finalCheckError,
				);
				pendingResponses.delete(chatId);
				return {
					success: false,
					cancelled: true,
					reason: 'Final check error (safety abort)',
				};
			}

			console.log(
				`[Pending Response] ✅ All checks passed, generating and sending response for ${chatId}...`,
			);

			// 4. Генерация и отправка (используем существующую логику с retry)
			const result = await aiResponseService.generateAndSend({
				userId: pending.userId,
				accountId: pending.accountId,
				profileUid: pending.profileUid,
				chatId: pending.chatId,
				profile: pending.profile,
				manMessage: pending.chat.lastManMessage.body,
				messageType: 1,
				conversationHistory: [],
			});

			if (result.success) {
				console.log(
					`[Pending Response] ✅ Successfully sent AI response to ${pending.chat.memberUsername}`,
				);
			} else {
				console.log(
					`[Pending Response] ✗ Failed to send: ${result.reason || 'Unknown error'}`,
				);
			}

			// 5. Удаляем из очереди
			pendingResponses.delete(chatId);

			return result;
		} catch (error) {
			console.error(`[Pending Response] ❌ Error executing response for ${chatId}:`, error);
			pendingResponses.delete(chatId);
			return { success: false, error: error.message };
		}
	},

	/**
	 * Отменить отложенный ответ
	 * @param {string} chatId - ID чата
	 * @returns {boolean} - true если был отменён, false если не найден
	 */
	cancel: (chatId) => {
		const pending = pendingResponses.get(chatId);
		if (pending) {
			clearTimeout(pending.timeoutId);
			pendingResponses.delete(chatId);
			console.log(`[Pending Response] 🚫 Cancelled response for chat ${chatId}`);
			return true;
		}
		return false;
	},

	/**
	 * Отменить ВСЕ отложенные ответы для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {number} - Количество отменённых ответов
	 */
	cancelAllForAccount: (accountId) => {
		// ✅ FIX: Приводим к string для корректного сравнения
		const accountIdStr = accountId.toString();
		let cancelled = 0;
		
		for (const [chatId, pending] of pendingResponses.entries()) {
			if (pending.accountId === accountIdStr) {
				clearTimeout(pending.timeoutId);
				pendingResponses.delete(chatId);
				cancelled++;
			}
		}

		if (cancelled > 0) {
			console.log(
				`[Pending Response] 🚫 Cancelled ${cancelled} pending response(s) for account ${accountIdStr}`,
			);
		}

		return cancelled;
	},

	/**
	 * Получить статус отложенных ответов
	 * @returns {Object} - Статистика и список pending responses
	 */
	getStatus: () => {
		const now = Date.now();
		return {
			total: pendingResponses.size,
			pending: Array.from(pendingResponses.entries()).map(([chatId, data]) => ({
				chatId,
				accountId: data.accountId,
				profileUid: data.profileUid,
				memberUsername: data.chat.memberUsername,
				scheduledAt: data.createdAt,
				scheduledFor: data.createdAt + data.delay,
				remainingMs: Math.max(0, data.createdAt + data.delay - now),
				remainingSec: Math.max(0, Math.round((data.createdAt + data.delay - now) / 1000)),
			})),
		};
	},

	/**
	 * Проверить находится ли чат в очереди
	 * @param {string} chatId - ID чата
	 * @returns {boolean}
	 */
	isPending: (chatId) => {
		return pendingResponses.has(chatId);
	},

	/**
	 * Получить количество pending responses для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {number}
	 */
	getAccountPendingCount: (accountId) => {
		// ✅ FIX: Приводим к string для корректного сравнения
		const accountIdStr = accountId.toString();
		let count = 0;
		for (const pending of pendingResponses.values()) {
			if (pending.accountId === accountIdStr) {
				count++;
			}
		}
		return count;
	},
};

export default pendingResponseService;
