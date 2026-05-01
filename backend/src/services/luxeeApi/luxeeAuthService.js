import ApiError from '../../exceptions/apiError.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import chatNavigationService from './chatNavigationService.js';
import keepAliveService from './keepAliveService.js';

const luxeeAuthService = {
	login: async ({ userId, luxeeEmail, luxeePassword }) => {
		let tempAccountId = null;
		
		try {
			console.log(`[Luxee Auth] Starting login for user ${userId}`);

			// Проверяем существующий аккаунт
			let luxeeAccount = await LuxeeAccountModel.findOne({
				user: userId,
				luxeeEmail,
			});

			// Создаём уникальный ID для контекста
			tempAccountId = luxeeAccount?._id?.toString() || `temp_${userId}_${Date.now()}`;
			
			// Закрываем старый контекст если существует (для чистой авторизации)
			await browserService.closeContext(tempAccountId);
			console.log(`[Luxee Auth] Closed old context if existed`);
			
			// Создаём НОВЫЙ контекст без старой сессии
			const context = await browserService.createContext({
				accountId: tempAccountId,
				sessionData: null, // Всегда новая сессия при логине
			});

			const page = await pageHelpers.getOrCreatePage(context);

			// Переходим на сайт Luxee
			console.log('[Luxee Auth] Navigating to luxee.io');
			await pageHelpers.navigateTo({ page, url: 'https://luxee.io/' });

			// Задержка после загрузки страницы
			await page.waitForTimeout(300);
			console.log('[Luxee Auth] Page loaded, waiting 300ms');

		// Нажимаем на кнопку Log In
		console.log('[Luxee Auth] Clicking Log In button');
		await pageHelpers.safeClick({ page, selector: 'button.log__in' });

		// Увеличенная задержка после клика для загрузки формы
		await page.waitForTimeout(1000);
		console.log('[Luxee Auth] Waiting for login form...');

		// Ждём появления формы логина с увеличенным таймаутом
		await pageHelpers.waitForElement({
			page,
			selector: '.form__inner.login',
			state: 'visible',
			timeout: 15000,
		});
		console.log('[Luxee Auth] Login form appeared');

			// Задержка перед вводом
			await page.waitForTimeout(300);

			// Вводим email
			await pageHelpers.safeFill({
				page,
				selector: 'input[name="userIdentifier"]',
				value: luxeeEmail,
			});
			console.log('[Luxee Auth] Email entered');

			// Задержка между полями
			await page.waitForTimeout(300);

			// Вводим пароль
			await pageHelpers.safeFill({
				page,
				selector: 'input[name="password"]',
				value: luxeePassword,
			});
			console.log('[Luxee Auth] Password entered');

			// Задержка перед нажатием кнопки
			await page.waitForTimeout(300);

			// Нажимаем кнопку Sign in (ищем по тексту для надёжности)
			console.log('[Luxee Auth] Clicking Sign in button');
			await page.click('button:has-text("Sign in")');
			console.log('[Luxee Auth] Sign in button clicked');

			// Ждём успешной авторизации (проверяем URL в течение 10 секунд)
			console.log('[Luxee Auth] Waiting for successful login (checking URL for 10 seconds)...');
			let loginSuccess = false;
			const maxAttempts = 20; // 20 попыток по 500мс = 10 секунд
			
			for (let i = 0; i < maxAttempts; i++) {
				await page.waitForTimeout(500);
				const currentUrl = page.url();
				console.log(`[Luxee Auth] Attempt ${i + 1}/${maxAttempts}: ${currentUrl}`);
				
				if (currentUrl.includes('/profile/') || currentUrl.includes('/dashboard/')) {
					loginSuccess = true;
					console.log('[Luxee Auth] Login successful! URL changed to:', currentUrl);
					break;
				}
			}
			
			if (!loginSuccess) {
				const finalUrl = page.url();
				console.error('[Luxee Auth] Login failed. Final URL:', finalUrl);
				
				// Закрываем контекст при ошибке
				await browserService.closeContext(tempAccountId);
				console.log('[Luxee Auth] Context closed due to login failure');
				
				throw ApiError.BadRequest('Неверный логин или пароль Luxee');
			}
			
			const currentUrl = page.url();

			// Сохраняем сессию
			console.log('[Luxee Auth] Saving session');
			const sessionData = await browserService.saveSessionState({
				accountId: tempAccountId,
				context,
			});

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

			const finalAccountId = luxeeAccount._id.toString();

			// Если tempAccountId отличается от finalAccountId, обновляем ключ в Map
			if (tempAccountId !== finalAccountId) {
				console.log(`[Luxee Auth] Updating context key from ${tempAccountId} to ${finalAccountId}`);
				browserService.updateContextKey(tempAccountId, finalAccountId);
			}

			// Переходим в раздел чатов
			console.log('[Luxee Auth] Navigating to chats section');
			await chatNavigationService.navigateToChats({ page });

			// Запускаем keep-alive для поддержания активности
			console.log('[Luxee Auth] Starting keep-alive');
			await keepAliveService.start({ 
				accountId: finalAccountId, 
				context,
			});

			console.log('[Luxee Auth] Login successful');

			return {
				success: true,
				message: 'Успешная авторизация на Luxee',
				accountId: luxeeAccount._id,
				luxeeEmail,
				currentUrl: page.url(),
			};
		} catch (error) {
			console.error('[Luxee Auth] Error:', error);
			
			// Закрываем контекст при любой ошибке
			if (tempAccountId) {
				await browserService.closeContext(tempAccountId);
				console.log('[Luxee Auth] Context closed due to error');
			}
			
			throw error;
		}
	},

	getLuxeeAccounts: async ({ userId }) => {
		try {
			const accounts = await LuxeeAccountModel.find({ user: userId });
			return accounts.map(
				({ _id, luxeeEmail, isActive, lastActivity, createdAt }) => ({
					id: _id,
					luxeeEmail,
					isActive,
					lastActivity,
					createdAt,
				}),
			);
		} catch (error) {
			console.error('[Luxee Auth] Error getting accounts:', error);
			throw error;
		}
	},

	deleteLuxeeAccount: async ({ userId, accountId }) => {
		try {
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});

			if (!account) {
				throw ApiError.BadRequest('Аккаунт не найден');
			}

			// Останавливаем keep-alive
			keepAliveService.stop(accountId);

			// Закрываем контекст если открыт
			await browserService.closeContext(accountId);

			await LuxeeAccountModel.deleteOne({ _id: accountId });

			return { success: true, message: 'Аккаунт Luxee удалён' };
		} catch (error) {
			console.error('[Luxee Auth] Error deleting account:', error);
			throw error;
		}
	},

	restoreSession: async ({ userId, accountId }) => {
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
			const context = await browserService.createContext({
				accountId,
				sessionData: account.sessionData,
			});

			const page = await pageHelpers.getOrCreatePage(context);
			await pageHelpers.navigateTo({ page, url: 'https://luxee.io/chats/' });

			const currentUrl = pageHelpers.getCurrentUrl(page);
			console.log('[Luxee Auth] Session restored, URL:', currentUrl);

			// Запускаем keep-alive
			await keepAliveService.start({ accountId, context });

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

	// Восстановить все сессии пользователя (параллельно)
	restoreAllSessions: async ({ userId }) => {
		try {
			console.log(`[Luxee Auth] Restoring all sessions for user ${userId}`);
			
			const accounts = await LuxeeAccountModel.find({
				user: userId,
				sessionData: { $exists: true, $ne: null },
			});

			console.log(`[Luxee Auth] Found ${accounts.length} accounts with saved sessions`);

			// Восстанавливаем все сессии ПАРАЛЛЕЛЬНО
			const restorePromises = accounts.map(async (account) => {
				try {
					const accountId = account._id.toString();
					
					// Проверяем, может контекст уже существует
					const existingContext = browserService.getContext(accountId);
					if (existingContext) {
						console.log(`[Luxee Auth] Context already exists for ${account.luxeeEmail}`);
						return {
							accountId,
							luxeeEmail: account.luxeeEmail,
							status: 'already_active',
						};
					}

					// Восстанавливаем сессию
					await luxeeAuthService.restoreSession({ userId, accountId });
					
					console.log(`[Luxee Auth] Restored session for ${account.luxeeEmail}`);
					return {
						accountId,
						luxeeEmail: account.luxeeEmail,
						status: 'restored',
					};
				} catch (error) {
					console.error(`[Luxee Auth] Failed to restore ${account.luxeeEmail}:`, error.message);
					return {
						accountId: account._id.toString(),
						luxeeEmail: account.luxeeEmail,
						status: 'failed',
						error: error.message,
					};
				}
			});

			// Ждём завершения всех восстановлений
			const results = await Promise.all(restorePromises);

			const restoredCount = results.filter(r => r.status === 'restored').length;
			console.log(`[Luxee Auth] Restored ${restoredCount}/${accounts.length} sessions (parallel)`);

			return {
				success: true,
				restored: restoredCount,
				total: accounts.length,
				results,
			};
		} catch (error) {
			console.error('[Luxee Auth] Error restoring all sessions:', error);
			throw error;
		}
	},
};

export default luxeeAuthService;
