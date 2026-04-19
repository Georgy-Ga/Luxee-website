import browserManager from './browserManager.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import ApiError from '../../exceptions/apiError.js';

const luxeeAuthService = {
	login: async (userId, luxeeEmail, luxeePassword) => {
		try {
			console.log(`[Luxee Auth] Starting login for user ${userId}`);
			
			// Проверяем, есть ли уже активная сессия
			let luxeeAccount = await LuxeeAccountModel.findOne({ user: userId, luxeeEmail });
			
			// Создаём или восстанавливаем контекст браузера
			const context = await browserManager.createContext(
				userId,
				luxeeAccount?.sessionData
			);
			
			const page = await context.newPage();
			
			// Переходим на сайт Luxee
			console.log('[Luxee Auth] Navigating to luxee.io');
			await page.goto('https://luxee.io/', { waitUntil: 'networkidle' });
			
			// Нажимаем на кнопку Log In
			console.log('[Luxee Auth] Clicking Log In button');
			await page.click('button.log__in');
			
			// Ждём появления формы логина
			await page.waitForSelector('.form__inner.login', { state: 'visible' });
			console.log('[Luxee Auth] Login form appeared');
			
			// Вводим email
			await page.fill('input[name="userIdentifier"]', luxeeEmail);
			console.log('[Luxee Auth] Email entered');
			
			// Вводим пароль
			await page.fill('input[name="password"]', luxeePassword);
			console.log('[Luxee Auth] Password entered');
			
			// Нажимаем кнопку Sign in
			await page.click('button.global__button.form');
			console.log('[Luxee Auth] Sign in button clicked');
			
			// Ждём навигации после логина
			await page.waitForLoadState('networkidle');
			
			// Проверяем успешность логина (если остались на той же странице - ошибка)
			const currentUrl = page.url();
			console.log('[Luxee Auth] Current URL after login:', currentUrl);
			
			if (currentUrl === 'https://luxee.io/' || currentUrl.includes('luxee.io/#')) {
				throw ApiError.BadRequest('Неверный логин или пароль Luxee');
			}
			
			// Сохраняем сессию
			console.log('[Luxee Auth] Saving session');
			const sessionData = await browserManager.saveSession(userId, context);
			
			// Сохраняем или обновляем аккаунт в БД
			if (luxeeAccount) {
				luxeeAccount.sessionData = sessionData;
				luxeeAccount.isActive = true;
				luxeeAccount.lastActivity = new Date();
				await luxeeAccount.save();
			} else {
				luxeeAccount = await LuxeeAccountModel.create({
					user: userId,
					luxeeEmail,
					luxeePassword,
					sessionData,
					isActive: true,
				});
			}
			
			console.log('[Luxee Auth] Login successful');
			
			return {
				success: true,
				message: 'Успешная авторизация на Luxee',
				accountId: luxeeAccount._id,
				luxeeEmail,
				currentUrl,
			};
		} catch (error) {
			console.error('[Luxee Auth] Error:', error);
			throw error;
		}
	},

	getLuxeeAccounts: async userId => {
		try {
			const accounts = await LuxeeAccountModel.find({ user: userId });
			return accounts.map(acc => ({
				id: acc._id,
				luxeeEmail: acc.luxeeEmail,
				isActive: acc.isActive,
				lastActivity: acc.lastActivity,
				createdAt: acc.createdAt,
			}));
		} catch (error) {
			console.error('[Luxee Auth] Error getting accounts:', error);
			throw error;
		}
	},

	deleteLuxeeAccount: async (userId, accountId) => {
		try {
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});
			
			if (!account) {
				throw ApiError.BadRequest('Аккаунт не найден');
			}
			
			// Закрываем браузер если открыт
			await browserManager.closeBrowser(userId);
			
			await LuxeeAccountModel.deleteOne({ _id: accountId });
			
			return { success: true, message: 'Аккаунт Luxee удалён' };
		} catch (error) {
			console.error('[Luxee Auth] Error deleting account:', error);
			throw error;
		}
	},

	restoreSession: async (userId, accountId) => {
		try {
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});
			
			if (!account) {
				throw ApiError.BadRequest('Аккаунт не найден');
			}
			
			if (!account.sessionData) {
				throw ApiError.BadRequest('Нет сохранённой сессии');
			}
			
			// Создаём контекст с сохранённой сессией
			const context = await browserManager.createContext(
				userId,
				account.sessionData
			);
			
			const page = await context.newPage();
			await page.goto('https://luxee.io/', { waitUntil: 'networkidle' });
			
			const currentUrl = page.url();
			console.log('[Luxee Auth] Session restored, URL:', currentUrl);
			
			// Обновляем активность
			account.isActive = true;
			account.lastActivity = new Date();
			await account.save();
			
			return {
				success: true,
				message: 'Сессия восстановлена',
				currentUrl,
			};
		} catch (error) {
			console.error('[Luxee Auth] Error restoring session:', error);
			throw error;
		}
	},
};

export default luxeeAuthService;
