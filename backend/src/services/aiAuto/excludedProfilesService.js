// AI Auto Response - Excluded Profiles Service
// Сервис исключения женских анкет (профилей Luxee) из обработки ИИ.
//
// Уровень хранения: обычный пользователь (User.aiExcludedProfileUids).
// Храним inner UID профилей строкой — переживает рестарт Docker (MongoDB),
// сироты от удалённых аккаунтов/анкет безвредны (просто ни с чем не матчатся).
//
// Дизайн "на горячую": список читается свежим из БД в каждом цикле AI
// (account.populate('user')), поэтому изменения применяются без
// перезапуска ИИ. Никакого in-memory кеша здесь нет осознанно.

export const MAX_EXCLUDED_PROFILES = 500;

/**
 * Нормализовать UID профиля к строке для стабильного сравнения.
 * @param {string|number} uid
 * @returns {string} - нормализованный UID или '' если пусто
 */
export const normalizeProfileUid = (uid) => {
	if (uid === null || uid === undefined) return '';
	return String(uid).trim();
};

/**
 * Собрать Set исключённых UID из объекта пользователя.
 * Принимает populated user, plain-объект или сам массив — всё остальное даёт пустой Set.
 * Никогда не бросает исключение (в случае сомнений — НЕ исключаем, ИИ работает как раньше).
 * @param {Object|Array<string|number>|null|undefined} user
 * @returns {Set<string>}
 */
export const getExcludedSet = (user) => {
	try {
		const raw = Array.isArray(user) ? user : user?.aiExcludedProfileUids;
		if (!Array.isArray(raw)) return new Set();
		const set = new Set();
		for (const uid of raw) {
			const normalized = normalizeProfileUid(uid);
			if (normalized) set.add(normalized);
		}
		return set;
	} catch {
		return new Set();
	}
};

/**
 * Проверить, исключена ли анкета из обработки ИИ.
 * @param {Object|Array<string|number>|null|undefined} user - populated user или массив UID
 * @param {string|number|null|undefined} profileUid - inner UID профиля
 * @returns {boolean} - true если ИИ должен полностью пропустить профиль
 */
export const isProfileExcluded = (user, profileUid) => {
	const normalized = normalizeProfileUid(profileUid);
	if (!normalized) return false;
	return getExcludedSet(user).has(normalized);
};

/**
 * Отфильтровать массив профилей, убрав исключённые.
 * @param {Array<Object>} profiles - профили с полем uid
 * @param {Object|Array<string|number>|null|undefined} user
 * @returns {Array<Object>} - новый массив без исключённых
 */
export const filterExcludedProfiles = (profiles, user) => {
	if (!Array.isArray(profiles)) return [];
	const excluded = getExcludedSet(user);
	if (excluded.size === 0) return [...profiles];
	return profiles.filter((p) => !excluded.has(normalizeProfileUid(p?.uid)));
};

/**
 * Санитизация списка от фронтенда перед записью в БД.
 * @param {unknown} raw - произвольный вход (ожидается массив)
 * @returns {Array<string>} - чистый dedup-список UID строкой
 */
export const sanitizeExcludedList = (raw) => {
	if (!Array.isArray(raw)) return [];
	const seen = new Set();
	const result = [];
	for (const uid of raw) {
		const normalized = normalizeProfileUid(uid);
		// UID профилей Luxee — цифры; остальное отбрасываем как мусор
		if (!normalized || !/^\d+$/.test(normalized) || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
		if (result.length >= MAX_EXCLUDED_PROFILES) break;
	}
	return result;
};

export default {
	MAX_EXCLUDED_PROFILES,
	normalizeProfileUid,
	getExcludedSet,
	isProfileExcluded,
	filterExcludedProfiles,
	sanitizeExcludedList,
};
