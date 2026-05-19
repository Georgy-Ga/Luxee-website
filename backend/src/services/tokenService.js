import jwt from 'jsonwebtoken';
import TokenModel from '../models/TokenModel.js';
import { validate } from 'uuid';
const tokenService = {
	generateTokens: payload => {
		const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
			expiresIn: '300m',
		});
		const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
			expiresIn: '30d',
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
	saveToken: async (userId, refreshToken) => {
		const tokenData = await TokenModel.findOne({ user: userId });
		if (tokenData) {
			tokenData.refreshToken = refreshToken;
			return tokenData.save();
		}
		const token = await TokenModel.create({ user: userId, refreshToken });
		return token;
	},
	removeToken: async refreshToken => {
		const tokenData = await TokenModel.deleteOne({ refreshToken });
		return tokenData;
	},
	findToken: async refreshToken => {
		const tokenData = await TokenModel.findOne({ refreshToken });
		return tokenData;
	},
	removeTokenByUserId: async userId => {
		const tokenData = await TokenModel.deleteOne({ user: userId });
		return tokenData;
	}
};

export default tokenService;


