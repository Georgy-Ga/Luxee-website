// AI Auto Response - Utility Functions
// Вспомогательные функции для AI автоответчика

/**
 * Получить timestamp для логов
 * @returns {string} - Timestamp в формате HH:MM:SS.mmm
 */
const getTimestamp = () => {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	const ms = String(now.getMilliseconds()).padStart(3, '0');
	return `${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * Логирование с timestamp
 * @param {string} module - Название модуля
 * @param {string} message - Сообщение
 */
const log = (module, message) => {
	console.log(`[${getTimestamp()}] [${module}] ${message}`);
};

/**
 * Логирование ошибок с timestamp
 * @param {string} module - Название модуля
 * @param {string} message - Сообщение
 * @param {Error} error - Объект ошибки (опционально)
 */
const logError = (module, message, error = null) => {
	if (error) {
		console.error(`[${getTimestamp()}] [${module}] ${message}`, error);
	} else {
		console.error(`[${getTimestamp()}] [${module}] ${message}`);
	}
};

/**
 * Задержка выполнения
 * @param {number} ms - Миллисекунды
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Случайная задержка в диапазоне
 * @param {number} min - Минимум (мс)
 * @param {number} max - Максимум (мс)
 * @returns {Promise<void>}
 */
const randomDelay = async (min, max) => {
	const delay = min + Math.random() * (max - min);
	log('AI Auto', `⏱️  Waiting ${Math.round(delay / 1000)} seconds...`);
	await sleep(delay);
};

/**
 * Получить активный профиль
 * @param {Object} page - Playwright page
 * @returns {Promise<Object|null>}
 */
const getActiveProfile = async page => {
	try {
		const profile = await page.evaluate(() => {
			if (!window.modelsChat?.getProfile?.active?.inner) {
				return null;
			}

			const active = window.modelsChat.getProfile.active;
			const inner = active.inner;

			// Собираем ВСЕ UIDs профиля (inner + outer)
			const allUids = [inner.uid];
			if (active.outer) {
				for (const outerKey in active.outer) {
					allUids.push(active.outer[outerKey].uid);
				}
			}

			return {
				uid: inner.uid,
				allUids: allUids, // ✅ Все UIDs для поиска чатов
				username: inner.username,
				age: inner.age,
				country: inner.country,
				city: inner.city,
				newMessages: active.newMessages || 0,
			};
		});

		return profile;
	} catch (error) {
		logError('AI Auto', 'Error getting active profile:', error);
		return null;
	}
};

/**
 * Переключиться на профиль через глобальный сервис
 * @param {Object} page - Playwright page
 * @param {string} accountId - ID аккаунта (для блокировки)
 * @param {number} profileUid - UID профиля (inner)
 * @returns {Promise<boolean>} - Успешность переключения
 */
const switchToProfile = async (page, accountId, profileUid) => {
	// ⚠️ ИМПОРТИРУЕМ ДИНАМИЧЕСКИ чтобы избежать циклической зависимости
	const profileSwitchService = (await import('../luxeeApi/profileSwitchService.js')).default;
	
	return await profileSwitchService.switchProfile(
		page,
		accountId,
		profileUid,
		'AI Auto',
	);
};

export default {
	getTimestamp,
	log,
	logError,
	sleep,
	randomDelay,
	getActiveProfile,
	switchToProfile,
};
