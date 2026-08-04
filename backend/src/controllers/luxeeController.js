import luxeeAuthService from '../services/luxeeApi/luxeeAuthService/index.js';
import luxeeScraperService from '../services/luxeeApi/luxeeScraperService.js';
import messageCheckService from '../services/luxeeApi/messageCheckService/index.js';
import messageSendService from '../services/luxeeApi/messageSendService.js';
import profileChatsLoadService from '../services/luxeeApi/profileChatsLoadService.js';
import chatOpenService from '../services/luxeeApi/chatOpenService.js';
import luxeeAccountOnlineService from '../services/luxeeAccountOnlineService.js';
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

	// 🎯 Трекинг ручной активности (клики на аккаунты/профили)
	trackManualActivity: async (req, res, next) => {
		try {
			const userId = req.user.id;
			const { accountId } = req.body;

			console.log(`[Luxee Controller] Track manual activity for user ${userId}, account ${accountId}`);
			
			const result = await luxeeAccountOnlineService.trackManualActivity(userId, accountId);
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// 🎯 Получить онлайн статус аккаунтов пользователя
	getAccountsOnlineStatus: async (req, res, next) => {
		try {
			const userId = req.user.id;

			console.log(`[Luxee Controller] Get accounts online status for user ${userId}`);
			
			const result = await luxeeAccountOnlineService.getUserAccountsOnlineStatus(userId);
			
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},

	// 🚫 Получить черный список аккаунта
	getBlacklist: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const LuxeeAccount = (await import('../models/LuxeeAccountModel.js')).default;

			console.log(`[Luxee Controller] Get blacklist for account ${accountId}`);
			
			const account = await LuxeeAccount.findById(accountId);
			
			if (!account) {
				return next(ApiError.NotFound('Аккаунт не найден'));
			}

			// Возвращаем черный список или значения по умолчанию
			const blacklist = account.blacklist || {
				enabled: false,
				userIds: [],
				categories: {
					newMessages: false,
					catchUp: false,
					activityCenter: false
				}
			};
			
			return res.json(blacklist);
		} catch (error) {
			next(error);
		}
	},

	// 🚫 Обновить черный список аккаунта
	updateBlacklist: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const { enabled, userIds, categories } = req.body;
			const LuxeeAccount = (await import('../models/LuxeeAccountModel.js')).default;

			console.log(`[Luxee Controller] Update blacklist for account ${accountId}`);
			
			const account = await LuxeeAccount.findById(accountId);
			
			if (!account) {
				return next(ApiError.NotFound('Аккаунт не найден'));
			}

			// Обновляем черный список
			account.blacklist = {
				enabled: enabled !== undefined ? enabled : account.blacklist?.enabled || false,
				userIds: userIds || account.blacklist?.userIds || [],
				categories: {
					newMessages: categories?.newMessages !== undefined ? categories.newMessages : account.blacklist?.categories?.newMessages || false,
					catchUp: categories?.catchUp !== undefined ? categories.catchUp : account.blacklist?.categories?.catchUp || false,
					activityCenter: categories?.activityCenter !== undefined ? categories.activityCenter : account.blacklist?.categories?.activityCenter || false
				}
			};

			await account.save();
			
			console.log(`[Luxee Controller] ✅ Blacklist updated for account ${accountId}`);
			
			return res.json({
				success: true,
				blacklist: account.blacklist
			});
		} catch (error) {
			next(error);
		}
	},

	// 🚫 Добавить ID в черный список
	addToBlacklist: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const { userIds } = req.body;
			const LuxeeAccount = (await import('../models/LuxeeAccountModel.js')).default;

			if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
				return next(ApiError.BadRequest('userIds должен быть непустым массивом'));
			}

			console.log(`[Luxee Controller] Add to blacklist for account ${accountId}:`, userIds);
			
			const account = await LuxeeAccount.findById(accountId);
			
			if (!account) {
				return next(ApiError.NotFound('Аккаунт не найден'));
			}

			// Инициализируем blacklist если не существует
			if (!account.blacklist) {
				account.blacklist = {
					enabled: false,
					userIds: [],
					categories: {
						newMessages: false,
						catchUp: false,
						activityCenter: false
					}
				};
			}

			// Добавляем новые ID (избегаем дубликатов)
			const existingIds = new Set(account.blacklist.userIds);
			const newIds = userIds.filter(id => !existingIds.has(id));
			
			account.blacklist.userIds.push(...newIds);
			await account.save();
			
			console.log(`[Luxee Controller] ✅ Added ${newIds.length} new IDs to blacklist`);
			
			return res.json({
				success: true,
				added: newIds.length,
				blacklist: account.blacklist
			});
		} catch (error) {
			next(error);
		}
	},

	// 🚫 Удалить ID из черного списка
	removeFromBlacklist: async (req, res, next) => {
		try {
			const { accountId } = req.params;
			const { userIds } = req.body;
			const LuxeeAccount = (await import('../models/LuxeeAccountModel.js')).default;

			if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
				return next(ApiError.BadRequest('userIds должен быть непустым массивом'));
			}

			console.log(`[Luxee Controller] Remove from blacklist for account ${accountId}:`, userIds);
			
			const account = await LuxeeAccount.findById(accountId);
			
			if (!account) {
				return next(ApiError.NotFound('Аккаунт не найден'));
			}

			if (!account.blacklist || !account.blacklist.userIds) {
				return res.json({
					success: true,
					removed: 0,
					blacklist: account.blacklist
				});
			}

			// Удаляем ID из списка
			const idsToRemove = new Set(userIds);
			const before = account.blacklist.userIds.length;
			account.blacklist.userIds = account.blacklist.userIds.filter(id => !idsToRemove.has(id));
			const removed = before - account.blacklist.userIds.length;
			
			await account.save();
			
			console.log(`[Luxee Controller] ✅ Removed ${removed} IDs from blacklist`);
			
			return res.json({
				success: true,
				removed,
				blacklist: account.blacklist
			});
		} catch (error) {
			next(error);
		}
	},
};

export default LuxeeController;
