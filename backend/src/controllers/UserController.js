import userService from '../services/userService.js';
import { validationResult } from 'express-validator';
import ApiError from '../exceptions/apiError.js';
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
			return res.json(userData);
		} catch (error) {
			next(error);
		}
	},
	logout: async(req, res, next) => {
		try {
			const { refreshToken } = req.cookies;
			const token = await userService.logout(refreshToken);
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
};

export default UserController;
