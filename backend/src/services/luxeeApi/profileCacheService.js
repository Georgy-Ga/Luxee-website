import LuxeeProfileModel from '../../models/LuxeeProfileModel.js';

/**
 * Сервис для работы с кешем профилей Luxee
 * Только чтение из БД и управление кешем
 * Парсинг данных делается через profileCacheSyncService
 */

// TTL кеша в днях
const CACHE_TTL_DAYS = 2;

const profileCacheService = {
	/**
	 * Получить данные профиля из кеша
	 * @param {Object} page - Playwright page (не используется, для совместимости)
	 * @param {string} accountId - ID аккаунта
	 * @param {number} profileUid - UID профиля
	 * @param {Object} options - Опции (не используются, для совместимости)
	 * @returns {Promise<Object|null>}
	 */
	getProfile: async (page, accountId, profileUid, options = {}) => {
		try {
			const cached = await LuxeeProfileModel.findOne({
				accountId,
				profileUid,
			});

			if (!cached) {
				console.log(
					`[Profile Cache] ❌ Cache MISS for profile ${profileUid}`,
				);
				return null;
			}

			if (cached.isFresh(CACHE_TTL_DAYS)) {
				console.log(
					`[Profile Cache] ✅ Cache HIT for profile ${profileUid} (age: ${Math.floor((Date.now() - cached.lastFetchedAt) / (1000 * 60 * 60))}h)`,
				);
				return cached.toObject();
			}

			console.log(
				`[Profile Cache] ⚠️  Cache STALE for profile ${profileUid} (age: ${Math.floor((Date.now() - cached.lastFetchedAt) / (1000 * 60 * 60))}h)`,
			);
			return cached.toObject(); // Возвращаем даже устаревший кеш
		} catch (error) {
			console.error(
				`[Profile Cache] Error getting profile ${profileUid}:`,
				error,
			);
			return null;
		}
	},

	/**
	 * Синхронизировать список профилей в кеш
	 * Используется после парсинга /profile/ для массового обновления
	 * @param {string} accountId - ID аккаунта
	 * @param {Array} profilesList - Массив профилей из парсера
	 * @returns {Promise<void>}
	 */
	syncProfilesFromList: async (accountId, profilesList) => {
		try {
			console.log(
				`[Profile Cache] Syncing ${profilesList.length} profiles for account ${accountId}`,
			);

			const operations = profilesList.map(profile => ({
				updateOne: {
					filter: { accountId, profileUid: profile.uid },
					update: {
						$set: {
							username: profile.username,
							age: profile.age,
							country: profile.country,
							imageUrl: profile.imageUrl,
							isDisabled: profile.isDisabled,
							lastFetchedAt: new Date(),
						},
					},
					upsert: true,
				},
			}));

			await LuxeeProfileModel.bulkWrite(operations);

			console.log(
				`[Profile Cache] ✅ Synced ${profilesList.length} profiles to cache`,
			);
		} catch (error) {
			console.error('[Profile Cache] Error syncing profiles:', error);
		}
	},

	/**
	 * Получить все профили аккаунта из кеша
	 * @param {string} accountId - ID аккаунта
	 * @returns {Promise<Array>}
	 */
	getAllProfiles: async accountId => {
		try {
			const profiles = await LuxeeProfileModel.find({ accountId }).sort({
				username: 1,
			});

			return profiles.map(p => p.toObject());
		} catch (error) {
			console.error('[Profile Cache] Error getting all profiles:', error);
			return [];
		}
	},

	/**
	 * Получить устаревшие профили для обновления
	 * @param {string} accountId - ID аккаунта
	 * @returns {Promise<Array>}
	 */
	getStaleProfiles: async accountId => {
		try {
			return await LuxeeProfileModel.getStaleProfiles(
				accountId,
				CACHE_TTL_DAYS,
			);
		} catch (error) {
			console.error('[Profile Cache] Error getting stale profiles:', error);
			return [];
		}
	},

	/**
	 * Очистить кеш профилей аккаунта
	 * @param {string} accountId - ID аккаунта
	 * @returns {Promise<void>}
	 */
	clearCache: async accountId => {
		try {
			const result = await LuxeeProfileModel.deleteMany({ accountId });
			console.log(
				`[Profile Cache] ✅ Cleared ${result.deletedCount} profiles for account ${accountId}`,
			);
		} catch (error) {
			console.error('[Profile Cache] Error clearing cache:', error);
		}
	},
};

export default profileCacheService;
