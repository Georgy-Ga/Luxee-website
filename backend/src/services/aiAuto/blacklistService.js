// AI Auto Response - Blacklist Service
// Сервис для проверки черного списка и защиты от зацикливания

import LuxeeAccount from '../../models/LuxeeAccountModel.js';

// Глобальный кеш для предотвращения зацикливания
// Формат: accountId → Map<chatId, { count, timestamp }>
const blacklistCache = new Map();

/**
 * Проверить находится ли мужчина в черном списке
 * @param {string} accountId - ID аккаунта Luxee
 * @param {string} userUid - ID мужчины (userUid)
 * @param {string} category - Категория ('newMessages', 'catchUp', 'activityCenter')
 * @returns {Promise<boolean>} - true если нужно игнорировать
 */
export const isUserBlacklisted = async (accountId, userUid, category) => {
	try {
		const account = await LuxeeAccount.findById(accountId);
		
		// Если аккаунт не найден или черный список отключен
		if (!account?.blacklist?.enabled) {
			return false;
		}
		
		// Проверяем есть ли userUid в списке
		if (!account.blacklist.userIds || !account.blacklist.userIds.includes(userUid)) {
			return false;
		}
		
		// Проверяем включена ли категория
		const categoryEnabled = account.blacklist.categories?.[category] === true;
		
		if (categoryEnabled) {
			console.log(`[Blacklist] 🚫 User ${userUid} is blacklisted for category "${category}"`);
		}
		
		return categoryEnabled;
	} catch (error) {
		console.error(`[Blacklist] ❌ Error checking blacklist:`, error);
		return false; // В случае ошибки не блокируем
	}
};

/**
 * Проверить нужно ли пропустить из-за зацикливания
 * Используется чтобы не переключаться на один и тот же профиль постоянно
 * 
 * @param {string} accountId - ID аккаунта
 * @param {string} profileUid - ID профиля
 * @param {string} userUid - ID мужчины
 * @param {number} messageCount - Количество сообщений в чате
 * @returns {boolean} - true если нужно пропустить
 */
export const shouldSkipDueToLoop = (accountId, profileUid, userUid, messageCount) => {
	const chatId = `${profileUid}_${userUid}`;
	
	// Инициализируем кеш для аккаунта если нет
	if (!blacklistCache.has(accountId)) {
		blacklistCache.set(accountId, new Map());
	}
	
	const accountCache = blacklistCache.get(accountId);
	const cached = accountCache.get(chatId);
	
	// Первый раз видим этот чат - сохраняем и разрешаем проверку
	if (!cached) {
		accountCache.set(chatId, {
			count: messageCount,
			timestamp: Date.now()
		});
		return false;
	}
	
	// Проверяем: счетчик не изменился?
	if (cached.count === messageCount) {
		const elapsed = Date.now() - cached.timestamp;
		const fiveMinutes = 5 * 60 * 1000;
		
		// Прошло меньше 5 минут → skip (защита от зацикливания)
		if (elapsed < fiveMinutes) {
			const remainingSeconds = Math.round((fiveMinutes - elapsed) / 1000);
			console.log(
				`[Blacklist] ⏭️  Skipping ${chatId} (loop protection, ${remainingSeconds}s remaining)`
			);
			return true;
		}
		
		// Прошло 5+ минут → обнуляем кеш и проверяем снова
		console.log(`[Blacklist] 🔄 5 minutes passed, re-checking ${chatId}`);
		accountCache.set(chatId, {
			count: messageCount,
			timestamp: Date.now()
		});
		return false;
	}
	
	// Счетчик изменился → обновляем кеш и разрешаем проверку
	console.log(`[Blacklist] 📊 Message count changed for ${chatId}, updating cache`);
	accountCache.set(chatId, {
		count: messageCount,
		timestamp: Date.now()
	});
	return false;
};

/**
 * Очистить кеш для аккаунта
 * Используется при остановке AI или удалении аккаунта
 * 
 * @param {string} accountId - ID аккаунта
 */
export const clearBlacklistCache = (accountId) => {
	if (blacklistCache.has(accountId)) {
		blacklistCache.delete(accountId);
		console.log(`[Blacklist] 🗑️  Cache cleared for account ${accountId}`);
	}
};

/**
 * Очистить весь кеш
 * Используется при перезапуске сервера
 */
export const clearAllBlacklistCache = () => {
	blacklistCache.clear();
	console.log(`[Blacklist] 🗑️  All cache cleared`);
};

/**
 * Получить статистику кеша (для отладки)
 * @returns {Object} - Статистика кеша
 */
export const getBlacklistCacheStats = () => {
	const stats = {
		totalAccounts: blacklistCache.size,
		accounts: []
	};
	
	for (const [accountId, chats] of blacklistCache.entries()) {
		stats.accounts.push({
			accountId,
			chatsCount: chats.size,
			chats: Array.from(chats.entries()).map(([chatId, data]) => ({
				chatId,
				count: data.count,
				age: Math.round((Date.now() - data.timestamp) / 1000) + 's'
			}))
		});
	}
	
	return stats;
};

export default {
	isUserBlacklisted,
	shouldSkipDueToLoop,
	clearBlacklistCache,
	clearAllBlacklistCache,
	getBlacklistCacheStats
};
