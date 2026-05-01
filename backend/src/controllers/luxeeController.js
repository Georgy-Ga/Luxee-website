import luxeeAuthService from '../services/luxeeApi/luxeeAuthService.js';
import luxeeScraperService from '../services/luxeeApi/luxeeScraperService.js';
import messageCheckService from '../services/luxeeApi/messageCheckService.js';
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
			const result = await luxeeAuthService.login({ 
				userId, 
				luxeeEmail, 
				luxeePassword,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	getAccounts: async (req, res, next) => {
		try {
			const userId = req.user.id;
			
			console.log(`[Luxee Controller] Get accounts request from user ${userId}`);
			const accounts = await luxeeAuthService.getLuxeeAccounts({ userId });
			
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
			const result = await luxeeAuthService.deleteLuxeeAccount({ 
				userId, 
				accountId,
			});
			
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
			const result = await luxeeAuthService.restoreSession({ 
				userId, 
				accountId,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	getProfiles: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId } = req.query;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[Luxee Controller] Get profiles request from user ${userId}`);
			const result = await luxeeScraperService.getProfiles({ 
				userId, 
				accountId,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	getPageContent: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId, url } = req.query;

			if (!accountId || !url) {
				return next(ApiError.BadRequest('ID аккаунта и URL обязательны'));
			}

			console.log(`[Luxee Controller] Get page content request from user ${userId}`);
			const result = await luxeeScraperService.getPageContent({ 
				userId, 
				accountId, 
				url,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// Проверить сообщения на всех аккаунтах
	checkAllMessages: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[Luxee Controller] Check all messages request from user ${userId}`);
			const result = await messageCheckService.checkAllMessages({ userId });
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// Проверить сообщения на конкретном аккаунте
	checkAccountMessages: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId } = req.query;

			if (!accountId) {
				return next(ApiError.BadRequest('ID аккаунта обязателен'));
			}

			console.log(`[Luxee Controller] Check account messages request from user ${userId}`);
			const result = await messageCheckService.checkAccountMessages({ 
				userId, 
				accountId,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// Получить только непрочитанные сообщения
	checkUnreadMessages: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[Luxee Controller] Check unread messages request from user ${userId}`);
			const result = await messageCheckService.checkUnreadMessages({ userId });
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
};

export default LuxeeController;
