import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import ApiError from '../../exceptions/apiError.js';

const luxeeScraperService = {
	getProfiles: async ({ userId, accountId }) => {
		try {
			console.log(`[Luxee Scraper] Getting profiles for user ${userId}, account ${accountId}`);
			
			// Получаем аккаунт из БД
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});
			
			if (!account) {
				throw ApiError.BadRequest('Аккаунт не найден');
			}
			
			// Получаем или создаём контекст браузера
			let context = browserService.getContext(accountId);
			
			if (!context) {
				if (!account.sessionData) {
					throw ApiError.BadRequest('Нет активной сессии. Авторизуйтесь на Luxee');
				}
				
				context = await browserService.createContext({
					accountId,
					sessionData: account.sessionData,
				});
			}
			
			// Получаем страницу
			const page = await pageHelpers.getOrCreatePage(context);
			
			// Переходим на страницу профилей
			console.log('[Luxee Scraper] Navigating to profiles page');
			await pageHelpers.navigateTo({ 
				page, 
				url: 'https://luxee.io/profile/',
			});
			
			// Ждём загрузки контента
			await page.waitForTimeout(2000);
			
			// Парсим данные со страницы
			const { data: profilesData } = await pageHelpers.extractData({
				page,
				extractor: () => {
					const data = {
						username: null,
						profilesCount: 0,
						hasProfiles: false,
						pageTitle: document.title,
						url: window.location.href,
					};
					
					// Получаем имя пользователя
					const usernameEl = document.querySelector('.profile_info h2');
					if (usernameEl) {
						data.username = usernameEl.textContent.trim();
					}
					
					// Проверяем наличие профилей
					const noProfilesAlert = document.querySelector('.alert.alert-info');
					if (noProfilesAlert && noProfilesAlert.textContent.includes('There are no profiles yet')) {
						data.hasProfiles = false;
						data.profilesCount = 0;
					} else {
						data.hasProfiles = true;
					}
					
					// Получаем навигационное меню
					const menuItems = [];
					document.querySelectorAll('#sidebar-menu .nav.side-menu > li').forEach(item => {
						const link = item.querySelector('a');
						if (link) {
							const icon = link.querySelector('i');
							const span = link.querySelector('span');
							menuItems.push({
								text: span ? span.textContent.trim() : '',
								icon: icon ? icon.className : '',
								href: link.getAttribute('href'),
							});
						}
					});
					data.menuItems = menuItems;
					
					return data;
				},
			});
			
			// Обновляем активность аккаунта
			account.lastActivity = new Date();
			await account.save();
			
			console.log('[Luxee Scraper] Profiles data retrieved:', profilesData);
			
			return {
				success: true,
				data: profilesData,
				accountEmail: account.luxeeEmail,
			};
		} catch (error) {
			console.error('[Luxee Scraper] Error:', error);
			throw error;
		}
	},

	getPageContent: async ({ userId, accountId, url }) => {
		try {
			console.log(`[Luxee Scraper] Getting page content for ${url}`);
			
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});
			
			if (!account) {
				throw ApiError.BadRequest('Аккаунт не найден');
			}
			
			let context = browserService.getContext(accountId);
			
			if (!context) {
				if (!account.sessionData) {
					throw ApiError.BadRequest('Нет активной сессии');
				}
				context = await browserService.createContext({
					accountId,
					sessionData: account.sessionData,
				});
			}
			
			const page = await pageHelpers.getOrCreatePage(context);
			await pageHelpers.navigateTo({ page, url });
			await page.waitForTimeout(1000);
			
			const content = await pageHelpers.getPageContent({ page });
			const currentUrl = pageHelpers.getCurrentUrl(page);
			
			return {
				success: true,
				url: currentUrl,
				content,
			};
		} catch (error) {
			console.error('[Luxee Scraper] Error getting page content:', error);
			throw error;
		}
	},
};

export default luxeeScraperService;
