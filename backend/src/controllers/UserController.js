import { randomUUID } from 'crypto';
import userService from '../services/userService.js';
import tokenService from '../services/tokenService.js';
import auditService from '../services/auditService.js';
import { validationResult } from 'express-validator';
import ApiError from '../exceptions/apiError.js';
import luxeeAuthService from '../services/luxeeApi/luxeeAuthService/index.js';
import aiAutoResponseService from '../services/aiAutoResponseService.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => ({
	maxAge: REFRESH_MAX_AGE,
	httpOnly: true,
	// Важно для мультивхода за одним userId: clearCookie обязан совпадать с setCookie,
	// иначе logout в проде (HTTPS) не сотрёт куку.
	sameSite: 'lax',
	// secure только если явно включено через COOKIE_SECURE=true.
	// На production по HTTP (без SSL-терминации nginx) secure:true отрежет куку и auth сломается.
	secure: process.env.COOKIE_SECURE === 'true',
	path: '/',
});

const getSessionMeta = req => ({
	// deviceId стабилен на браузер: фронт присылает x-device-id (localStorage) и x-device-name.
	// Если заголовка нет (старый клиент) — генерируем: сессия всё равно отдельная, чужие не затираются.
	deviceId: req.headers['x-device-id'] || req.cookies?.deviceId || randomUUID(),
	deviceName: req.headers['x-device-name'] || null,
	ip: req.ip || null,
	userAgent: req.headers['user-agent'] || null,
});
const UserController = {
	registration: async (req, res, next) => {
		try {
			const errors = validationResult(req);
			if(!errors.isEmpty()) {
				return next(ApiError.BadRequest('Validation error', errors.array()));
			}
			
			const { email, password } = req.body;
			const userData = await userService.registration(email, password, getSessionMeta(req));
			res.cookie(REFRESH_COOKIE, userData.refreshToken, getCookieOptions());
			await auditService.log({ userId: userData.user.id, action: 'auth.register', req });
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	login: async (req, res, next) => {
		try {
			const {email, password} = req.body;
			const userData = await userService.login(email, password, getSessionMeta(req));
			res.cookie(REFRESH_COOKIE, userData.refreshToken, getCookieOptions());
			
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

			await auditService.log({ userId: userData.user.id, action: 'auth.login', req });
			
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	logout: async(req, res, next) => {
		try {
			const { refreshToken } = req.cookies;
			// Выход ОДНОЙ сессии: контексты/AI не останавливаем — коллеги остаются в системе.
			const token = await userService.logout(refreshToken);
			try {
				const userData = tokenService.validateRefreshToken(refreshToken);
				if (userData?.id) {
					await auditService.log({ userId: userData.id, action: 'auth.logout', req });
				}
			} catch {
				// аудит не должен ломать logout
			}
			res.clearCookie(REFRESH_COOKIE, getCookieOptions());
			return res.json(token);
		} catch (error) {
			next(error);
		}
	},
	logoutAll: async (req, res, next) => {
		try {
			// Только здесь — полный cleanup (остановка AI/браузеров): вышли ВСЕ сессии.
			const result = await userService.logoutAll(req.user.id);
			await auditService.log({ userId: req.user.id, action: 'auth.logout_all', req });
			res.clearCookie(REFRESH_COOKIE, getCookieOptions());
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
	refresh: async(req, res, next) => {
		try {
			const { refreshToken } = req.cookies;
			const userData = await userService.refresh(refreshToken, getSessionMeta(req));
			res.cookie(REFRESH_COOKIE, userData.refreshToken, getCookieOptions());
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	getSessions: async (req, res, next) => {
		try {
			const sessions = await tokenService.listSessions(req.user.id);
			const current = req.cookies?.[REFRESH_COOKIE]
				? await tokenService.findToken(req.cookies[REFRESH_COOKIE])
				: null;
			return res.json(
				sessions.map(s => ({
					id: s._id.toString(),
					deviceId: s.deviceId,
					deviceName: s.deviceName,
					ip: s.ip,
					lastUsedAt: s.lastUsedAt,
					createdAt: s.createdAt,
					isCurrent: current ? current._id.toString() === s._id.toString() : false,
				})),
			);
		} catch (error) {
			next(error);
		}
	},
	revokeSession: async (req, res, next) => {
		try {
			const { sessionId } = req.params;
			const current = req.cookies?.[REFRESH_COOKIE]
				? await tokenService.findToken(req.cookies[REFRESH_COOKIE])
				: null;
			const result = await tokenService.removeSession(req.user.id, sessionId);
			if (result.deletedCount === 0) {
				return next(ApiError.BadRequest('Сессия не найдена'));
			}
			await auditService.log({
				userId: req.user.id,
				action: 'auth.revoke_session',
				detail: sessionId,
				req,
			});
			// Если закрыли свою текущую сессию — чистим куку, без глобального cleanup.
			if (current && current._id.toString() === sessionId) {
				res.clearCookie(REFRESH_COOKIE, getCookieOptions());
			}
			return res.json({ success: true });
		} catch (error) {
			next(error);
		}
	},
	getAudit: async (req, res, next) => {
		try {
			const { limit, accountId } = req.query;
			const items = await auditService.list(req.user.id, { limit, accountId });
			return res.json(items);
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
