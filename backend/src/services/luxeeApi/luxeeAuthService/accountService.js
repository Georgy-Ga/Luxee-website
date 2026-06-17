// Модуль для управления Luxee аккаунтами
import ApiError from '../../../exceptions/apiError.js';
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import keepAliveService from '../keepAliveService.js';
import messageCheckIntervalService from '../messageCheckIntervalService.js';

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

		// Останавливаем keep-alive
		keepAliveService.stop(accountId);

		// Останавливаем проверку сообщений для пользователя
		messageCheckIntervalService.stop(userId);

		// Закрываем контекст если открыт
		await browserService.closeContext(accountId);

		await LuxeeAccountModel.deleteOne({ _id: accountId });

		return { success: true, message: 'Аккаунт Luxee удалён' };
	} catch (error) {
		console.error('[Luxee Auth] Error deleting account:', error);
		throw error;
	}
};
