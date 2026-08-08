// Profile Cache Sync Service - Временный контекст для парсинга профилей
// Создает временный контекст, парсит /profile/, обновляет кеш, закрывает контекст

import profileCacheService from './profileCacheService.js';

/**
 * Синхронизировать кеш профилей через временный контекст
 * Создает временный контекст с авторизацией, парсит /profile/, обновляет кеш
 * 
 * @param {string} accountId - ID аккаунта
 * @param {string} sessionData - JSON сессии (для авторизации)
 * @returns {Promise<Object>} - { success: boolean, profilesCount: number, updated: number }
 */
const syncProfileCache = async (accountId, sessionData) => {
	const { default: browserService } = await import('../browser/browserService.js');
	
	const tempContextId = `${accountId}_temp_profile_sync`;
	let tempContext = null;
	
	try {
		console.log(`[Profile Cache Sync] 🚀 Creating temporary context for account ${accountId}`);
		
		// 1️⃣ Создать временный контекст с авторизацией
		const browser = await browserService.getBrowser();
		
		const storageState = typeof sessionData === 'string' 
			? JSON.parse(sessionData) 
			: sessionData;
		
		tempContext = await browser.newContext({
			storageState,
			viewport: { width: 1920, height: 1080 },
		});
		
		console.log(`[Profile Cache Sync] ✅ Temporary context created`);
		
		// 2️⃣ Открыть новую страницу
		const page = await tempContext.newPage();
		console.log(`[Profile Cache Sync] 🌐 Navigating to /profile/...`);
		
		// 3️⃣ Перейти на /profile/
		await page.goto('https://luxee.io/profile/', {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});
		
		// Ждем загрузки
		await page.waitForTimeout(3000);
		
		console.log(`[Profile Cache Sync] ✅ Page loaded`);
		
		// 4️⃣ Парсинг плиток профилей
		const profiles = await page.evaluate(() => {
			const profilesList = [];
			
			const tiles = document.querySelectorAll('.profile-tile-wrap-outside');
			
			tiles.forEach(tile => {
				try {
					// Username
					const usernameEl = tile.querySelector('.username');
					const username = usernameEl?.textContent?.trim();
					
					// Age
					const ageEl = tile.querySelector('.age');
					const ageText = ageEl?.textContent?.trim();
					const age = ageText ? parseInt(ageText.match(/\d+/)?.[0]) : null;
					
					// Country
					const locationEl = tile.querySelector('.location');
					const country = locationEl?.textContent?.trim();
					
					// UID (из data-uid или текста)
					const uidText = tile.querySelector('.uid')?.textContent;
					const uid = uidText ? parseInt(uidText.match(/\d+/)?.[0]) : null;
					
					// Image URL
					const imgEl = tile.querySelector('.profile-img img');
					const imageUrl = imgEl?.src;
					
					// Is Disabled (если есть класс disabled)
					const isDisabled = tile.classList.contains('disabled') || false;
					
					if (uid && username) {
						profilesList.push({
							uid,
							username,
							age,
							country,
							imageUrl,
							isDisabled,
						});
					}
				} catch (error) {
					console.error('[Profile Parser] Error parsing tile:', error);
				}
			});
			
			return profilesList;
		});
		
		console.log(`[Profile Cache Sync] 📊 Parsed ${profiles.length} profiles`);
		
		// 5️⃣ Синхронизировать в кеш
		if (profiles.length > 0) {
			await profileCacheService.syncProfilesFromList(accountId, profiles);
		}
		
		// 6️⃣ Закрыть временный контекст
		await tempContext.close();
		console.log(`[Profile Cache Sync] ✅ Temporary context closed`);
		
		return {
			success: true,
			profilesCount: profiles.length,
			updated: profiles.length,
		};
		
	} catch (error) {
		console.error(`[Profile Cache Sync] ❌ Error syncing cache:`, error);
		
		// Закрыть контекст при ошибке
		if (tempContext) {
			try {
				await tempContext.close();
				console.log(`[Profile Cache Sync] 🧹 Temporary context closed (error cleanup)`);
			} catch (closeError) {
				console.error(`[Profile Cache Sync] Error closing temp context:`, closeError);
			}
		}
		
		return {
			success: false,
			profilesCount: 0,
			updated: 0,
			error: error.message,
		};
	}
};

/**
 * Синхронизировать один профиль (детали с /profile/update/{uid}/)
 * @param {string} accountId - ID аккаунта
 * @param {number} profileUid - UID профиля
 * @param {string} sessionData - JSON сессии
 * @returns {Promise<Object>} - Данные профиля или null
 */
const syncSingleProfile = async (accountId, profileUid, sessionData) => {
	const { default: browserService } = await import('../browser/browserService.js');
	
	let tempContext = null;
	
	try {
		console.log(`[Profile Cache Sync] 🚀 Syncing single profile ${profileUid}`);
		
		// Создать временный контекст
		const browser = await browserService.getBrowser();
		const storageState = typeof sessionData === 'string' 
			? JSON.parse(sessionData) 
			: sessionData;
		
		tempContext = await browser.newContext({
			storageState,
			viewport: { width: 1920, height: 1080 },
		});
		
		const page = await tempContext.newPage();
		
		// Перейти на /profile/update/{uid}/
		await page.goto(`https://luxee.io/profile/update/${profileUid}/`, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});
		
		await page.waitForTimeout(2000);
		
		// Парсинг детальных данных
		const profileData = await page.evaluate(() => {
			const data = {};
			
			// Username
			const usernameEl = document.querySelector('input[name="username"]');
			data.username = usernameEl?.value;
			
			// Birthday
			const birthdayEl = document.querySelector('input[name="birthday"]');
			data.birthday = birthdayEl?.value;
			
			// City
			const cityEl = document.querySelector('input[name="city"]');
			data.city = cityEl?.value;
			
			// Bio
			const bioEl = document.querySelector('textarea[name="bio"]');
			data.bio = bioEl?.value;
			
			// Occupation
			const occupationEl = document.querySelector('input[name="occupation"]');
			data.occupation = occupationEl?.value;
			
			// Height
			const heightEl = document.querySelector('input[name="height"]');
			data.height = heightEl?.value ? parseInt(heightEl.value) : null;
			
			// Weight
			const weightEl = document.querySelector('input[name="weight"]');
			data.weight = weightEl?.value ? parseInt(weightEl.value) : null;
			
			return data;
		});
		
		// Закрыть контекст
		await tempContext.close();
		console.log(`[Profile Cache Sync] ✅ Profile ${profileUid} synced and context closed`);
		
		return profileData;
		
	} catch (error) {
		console.error(`[Profile Cache Sync] ❌ Error syncing profile ${profileUid}:`, error);
		
		if (tempContext) {
			try {
				await tempContext.close();
			} catch (closeError) {
				// Игнорируем
			}
		}
		
		return null;
	}
};

export default {
	syncProfileCache,
	syncSingleProfile,
};
