// Модуль для управления сессиями Luxee
import ApiError from '../../../exceptions/apiError.js';
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
import keepAliveService from '../keepAliveService.js';
import messageCheckIntervalService from '../messageCheckIntervalService.js';

/**
 * Восстановить сессию Luxee аккаунта
 */
export const restoreSession = async ({ userId, accountId }) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw ApiError.BadRequest('Аккаунт не найден');
		}

		if (!account.sessionData) {
			throw ApiError.BadRequest('Нет сохранённой сессии');
		}

		// Создаём контекст с сохранённой сессией
		const context = await browserService.createContext({
			accountId,
			sessionData: account.sessionData,
		});

		const page = await pageHelpers.getOrCreatePage(context);
		await pageHelpers.navigateTo({ page, url: 'https://luxee.io/chats/' });

		const currentUrl = pageHelpers.getCurrentUrl(page);
		console.log('[Luxee Auth] Session restored, URL:', currentUrl);

		// Запускаем keep-alive
		await keepAliveService.start({ accountId, context });

		// Запускаем автоматическую проверку сообщений
		messageCheckIntervalService.start({ userId });

		// Обновляем активность
		account.isActive = true;
		account.lastActivity = new Date();
		await account.save();

		return {
			success: true,
			message: 'Сессия восстановлена',
			currentUrl,
		};
	} catch (error) {
		console.error('[Luxee Auth] Error restoring session:', error);
		throw error;
	}
};

/**
 * Восстановить все сессии пользователя (параллельно)
 */
export const restoreAllSessions = async ({ userId }) => {
	try {
		console.log(`[Luxee Auth] Restoring all sessions for user ${userId}`);
		
		const accounts = await LuxeeAccountModel.find({
			user: userId,
			sessionData: { $exists: true, $ne: null },
		});

		console.log(`[Luxee Auth] Found ${accounts.length} accounts with saved sessions`);

		// Восстанавливаем все сессии ПАРАЛЛЕЛЬНО
		const restorePromises = accounts.map(async (account) => {
			try {
				const accountId = account._id.toString();
				
				// Проверяем, может контекст уже существует
				const existingContext = browserService.getContext(accountId);
				if (existingContext) {
					console.log(`[Luxee Auth] Context already exists for ${account.luxeeEmail}`);
					return {
						accountId,
						luxeeEmail: account.luxeeEmail,
						status: 'already_active',
					};
				}

				// Восстанавливаем сессию
				await restoreSession({ userId, accountId });
				
				console.log(`[Luxee Auth] Restored session for ${account.luxeeEmail}`);
				return {
					accountId,
					luxeeEmail: account.luxeeEmail,
					status: 'restored',
				};
			} catch (error) {
				console.error(`[Luxee Auth] Failed to restore ${account.luxeeEmail}:`, error.message);
				return {
					accountId: account._id.toString(),
					luxeeEmail: account.luxeeEmail,
					status: 'failed',
					error: error.message,
				};
			}
		});

		// Ждём завершения всех восстановлений
		const results = await Promise.all(restorePromises);

		const restoredCount = results.filter(r => r.status === 'restored').length;
		console.log(`[Luxee Auth] Restored ${restoredCount}/${accounts.length} sessions (parallel)`);

		return {
			success: true,
			restored: restoredCount,
			total: accounts.length,
			results,
		};
	} catch (error) {
		console.error('[Luxee Auth] Error restoring all sessions:', error);
		throw error;
	}
};
