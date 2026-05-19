// Модуль для проверки сообщений на конкретном аккаунте
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
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

		const accountUnread = profilesData.reduce((sum, p) => sum + p.newMessages, 0);

		console.log(
			`[Message Check] Account ${account.luxeeEmail}: ${profilesData.length} profiles, ${accountUnread} unread`,
		);

		return {
			accountId: account._id,
			accountEmail: account.luxeeEmail,
			profiles: profilesData,
			totalUnread: accountUnread,
			profilesCount: profilesData.length,
		};
	} catch (error) {
		console.error('[Message Check] Error:', error);
		throw error;
	}
};
