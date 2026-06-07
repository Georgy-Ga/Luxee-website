// Сервис управления AI для аккаунтов

import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import aiBrowserContextService from '../browser/aiBrowserContextService.js';
import aiAutoResponseService from '../aiAutoResponseService.js';

export const getAllAccountsAiStatus = async () => {
	try {
		const accounts = await LuxeeAccountModel.find()
			.select('user luxeeEmail aiEnabled aiEnabledByAdmin')
			.populate('user', 'email')
			.sort({ createdAt: 1 });
		return accounts;
	} catch (error) {
		console.error('[AI Management Service] Error getting accounts AI status:', error);
		throw error;
	}
};

export const getUserAccountsAiStatus = async (userId) => {
	try {
		const accounts = await LuxeeAccountModel.find({ user: userId })
			.select('luxeeEmail aiEnabled aiEnabledByAdmin')
			.sort({ createdAt: 1 });
		return accounts;
	} catch (error) {
		console.error('[AI Management Service] Error getting user accounts AI status:', error);
		throw error;
	}
};

export const getAccountAiStatus = async (userId, accountId) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		}).select('luxeeEmail aiEnabled aiEnabledByAdmin');

		if (!account) {
			throw new Error('Account not found');
		}
		return account;
	} catch (error) {
		console.error('[AI Management Service] Error getting account AI status:', error);
		throw error;
	}
};

export const setAccountAiByAdmin = async (accountId, enabled) => {
	try {
		// ВАЖНО: Когда админ разрешает AI, он автоматически включается (aiEnabled = true)
		// Концепция: админ разрешил = сразу включено, пользователь НЕ может сам включить
		const account = await LuxeeAccountModel.findByIdAndUpdate(
			accountId,
			{ 
				aiEnabledByAdmin: enabled,
				aiEnabled: enabled  // Админ контролирует ОБА флага
			},
			{ new: true },
		).select('luxeeEmail aiEnabled aiEnabledByAdmin user');

		if (!account) {
			throw new Error('Account not found');
		}

		console.log(
			`[AI Management Service] Admin set AI for account ${accountId} (${account.luxeeEmail}):`,
			`aiEnabledByAdmin=${enabled}, aiEnabled=${enabled}`
		);

		if (enabled) {
			// Создаём AI контекст и запускаем автоответы при включении
			try {
				console.log(`[AI Management Service] Creating AI context for account ${accountId}...`);
				await aiBrowserContextService.getOrCreateAiContext(accountId);
				console.log(`[AI Management Service] ✓ AI context created for account ${accountId}`);
				
				// Запускаем автоответы
				console.log(`[AI Management Service] Starting auto-response for account ${accountId}...`);
				await aiAutoResponseService.start(accountId);
				console.log(`[AI Management Service] ✓ Auto-response started for account ${accountId}`);
			} catch (error) {
				console.error(`[AI Management Service] ✗ Failed to create AI context or start auto-response for account ${accountId}:`, error);
			}
		} else {
			// Останавливаем автоответы и закрываем AI контекст при выключении
			console.log(`[AI Management Service] Stopping AI for account ${accountId}...`);
			await aiAutoResponseService.stop(accountId);
			console.log(`[AI Management Service] ✓ Auto-response stopped for account ${accountId}`);
			await aiBrowserContextService.closeAiContext(accountId);
			console.log(`[AI Management Service] ✓ AI context closed for account ${accountId}`);
		}

		return account;
	} catch (error) {
		console.error('[AI Management Service] Error setting account AI by admin:', error);
		throw error;
	}
};

// УДАЛЕНО: toggleAccountAi - пользователь НЕ может сам включать/выключать AI
// Только админ контролирует AI через setAccountAiByAdmin
// Концепция: админ разрешил = сразу включено, пользователь не имеет контроля

export const canAccountUseAi = async (userId, accountId) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		}).select('aiEnabled aiEnabledByAdmin');

		if (!account) {
			return false;
		}
		return account.aiEnabledByAdmin && account.aiEnabled;
	} catch (error) {
		console.error('[AI Management Service] Error checking if account can use AI:', error);
		return false;
	}
};

export const enableAccountAi = async (userId, accountId, adminId) => {
	try {
		await setAccountAiByAdmin(accountId, true);
		console.log(`[AI Management Service] Admin ${adminId} enabled AI for account ${accountId}`);
	} catch (error) {
		console.error('[AI Management Service] Error enabling account AI:', error);
		throw error;
	}
};

export const disableAccountAi = async (userId, accountId, adminId) => {
	try {
		await setAccountAiByAdmin(accountId, false);
		console.log(`[AI Management Service] Admin ${adminId} disabled AI for account ${accountId}`);
	} catch (error) {
		console.error('[AI Management Service] Error disabling account AI:', error);
		throw error;
	}
};
