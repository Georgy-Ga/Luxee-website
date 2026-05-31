// AI Auto Response Controller
// Контроллер для управления автоответами AI

import aiAutoResponseService from '../services/aiAutoResponseService.js';
import ApiError from '../exceptions/apiError.js';

const AiAutoResponseController = {
	/**
	 * Запустить автоответы для аккаунта
	 */
	startForAccount: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const userId = req.user.id;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[AI Auto Response Controller] Start request for account ${accountId} from user ${userId}`);
			
			await aiAutoResponseService.start(accountId);
			
			return res.json({
				success: true,
				message: 'AI auto-response started',
				accountId,
			});
		} catch (error) {
			next(error);
		}
	},

	/**
	 * Остановить автоответы для аккаунта
	 */
	stopForAccount: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const userId = req.user.id;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[AI Auto Response Controller] Stop request for account ${accountId} from user ${userId}`);
			
			await aiAutoResponseService.stop(accountId);
			
			return res.json({
				success: true,
				message: 'AI auto-response stopped',
				accountId,
			});
		} catch (error) {
			next(error);
		}
	},

	/**
	 * Запустить автоответы для всех аккаунтов пользователя
	 */
	startForUser: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[AI Auto Response Controller] Start all request from user ${userId}`);
			
			await aiAutoResponseService.startForUser(userId);
			
			return res.json({
				success: true,
				message: 'AI auto-response started for all accounts',
			});
		} catch (error) {
			next(error);
		}
	},

	/**
	 * Остановить автоответы для всех аккаунтов пользователя
	 */
	stopForUser: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[AI Auto Response Controller] Stop all request from user ${userId}`);
			
			await aiAutoResponseService.stopForUser(userId);
			
			return res.json({
				success: true,
				message: 'AI auto-response stopped for all accounts',
			});
		} catch (error) {
			next(error);
		}
	},

	/**
	 * Получить статус автоответов
	 */
	getStatus: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[AI Auto Response Controller] Get status request from user ${userId}`);
			
			const status = aiAutoResponseService.getStatus();
			
			return res.json(status);
		} catch (error) {
			next(error);
		}
	},

	/**
	 * Проверить запущены ли автоответы для аккаунта
	 */
	isRunning: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const userId = req.user.id;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[AI Auto Response Controller] Check running for account ${accountId} from user ${userId}`);
			
			const isRunning = aiAutoResponseService.isRunning(accountId);
			
			return res.json({
				accountId,
				isRunning,
			});
		} catch (error) {
			next(error);
		}
	},
};

export default AiAutoResponseController;
