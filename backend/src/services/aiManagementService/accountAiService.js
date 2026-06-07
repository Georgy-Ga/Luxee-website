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

export const toggleAccountAi = async (userId, accountId) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw new Error('Account not found');
		}

		const newStatus = !account.aiEnabled;

		// ВАЖНО: Пользователь может ВЫКЛЮЧИТЬ AI, но НЕ может ВКЛЮЧИТЬ без разрешения админа
		if (newStatus === true && !account.aiEnabledByAdmin) {
			throw new Error('AI disabled by admin. Cannot enable. Contact administrator.');
		}

		account.aiEnabled = newStatus;
		await account.save();

		console.log(
			`[AI Management Service] User ${userId} toggled AI for account ${accountId}:`,
			`aiEnabled=${newStatus}, aiEnabledByAdmin=${account.aiEnabledByAdmin}`
		);

		if (account.aiEnabled && account.aiEnabledByAdmin) {
			// Запускаем автоответы если AI включен и админ разрешил
			try {
				console.log(`[AI Management Service] Starting auto-response for account ${accountId}...`);
				await aiAutoResponseService.start(accountId);
				console.log(`[AI Management Service] ✓ Auto-response started for account ${accountId}`);
			} catch (error) {
				console.error(`[AI Management Service] ✗ Failed to start auto-response for account ${accountId}:`, error);
			}
		} else {
			// Останавливаем автоответы если AI выключен
			console.log(`[AI Management Service] Stopping auto-response for account ${accountId}...`);
			await aiAutoResponseService.stop(accountId);
			await aiBrowserContextService.closeAiContext(accountId);
			console.log(`[AI Management Service] ✓ Auto-response stopped for account ${accountId}`);
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

export const toggleAllMyAccountsAi = async (userId) => {
	try {
		const accounts = await LuxeeAccountModel.find({ user: userId });
		
		if (accounts.length === 0) {
			return { message: 'No accounts found', updated: 0 };
		}
		
		// Определяем новый статус: если хотя бы один включен - выключаем все, иначе - включаем все
		const anyEnabled = accounts.some(acc => acc.aiEnabled);
		const newStatus = !anyEnabled;
		
		console.log(`[AI Management Service] User ${userId} toggling AI for ${accounts.length} accounts to ${newStatus}`);
		
		let updated = 0;
		const results = [];
		
		for (const account of accounts) {
			// Пользователь может ВЫКЛЮЧИТЬ любой аккаунт, но ВКЛЮЧИТЬ только если админ разрешил
			if (newStatus === true && !account.aiEnabledByAdmin) {
				console.log(`[AI Management Service] Skipping account ${account._id}: admin has not enabled AI`);
				results.push({ accountId: account._id, status: 'skipped', reason: 'Admin has not enabled AI' });
				continue;
			}
			
			try {
				account.aiEnabled = newStatus;
				await account.save();
				
				if (newStatus && account.aiEnabledByAdmin) {
					// Включаем AI
					await aiBrowserContextService.getOrCreateAiContext(account._id);
					await aiAutoResponseService.start(account._id);
					console.log(`[AI Management Service] ✓ AI started for account ${account._id}`);
				} else {
					// Выключаем AI
					await aiAutoResponseService.stop(account._id);
					await aiBrowserContextService.closeAiContext(account._id);
					console.log(`[AI Management Service] ✓ AI stopped for account ${account._id}`);
				}
				
				updated++;
				results.push({ accountId: account._id, status: 'success', aiEnabled: newStatus });
			} catch (error) {
				console.error(`[AI Management Service] ✗ Failed to toggle AI for account ${account._id}:`, error);
				results.push({ accountId: account._id, status: 'error', error: error.message });
			}
		}
		
		return { 
			message: `AI ${newStatus ? 'enabled' : 'disabled'} for accounts`,
			updated,
			total: accounts.length,
			results
		};
	} catch (error) {
		console.error('[AI Management Service] Error toggling all my accounts AI:', error);
		throw error;
	}
};
