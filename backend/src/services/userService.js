import bcrypt from 'bcrypt';
import UserDto from '../dtos/UserDto.js';
import UserModel from '../models/UserModel.js';
import tokenService from './tokenService.js';
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
	logout: async refreshToken => {
		const token = await tokenService.removeToken(refreshToken);
		return token;
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
	}
};

export default userService;
