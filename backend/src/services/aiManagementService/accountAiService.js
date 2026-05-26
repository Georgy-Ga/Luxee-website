// Сервис управления AI для аккаунтов

import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import aiBrowserContextService from '../browser/aiBrowserContextService.js';

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
		const account = await LuxeeAccountModel.findByIdAndUpdate(
			accountId,
			{ aiEnabledByAdmin: enabled },
			{ new: true },
		).select('luxeeEmail aiEnabled aiEnabledByAdmin');

		if (!account) {
			throw new Error('Account not found');
		}

		console.log(
			'[AI Management Service] Admin set AI for account:',
			accountId,
			'Enabled:',
			enabled,
		);

		if (enabled) {
			// Создаём AI контекст сразу при включении
			try {
				await aiBrowserContextService.getOrCreateAiContext(accountId);
				console.log('[AI Management Service] AI context created for account:', accountId);
			} catch (error) {
				console.error('[AI Management Service] Failed to create AI context:', error);
			}
		} else {
			// Закрываем AI контекст при выключении
			await aiBrowserContextService.closeAiContext(accountId);
		}

		return account;
	} catch (error) {
		console.error('[AI Management Service] Error setting account AI by admin:', error);
		throw error;
	}
};

export const toggleAccountAi = async (userId, accountId) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw new Error('Account not found');
		}

		if (!account.aiEnabledByAdmin && !account.aiEnabled) {
			throw new Error('AI disabled by admin. Cannot enable.');
		}

		account.aiEnabled = !account.aiEnabled;
		await account.save();

		console.log(
			'[AI Management Service] User toggled AI for account:',
			accountId,
			'New state:',
			account.aiEnabled,
		);

		if (!account.aiEnabled) {
			await aiBrowserContextService.closeAiContext(accountId);
		}

		return account;
	} catch (error) {
		console.error('[AI Management Service] Error toggling account AI:', error);
		throw error;
	}
};

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
