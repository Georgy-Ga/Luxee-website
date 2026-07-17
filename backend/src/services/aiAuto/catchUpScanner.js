// AI Auto Response - Catch Up Scanner
// Сканирование чатов из Catch Up раздела

import utils from './utils.js';

// Глобальный кеш обработанных Catch Up чатов
// Формат ключа: `${accountId}_${profileUid}_${manUid}`
// Это позволяет одному мужчине общаться с разными анкетами
const catchUpProcessedCache = new Map();

/**
 * Проверить не обработан ли чат недавно (по accountId + profileUid + manUid)
 * @param {string} accountId - ID аккаунта
 * @param {string} profileUid - UID профиля (inner)
 * @param {string} manUid - UID мужчины
 * @returns {boolean}
 */
const isChatProcessed = (accountId, profileUid, manUid) => {
	const key = `${accountId}_${profileUid}_${manUid}`;
	const cached = catchUpProcessedCache.get(key);
	
	if (!cached) return false;
	
	// Проверяем срок действия
	if (Date.now() > cached.expiresAt) {
		catchUpProcessedCache.delete(key);
		utils.log('Catch Up Cache', `⏰ Cache expired for ${key}`);
		return false;
	}
	
	const remainingHours = ((cached.expiresAt - Date.now()) / (1000 * 60 * 60)).toFixed(1);
	utils.log('Catch Up Cache', `✅ Chat cached: ${key} (${remainingHours}h remaining)`);
	return true;
};

/**
 * Пометить чат как обработанный (10-16 часов)
 * @param {string} accountId - ID аккаунта
 * @param {string} profileUid - UID профиля (inner)
 * @param {string} manUid - UID мужчины
 */
const markChatAsProcessed = (accountId, profileUid, manUid) => {
	const key = `${accountId}_${profileUid}_${manUid}`;
	
	// Случайное время от 10 до 16 часов
	const randomHours = 10 + Math.random() * 6;
	const expiresAt = Date.now() + randomHours * 60 * 60 * 1000;
	
	catchUpProcessedCache.set(key, {
		processedAt: Date.now(),
		expiresAt: expiresAt,
		accountId,
		profileUid,
		manUid,
	});
	
	const hoursFormatted = randomHours.toFixed(1);
	utils.log('Catch Up Cache', `💾 Cached: ${key} for ${hoursFormatted}h`);
};

/**
 * Получить количество чатов в Catch Up БЕЗ открытия
 * @param {Object} page - Playwright page
 * @returns {Promise<number>} - Количество чатов в Catch Up
 */
const getCatchUpCount = async (page) => {
	try {
		const count = await page.evaluate(() => {
			const container = modelsChat?.getProfile?.container?.[0];
			if (!container) {
				console.log('[Catch Up Count] ❌ Container not found');
				return 0;
			}
			
			const catchUpElement = container.querySelector('#profile-catchup');
			if (!catchUpElement) {
				console.log('[Catch Up Count] ❌ Catch Up element not found');
				return 0;
			}
			
			const badge = catchUpElement.querySelector('.profiles_new-messages');
			const count = parseInt(badge?.textContent) || 0;
			
			console.log('[Catch Up Count] Found count:', count);
			return count;
		});
		
		utils.log('Catch Up Scanner', `📊 Catch Up count: ${count}`);
		return count;
	} catch (error) {
		utils.logError('Catch Up Scanner', 'Error getting count:', error);
		return 0;
	}
};

/**
 * Получить все чаты из Catch Up (БЕЗ фильтра unAnswered!)
 * @param {Object} page - Playwright page
 * @returns {Promise<Array>} - Массив чатов
 */
const getAllCatchUpChats = async (page) => {
	try {
		console.log('[🚦 CATCH UP SCANNER] ========================================');
		console.log('[🚦 CATCH UP SCANNER] 🎯 OPENING CATCH UP');
		console.log('[🚦 CATCH UP SCANNER] Current URL BEFORE open:', page.url());
		console.log('[🚦 CATCH UP SCANNER] Time:', new Date().toISOString());
		
		utils.log('Catch Up Scanner', '🎯 Opening Catch Up...');
		
		// Открываем Catch Up
		console.log('[🚦 CATCH UP SCANNER] ⏳ Executing modelsChat.openCatchUp()...');
		await page.evaluate(() => {
			if (modelsChat?.openCatchUp) {
				modelsChat.openCatchUp();
			}
		});
		console.log('[🚦 CATCH UP SCANNER] ✅ modelsChat.openCatchUp() completed');
		
		// Ждём загрузки
		console.log('[🚦 CATCH UP SCANNER] ⏳ Sleeping 2 seconds...');
		await utils.sleep(2000);
		console.log('[🚦 CATCH UP SCANNER] ✅ Sleep completed');
		console.log('[🚦 CATCH UP SCANNER] Current URL AFTER open:', page.url());
		
		// Получаем ВСЕ чаты из container (не фильтруем по unAnswered!)
		const chats = await page.evaluate(() => {
			const container = modelsChat?.getChats?.container?.[0];
			if (!container) {
				console.log('[Catch Up] Container not found');
				return [];
			}
			
			const chatElements = container.querySelectorAll('.chats[data-identity]');
			console.log('[Catch Up] Found chat elements:', chatElements.length);
			
			const result = [];
			
			chatElements.forEach((el, index) => {
				const chatId = el.getAttribute('data-identity');
				const manUid = el.getAttribute('data-member-uid');
				const manName = el.querySelector('.profiles_username_text')?.textContent?.trim();
				
				if (chatId) {
					// chatId формат: "profileUidOuter_manUid" (например "2544573_2849693")
					const [profileUidOuter, manUidFromId] = chatId.split('_');
					
					const chat = {
						chatId: chatId,
						profileUidOuter: profileUidOuter, // Outer UID из chatId
						manUid: manUid || manUidFromId,
						manName: manName || 'Unknown',
						source: 'catchup',
					};
					
					console.log(`[Catch Up] Chat ${index + 1}:`, chat);
					result.push(chat);
				}
			});
			
			console.log('[Catch Up] Total chats extracted:', result.length);
			return result;
		});
		
		console.log('[🚦 CATCH UP SCANNER] ========================================');
		console.log('[🚦 CATCH UP SCANNER] ✅ EXTRACTION COMPLETE');
		console.log('[🚦 CATCH UP SCANNER] Total chats found:', chats.length);
		console.log('[🚦 CATCH UP SCANNER] Current URL:', page.url());
		console.log('[🚦 CATCH UP SCANNER] Time:', new Date().toISOString());
		if (chats.length > 0) {
			console.log('[🚦 CATCH UP SCANNER] First 3 chats:', chats.slice(0, 3).map(c => ({
				chatId: c.chatId,
				manName: c.manName,
				profileUidOuter: c.profileUidOuter,
			})));
		}
		
		utils.log('Catch Up Scanner', `✅ Found ${chats.length} chats in Catch Up`);
		
		return chats;
		
	} catch (error) {
		utils.logError('Catch Up Scanner', 'Error getting chats:', error);
		return [];
	}
};

/**
 * Получить статистику кеша
 * @returns {Object}
 */
const getCacheStats = () => {
	const now = Date.now();
	let active = 0;
	let expired = 0;
	
	for (const [key, value] of catchUpProcessedCache.entries()) {
		if (now > value.expiresAt) {
			expired++;
		} else {
			active++;
		}
	}
	
	return {
		total: catchUpProcessedCache.size,
		active,
		expired,
	};
};

/**
 * Очистить устаревшие записи из кеша
 */
const cleanupExpiredCache = () => {
	const now = Date.now();
	let cleaned = 0;
	
	for (const [key, value] of catchUpProcessedCache.entries()) {
		if (now > value.expiresAt) {
			catchUpProcessedCache.delete(key);
			cleaned++;
		}
	}
	
	if (cleaned > 0) {
		utils.log('Catch Up Cache', `🧹 Cleaned ${cleaned} expired entries`);
	}
	
	return cleaned;
};

// Автоматическая очистка каждые 30 минут
setInterval(() => {
	cleanupExpiredCache();
}, 30 * 60 * 1000);

export default {
	getCatchUpCount,
	getAllCatchUpChats,
	isChatProcessed,
	markChatAsProcessed,
	getCacheStats,
	cleanupExpiredCache,
};
