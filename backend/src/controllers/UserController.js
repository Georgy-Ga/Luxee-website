import userService from '../services/userService.js';
import tokenService from '../services/tokenService.js';
import { validationResult } from 'express-validator';
import ApiError from '../exceptions/apiError.js';
import luxeeAuthService from '../services/luxeeApi/luxeeAuthService/index.js';
import aiAutoResponseService from '../services/aiAutoResponseService.js';
const UserController = {
	registration: async (req, res, next) => {
		try {
			const errors = validationResult(req);
			if(!errors.isEmpty()) {
				return next(ApiError.BadRequest('Validation error', errors.array()));
			}
			
			const { email, password } = req.body;
			const userData = await userService.registration(email, password);
			res.cookie('refreshToken', userData.refreshToken, {
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: true,
			});
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	login: async (req, res, next) => {
		try {
			const {email, password} = req.body;
			const userData = await userService.login(email, password);
			res.cookie('refreshToken', userData.refreshToken, {
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: true,
			});
			
			// Автоматически восстанавливаем все Luxee контексты пользователя
			try {
				console.log(`[User Login] Restoring Luxee contexts for user ${userData.user.id}`);
				await luxeeAuthService.restoreAllSessions({ userId: userData.user.id });
			} catch (error) {
				console.error('[User Login] Error restoring Luxee contexts:', error.message);
				// Не прерываем логин если не удалось восстановить контексты
			}
			
			// Автоматически запускаем автоответы для всех аккаунтов с включенным AI
			try {
				console.log(`[User Login] Starting AI auto-responses for user ${userData.user.id}`);
				await aiAutoResponseService.startForUser(userData.user.id);
			} catch (error) {
				console.error('[User Login] Error starting AI auto-responses:', error.message);
				// Не прерываем логин если не удалось запустить автоответы
			}
			
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	logout: async(req, res, next) => {
		try {
			const { refreshToken } = req.cookies;
			// Получаем userId из токена если есть
			let userId = null;
			try {
				const userData = tokenService.validateRefreshToken(refreshToken);
				userId = userData?.id;
			} catch (e) {
				// Токен невалиден, но продолжаем logout
			}
			
			const token = await userService.logout(refreshToken, userId);
			res.clearCookie('refreshToken');
			return res.json(token);
		} catch (error) {
			next(error);
		}
	},
	refresh: async(req, res, next) => {
		try {
			const { refreshToken } = req.cookies;
			const userData = await userService.refresh(refreshToken);
			res.cookie('refreshToken', userData.refreshToken, {
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: true,
			});
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	getUsers: async(req, res, next) => {
		try {
			const users = await userService.getAllUsers();
			return res.json(users);
		} catch (error) {
			next(error);
		}
	},
	deleteUser: async(req, res, next) => {
		try {
			const { userId } = req.params;
			const requestingUserId = req.user.id; // ID текущего пользователя из middleware
			
			const result = await userService.deleteUser(userId, requestingUserId);
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
};

export default UserController;
