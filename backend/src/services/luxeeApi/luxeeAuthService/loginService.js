// Модуль для авторизации на Luxee
import ApiError from '../../../exceptions/apiError.js';
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
import chatNavigationService from '../chatNavigationService.js';
import keepAliveService from '../keepAliveService.js';
import messageCheckIntervalService from '../messageCheckIntervalService.js';
import profileActivationService from '../profileActivationService.js';

/**
 * Авторизация на Luxee
 */
export const login = async ({ userId, luxeeEmail, luxeePassword }) => {
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
		
		// Создаём НОВЫЙ контекст с правильным размером окна
		const context = await browserService.createContext({
			accountId: tempAccountId,
			sessionData: null, // Всегда новая сессия при логине
		});

		const page = await pageHelpers.getOrCreatePage(context);
		
		// Устанавливаем размер окна (чтобы все элементы были видны)
		await page.setViewportSize({ width: 1920, height: 1080 });
		console.log('[Luxee Auth] Viewport set to 1920x1080');

		// Переходим на сайт Luxee
		console.log('[Luxee Auth] Navigating to luxee.io');
		await pageHelpers.navigateTo({ page, url: 'https://luxee.io/' });

		// Ждём полной загрузки страницы (несколько методов)
		console.log('[Luxee Auth] Waiting for page to load...');
		await page.waitForLoadState('domcontentloaded');
		console.log('[Luxee Auth] DOM loaded');
		
		await page.waitForLoadState('networkidle');
		console.log('[Luxee Auth] Network idle');
		
		// Дополнительная задержка для полной загрузки
		await page.waitForTimeout(1000);
		console.log('[Luxee Auth] Page fully loaded, ready for API call');

		// Авторизация через API (быстрее и надёжнее)
		console.log('[Luxee Auth] Sending login request to API...');
		console.log('[Luxee Auth] Email:', luxeeEmail);
		
		const loginResponse = await page.evaluate(async ({ email, password }) => {
			console.log('[Browser] Starting API login request');
			console.log('[Browser] Email:', email);
			
			try {
				const requestBody = {
					username: email,
					password: password,
					rememberMe: true
				};
				
				console.log('[Browser] Request body:', requestBody);
				
				const response = await fetch('https://luxee.io/luxee-api/login/', {
					method: 'POST',
					headers: {
						'accept': 'application/json, text/plain, */*',
						'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
						'content-type': 'application/json',
						'sec-fetch-dest': 'empty',
						'sec-fetch-mode': 'cors',
						'sec-fetch-site': 'same-origin',
					},
					body: JSON.stringify(requestBody)
				});
				
				console.log('[Browser] Response status:', response.status);
				console.log('[Browser] Response ok:', response.ok);
				
				const data = await response.json();
				console.log('[Browser] Response data:', data);
				
				return { 
					success: response.ok, 
					data, 
					status: response.status,
					headers: Object.fromEntries(response.headers.entries())
				};
			} catch (error) {
				console.error('[Browser] API login error:', error);
				return { success: false, error: error.message, stack: error.stack };
			}
		}, { email: luxeeEmail, password: luxeePassword });

		console.log('[Luxee Auth] API login response:', JSON.stringify(loginResponse, null, 2));

		if (!loginResponse.success) {
			console.error('[Luxee Auth] Login failed:', loginResponse);
			throw ApiError.BadRequest(`Неверный логин или пароль Luxee. Status: ${loginResponse.status}, Error: ${loginResponse.error || 'Unknown'}`);
		}
		
		console.log('[Luxee Auth] API login successful!');

		// Получаем redirect_url из ответа
		const redirectUrl = loginResponse.data?.data?.redirect_url;
		console.log('[Luxee Auth] Redirect URL from API:', redirectUrl);

		if (redirectUrl) {
			// Переходим по redirect_url
			console.log('[Luxee Auth] Navigating to redirect URL:', redirectUrl);
			await pageHelpers.navigateTo({ page, url: redirectUrl });
			await page.waitForLoadState('networkidle');
			console.log('[Luxee Auth] Redirected successfully to:', page.url());
		} else {
			// Если нет redirect_url, пробуем перейти на /profile/
			console.log('[Luxee Auth] No redirect URL, trying /profile/');
			await pageHelpers.navigateTo({ page, url: 'https://luxee.io/profile/' });
			await page.waitForLoadState('networkidle');
		}

		const currentUrl = page.url();
		console.log('[Luxee Auth] Current URL after redirect:', currentUrl);

		// Проверяем что мы на правильной странице
		if (!currentUrl.includes('/profile/') && !currentUrl.includes('/dashboard/')) {
			console.error('[Luxee Auth] Not on profile/dashboard page. URL:', currentUrl);
			await browserService.closeContext(tempAccountId);
			throw ApiError.BadRequest('Не удалось перейти на страницу профиля после авторизации');
		}

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

		// ✅ Активируем первый профиль
		console.log('[Luxee Auth] Activating first profile');
		await profileActivationService.activateFirstProfile({ page });

		// Запускаем keep-alive для поддержания активности
		console.log('[Luxee Auth] Starting keep-alive');
		await keepAliveService.start({ 
			accountId: finalAccountId, 
			context,
		});

		// Запускаем автоматическую проверку сообщений каждые 8 секунд
		console.log('[Luxee Auth] Starting message check interval');
		messageCheckIntervalService.start({ userId });

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
};
