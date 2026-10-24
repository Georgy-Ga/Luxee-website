import bcrypt from 'bcrypt';
import UserDto from '../dtos/UserDto.js';
import UserModel from '../models/UserModel.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import tokenService from './tokenService.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import aiAutoResponseService from './aiAutoResponseService.js';
import keepAliveService from './luxeeApi/keepAliveService.js';
import profileSwitchService from './luxeeApi/profileSwitchService.js';
import onlineKeeperService from './onlineKeeperService.js';
import { setAllOfflineViaNewContext } from './luxeeApi/onlineRecoveryService.js';
import messageCheckIntervalService from './luxeeApi/messageCheckIntervalService.js';
import browserService from './browser/browserService.js';
import ApiError from '../exceptions/apiError.js';

const userService = {
	registration: async (email, password, sessionMeta = {}) => {
		const candidate = await UserModel.findOne({ email });
		if (candidate) {
			throw ApiError.BadRequest('User with this email already exists');
		}
		const hashPassword = await bcrypt.hash(password, 3);
		const user = await UserModel.create({ email, password: hashPassword });
		const userDto = UserDto(user);
		const tokens = tokenService.generateTokens({ ...userDto, sid: sessionMeta.deviceId || undefined });
		const session = await tokenService.saveToken(userDto.id, tokens.refreshToken, sessionMeta);
		return { ...tokens, user: userDto, sessionId: session._id.toString(), deviceId: session.deviceId };
	},
	login: async (email, password, sessionMeta = {}) => {
		const user = await UserModel.findOne({ email });
		if (!user) {
			throw ApiError.BadRequest('User with this email not found');
		}
		const isPassEquals = await bcrypt.compare(password, user.password);
		if (!isPassEquals) {
			throw ApiError.BadRequest('Incorrect password');
		}	
		const userDto = UserDto(user);		
		const tokens = tokenService.generateTokens({ ...userDto, sid: sessionMeta.deviceId || undefined });
		// Мультивход: создаём/ротируем ТОЛЬКО свою сессию, чужие refresh токены не трогаем.
		const session = await tokenService.saveToken(userDto.id, tokens.refreshToken, sessionMeta);
		return { ...tokens, user: userDto, sessionId: session._id.toString(), deviceId: session.deviceId };
	},
	logout: async refreshToken => {
		// Выход ОДНОЙ сессии: удаляем только свой refresh.
		// AI/браузерные контексты НЕ трогаем — за этим же userId могут работать коллеги.
		try {
			const token = await tokenService.removeToken(refreshToken);
			return token;
		} catch (error) {
			console.error('[User Service] Error during logout:', error);
			throw error;
		}
	},
	logoutAll: async userId => {
		try {
			console.log('[User Service] Logging out ALL sessions for user:', userId);

			// Удаляем ВСЕ токены пользователя
			const removed = await tokenService.removeAllByUserId(userId);
			
			// 🔥 ПОЛНЫЙ CLEANUP: Останавливаем ВСЁ для пользователя
			if (userId) {
				console.log('[User Service] Starting full cleanup for user', userId);
				
				// ✅ 1. Останавливаем Message Check Interval
				try {
					messageCheckIntervalService.stop(userId);
					console.log(`[User Service] ✓ Message Check stopped for user ${userId}`);
				} catch (error) {
					console.error(`[User Service] ⚠️  Failed to stop Message Check:`, error);
				}
				
				// ✅ 2. Отключаем AI для всех аккаунтов пользователя
				console.log('[User Service] Disabling AI for all user accounts...');
				const accounts = await LuxeeAccountModel.find({ user: userId });
				
				for (const account of accounts) {
					const accountId = account._id.toString();
					
					try {
						// Отключаем AI
						if (account.aiEnabled) {
							account.aiEnabled = false;
							await account.save();
							console.log(`[User Service] ✓ AI disabled for account ${accountId}`);
						}
						
					// ✅ 3. Закрываем AI контекст
					if (account.aiContext) {
						keepAliveService.stop(`${accountId}_ai`);
						await aiBrowserContextService.closeAiContext(accountId);
						console.log(`[User Service] ✓ AI context closed for account ${accountId}`);
					}

					// ✅ 3b. Останавливаем online-keeper + анкеты в оффлайн (logout = оффлайн)
					try {
						onlineKeeperService.stop(accountId);
						await setAllOfflineViaNewContext(accountId).catch(() => false);
						console.log(`[User Service] ✓ Online keeper stopped, offline-all for account ${accountId}`);
					} catch (e) {}
						
						// ✅ 4. Останавливаем Keep-Alive для основного контекста
						keepAliveService.stop(accountId);
						console.log(`[User Service] ✓ Keep-Alive stopped for account ${accountId}`);
						
						// ✅ 5. Закрываем основной контекст
						await browserService.closeContext(accountId);
						console.log(`[User Service] ✓ Main context closed for account ${accountId}`);
						
					} catch (error) {
						console.error(`[User Service] ⚠️  Error cleaning up account ${accountId}:`, error);
						// Продолжаем с другими аккаунтами
					}
				}
				
				console.log('[User Service] ✓ Full cleanup completed for user', userId);
			}

			return removed;
		} catch (error) {
			console.error('[User Service] Error during logout:', error);
			throw error;
		}
	},
	refresh: async (refreshToken, sessionMeta = {}) => {
		if (!refreshToken) {
			throw ApiError.UnauthorizedError();
		}
		const userData = tokenService.validateRefreshToken(refreshToken);
		const tokenFromDb = await tokenService.findToken(refreshToken);
		if (!userData || !tokenFromDb) {
			throw ApiError.UnauthorizedError();
		}
		const user = await UserModel.findById(userData.id);
		if (!user) {
			// Пользователь удалён, а refresh остался: чистим висячую сессию и отдаём 401, а не 500.
			await tokenService.removeToken(refreshToken);
			throw ApiError.UnauthorizedError();
		}
		const userDto = UserDto(user);
		// Сохраняем привязку к сессии: sid из старого токена приоритетнее (устройство не меняется при refresh).
		const sid = userData.sid || tokenFromDb.deviceId || sessionMeta.deviceId || undefined;
		const tokens = tokenService.generateTokens({ ...userDto, sid });
		// Ротация в пределах СВОЕЙ сессии: чужие сессии не трогаем.
		const rotated = await tokenService.rotateToken(refreshToken, tokens.refreshToken, sessionMeta);
		if (!rotated) {
			throw ApiError.UnauthorizedError();
		}
		return { ...tokens, user: userDto, sessionId: rotated._id.toString(), deviceId: rotated.deviceId };
	},
	getAllUsers: async () => {
		// Никогда не отдаём хеши паролей наружу (раньше GET /users сливал password всем админам).
		const users = await UserModel.find().select('-password');
		return users;
	},
	
	deleteUser: async (userId, requestingUserId) => {
		// Проверяем что пользователь существует
		const userToDelete = await UserModel.findById(userId);
		if (!userToDelete) {
			throw ApiError.BadRequest('Пользователь не найден');
		}
		
		// Запрещаем удалять админов
		if (userToDelete.role === 'admin') {
			throw ApiError.BadRequest('Нельзя удалять администраторов');
		}
		
		// Запрещаем удалять самого себя
		if (userId === requestingUserId) {
			throw ApiError.BadRequest('Нельзя удалить свой аккаунт');
		}
		
		console.log(`[User Service] Starting deletion process for user ${userId}`);
		
		// ✅ 1. Останавливаем Message Check Interval
		try {
			messageCheckIntervalService.stop(userId);
			console.log(`[User Service] ✓ Message Check stopped for user ${userId}`);
		} catch (error) {
			console.error(`[User Service] ⚠️  Failed to stop Message Check:`, error);
		}
		
		// ✅ 2. Останавливаем AI auto-response для ВСЕХ аккаунтов пользователя
		try {
			console.log(`[User Service] Stopping AI auto-response for all accounts of user ${userId}`);
			await aiAutoResponseService.stopForUser(userId);
			console.log(`[User Service] ✓ AI auto-response stopped for user ${userId}`);
		} catch (error) {
			console.error(`[User Service] ⚠️  Failed to stop AI for user ${userId}:`, error);
		}
		
		// Получаем все Luxee аккаунты пользователя
		const luxeeAccounts = await LuxeeAccountModel.find({ user: userId });
		console.log(`[User Service] Found ${luxeeAccounts.length} Luxee accounts for user ${userId}`);
		
		// ✅ 3. Закрываем ВСЕ контексты и keep-alive для всех аккаунтов
		for (const account of luxeeAccounts) {
			const accountId = account._id.toString();
			
		try {
			// Останавливаем keep-alive для AI контекста
			keepAliveService.stop(`${accountId}_ai`);

			// Страховка: online-keeper остановлен через stopForUser→stop выше,
			// но если ИИ не был запущен — гасим напрямую (идемпотентно)
			try {
				onlineKeeperService.stop(accountId);
			} catch (e) {}

			// Очередь переключения профилей — удалить, чтобы не копилась
			try {
				profileSwitchService.deleteQueue(accountId);
			} catch (e) {}
				
				// Закрываем AI контекст
				await aiBrowserContextService.closeAiContext(accountId);
				console.log(`[User Service] ✓ AI context closed for account ${accountId}`);
				
				// ✅ НОВОЕ: Останавливаем Keep-Alive для основного контекста
				keepAliveService.stop(accountId);
				console.log(`[User Service] ✓ Keep-Alive stopped for account ${accountId}`);
				
				// ✅ НОВОЕ: Закрываем основной контекст
				await browserService.closeContext(accountId);
				console.log(`[User Service] ✓ Main context closed for account ${accountId}`);
				
			} catch (error) {
				console.error(`[User Service] ⚠️  Failed to cleanup account ${accountId}:`, error);
			}
		}
		
		// Удаляем все Luxee аккаунты пользователя
		await LuxeeAccountModel.deleteMany({ user: userId });
		console.log(`[User Service] ✓ Deleted ${luxeeAccounts.length} Luxee accounts for user ${userId}`);
		
		// Удаляем токены пользователя (все сессии)
		await tokenService.removeAllByUserId(userId);
		console.log(`[User Service] ✓ Tokens removed for user ${userId}`);
		
		// Удаляем пользователя
		await UserModel.findByIdAndDelete(userId);
		console.log(`[User Service] ✓ User ${userId} deleted from DB`);
		
		return { success: true, message: 'Пользователь удалён' };
	}
};

export default userService;
