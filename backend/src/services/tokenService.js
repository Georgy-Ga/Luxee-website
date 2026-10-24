import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import TokenModel from '../models/TokenModel.js';

const getAccessExpiresIn = () => process.env.JWT_ACCESS_EXPIRES || '300m';
const getRefreshExpiresIn = () => process.env.JWT_REFRESH_EXPIRES || '30d';

const tokenService = {
	generateTokens: payload => {
		// jti делает каждый токен уникальным даже при параллельных логинах;
		// sid привязывает пару access/refresh к сессии (устройству).
		const base = { ...payload, jti: randomUUID() };
		const accessToken = jwt.sign(base, process.env.JWT_ACCESS_SECRET, {
			expiresIn: getAccessExpiresIn(),
		});
		const refreshToken = jwt.sign(base, process.env.JWT_REFRESH_SECRET, {
			expiresIn: getRefreshExpiresIn(),
		});
		return { accessToken, refreshToken };
	},
	validateAccessToken: token => {
		try {
			const userData = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
			return userData;
		} catch (error) {
			return null;
		}
	},
	validateRefreshToken: token => {
		try {
			const userData = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
			return userData;
		} catch (error) {
			return null;
		}
	},
	/**
	 * Мультисессии: второй логин НЕ затирает первый.
	 * Один и тот же браузер (deviceId) — ротация своей записи,
	 * новый браузер — новая запись.
	 */
	saveToken: async (userId, refreshToken, meta = {}) => {
		const deviceId = meta.deviceId || undefined;
		const base = {
			refreshToken,
			...(meta.deviceName ? { deviceName: meta.deviceName } : {}),
			...(meta.ip ? { ip: meta.ip } : {}),
			...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
			lastUsedAt: new Date(),
		};
		if (deviceId) {
			const updated = await TokenModel.findOneAndUpdate(
				{ user: userId, deviceId },
				{ $set: base },
				{ returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
			);
			return updated;
		}
		// Без deviceId (старые клиенты): каждая запись отдельная, чужие не трогаем.
		const token = await TokenModel.create({ user: userId, refreshToken, ...base });
		return token;
	},
	/** Ротация refresh в пределах СВОЕЙ сессии (старый становится недействителен). */
	rotateToken: async (oldRefreshToken, newRefreshToken, meta = {}) => {
		const updated = await TokenModel.findOneAndUpdate(
			{ refreshToken: oldRefreshToken },
			{
				$set: {
					refreshToken: newRefreshToken,
					lastUsedAt: new Date(),
					...(meta.ip ? { ip: meta.ip } : {}),
					...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
				},
			},
			{ returnDocument: 'after' },
		);
		return updated;
	},
	touchToken: async refreshToken => {
		await TokenModel.updateOne({ refreshToken }, { $set: { lastUsedAt: new Date() } }).exec();
	},
	removeToken: async refreshToken => {
		if (!refreshToken) return { deletedCount: 0 };
		const tokenData = await TokenModel.deleteOne({ refreshToken });
		return tokenData;
	},
	findToken: async refreshToken => {
		if (!refreshToken) return null;
		const tokenData = await TokenModel.findOne({ refreshToken });
		return tokenData;
	},
	/** Все сессии пользователя (для экрана «Активные сессии»). */
	listSessions: async userId => {
		const sessions = await TokenModel.find({ user: userId })
			.sort({ lastUsedAt: -1 })
			.lean();
		return sessions;
	},
	/** Закрыть одну чужую/текущую сессию (без глобального cleanup). */
	removeSession: async (userId, sessionId) => {
		const res = await TokenModel.deleteOne({ _id: sessionId, user: userId });
		return res;
	},
	removeTokenByUserId: async userId => {
		// Оставлено для совместимости; удаляет ВСЕ сессии (logout-all / deleteUser).
		const tokenData = await TokenModel.deleteMany({ user: userId });
		return tokenData;
	},
	removeAllByUserId: async userId => {
		const tokenData = await TokenModel.deleteMany({ user: userId });
		return tokenData;
	},
};

export default tokenService;
