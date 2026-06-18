// Модуль для проверки сообщений на всех аккаунтах
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
import profileActivationService from '../profileActivationService.js';
import { extractAllProfilesData } from './profileDataExtractor.js';

/**
 * Проверить сообщения на всех аккаунтах пользователя
 */
export const checkAllMessages = async ({ userId }) => {
	try {
		console.log(`[Message Check] Checking messages for user ${userId}`);

		// Получаем все аккаунты пользователя
		const accounts = await LuxeeAccountModel.find({ user: userId });

		if (accounts.length === 0) {
			return {
				accounts: [],
				totalUnread: 0,
				totalProfiles: 0,
			};
		}

		const results = [];
		let totalUnread = 0;
		let totalProfiles = 0;

		// Проверяем каждый аккаунт
		for (const account of accounts) {
			try {
				const accountId = account._id.toString();

				// Получаем контекст
				const context = browserService.getContext(accountId);

				if (!context) {
					console.log(`[Message Check] No context for account ${account.luxeeEmail}`);
					results.push({
						accountId: account._id,
						accountEmail: account.luxeeEmail,
						error: 'Context not found',
						profiles: [],
						totalUnread: 0,
						profilesCount: 0,
					});
					continue;
				}

				// Получаем страницу
				const page = await pageHelpers.getOrCreatePage(context);

				// ✅ АКТИВИРУЕМ ПЕРВЫЙ ПРОФИЛЬ (если ещё не активирован)
				await profileActivationService.activateFirstProfile({ page });

				// ✅ ЧИТАЕМ API БЕЗ ПЕРЕКЛЮЧЕНИЯ ПРОФИЛЕЙ
				const result = await page.evaluate(extractAllProfilesData);
				const profilesData = result.profiles;

				// Подсчитываем статистику
				const accountUnread = profilesData.reduce(
					(sum, p) => sum + p.newMessages,
					0,
				);
				
				const accountUnanswered = profilesData.reduce(
					(sum, p) => sum + p.unansweredMessages,
					0,
				);

				totalUnread += accountUnread;
				totalProfiles += profilesData.length;

				results.push({
					accountId: account._id,
					accountEmail: account.luxeeEmail,
					profiles: profilesData,
					totalUnread: accountUnread,
					profilesCount: profilesData.length,
				});

				console.log(
					`[Message Check] Account ${account.luxeeEmail}: ${profilesData.length} profiles, ${accountUnread} unread, ${accountUnanswered} unanswered`,
				);
			} catch (error) {
				console.error(
					`[Message Check] Error checking account ${account._id}:`,
					error.message,
				);
				results.push({
					accountId: account._id,
					accountEmail: account.luxeeEmail,
					error: error.message,
					profiles: [],
					totalUnread: 0,
					profilesCount: 0,
				});
			}
		}

		console.log(
			`[Message Check] Total: ${totalProfiles} profiles, ${totalUnread} unread messages`,
		);

		return {
			accounts: results,
			totalUnread,
			totalProfiles,
		};
	} catch (error) {
		console.error('[Message Check] Error:', error);
		throw error;
	}
};
