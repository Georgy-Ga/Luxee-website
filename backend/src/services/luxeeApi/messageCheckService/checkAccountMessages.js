// Модуль для проверки сообщений на конкретном аккаунте
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
import answeredChatService from '../../answeredChatService.js';
import { extractAccountProfilesData } from './profileDataExtractor.js';

/**
 * Проверить сообщения на конкретном аккаунте
 */
export const checkAccountMessages = async ({ userId, accountId }) => {
	try {
		console.log(`[Message Check] Checking messages for account ${accountId}`);

		// Проверяем что аккаунт принадлежит пользователю
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw new Error('Account not found');
		}

		// Получаем контекст
		const context = browserService.getContext(accountId);

		if (!context) {
			throw new Error('Context not found. Please login first.');
		}

	// Получаем страницу
	const page = await pageHelpers.getOrCreatePage(context);

	// ✅ ЧИТАЕМ API БЕЗ ПЕРЕКЛЮЧЕНИЯ ПРОФИЛЕЙ
	const profilesData = await page.evaluate(extractAccountProfilesData);

	// ✅ Получаем отвеченные чаты из MongoDB для корректного подсчёта unanswered
	for (const profile of profilesData) {
		// Для активного профиля: unanswered включает новые сообщения
		// Реальные неотвеченные = unanswered - newMessages
		if (profile.isActive) {
			const totalNewMessages = profile.chats.reduce((sum, chat) => sum + (chat.newMessages || 0), 0);
			const rawUnanswered = profile.unansweredMessages || 0;
			
			// Вычитаем новые сообщения из unanswered
			profile.unansweredMessages = Math.max(0, rawUnanswered - totalNewMessages);
			
			console.log(
				`[Message Check] Profile ${profile.profileUid}: raw unanswered=${rawUnanswered}, new=${totalNewMessages}, real unanswered=${profile.unansweredMessages}`
			);
		}

		// Получаем отвеченные чаты для фильтрации
		const answeredChats = await answeredChatService.getAnsweredChats({
			accountId: account._id,
			profileUid: profile.profileUid,
		});

		// Создаём Set с chatId отвеченных чатов для быстрой проверки
		const answeredChatIds = new Set(answeredChats.map(c => c.chatId));

		// Фильтруем чаты, исключая те на которые AI уже ответил
		const filteredChats = [];

		for (const chat of profile.chats) {
			const isAnswered = answeredChatIds.has(chat.chatId);
			
			// Добавляем чат в список только если есть новые сообщения ИЛИ он неотвечен
			if (chat.newMessages > 0 || (chat.unAnswered && !isAnswered)) {
				filteredChats.push(chat);
			}
		}

		profile.chats = filteredChats;
	}

	const accountUnread = profilesData.reduce((sum, p) => sum + p.newMessages, 0);
	const accountUnanswered = profilesData.reduce((sum, p) => sum + p.unansweredMessages, 0);

	console.log(
		`[Message Check] Account ${account.luxeeEmail}: ${profilesData.length} profiles, ${accountUnread} unread, ${accountUnanswered} unanswered`,
	);

	return {
		accountId: account._id,
		accountEmail: account.luxeeEmail,
		profiles: profilesData,
		totalUnread: accountUnread,
		totalUnanswered: accountUnanswered,
		profilesCount: profilesData.length,
	};
	} catch (error) {
		console.error('[Message Check] Error:', error);
		throw error;
	}
};
