// Сервис управления AI для пользователей

import UserModel from '../../models/UserModel.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import aiBrowserContextService from '../browser/aiBrowserContextService.js';
import aiAutoResponseService from '../aiAutoResponseService.js';
import socketService from '../socketService.js';

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
		// ✅ FIX: Когда админ включает/выключает AI - обновляем ОБА флага
		const user = await UserModel.findByIdAndUpdate(
			userId,
			{ 
				aiEnabledByAdmin: enabled,
				aiEnabled: enabled  // ВАЖНО: оба флага одновременно!
			},
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

export const setUserAiState = async (userId, enabled) => {
	try {
		const user = await UserModel.findById(userId);
		if (!user) {
			throw new Error('User not found');
		}

		// Если пытаемся включить, но админ не разрешил - ошибка
		if (enabled && !user.aiEnabledByAdmin) {
			throw new Error('AI disabled by admin. Cannot enable.');
		}

		user.aiEnabled = enabled;
		await user.save();

		console.log('[AI Management Service] User set AI state:', userId, 'New state:', user.aiEnabled);
		return user;
	} catch (error) {
		console.error('[AI Management Service] Error setting user AI state:', error);
		throw error;
	}
};

export const canUserUseAi = async (userId) => {
	try {
		const user = await UserModel.findById(userId).select('aiEnabled aiEnabledByAdmin');
		if (!user) {
			console.log(`[AI Management Service] canUserUseAi(${userId}): User not found`);
			return false;
		}
		
		// ✅ FIX: Проверяем наличие хотя бы одного активного аккаунта
		// Вместо проверки User флагов (которые могут не синхронизироваться)
		// проверяем реальное состояние аккаунтов в базе данных
		const hasActiveAccount = await LuxeeAccountModel.exists({
			user: userId,
			aiEnabled: true,
			aiEnabledByAdmin: true
		});
		
		const result = !!hasActiveAccount;
		console.log(`[AI Management Service] canUserUseAi(${userId}): hasActiveAccount=${result}`);
		return result;
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
		
		// Обновляем User флаги для консистентности (хотя canUserUseAi теперь проверяет аккаунты)
		await UserModel.findByIdAndUpdate(userId, {
			aiEnabledByAdmin: enabled,
			aiEnabled: enabled
		});
		console.log(`[AI Management Service] Updated user ${userId}: aiEnabled=${enabled}, aiEnabledByAdmin=${enabled}`);
		
		// ВАЖНО: Концепция - админ контролирует ОБА флага
		// Когда админ разрешает = сразу включено (aiEnabled = aiEnabledByAdmin)
		await LuxeeAccountModel.updateMany(
			{ user: userId },
			{ 
				aiEnabledByAdmin: enabled,
				aiEnabled: enabled  // Админ контролирует ОБА флага
			}
		);
		
		if (enabled) {
			// При включении - создаем AI контексты и запускаем автоответы
			console.log(`[AI Management Service] Starting AI for ${accounts.length} accounts...`);
			for (const account of accounts) {
				try {
					console.log(`[AI Management Service] Creating AI context for account ${account._id}...`);
					await aiBrowserContextService.getOrCreateAiContext(account._id);
					console.log(`[AI Management Service] ✓ AI context created for account ${account._id}`);
					
					console.log(`[AI Management Service] Starting auto-response for account ${account._id}...`);
					await aiAutoResponseService.start(account._id);
					console.log(`[AI Management Service] ✓ Auto-response started for account ${account._id}`);
				} catch (error) {
					console.error(`[AI Management Service] ✗ Failed to start AI for account ${account._id}:`, error);
				}
			}
		} else {
			// Если выключаем - останавливаем автоответы и закрываем AI контексты
			console.log(`[AI Management Service] Stopping AI for ${accounts.length} accounts...`);
			const stopPromises = accounts.map(account => 
				aiAutoResponseService.stop(account._id)
					.then(() => aiBrowserContextService.closeAiContext(account._id))
					.then(() => {
						console.log(`[AI Management Service] ✓ AI stopped for account ${account._id}`);
					})
					.catch(error => {
						console.error(`[AI Management Service] ✗ Failed to stop AI for account ${account._id}:`, error);
						return null;
					})
			);
			
			await Promise.allSettled(stopPromises);
		}
		
		// 🚀 WebSocket: Отправляем bulk событие всем подключенным клиентам
		const updatedAccounts = await LuxeeAccountModel.find({ user: userId }).select('_id aiEnabled aiEnabledByAdmin');
		socketService.emitBulkAIChanged(
			userId,
			updatedAccounts.map(acc => ({
				accountId: acc._id.toString(),
				aiEnabled: acc.aiEnabled,
				aiEnabledByAdmin: acc.aiEnabledByAdmin
			})),
			'admin'
		);
		console.log(`[AI Management Service] 📡 WebSocket broadcast sent for ${updatedAccounts.length} accounts`);
		
		return { updated: accounts.length };
	} catch (error) {
		console.error('[AI Management Service] Error setting all user accounts AI by admin:', error);
		throw error;
	}
};
