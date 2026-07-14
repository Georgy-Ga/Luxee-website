import bcrypt from 'bcrypt';
import UserDto from '../dtos/UserDto.js';
import UserModel from '../models/UserModel.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import tokenService from './tokenService.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import aiAutoResponseService from './aiAutoResponseService.js';
import keepAliveService from './luxeeApi/keepAliveService.js';
import messageCheckIntervalService from './luxeeApi/messageCheckIntervalService.js';
import browserService from './browser/browserService.js';
import ApiError from '../exceptions/apiError.js';

const userService = {
	registration: async (email, password) => {
		const candidate = await UserModel.findOne({ email });
		if (candidate) {
			throw ApiError.BadRequest('User with this email already exists');
		}
		const hashPassword = await bcrypt.hash(password, 3);
		const user = await UserModel.create({ email, password: hashPassword });
		const userDto = UserDto(user);
		const tokens = tokenService.generateTokens({ ...userDto });
		await tokenService.saveToken(userDto.id, tokens.refreshToken);
		return { ...tokens, user: userDto };
	},
	login: async (email, password) => {
		const user = await UserModel.findOne({ email });
		if (!user) {
			throw ApiError.BadRequest('User with this email not found');
		}
		const isPassEquals = await bcrypt.compare(password, user.password);
		if (!isPassEquals) {
			throw ApiError.BadRequest('Incorrect password');
		}	
		const userDto = UserDto(user);		
		const tokens = tokenService.generateTokens({ ...userDto });
		await tokenService.saveToken(userDto.id, tokens.refreshToken);
		return { ...tokens, user: userDto };
	},
	logout: async (refreshToken, userId) => {
		try {
			console.log('[User Service] Logging out user:', userId);
			
			// Удаляем токен
			const token = await tokenService.removeToken(refreshToken);
			
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
			
			return token;
		} catch (error) {
			console.error('[User Service] Error during logout:', error);
			throw error;
		}
	},
	refresh: async refreshToken => {
		if (!refreshToken) {
			throw ApiError.UnauthorizedError();
		}
		const userData = tokenService.validateRefreshToken(refreshToken);
		const tokenFromDb = await tokenService.findToken(refreshToken);
		if (!userData || !tokenFromDb) {
			throw ApiError.UnauthorizedError();
		}
		const user = await UserModel.findById(userData.id);
		const userDto = UserDto(user);		
		const tokens = tokenService.generateTokens({ ...userDto });
		await tokenService.saveToken(userDto.id, tokens.refreshToken);
		return { ...tokens, user: userDto };
	},
	getAllUsers: async () => {
		const users = await UserModel.find();
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
		
		// Удаляем токены пользователя
		await tokenService.removeTokenByUserId(userId);
		console.log(`[User Service] ✓ Tokens removed for user ${userId}`);
		
		// Удаляем пользователя
		await UserModel.findByIdAndDelete(userId);
		console.log(`[User Service] ✓ User ${userId} deleted from DB`);
		
		return { success: true, message: 'Пользователь удалён' };
	}
};

export default userService;
