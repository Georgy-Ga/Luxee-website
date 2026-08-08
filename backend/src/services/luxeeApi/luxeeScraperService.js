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
				const profiles = [];
				
				// Парсим плитки профилей (.profile-tile-wrap-outside)
				document.querySelectorAll('.profile-tile-wrap-outside').forEach(tile => {
					try {
						const link = tile.querySelector('a.profile-tile-wrap__img');
						const username = tile.querySelector('.username')?.textContent?.trim();
						const location = tile.querySelector('.location')?.textContent?.trim();
						const ageText = tile.querySelector('.age')?.textContent?.trim(); // "37 yrs"
						const uidText = tile.querySelector('.uid')?.textContent?.trim(); // "Uid: 609024"
						
						// Извлекаем числа
						const age = ageText ? parseInt(ageText.match(/\d+/)?.[0]) : null;
						const uid = uidText ? parseInt(uidText.match(/\d+/)?.[0]) : null;
						
						// URL картинки из style background-image
						const style = link?.getAttribute('style') || '';
						const imageUrlMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
						const imageUrl = imageUrlMatch ? imageUrlMatch[1] : null;
						
						// URL профиля
						const profileUrl = link?.getAttribute('href'); // "/profile/update/609024/"
						
						// Disabled?
						const actionDiv = tile.querySelector('.profile-tile-wrap__action');
						const isDisabled = actionDiv?.textContent?.includes('Disabled') || false;
						
						if (uid && username) {
							profiles.push({
								uid,
								username,
								age,
								country: location,
								imageUrl,
								profileUrl,
								isDisabled,
							});
						}
					} catch (error) {
						console.error('[Luxee Scraper] Error parsing profile tile:', error);
					}
				});
				
				return {
					profiles,
					profilesCount: profiles.length,
					hasProfiles: profiles.length > 0,
					pageTitle: document.title,
					url: window.location.href,
				};
			},
		});
			
		// Синхронизируем профили в кеш
		if (profilesData.profiles && profilesData.profiles.length > 0) {
			const { default: profileCacheService } = await import('./profileCacheService.js');
			await profileCacheService.syncProfilesFromList(accountId, profilesData.profiles);
		}
		
		// Обновляем активность аккаунта
		account.lastActivity = new Date();
		await account.save();
		
		console.log('[Luxee Scraper] Profiles data retrieved:', {
			count: profilesData.profilesCount,
			hasProfiles: profilesData.hasProfiles,
		});
		
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
