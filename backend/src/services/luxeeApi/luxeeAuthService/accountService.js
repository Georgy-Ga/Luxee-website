// Модуль для управления Luxee аккаунтами
import ApiError from '../../../exceptions/apiError.js';
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import keepAliveService from '../keepAliveService.js';
import messageCheckIntervalService from '../messageCheckIntervalService.js';
import socketService from '../../socketService.js';
import aiAutoResponseService from '../../aiAutoResponseService.js';
import aiBrowserContextService from '../../browser/aiBrowserContextService.js';

/**
 * Получить список Luxee аккаунтов пользователя
 */
export const getLuxeeAccounts = async ({ userId }) => {
	try {
		const accounts = await LuxeeAccountModel.find({ user: userId });
		return accounts.map(
			({ _id, luxeeEmail, isActive, lastActivity, createdAt }) => ({
				_id: _id.toString(), // Возвращаем _id вместо id для совместимости с фронтендом
				luxeeEmail,
				isActive,
				lastActivity,
				createdAt,
			}),
		);
	} catch (error) {
		console.error('[Luxee Auth] Error getting accounts:', error);
		throw error;
	}
};

/**
 * Удалить Luxee аккаунт
 */
export const deleteLuxeeAccount = async ({ userId, accountId }) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw ApiError.BadRequest('Аккаунт не найден');
		}

		// ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ОСТАНОВКИ:
		console.log(`[Luxee Auth] Starting deletion process for account ${accountId}`);
		
		// 1. Останавливаем keep-alive
		keepAliveService.stop(accountId);
		console.log(`[Luxee Auth] ✓ Keep-alive stopped for account ${accountId}`);

		// 2. Останавливаем проверку сообщений для пользователя
		messageCheckIntervalService.stop(userId);
		console.log(`[Luxee Auth] ✓ Message check stopped for user ${userId}`);

		// 3. Останавливаем AI auto-response (если включен)
		try {
			await aiAutoResponseService.stop(accountId);
			console.log(`[Luxee Auth] ✓ AI auto-response stopped for account ${accountId}`);
		} catch (error) {
			console.error(`[Luxee Auth] Failed to stop AI auto-response for account ${accountId}:`, error);
		}

		// 4. Даём время завершить текущий цикл AI (если выполняется)
		await new Promise(resolve => setTimeout(resolve, 300));
		console.log(`[Luxee Auth] ✓ Waited for AI cycle completion`);

		// 5. Закрываем AI контекст (если есть)
		try {
			await aiBrowserContextService.closeAiContext(accountId);
			console.log(`[Luxee Auth] ✓ AI context closed for account ${accountId}`);
		} catch (error) {
			console.error(`[Luxee Auth] Failed to close AI context for account ${accountId}:`, error);
		}

		// 6. Закрываем основной контекст
		await browserService.closeContext(accountId);
		console.log(`[Luxee Auth] ✓ Main context closed for account ${accountId}`);

		// 7. Сохраняем email перед удалением для логов
		const luxeeEmail = account.luxeeEmail;

		// 8. Удаляем из БД
		await LuxeeAccountModel.deleteOne({ _id: accountId });
		console.log(`[Luxee Auth] ✓ Account deleted from DB: ${luxeeEmail}`);

		// 9. Emit WebSocket событие для синхронизации с админ-панелью
		console.log(`[Luxee Auth] Emitting account deleted event for ${luxeeEmail}`);
		socketService.emitAccountDeleted(userId, accountId);

		return { success: true, message: 'Аккаунт Luxee удалён' };
	} catch (error) {
		console.error('[Luxee Auth] Error deleting account:', error);
		throw error;
	}
};
