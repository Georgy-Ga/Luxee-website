import bcrypt from 'bcrypt';
import UserDto from '../dtos/UserDto.js';
import UserModel from '../models/UserModel.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import tokenService from './tokenService.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
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
			
			// Отключаем AI для всех аккаунтов пользователя и закрываем AI контексты
			if (userId) {
				console.log('[User Service] Disabling AI for all user accounts...');
				
				const accounts = await LuxeeAccountModel.find({ user: userId });
				
				for (const account of accounts) {
					try {
						// Отключаем AI
						if (account.aiEnabled) {
							account.aiEnabled = false;
							await account.save();
							console.log(`[User Service] AI disabled for account ${account._id}`);
						}
						
						// Закрываем AI контекст если есть
						if (account.aiContext) {
							await aiBrowserContextService.closeAiContext(account._id.toString());
							console.log(`[User Service] AI context closed for account ${account._id}`);
						}
					} catch (error) {
						console.error(`[User Service] Error disabling AI for account ${account._id}:`, error);
						// Продолжаем с другими аккаунтами
					}
				}
				
				console.log('[User Service] AI disabled for all accounts');
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
		
		// Удаляем токены пользователя
		await tokenService.removeTokenByUserId(userId);
		
		// Удаляем пользователя
		await UserModel.findByIdAndDelete(userId);
		
		return { success: true, message: 'Пользователь удалён' };
	}
};

export default userService;
