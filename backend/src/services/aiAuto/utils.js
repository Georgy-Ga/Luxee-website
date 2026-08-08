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
 * Получить активный профиль с retry и reload + кеш из БД
 * @param {Object} page - Playwright page
 * @param {string} accountId - ID аккаунта (для кеша)
 * @param {number} maxRetries - Максимум попыток (default: 3)
 * @returns {Promise<Object|null>}
 */
const getActiveProfile = async (page, accountId, maxRetries = 3) => {
	let attempt = 0;

	while (attempt < maxRetries) {
		try {
			const basicProfile = await page.evaluate(() => {
				// ✅ ПРОВЕРКА 1: modelsChat доступен?
				if (!window.modelsChat) {
					throw new Error('modelsChat_not_available');
				}

				// ✅ ПРОВЕРКА 2: Активный профиль есть?
				if (!window.modelsChat.getProfile?.active?.inner) {
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
					newMessages: active.newMessages || 0,
				};
			});

			// Успех! Получили базовые данные
			if (basicProfile) {
				if (attempt > 0) {
					log(
						'AI Auto',
						`✅ Active profile found after ${attempt + 1} attempt(s)`,
					);
				}

				// ✅ ПОЛУЧАЕМ ПОЛНЫЕ ДАННЫЕ ИЗ КЕША (age, country, city, bio)
				try {
					const { default: profileCacheService } =
						await import('../luxeeApi/profileCacheService.js');
					let cachedData = await profileCacheService.getProfile(
						page,
						accountId,
						basicProfile.uid,
						{ forceRefresh: false, includeDetails: false },
					);

					// 🔄 УМНАЯ СИНХРОНИЗАЦИЯ: Если кеш пустой → синхронизировать ЭТОТ профиль
					if (!cachedData || !cachedData.age) {
						log(
							'AI Auto',
							`⚠️  Profile ${basicProfile.uid} (${basicProfile.username}) not in cache, syncing...`,
						);

						try {
							const { default: profileCacheSyncService } =
								await import('../luxeeApi/profileCacheSyncService.js');
							const LuxeeAccount = (
								await import('../../models/LuxeeAccountModel.js')
							).default;

							// Получить sessionData аккаунта
							const account = await LuxeeAccount.findById(accountId);
							if (account && account.sessionData) {
								// Синхронизировать ОДИН профиль через временный контекст
								const syncedData =
									await profileCacheSyncService.syncSingleProfile(
										accountId,
										basicProfile.uid,
										account.sessionData,
									);

								if (syncedData && syncedData.username) {
									log(
										'AI Auto',
										`✅ Profile ${basicProfile.uid} synced successfully`,
									);

									// Вычислить возраст из birthday
									let age = null;
									if (syncedData.birthday) {
										const birthDate = new Date(syncedData.birthday);
										age = Math.floor(
											(Date.now() - birthDate.getTime()) /
												(365.25 * 24 * 60 * 60 * 1000),
										);
									}

									// Сохранить в кеш
									await profileCacheService.syncProfilesFromList(accountId, [
										{
											uid: basicProfile.uid,
											username: syncedData.username,
											age: age,
											country: syncedData.country,
											city: syncedData.city,
											bio: syncedData.bio,
										},
									]);

									// Повторно получить из кеша (для консистентности)
									cachedData = await profileCacheService.getProfile(
										page,
										accountId,
										basicProfile.uid,
										{ forceRefresh: false, includeDetails: false },
									);

									log(
										'AI Auto',
										`✅ Profile data cached: age=${age}, country=${syncedData.country || 'N/A'}`,
									);
								} else {
									log(
										'AI Auto',
										`⚠️  Failed to sync profile ${basicProfile.uid}, using basic data`,
									);
								}
							}
						} catch (syncError) {
							logError(
								'AI Auto',
								'⚠️  Failed to sync profile via temp context:',
								syncError,
							);
						}
					}

					// Если есть кеш → объединяем
					if (cachedData && cachedData.age) {
						log(
							'AI Auto',
							`✅ Profile data from cache: age=${cachedData.age}, country=${cachedData.country || 'N/A'}`,
						);
						return {
							...basicProfile,
							age: cachedData.age,
							country: cachedData.country,
							city: cachedData.city,
							bio: cachedData.bio,
						};
					}
				} catch (cacheError) {
					logError(
						'AI Auto',
						'⚠️  Failed to get cached profile data:',
						cacheError,
					);
				}

				// ✅ FALLBACK: Если всё не сработало, возвращаем базовые данные
				log(
					'AI Auto',
					`⚠️  Using basic profile data without age/country/city`,
				);
				return basicProfile;
			}

			// Профиль не найден (но API доступен)
			log(
				'AI Auto',
				`⚠️  No active profile (attempt ${attempt + 1}/${maxRetries})`,
			);
		} catch (error) {
			// Если modelsChat недоступен → reload страницы
			if (error.message.includes('modelsChat_not_available')) {
				log(
					'AI Auto',
					`⚠️  modelsChat API not available (attempt ${attempt + 1}/${maxRetries})`,
				);

				if (attempt < maxRetries - 1) {
					// Получаем текущий URL перед reload
					const currentUrl = page.url();
					log('AI Auto', `🔄 Reloading page: ${currentUrl}`);

					try {
						// Reload страницы
						await page.reload({
							waitUntil: 'domcontentloaded',
							timeout: 30000,
						});
						log('AI Auto', '✅ Page reloaded successfully');

						// Ждём загрузки API (2 секунды)
						await sleep(2000);
					} catch (reloadError) {
						logError('AI Auto', `❌ Failed to reload page:`, reloadError);

						// Если reload не сработал, пробуем navigate
						try {
							log('AI Auto', `🔄 Trying navigation to: ${currentUrl}`);
							await page.goto(currentUrl, {
								waitUntil: 'domcontentloaded',
								timeout: 30000,
							});
							await sleep(2000);
							log('AI Auto', '✅ Navigation successful');
						} catch (navError) {
							logError('AI Auto', `❌ Failed to navigate:`, navError);
						}
					}
				}
			} else {
				// Другая ошибка
				logError(
					'AI Auto',
					`Error getting active profile (attempt ${attempt + 1}/${maxRetries}):`,
					error,
				);
			}
		}

		attempt++;

		// Ждём перед следующей попыткой (если не последняя)
		if (attempt < maxRetries) {
			await sleep(1000);
		}
	}

	// Все попытки исчерпаны
	log(
		'AI Auto',
		`❌ Failed to get active profile after ${maxRetries} attempts`,
	);
	return null;
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
	const profileSwitchService = (
		await import('../luxeeApi/profileSwitchService.js')
	).default;

	return await profileSwitchService.switchProfile(
		page,
		accountId,
		profileUid,
		'AI Auto',
	);
};

/**
 * Получить профиль по UID (для Catch Up чатов)
 * @param {Object} page - Playwright page
 * @param {string} targetUid - UID профиля для поиска (может быть outer или inner)
 * @returns {Promise<Object|null>} - Данные профиля или null
 */
const getProfileByUid = async (page, targetUid) => {
	try {
		const profile = await page.evaluate(uid => {
			const data = modelsChat?.getProfile?.data;
			if (!data) return null;

			// 1️⃣ Прямой поиск (inner UID)
			const profileData = data[uid];
			if (profileData) {
				const inner = profileData.inner;
				if (!inner) return null;

				// Собираем все UIDs (inner + outer)
				const allUids = [inner.uid];
				if (profileData.outer) {
					for (const key in profileData.outer) {
						allUids.push(profileData.outer[key].uid);
					}
				}

				return {
					uid: inner.uid,
					allUids: allUids,
					username: inner.username,
					age: inner.age,
					country: inner.country,
					city: inner.city,
				};
			}

			// 2️⃣ Поиск в modelsChat.getProfile.outer (outer UID → inner UID)
			const outerProfiles = modelsChat?.getProfile?.outer;
			if (outerProfiles && outerProfiles[uid]) {
				const outerProfile = outerProfiles[uid];
				const innerUid = outerProfile.import_uid;

				console.log(
					`[getProfileByUid] Found outer UID ${uid}, inner UID: ${innerUid}`,
				);

				// Получаем полные данные по inner UID
				if (innerUid && data[innerUid]) {
					const innerData = data[innerUid];
					const inner = innerData.inner;
					if (!inner) return null;

					// Собираем все UIDs
					const allUids = [inner.uid];
					if (innerData.outer) {
						for (const key in innerData.outer) {
							allUids.push(innerData.outer[key].uid);
						}
					}

					return {
						uid: inner.uid,
						allUids: allUids,
						username: inner.username,
						age: inner.age,
						country: inner.country,
						city: inner.city,
					};
				}
			}

			console.log(`[getProfileByUid] Profile not found for UID: ${uid}`);
			return null;
		}, targetUid);

		return profile;
	} catch (error) {
		logError('Utils', `Error getting profile by UID ${targetUid}:`, error);
		return null;
	}
};

export default {
	getTimestamp,
	log,
	logError,
	sleep,
	randomDelay,
	getActiveProfile,
	switchToProfile,
	getProfileByUid,
};
