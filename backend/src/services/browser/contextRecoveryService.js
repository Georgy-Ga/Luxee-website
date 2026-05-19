// Сервис для автоматического восстановления контекстов при перезапуске сервера
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import browserService from './browserService.js';
import luxeeAuthService from '../luxeeApi/luxeeAuthService/index.js';

const contextRecoveryService = {
	// Восстановить все активные контексты
	recoverAllContexts: async () => {
		try {
			console.log('[Context Recovery] Starting context recovery...');

			// Получаем все активные аккаунты
			const accounts = await LuxeeAccountModel.find({ isActive: true });

			if (accounts.length === 0) {
				console.log('[Context Recovery] No active accounts found');
				return {
					success: true,
					recovered: 0,
					failed: 0,
					accounts: [],
				};
			}

			console.log(`[Context Recovery] Found ${accounts.length} active accounts`);

			const results = [];
			let recovered = 0;
			let failed = 0;

			for (const account of accounts) {
				try {
					const accountId = account._id.toString();
					
					// Проверяем есть ли уже контекст
					const existingContext = browserService.getContext(accountId);
					
					if (existingContext) {
						console.log(`[Context Recovery] Context already exists for account ${account.luxeeEmail}`);
						results.push({
							accountId,
							email: account.luxeeEmail,
							status: 'already_exists',
						});
						recovered++;
						continue;
					}

					// Пытаемся восстановить контекст
					console.log(`[Context Recovery] Recovering context for account ${account.luxeeEmail}`);
					
					await luxeeAuthService.restoreSession({
						userId: account.user.toString(),
						accountId,
					});

					results.push({
						accountId,
						email: account.luxeeEmail,
						status: 'recovered',
					});
					recovered++;

					console.log(`[Context Recovery] Successfully recovered context for ${account.luxeeEmail}`);
				} catch (error) {
					console.error(`[Context Recovery] Failed to recover context for ${account.luxeeEmail}:`, error.message);
					results.push({
						accountId: account._id.toString(),
						email: account.luxeeEmail,
						status: 'failed',
						error: error.message,
					});
					failed++;
				}
			}

			console.log(`[Context Recovery] Recovery complete: ${recovered} recovered, ${failed} failed`);

			return {
				success: true,
				recovered,
				failed,
				accounts: results,
			};
		} catch (error) {
			console.error('[Context Recovery] Error during recovery:', error);
			throw error;
		}
	},

	// Проверить и восстановить контекст для конкретного аккаунта
	recoverAccountContext: async ({ userId, accountId }) => {
		try {
			console.log(`[Context Recovery] Checking context for account ${accountId}`);

			// Проверяем есть ли контекст
			const existingContext = browserService.getContext(accountId);
			
			if (existingContext) {
				console.log(`[Context Recovery] Context exists for account ${accountId}`);
				return {
					success: true,
					status: 'exists',
					message: 'Context already exists',
				};
			}

			// Проверяем что аккаунт существует и принадлежит пользователю
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
				isActive: true,
			});

			if (!account) {
				throw new Error('Account not found or not active');
			}

			// Восстанавливаем контекст
			console.log(`[Context Recovery] Recovering context for account ${account.luxeeEmail}`);
			
			await luxeeAuthService.restoreSession({
				userId,
				accountId,
			});

			console.log(`[Context Recovery] Successfully recovered context for ${account.luxeeEmail}`);

			return {
				success: true,
				status: 'recovered',
				message: 'Context recovered successfully',
			};
		} catch (error) {
			console.error(`[Context Recovery] Error recovering context:`, error);
			throw error;
		}
	},

	// Проверить статус контекста
	checkContextStatus: async ({ accountId }) => {
		try {
			const context = browserService.getContext(accountId);
			
			if (!context) {
				return {
					exists: false,
					status: 'missing',
				};
			}

			// Проверяем что контекст рабочий
			try {
				const pages = context.pages();
				return {
					exists: true,
					status: 'active',
					pagesCount: pages.length,
				};
			} catch (error) {
				return {
					exists: false,
					status: 'broken',
					error: error.message,
				};
			}
		} catch (error) {
			console.error('[Context Recovery] Error checking context status:', error);
			return {
				exists: false,
				status: 'error',
				error: error.message,
			};
		}
	},

};

export default contextRecoveryService;
