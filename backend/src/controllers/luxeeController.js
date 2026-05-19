import luxeeAuthService from '../services/luxeeApi/luxeeAuthService/index.js';
import luxeeScraperService from '../services/luxeeApi/luxeeScraperService.js';
import messageCheckService from '../services/luxeeApi/messageCheckService/index.js';
import messageSendService from '../services/luxeeApi/messageSendService.js';
import profileChatsLoadService from '../services/luxeeApi/profileChatsLoadService.js';
import chatOpenService from '../services/luxeeApi/chatOpenService.js';
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
			
			// Добавляем поле user в каждый аккаунт для группировки на фронтенде
			const accountsWithUser = accounts.map(account => ({
				...account,
				user: account.user || userId // Используем существующее поле user или userId
			}));
			
			return res.json(accountsWithUser);
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

	// Отправить сообщение в чат
	sendMessage: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId, profileUid, memberUid, text, chatIdentity } = req.body;

			if (!accountId || !profileUid || !memberUid || !text) {
				return next(ApiError.BadRequest('ID аккаунта, UID профиля, UID получателя и текст сообщения обязательны'));
			}

			console.log(`[Luxee Controller] Send message request from user ${userId}`);
			const result = await messageSendService.sendMessage({ 
				userId, 
				accountId,
				profileUid,
				memberUid,
				text,
				chatIdentity,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// Загрузить чаты профиля (при клике на профиль)
	loadProfileChats: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId, profileUid } = req.query;

			if (!accountId || !profileUid) {
				return next(ApiError.BadRequest('ID аккаунта и UID профиля обязательны'));
			}

			console.log(`[Luxee Controller] Load profile chats request from user ${userId} for profile ${profileUid}`);
			const result = await profileChatsLoadService.loadProfileChats({ 
				accountId,
				profileUid: parseInt(profileUid),
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// Открыть чат и получить последнее сообщение
	openChat: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId, profileUid, chatId } = req.query;

			if (!accountId || !profileUid || !chatId) {
				return next(ApiError.BadRequest('ID аккаунта, UID профиля и ID чата обязательны'));
			}

			console.log(`[Luxee Controller] Open chat request from user ${userId} for chat ${chatId}`);
			const result = await chatOpenService.openChat({ 
				accountId,
				profileUid: parseInt(profileUid),
				chatId,
			});
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
};

export default LuxeeController;
