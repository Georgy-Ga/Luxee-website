// Сервис управления AI для пользователей

import UserModel from '../../models/UserModel.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import aiBrowserContextService from '../browser/aiBrowserContextService.js';

export const getAllUsersAiStatus = async () => {
	try {
		const users = await UserModel.find()
			.select('email role aiEnabled aiEnabledByAdmin')
			.sort({ createdAt: 1 });
		return users;
	} catch (error) {
		console.error('[AI Management Service] Error getting users AI status:', error);
		throw error;
	}
};

export const getUserAiStatus = async (userId) => {
	try {
		const user = await UserModel.findById(userId).select(
			'email role aiEnabled aiEnabledByAdmin',
		);
		if (!user) {
			throw new Error('User not found');
		}
		return user;
	} catch (error) {
		console.error('[AI Management Service] Error getting user AI status:', error);
		throw error;
	}
};

export const setUserAiByAdmin = async (userId, enabled) => {
	try {
		const user = await UserModel.findByIdAndUpdate(
			userId,
			{ aiEnabledByAdmin: enabled },
			{ new: true },
		).select('email role aiEnabled aiEnabledByAdmin');

		if (!user) {
			throw new Error('User not found');
		}

		console.log(
			'[AI Management Service] Admin set AI for user:',
			userId,
			'Enabled:',
			enabled,
		);

		// Если выключаем AI для пользователя - выключаем на всех его аккаунтах
		if (!enabled) {
			const accounts = await LuxeeAccountModel.find({ user: userId });
			console.log(`[AI Management Service] Disabling AI on ${accounts.length} accounts for user ${userId}`);
			
			for (const account of accounts) {
				// Выключаем AI на аккаунте
				account.aiEnabled = false;
				await account.save();
				
				// Закрываем AI контекст
				try {
					await aiBrowserContextService.closeAiContext(account._id);
				} catch (error) {
					console.error(`[AI Management Service] Failed to close AI context for account ${account._id}:`, error);
				}
			}
		}

		return user;
	} catch (error) {
		console.error('[AI Management Service] Error setting user AI by admin:', error);
		throw error;
	}
};

export const toggleUserAi = async (userId) => {
	try {
		const user = await UserModel.findById(userId);
		if (!user) {
			throw new Error('User not found');
		}

		if (!user.aiEnabledByAdmin && !user.aiEnabled) {
			throw new Error('AI disabled by admin. Cannot enable.');
		}

		user.aiEnabled = !user.aiEnabled;
		await user.save();

		console.log('[AI Management Service] User toggled AI:', userId, 'New state:', user.aiEnabled);
		return user;
	} catch (error) {
		console.error('[AI Management Service] Error toggling user AI:', error);
		throw error;
	}
};

export const canUserUseAi = async (userId) => {
	try {
		const user = await UserModel.findById(userId).select('aiEnabled aiEnabledByAdmin');
		if (!user) {
			return false;
		}
		return user.aiEnabledByAdmin && user.aiEnabled;
	} catch (error) {
		console.error('[AI Management Service] Error checking if user can use AI:', error);
		return false;
	}
};

export const enableUserAi = async (userId, adminId) => {
	try {
		await setUserAiByAdmin(userId, true);
		console.log(`[AI Management Service] Admin ${adminId} enabled AI for user ${userId}`);
	} catch (error) {
		console.error('[AI Management Service] Error enabling user AI:', error);
		throw error;
	}
};

export const disableUserAi = async (userId, adminId) => {
	try {
		await setUserAiByAdmin(userId, false);
		console.log(`[AI Management Service] Admin ${adminId} disabled AI for user ${userId}`);
	} catch (error) {
		console.error('[AI Management Service] Error disabling user AI:', error);
		throw error;
	}
};

export const setAllUserAccountsAiByAdmin = async (userId, enabled, adminId) => {
	try {
		const accounts = await LuxeeAccountModel.find({ user: userId });
		console.log(`[AI Management Service] Admin ${adminId} setting AI to ${enabled} for ${accounts.length} accounts of user ${userId}`);
		
		for (const account of accounts) {
			account.aiEnabledByAdmin = enabled;
			await account.save();
			
			// Если выключаем - закрываем AI контекст
			if (!enabled) {
				try {
					await aiBrowserContextService.closeAiContext(account._id);
				} catch (error) {
					console.error(`[AI Management Service] Failed to close AI context for account ${account._id}:`, error);
				}
			}
		}
		
		return { updated: accounts.length };
	} catch (error) {
		console.error('[AI Management Service] Error setting all user accounts AI by admin:', error);
		throw error;
	}
};
