// AI Auto Response - Catch Up Scanner
// Сканирование чатов из Catch Up раздела

import utils from './utils.js';
import cycleLogger from './cycleLogger.js';

// Глобальный кеш обработанных Catch Up чатов
// Формат ключа: `${accountId}_${profileUid}_${manUid}`
// Это позволяет одному мужчине общаться с разными анкетами
const catchUpProcessedCache = new Map();

// Лимит переключений профиля за один Catch Up проход (защита от долгого цикла)
const MAX_OWNER_SWITCHES_PER_PASS = 6;

// Сессионный кеш outer UID → inner UID (accountId → Map)
// Пополняется при успешном резолве через переключение, живёт до рестарта бэкенда
const outerToInnerSessionCache = new Map();

// Курсор свипа по кандидатам (accountId_outerUid → сколько кандидатов уже перебрано).
// Бюджет свипов на проход ограничен (MAX_OWNER_SWITCHES_PER_PASS), поэтому
// непокрытые кандидаты пробуются в следующих проходах, а не одни и те же.
const ownerSweepCursor = new Map();

const getSessionOuterCache = accountId => {
	let map = outerToInnerSessionCache.get(accountId);
	if (!map) {
		map = new Map();
		outerToInnerSessionCache.set(accountId, map);
	}
	return map;
};

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
 * Получить запись основного кеша (для проверки свежести/новой активности)
 * @returns {Object|null} - { processedAt, expiresAt, ... } или null
 */
const getCachedChat = (accountId, profileUid, manUid) => {
	const key = `${accountId}_${profileUid}_${manUid}`;
	const cached = catchUpProcessedCache.get(key);
	if (!cached) return null;
	if (Date.now() > cached.expiresAt) {
		catchUpProcessedCache.delete(key);
		return null;
	}
	return cached;
};
/**
 * Пометить чат как обработанный (10-16 часов).
 * Использовать ТОЛЬКО для успеха — неудачи идут в короткий retry-кеш,
 * иначе чат умирает на полдня после первой же ошибки.
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
 * @param {string} accountId - ID аккаунта (для cycleLogger)
 * @returns {Promise<Array>} - Массив чатов
 */
const getAllCatchUpChats = async (page, accountId = null) => {
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
		
			// Получаем ВСЕ чаты из container + метаданные из getChats.list
			// (lastActivity/unAnswered БЕЗ навигации — чат не помечается прочитанным).
			// Отвечаем только на реально новые (unAnswered === true).
			const chats = await page.evaluate(() => {
				const container = modelsChat?.getChats?.container?.[0];
				if (!container) {
					console.log('[Catch Up] Container not found');
					return [];
				}

				const chatElements = container.querySelectorAll('.chats[data-identity]');
				console.log('[Catch Up] Found chat elements:', chatElements.length);

				const list = modelsChat?.getChats?.list || {};
				const result = [];

				chatElements.forEach((el, index) => {
					const chatId = el.getAttribute('data-identity');
					const manUidAttr = el.getAttribute('data-member-uid');
					const manName = el.querySelector('.profiles_username_text')?.textContent?.trim();

					if (chatId) {
						// chatId формат "A_B", НО порядок частей НЕ фиксирован:
						// бывает profileOuter_manUid (Oski) и manUid_profileOuter (JS).
						// Роли определяем ТОЛЬКО по members (type 10 = мужчина),
						// иначе ищем анкету по UID мужчины и пишем не тому.
						const [partA, partB] = chatId.split('_');
						const listEntry = list[chatId] || {};
						const members = Array.isArray(listEntry.members)
							? listEntry.members
							: [];
						const manMember =
							members.find(m => m.type === 10) ||
							members.find(m => m.gender === 1) ||
							null;

						let manUid = manUidAttr || null;
						let profileUidOuter = partA;
						let identityVia = 'positional-legacy';
						if (manMember && manMember.uid !== undefined && manMember.uid !== null) {
							manUid = String(manMember.uid);
							const other = [partA, partB].find(p => String(p) !== manUid);
							if (other !== undefined) {
								profileUidOuter = other;
								identityVia = 'members';
							}
						}
						if (!manUid) {
							manUid = manUidAttr || partB || null;
						}

						const chat = {
							chatId: chatId,
							profileUidOuter: profileUidOuter, // Outer UID анкеты (не позиция!)
							manUid: manUid,
							manName: manName || 'Unknown',
							source: 'catchup',
							identityVia,
							// Метаданные БЕЗ открытия чата (не помечаем прочитанным)
							unAnswered: listEntry.unAnswered ?? null,
							lastActivity: listEntry.lastActivity ?? null,
							messageCount: Array.isArray(listEntry.message)
								? listEntry.message.length
								: null,
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
		if (accountId) {
			cycleLogger.logEvent(accountId, 'catchup', 'open_failed', {
				reason: 'open_failed',
				error: error.message,
				sent: false,
			});
		}
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

	// Чистим retry-кеш старше суток (счётчик fails начинается заново)
	let cleanedRetry = 0;
	for (const [key, entry] of catchUpRetryCache.entries()) {
		if (Date.now() - entry.retryAt > 24 * 60 * 60 * 1000) {
			catchUpRetryCache.delete(key);
			cleanedRetry++;
		}
	}
	if (cleanedRetry > 0) {
		utils.log('Catch Up Cache', `🧹 Cleaned ${cleanedRetry} stale retry entries`);
	}

	return cleaned;
};

// Автоматическая очистка каждые 30 минут
setInterval(() => {
	cleanupExpiredCache();
}, 30 * 60 * 1000);

/**
 * Короткий кеш повторных попыток (profile_not_found / временные ошибки)
 * Ключ — chatId целиком (уникален и всегда определён, в отличие от
 * отдельных outer/manUid которые могут отсутствовать в DOM).
 * Не даёт долбить один и тот же неразрешённый чат каждый тик, но в отличие
 * от основного кеша (10-16ч) разрешает повтор уже через 5 минут.
 */
const catchUpRetryCache = new Map();
const RETRY_TTL_MS = 5 * 60 * 1000;

const getRetryKey = (accountId, chatId) => `${accountId}_${chatId}`;

// После N подряд неудач ждём дольше (не долбим сайт/токены вхолостую),
// но НЕ 12 часов: повтор обязателен, просто с backoff.
const RETRY_FAILS_BEFORE_BACKOFF = 5;
const RETRY_BACKOFF_MS = 60 * 60 * 1000; // 1 час

const shouldRetryNow = (accountId, chatId) => {
	const key = getRetryKey(accountId, chatId);
	const entry = catchUpRetryCache.get(key);
	if (!entry) return true;
	if (Date.now() >= entry.retryAt) {
		return true;
	}
	return false;
};

const markRetryLater = (accountId, chatId) => {
	const key = getRetryKey(accountId, chatId);
	const prev = catchUpRetryCache.get(key);
	const fails = (prev?.fails || 0) + 1;
	const waitMs = fails >= RETRY_FAILS_BEFORE_BACKOFF ? RETRY_BACKOFF_MS : RETRY_TTL_MS;
	catchUpRetryCache.set(key, { retryAt: Date.now() + waitMs, fails });
	if (fails >= RETRY_FAILS_BEFORE_BACKOFF) {
		utils.log(
			'Catch Up Cache',
			`⏳ Chat ${chatId}: ${fails} fails in a row → backoff ${Math.round(waitMs / 60000)} min (keeps retrying)`,
		);
	}
};

const getRetryFails = (accountId, chatId) =>
	catchUpRetryCache.get(getRetryKey(accountId, chatId))?.fails || 0;

/**
 * Дамп карты профилей текущей сессии одним запросом:
 * какие inner/outer UID вообще видны в modelsChat.getProfile.
 * Нужно чтобы отличать "чата нет в сессии" от "сломан поиск".
 * @param {Object} page - Playwright page
 * @returns {Promise<Object>} - { innerUids: [], outerToInner: {}, dataKeys: number, outerKeys: number }
 */
const dumpSessionProfileMap = async page => {
	try {
		return await page.evaluate(() => {
			const result = {
				innerUids: [],
				outerToInner: {},
				dataKeys: 0,
				outerKeys: 0,
			};
			const data = modelsChat?.getProfile?.data;
			if (data) {
				for (const key in data) {
					result.dataKeys++;
					const entry = data[key];
					const innerUid = entry?.inner?.uid;
					if (innerUid !== undefined && innerUid !== null) {
						result.innerUids.push(innerUid);
						if (entry.outer) {
							for (const outerKey in entry.outer) {
								const outerUid = entry.outer[outerKey]?.uid;
								if (outerUid !== undefined && outerUid !== null) {
									result.outerToInner[String(outerUid)] = innerUid;
								}
							}
						}
					}
				}
			}
			const globalOuter = modelsChat?.getProfile?.outer;
			if (globalOuter) {
				for (const key in globalOuter) {
					result.outerKeys++;
					const innerUid = globalOuter[key]?.import_uid;
					if (innerUid !== undefined && innerUid !== null) {
						result.outerToInner[String(key)] = innerUid;
					}
				}
			}
			return result;
		});
	} catch (error) {
		utils.logError('Catch Up Scanner', 'Error dumping profile map:', error);
		return { innerUids: [], outerToInner: {}, dataKeys: 0, outerKeys: 0 };
	}
};

/**
 * Резолв анкеты-владельца для outer UID из Catch Up.
 * Порядок: сессионный кеш → свежий дамп карты → перебор кандидатов
 * с переключением профиля (как делает цикл "других анкет").
 * @param {Object} page - Playwright page
 * @param {string} accountId - ID аккаунта
 * @param {string|number} outerUid - Outer UID из chatId
 * @param {Object} options - { switchesUsed: {count}, maxSwitches }
 * @returns {Promise<Object|null>} - Профиль {uid, allUids, username, ...} или null
 */
const resolveOwnerProfile = async (page, accountId, outerUid, options = {}) => {
	const outerKey = String(outerUid);
	const sessionCache = getSessionOuterCache(accountId);

	// 1️⃣ Сессионный кеш (уже резолвили раньше)
	if (sessionCache.has(outerKey)) {
		const innerUid = sessionCache.get(outerKey);
		const profile = await utils.getProfileByUid(page, innerUid);
		if (profile) return profile;
		// Кеш протух (сессия изменилась) — чистим и ищем заново
		sessionCache.delete(outerKey);
	}

	// 2️⃣ Свежий дамп карты сессии
	const map = await dumpSessionProfileMap(page);
	if (map.outerToInner[outerKey] !== undefined) {
		const profile = await utils.getProfileByUid(
			page,
			map.outerToInner[outerKey],
		);
		if (profile) {
			sessionCache.set(outerKey, profile.uid);
			return profile;
		}
	}

	// 3️⃣ Перебор кандидатов с переключением профиля
	// Кандидаты: inner из сессии + inner из Mongo-кеша анкет аккаунта
	const candidates = [];
	for (const inner of map.innerUids) {
		if (!candidates.includes(inner)) candidates.push(inner);
	}
	try {
		const { default: profileCacheService } = await import(
			'../luxeeApi/profileCacheService.js'
		);
		const cached = await profileCacheService.getAllProfiles(accountId);
		for (const p of cached || []) {
			if (p.profileUid !== undefined && !candidates.includes(p.profileUid)) {
				candidates.push(p.profileUid);
			}
		}
	} catch (cacheError) {
		utils.logError(
			'Catch Up Scanner',
			'Error getting cached profiles for owner sweep:',
			cacheError,
		);
	}

	const switchesUsed = options.switchesUsed || { count: 0 };
	const maxSwitches =
		options.maxSwitches !== undefined
			? options.maxSwitches
			: MAX_OWNER_SWITCHES_PER_PASS;

	// Курсор: пропускаем уже перебранных в прошлых проходах кандидатов,
	// чтобы за несколько проходов покрыть всех (а не первые N каждый раз)
	const cursorKey = `${accountId}_${outerKey}`;
	const cursorStart = ownerSweepCursor.get(cursorKey) || 0;
	const orderedCandidates = candidates.slice(cursorStart).concat(
		candidates.slice(0, cursorStart),
	);
	let triedThisPass = 0;

	for (const innerUid of orderedCandidates) {
		if (switchesUsed.count >= maxSwitches) {
			ownerSweepCursor.set(cursorKey, cursorStart + triedThisPass);
			utils.log(
				'Catch Up Scanner',
				`⏸️  Owner sweep capped at ${maxSwitches} switches for this pass (${orderedCandidates.length - triedThisPass} candidates left for next passes)`,
			);
			break;
		}
		triedThisPass++;
		const switched = await utils.switchToProfile(page, accountId, innerUid);
		switchesUsed.count++;
		if (!switched) continue;

		const profile = await utils.getProfileByUid(page, outerUid);
		if (profile) {
			sessionCache.set(outerKey, profile.uid);
			ownerSweepCursor.delete(cursorKey);
			utils.log(
				'Catch Up Scanner',
				`✅ Resolved outer ${outerKey} → ${profile.username} (${profile.uid}) via switch`,
			);
			return profile;
		}
	}

	// Всех кандидатов перебрали (или бюджет кончился) — владельца нет.
	// Сбрасываем курсор чтобы следующий TTL-проход начал заново
	// (состав анкет мог измениться), retry-кеш на 5 мин ставит вызывающий.
	if (triedThisPass >= orderedCandidates.length) {
		ownerSweepCursor.delete(cursorKey);
		utils.log(
			'Catch Up Scanner',
			`🔍 Owner sweep exhausted all ${orderedCandidates.length} candidates for outer ${outerKey}, will retry in next passes`,
		);
	}

	return null;
};

export default {
	getCatchUpCount,
	getAllCatchUpChats,
	isChatProcessed,
	markChatAsProcessed,
	getCachedChat,
	getCacheStats,
	cleanupExpiredCache,
	dumpSessionProfileMap,
	resolveOwnerProfile,
	shouldRetryNow,
	markRetryLater,
	getRetryFails,
	MAX_OWNER_SWITCHES_PER_PASS,
};
