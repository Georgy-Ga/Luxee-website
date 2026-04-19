import luxeeAuthService from '../services/luxeeApi/luxeeAuthService.js';
import ApiError from '../exceptions/apiError.js';

const LuxeeController = {
	login: async (req, res, next) => {
		try {
			const { luxeeEmail, luxeePassword } = req.body;
			const userId = req.user.id;

			if (!luxeeEmail || !luxeePassword) {
				return next(ApiError.BadRequest('Email и пароль обязательны'));
			}

			console.log(`[Luxee Controller] Login request from user ${userId}`);
			const result = await luxeeAuthService.login(userId, luxeeEmail, luxeePassword);
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	getAccounts: async (req, res, next) => {
		try {
			const userId = req.user.id;
			
			console.log(`[Luxee Controller] Get accounts request from user ${userId}`);
			const accounts = await luxeeAuthService.getLuxeeAccounts(userId);
			
			return res.json(accounts);
		} catch (error) {
			next(error);
		}
	},

	deleteAccount: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId } = req.params;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[Luxee Controller] Delete account ${accountId} request from user ${userId}`);
			const result = await luxeeAuthService.deleteLuxeeAccount(userId, accountId);
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	restoreSession: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId } = req.params;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[Luxee Controller] Restore session ${accountId} request from user ${userId}`);
			const result = await luxeeAuthService.restoreSession(userId, accountId);
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
};

export default LuxeeController;
