// AI Auto Response - Main Orchestrator
// Главный оркестратор с глобальной блокировкой (Mutex)

import LuxeeAccount from '../../models/LuxeeAccountModel.js';
import aiResponseService from '../aiResponseService.js';
import aiScheduleService from '../aiScheduleService.js';
import activityCenterScanner from './activityCenterScanner.js';
import { isUserBlacklisted, shouldSkipDueToLoop } from './blacklistService.js';
import { isProfileExcluded } from './excludedProfilesService.js';
import catchUpScanner from './catchUpScanner.js';
import chatProcessor from './chatProcessor.js';
import cycleLogger from './cycleLogger.js';
import profileScanner from './profileScanner.js';
import utils from './utils.js';

// Глобальная блокировка для аккаунтов (Mutex)
const processingLocks = new Map(); // accountId → { isProcessing: true, startedAt: timestamp }

// Кеш последних значений Catch Up счётчика (для оптимизации)
const lastCatchUpCounts = new Map(); // accountId → lastCount

// Время последнего ПОЛНОГО прохода Catch Up (для TTL-гейта)
// Полный проход = зашли внутрь, извлекли чаты, отфильтровали.
// Даже если count не меняется, полный проход повторяется не реже TTL.
const lastCatchUpFullCheck = new Map(); // accountId → timestamp
const CATCH_UP_FULL_CHECK_TTL_MS = 5 * 60 * 1000; // 5 минут

/**
 * Обработать сообщения аккаунта
 * @param {string} accountId - ID аккаунта
 * @param {string} userId - ID пользователя
 * @param {Object} page - Playwright page
 * @returns {Promise<Object>} - { processed: boolean, reason: string }
 */
const processAccountMessages = async (accountId, userId, page) => {
	const startTime = Date.now();

	// ========== ПРОВЕРКА ПЕРЕЗАПУСКА AI КОНТЕКСТА (КАЖДЫЕ 2 ЧАСА) ==========
	try {
		const aiContextId = `${accountId}_ai`;
		const { default: browserService } = await import('../browser/browserService.js');
		
		if (browserService.shouldRestartAiContext(aiContextId)) {
			const age = browserService.getContextAge(aiContextId);
			const ageHours = age ? (age / (60 * 60 * 1000)).toFixed(1) : 'unknown';
			
			utils.log(
				'AI Auto',
				`🔄 AI context is ${ageHours}h old, restarting for account ${accountId}...`,
			);

			try {
				await browserService.restartAiContext(aiContextId);
				utils.log('AI Auto', `✅ AI context restarted successfully for account ${accountId}`);
				
				// После перезапуска получаем новую страницу
				const newContext = browserService.getContext(aiContextId);
				if (newContext) {
					const pages = newContext.pages();
					if (pages.length > 0) {
						// Обновляем page для дальнейшего использования
						page = pages[0];
						utils.log('AI Auto', `✅ Using new page after context restart`);
					}
				}
			} catch (restartError) {
				utils.logError('AI Auto', 'Failed to restart AI context:', restartError);
				// Продолжаем работу со старым контекстом
			}
		}
	} catch (checkError) {
		// Игнорируем ошибки проверки - продолжаем работу
		console.error('[AI Auto] Error checking context restart:', checkError);
	}

	// ========== ПРОВЕРКА БЛОКИРОВКИ ==========
	if (processingLocks.has(accountId)) {
		const lock = processingLocks.get(accountId);
		const elapsed = Date.now() - lock.startedAt;
		utils.log(
			'AI Auto',
			`⏸️  Account ${accountId} is LOCKED (${Math.round(elapsed / 1000)}s) - skipping cycle`,
		);
		cycleLogger.logEvent(accountId, 'lock', 'locked_skip', {
			elapsedSec: Math.round(elapsed / 1000),
		});
		return { processed: false, reason: 'account_locked' };
	}

	try {
		// ========== ЗАБЛОКИРОВАТЬ АККАУНТ ==========
		processingLocks.set(accountId, {
			isProcessing: true,
			startedAt: Date.now(),
		});

		utils.log('AI Auto', `🔒 Account ${accountId} LOCKED`);

		// ========== ПРОВЕРКА AI SCHEDULE (ИНТЕРВАЛОВ) ==========
		// Проверяем можно ли сейчас работать по расписанию пользователя
		const account = await LuxeeAccount.findById(accountId).populate('user');

		if (!account || !account.user) {
			utils.log('AI Auto', `❌ Account or user not found for schedule check`);
			return { processed: false, reason: 'account_not_found' };
		}

		const scheduleCheck = await aiScheduleService.checkUserSchedule(
			account.user._id,
		);

		if (!scheduleCheck.shouldRun) {
			const nextTime = scheduleCheck.nextToggleTime
				? new Date(scheduleCheck.nextToggleTime).toLocaleString('ru-RU')
				: 'неизвестно';

			const stateEmoji = scheduleCheck.currentState === 'resting' ? '💤' : '⏸️';
			utils.log(
				'AI Auto',
				`${stateEmoji} User ${account.user.email} в режиме ОТДЫХА до ${nextTime}`,
			);
			cycleLogger.logEvent(accountId, 'schedule', 'resting_skip', {
				currentState: scheduleCheck.currentState,
				nextRunTime: scheduleCheck.nextToggleTime || null,
			});

			return {
				processed: false,
				reason: 'user_schedule_resting',
				nextRunTime: scheduleCheck.nextToggleTime,
			};
		}

		// Если только что переключились - логируем
		if (scheduleCheck.justToggled) {
			const stateEmoji = scheduleCheck.currentState === 'working' ? '⚡' : '💤';
			utils.log(
				'AI Auto',
				`${stateEmoji} Schedule auto-switched to: ${scheduleCheck.currentState}`,
			);
		}

		// ========== ОСНОВНАЯ ЛОГИКА ==========

		// ========== МАСТЕР-ВЫКЛЮЧАТЕЛИ РАЗДЕЛОВ (aiSections) ==========
		// OFF = раздел полностью пропускается циклом. Дефолт true для
		// отсутствующего поля (обратная совместимость со старыми документами).
		// Отличается от blacklist.categories: там фильтр по конкретным мужчинам.
		const sectionsRaw =
			account.aiSections?.toObject?.() || account.aiSections || {};
		const secNewMessages = sectionsRaw.newMessages !== false;
		const secCatchUp = sectionsRaw.catchUp !== false;
		const secActivityCenter = sectionsRaw.activityCenter !== false;
		if (!secNewMessages || !secCatchUp || !secActivityCenter) {
			const off = [
				!secNewMessages ? 'newMessages' : null,
				!secCatchUp ? 'catchUp' : null,
				!secActivityCenter ? 'activityCenter' : null,
			].filter(Boolean);
			utils.log('AI Auto', `🚫 Sections disabled: ${off.join(', ')}`);
		}

		// 🔄 ПРОВЕРКА И СИНХРОНИЗАЦИЯ КЕША ПРОФИЛЕЙ (один раз при старте)
		try {
			const { default: profileCacheSyncService } = await import('../luxeeApi/profileCacheSyncService.js');
			const { default: profileCacheService } = await import('../luxeeApi/profileCacheService.js');
			
			// Проверяем есть ли профили в кеше
			const cachedProfiles = await profileCacheService.getAllProfiles(accountId);
			
			if (!cachedProfiles || cachedProfiles.length === 0) {
				utils.log('AI Auto', '📦 Cache is empty, syncing profiles...');
				
				// Получить sessionData из аккаунта
				const syncResult = await profileCacheSyncService.syncProfileCache(
					accountId,
					account.sessionData
				);
				
				if (syncResult.success) {
					utils.log('AI Auto', `✅ Cache synced: ${syncResult.profilesCount} profiles`);
				} else {
					utils.log('AI Auto', `⚠️  Cache sync failed, will retry later`);
				}
			}
		} catch (syncError) {
			// Не критично - продолжаем работу
			utils.logError('AI Auto', 'Cache sync error:', syncError);
		}

	// 1️⃣ Получить активный профиль + кеш из БД
	const activeProfile = await utils.getActiveProfile(page, accountId);

	if (!activeProfile) {
		utils.log('AI Auto', `❌ No active profile found`);
		cycleLogger.logEvent(accountId, 'cycle', 'no_active_profile', {});
		return { processed: false, reason: 'no_active_profile' };
	}

		utils.log(
			'AI Auto',
			`👤 Active profile: ${activeProfile.username} (${activeProfile.uid})`,
		);

		console.log('[🤖 AI AUTO] ========== ACTIVE PROFILE ==========');
		console.log('[🤖 AI AUTO] Profile:', {
			username: activeProfile.username,
			uid: activeProfile.uid,
			allUids: activeProfile.allUids,
		});

		// 🚫 Исключённые анкеты: ИИ полностью игнорирует профиль (читается свежим
		// из БД каждый цикл — работает "на горячую" без перезапуска).
		// account.user populated выше, поэтому изменения из админки применяются сразу.
		const isActiveProfileExcluded = isProfileExcluded(
			account.user,
			activeProfile.uid,
		);
		if (isActiveProfileExcluded) {
			utils.log(
				'AI Auto',
				`🚫 Active profile ${activeProfile.username} (${activeProfile.uid}) is excluded — skipping entirely`,
			);
		}

		// 2️⃣ Получить чаты АКТИВНОГО профиля (ПРИОРИТЕТ!)
		// Исключённый профиль даже не сканируем — ИИ его "не смотрит".
		// Раздел newMessages выключен — пропускаем обычные чаты целиком.
		let activeChats = [];
		if (!secNewMessages) {
			utils.log('AI Auto', `⏭️  Section newMessages disabled — skipping active chats`);
			cycleLogger.logEvent(accountId, 'cycle', 'section_disabled', {
				reason: 'section_newMessages_disabled',
			});
		} else if (!isActiveProfileExcluded) {
			utils.log(
				'AI Auto',
				`🔍 Checking chats on ACTIVE profile ${activeProfile.username}...`,
			);

			// Глобальный флаг для отслеживания успешной отправки
			activeChats = await profileScanner.getAllChatsForProfile(
				page,
				activeProfile.allUids || [activeProfile.uid],
			);
		}

		// Глобальный флаг для отслеживания успешной отправки
		let messageSent = false;

		console.log('[🤖 AI AUTO] Active chats found:', activeChats.length);

		// ========== ДЕТЕКЦИЯ И ИСПРАВЛЕНИЕ API РАССИНХРОНА ==========
		// (для исключённых профилей не выполняем — профиль всё равно пропускаем)
		if (secNewMessages && !isActiveProfileExcluded && activeProfile.newMessages > 0 && activeChats.length === 0) {
			utils.log(
				'AI Auto',
				`⚠️  API DESYNC: ${activeProfile.username} has ${activeProfile.newMessages} unread but 0 chats found`,
			);
			utils.log('AI Auto', '🔄 Reloading page to fix API sync...');

			try {
				const targetUid = activeProfile.uid;
				const targetName = activeProfile.username;

				// Reload страницы (сохраняем URL)
				const currentUrl = page.url();
				await page.goto(currentUrl, {
					waitUntil: 'domcontentloaded',
					timeout: 30000,
				});
				await utils.sleep(3000); // Wait for API load

				utils.log('AI Auto', '✅ Page reloaded');

				// Переключаемся обратно на целевой профиль
				utils.log('AI Auto', `🔄 Switching back to ${targetName}...`);
				const switched = await utils.switchToProfile(
					page,
					accountId,
					targetUid,
				);

				if (switched) {
					utils.log('AI Auto', `✅ Switched back to ${targetName}`);

				// Retry scanning - теперь API синхронизирован!
				const reloadedProfile = await utils.getActiveProfile(page, accountId);
				if (reloadedProfile) {
						activeChats = await profileScanner.getAllChatsForProfile(
							page,
							reloadedProfile.allUids || [reloadedProfile.uid],
						);

						if (activeChats.length > 0) {
							utils.log(
								'AI Auto',
								`✅ FIXED! Found ${activeChats.length} chats after reload+switch`,
							);
						} else {
							utils.log(
								'AI Auto',
								'⚠️  Still 0 chats after reload+switch - may need manual check',
							);
						}
					}
				} else {
					utils.log('AI Auto', '❌ Failed to switch back to profile');
				}
			} catch (error) {
				utils.logError('AI Auto', 'Reload+switch failed:', error);
			}
		}
		// ========== КОНЕЦ ДЕТЕКЦИИ РАССИНХРОНА ==========
		if (!isActiveProfileExcluded && activeChats.length > 0) {
			console.log(
				'[🤖 AI AUTO] All active chats:',
				activeChats.map(c => ({
					chatId: c.chatId,
					manName: c.manName,
					lastActivity: c.lastActivity,
				})),
			);
		}

		if (activeChats.length > 0) {
			utils.log(
				'AI Auto',
				`🎯 Found ${activeChats.length} chats on ACTIVE profile`,
			);

			// Сортируем чаты: НОВЫЕ ПЕРВЫМИ (по lastActivity)
			const sortedChats = activeChats.sort((a, b) => {
				const timeA = parseInt(a.lastActivity) || 0;
				const timeB = parseInt(b.lastActivity) || 0;
				return timeB - timeA; // DESC: новые первыми
			});

			console.log(
				'[🤖 AI AUTO] 📊 Sorted chats (newest first):',
				sortedChats.slice(0, 5).map(c => ({
					manName: c.manName,
					lastActivity: c.lastActivity,
				})),
			);

			// Обрабатываем ВСЕ чаты по очереди до первого успешного
			for (let i = 0; i < sortedChats.length; i++) {
				const chat = sortedChats[i];

				// 🚫 ПРОВЕРКА ЧЕРНОГО СПИСКА
				// manUid берём из объекта (members), НЕ из позиции в chatId:
				// порядок частей не фиксирован (manUid_profileOuter тоже бывает).
				const userUid = chat.manUid || chat.chatId.split('_')[1];
				if (await isUserBlacklisted(accountId, userUid, 'newMessages')) {
					// Проверка зацикливания
					const messageCount = chat.messageCount || 0;
					if (
						shouldSkipDueToLoop(
							accountId,
							activeProfile.uid,
							userUid,
							messageCount,
						)
					) {
						utils.log(
							'AI Auto',
							`⏭️  Skipping ${chat.chatId} (blacklist loop protection)`,
						);
						continue;
					}

					utils.log('AI Auto', `🚫 Skipping ${chat.chatId} (blacklisted user)`);
					continue;
				}

				utils.log(
					'AI Auto',
					`Processing chat ${i + 1}/${sortedChats.length}: ${chat.manName}`,
				);
				console.log('[🤖 AI AUTO] 🎯 Processing chat:', {
					chatId: chat.chatId,
					manName: chat.manName,
					position: `${i + 1} of ${sortedChats.length}`,
				});

				const result = await chatProcessor.processSingleChat({
					accountId,
					userId,
					page,
					profile: activeProfile,
					chat: chat,
				});

				if (result.sent) {
					const elapsed = Date.now() - startTime;
					utils.log(
						'AI Auto',
						`✅ Message sent on active profile (${Math.round(elapsed / 1000)}s)`,
					);
					console.log(
						'[🤖 AI AUTO] ✅ SUCCESS! Message sent on active profile',
					);
					await utils.randomDelay(3000, 5000);
					messageSent = true;
					cycleLogger.logEvent(accountId, 'cycle', 'finished', {
						processed: true,
						reason: 'active_profile_processed',
						durationSec: Math.round(elapsed / 1000),
						chatId: chat.chatId,
						manName: chat.manName,
						sent: true,
					});
					return { processed: true, reason: 'active_profile_processed' };
				} else {
					utils.log(
						'AI Auto',
						`⚠️  Chat ${i + 1} failed: ${result.reason} - trying next chat`,
					);
					console.log(
						'[🤖 AI AUTO] ⚠️  Chat failed:',
						result.reason,
						'- continuing to next',
					);
					// Продолжаем к следующему чату
				}
			}

			// Если дошли сюда - ни один чат не подошёл
			if (!messageSent) {
				utils.log(
					'AI Auto',
					`⚠️  No suitable chats found on active profile (checked all ${sortedChats.length})`,
				);
				console.log(
					'[🤖 AI AUTO] ⚠️  All chats checked on active profile - none suitable',
				);
			}
		} else if (!isActiveProfileExcluded) {
			utils.log(
				'AI Auto',
				`No chats on active profile ${activeProfile.username}`,
			);
		}

		// 3️⃣ Получить ДРУГИЕ профили с сообщениями
		// Раздел newMessages выключен — пропускаем (уже залогировано выше)
		utils.log('AI Auto', `🔍 Scanning other profiles...`);
		const allProfiles = secNewMessages
			? await profileScanner.getAllProfilesWithMessages(page)
			: [];
		// 🚫 Убираем исключённые анкеты ДО переключений — ИИ их даже не открывает
		const otherProfilesUnfiltered = allProfiles.filter(p => p.uid !== activeProfile.uid);
		const otherProfiles = otherProfilesUnfiltered.filter(
			p => !isProfileExcluded(account.user, p.uid),
		);
		if (otherProfiles.length !== otherProfilesUnfiltered.length) {
			utils.log(
				'AI Auto',
				`🚫 Filtered ${otherProfilesUnfiltered.length - otherProfiles.length} excluded profile(s), ${otherProfiles.length} remaining`,
			);
		}

		utils.log(
			'AI Auto',
			`Found ${otherProfiles.length} other profiles with messages`,
		);

		// 4️⃣ Обработать другие профили (если есть)
		if (otherProfiles.length > 0) {
			for (const profile of otherProfiles) {
				utils.log(
					'AI Auto',
					`🔄 Processing profile: ${profile.username} (${profile.newMessages} new)`,
				);

				// Переключиться на профиль через глобальный сервис
				const switched = await utils.switchToProfile(
					page,
					accountId,
					profile.uid,
				);
				if (!switched) {
					utils.log(
						'AI Auto',
						`⚠️  Failed to switch to ${profile.username} - skipping`,
					);
					continue;
				}

				// Получить чаты этого профиля
				const chats = await profileScanner.getAllChatsForProfile(
					page,
					profile.allUids,
				);

				if (chats.length === 0) {
					utils.log('AI Auto', `No chats on ${profile.username} - skipping`);
					continue;
				}

				utils.log(
					'AI Auto',
					`📝 Found ${chats.length} chats on ${profile.username}`,
				);

				// Сортируем чаты: НОВЫЕ ПЕРВЫМИ
				const sortedChats = chats.sort((a, b) => {
					const timeA = parseInt(a.lastActivity) || 0;
					const timeB = parseInt(b.lastActivity) || 0;
					return timeB - timeA;
				});

				// Обрабатываем ВСЕ чаты по очереди
				for (let i = 0; i < sortedChats.length; i++) {
					const chat = sortedChats[i];

					// 🚫 ПРОВЕРКА ЧЕРНОГО СПИСКА (для других профилей тоже)
					// manUid из объекта (members), не из позиции в chatId
					const userUid = chat.manUid || chat.chatId.split('_')[1];
					if (await isUserBlacklisted(accountId, userUid, 'newMessages')) {
						const messageCount = chat.messageCount || 0;
						if (
							shouldSkipDueToLoop(accountId, profile.uid, userUid, messageCount)
						) {
							utils.log(
								'AI Auto',
								`⏭️  Skipping ${chat.chatId} on ${profile.username} (blacklist loop)`,
							);
							continue;
						}

						utils.log(
							'AI Auto',
							`🚫 Skipping ${chat.chatId} on ${profile.username} (blacklisted)`,
						);
						continue;
					}

					utils.log(
						'AI Auto',
						`Processing chat ${i + 1}/${sortedChats.length}: ${chat.manName}`,
					);

					const result = await chatProcessor.processSingleChat({
						accountId,
						userId,
						page,
						profile,
						chat: chat,
					});

					if (result.sent) {
						const elapsed = Date.now() - startTime;
						utils.log(
							'AI Auto',
							`✅ Message sent on profile ${profile.username} (${Math.round(elapsed / 1000)}s)`,
						);
						await utils.randomDelay(3000, 5000);
						messageSent = true;
						cycleLogger.logEvent(accountId, 'cycle', 'finished', {
							processed: true,
							reason: 'other_profile_processed',
							durationSec: Math.round(elapsed / 1000),
							chatId: chat.chatId,
							manName: chat.manName,
							profileName: profile.username,
							sent: true,
						});
						return { processed: true, reason: 'other_profile_processed' };
					} else {
						utils.log(
							'AI Auto',
							`⚠️  Chat ${i + 1} failed: ${result.reason} - trying next`,
						);
						// Продолжаем со следующим чатом
					}
				}

				if (!messageSent) {
					utils.log(
						'AI Auto',
						`⚠️  No suitable chats on ${profile.username} (checked all ${sortedChats.length})`,
					);
					// Продолжаем со следующим профилем
				}
			}
		} else {
			utils.log('AI Auto', `No other profiles with messages`);
		}

		// ========== CATCH UP РЕЗЕРВ (только если НИ ОДИН ЧАТ не обработан) ==========
		// Мастер-выключатель раздела: OFF = скип целиком (см. aiSections)
		if (!messageSent && !secCatchUp) {
			utils.log('AI Auto', `⏭️  Section catchUp disabled — skipping`);
			cycleLogger.logEvent(accountId, 'cycle', 'section_disabled', {
				reason: 'section_catchUp_disabled',
			});
		}
		if (!messageSent && secCatchUp) {
			utils.log(
				'AI Auto',
				'🔍 No chats found in main cycle, checking Catch Up...',
			);

			console.log('[🚦 NAVIGATION] ========== CHECKING CATCH UP ==========');
			console.log('[🚦 NAVIGATION] Current URL:', page.url());
			console.log('[🚦 NAVIGATION] Time:', new Date().toISOString());

			// ✅ СНАЧАЛА проверяем count БЕЗ открытия
			const catchUpCount = await catchUpScanner.getCatchUpCount(page);
			const lastCount = lastCatchUpCounts.get(accountId) || 0;

			console.log('[🚦 NAVIGATION] Catch Up count:', catchUpCount);
			console.log('[🚦 NAVIGATION] Last count:', lastCount);

		// 🔍 Определяем нужно ли заходить в Catch Up
		// Заходим если: count изменился ИЛИ прошло 5+ минут с полного прохода.
		// Иначе stall: count висит, а чаты внутри никогда не перепроверяются.
		let shouldCheckCatchUp = false;
		let skipReason = '';
		let ttlExpired = false;

		if (catchUpCount === 0) {
			shouldCheckCatchUp = false;
			skipReason = 'count is 0 (empty)';
		} else if (catchUpCount !== lastCount) {
			shouldCheckCatchUp = true;
			skipReason = '';
		} else {
			const lastFull = lastCatchUpFullCheck.get(accountId) || 0;
			const elapsedSinceFull = Date.now() - lastFull;
			if (elapsedSinceFull >= CATCH_UP_FULL_CHECK_TTL_MS) {
				shouldCheckCatchUp = true;
				ttlExpired = true;
				skipReason = '';
			} else {
				shouldCheckCatchUp = false;
				const waitSec = Math.round(
					(CATCH_UP_FULL_CHECK_TTL_MS - elapsedSinceFull) / 1000,
				);
				skipReason = `count unchanged (${catchUpCount}), next full check in ${waitSec}s`;
			}
		}

			// Сохраняем текущий count для следующего цикла
			lastCatchUpCounts.set(accountId, catchUpCount);
		cycleLogger.logEvent(accountId, 'catchup', 'count_check', {
			count: catchUpCount,
			lastCount,
			shouldCheck: shouldCheckCatchUp,
			skipReason,
			ttlExpired,
		});

			if (!shouldCheckCatchUp) {
				utils.log('AI Auto', `⏭️  Skipping Catch Up: ${skipReason}`);
				console.log('[🚦 NAVIGATION] ⏭️  SKIPPING CATCH UP:', skipReason);
				console.log('[🚦 NAVIGATION] ✅ Staying at /chats/ (optimization)');
			} else {
				utils.log(
					'AI Auto',
					ttlExpired
						? `📬 Catch Up count ${catchUpCount} (unchanged) — 5-min TTL expired, re-checking...`
						: `📬 Catch Up count changed (${lastCount} → ${catchUpCount}), opening...`,
				);
				console.log(
					'[🚦 NAVIGATION] 📬 Catch Up count CHANGED, will check inside',
				);
			cycleLogger.logEvent(accountId, 'catchup', 'entering', {
				count: catchUpCount,
				lastCount,
				ttlExpired,
			});

				console.log(
					'[🚦 NAVIGATION] ========== ENTERING CATCH UP MODE ==========',
				);
				console.log('[🚦 NAVIGATION] Current URL:', page.url());
				console.log('[🚦 NAVIGATION] Time:', new Date().toISOString());

				const catchUpChats = await catchUpScanner.getAllCatchUpChats(page, accountId);

				console.log('[🚦 NAVIGATION] After opening Catch Up:');
				console.log('[🚦 NAVIGATION] Current URL:', page.url());
				console.log('[🚦 NAVIGATION] Found chats:', catchUpChats.length);
				cycleLogger.logEvent(accountId, 'catchup', 'extracted', {
					total: catchUpChats.length,
				});
				// Полный проход начат (overlay открыт, чаты извлечены).
				// Ставим TTL-метку СРАЗУ: даже если дальше цикл упадёт на
				// exception, следующий тик не будет долбить overlay заново,
				// а подождёт 5 минут. Retry-логика при этом сохраняется.
				lastCatchUpFullCheck.set(accountId, Date.now());

				if (catchUpChats.length > 0) {
					utils.log(
						'AI Auto',
						`📬 Found ${catchUpChats.length} chats in Catch Up`,
					);

				// Фильтруем уже обработанные (по кешу с учётом profileUid + manUid)
				const unprocessedChats = [];
				// Честные счётчики по причинам (раньше всё сваливалось в "in cache")
				const filterStats = {
					ready: 0,
					cached: 0,
					blacklisted: 0,
					excluded: 0,
					profile_not_found: 0,
					retry_wait: 0,
					already_answered: 0,
				};

				// Нормализация lastActivity к мс (сайт может отдать секунды)
				const normalizeTs = ts => {
					const n = Number(ts);
					if (!Number.isFinite(n) || n <= 0) return null;
					return n < 1e12 ? n * 1000 : n;
				};

				console.log(
					'[📊 CATCH UP FILTER] ========== FILTERING CHATS ==========',
				);
				console.log(
					'[📊 CATCH UP FILTER] Total chats found:',
					catchUpChats.length,
				);

				// Дамп карты профилей сессии: какие анкеты вообще видны.
				// Если outer чата нет в карте — это чат НЕ текущей сессии
				// (другая анкета аккаунта), резолвим через переключение.
				const sessionMap = await catchUpScanner.dumpSessionProfileMap(page);
				utils.log(
					'AI Auto',
					`🗺️  Session profiles: ${sessionMap.dataKeys} inners, ${sessionMap.outerKeys} outers in global map`,
				);
				// Бюджет переключений на этот проход (защита от долгого цикла)
				const ownerSwitchBudget = { count: 0 };

				for (const chat of catchUpChats) {
					// 🆕 Отвечаем ТОЛЬКО на реально новые сообщения.
					// unAnswered взят из getChats.list БЕЗ открытия чата —
					// прочитанные (false) даже не трогаем: ни захода, ни read-receipt.
					if (chat.unAnswered === false) {
						console.log('[⏭️ CATCH UP FILTER] Already answered (skipping):');
						console.log('   Chat ID:', chat.chatId);
						filterStats.already_answered++;
						cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
							chatId: chat.chatId,
							manName: chat.manName,
							manUid: chat.manUid || null,
							decision: 'already_answered',
							reason: 'already_answered',
						});
						continue;
					}
					if (chat.unAnswered == null) {
						console.log('[❓ CATCH UP FILTER] unAnswered unknown, will process:', chat.chatId);
					}
					// Получаем профиль чтобы узнать inner UID.
					// Быстрый путь — текущая сессия; иначе резолв владельца
					// через переключение анкет (как цикл "других анкет").
					let profile = await utils.getProfileByUid(
						page,
						chat.profileUidOuter,
					);
					let ownerSwitched = false;

					if (!profile) {
						profile = await catchUpScanner.resolveOwnerProfile(
							page,
							accountId,
							chat.profileUidOuter,
							{
								switchesUsed: ownerSwitchBudget,
								maxSwitches:
									catchUpScanner.MAX_OWNER_SWITCHES_PER_PASS,
							},
						);
						ownerSwitched = !!profile;
					}

					if (!profile) {
						// Владельца найти не удалось. Не кешируем на 10-16ч,
						// а откладываем на 5 минут (короткий retry-кеш) —
						// иначе чат умирает навсегда после первой неудачи.
					if (
						!catchUpScanner.shouldRetryNow(
							accountId,
							chat.chatId,
						)
					) {
						console.log('[⏳ CATCH UP FILTER] Retry wait (skipping):');
						console.log('   Chat ID:', chat.chatId);
						filterStats.retry_wait++;
						cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
							chatId: chat.chatId,
							manName: chat.manName,
							manUid: chat.manUid || null,
							decision: 'retry_wait',
							reason: 'retry_wait',
						});
						continue;
					}
					catchUpScanner.markRetryLater(
						accountId,
						chat.chatId,
					);
						console.log('[❌ CATCH UP FILTER] Profile not found:');
						console.log('   Chat ID:', chat.chatId);
						console.log('   Man:', chat.manName);
						console.log('   Profile UID (outer):', chat.profileUidOuter);
					utils.log(
						'AI Auto',
						`⚠️  Profile ${chat.profileUidOuter} not found, retry in 5 min`,
					);
					filterStats.profile_not_found++;
					cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
						chatId: chat.chatId,
						manName: chat.manName,
						manUid: chat.manUid || null,
						decision: 'profile_not_found',
						reason: 'profile_not_found',
					});
					continue;
					}

						// Проверяем кеш успеха: accountId_profileUid_manUid.
					// НО: если после нашего ответа пришла НОВАЯ активность —
					// кеш не действует, чат обрабатываем как новый.
					// (Иначе новое сообщение после нашего ответа игнорилось бы 10-16ч.)
					const cachedEntry = catchUpScanner.getCachedChat(
						accountId,
						profile.uid,
						chat.manUid,
					);
					let cacheBypassed = false;
					if (cachedEntry) {
						const lastAct = normalizeTs(chat.lastActivity);
						const now = Date.now();
						if (
							lastAct &&
							lastAct > cachedEntry.processedAt &&
							lastAct <= now + 5 * 60 * 1000
						) {
							cacheBypassed = true;
							utils.log(
								'AI Auto',
								`🔄 New activity in ${chat.chatId} after our reply — reprocessing (cache bypass)`,
							);
						}
					}

					if (cachedEntry && !cacheBypassed) {
							console.log('[💾 CATCH UP FILTER] Chat in CACHE (skipping):');
							console.log('   Chat ID:', chat.chatId);
							console.log('   Man:', chat.manName, `(${chat.manUid})`);
							console.log('   Profile:', profile.username, `(${profile.uid})`);
							console.log(
								'   Cache key:',
								`${accountId}_${profile.uid}_${chat.manUid}`,
							);
					utils.log(
						'AI Auto',
						`⏭️  Skip ${chat.chatId} (in cache for profile ${profile.uid})`,
					);
					filterStats.cached++;
					cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
						chatId: chat.chatId,
						manName: chat.manName,
						profileName: profile.username,
						decision: 'cached',
						reason: 'in_cache',
					});
				} else {
						console.log('[✅ CATCH UP FILTER] Chat READY for processing:');
						console.log('   Chat ID:', chat.chatId);
						console.log('   Man:', chat.manName, `(${chat.manUid})`);
						console.log('   Profile:', profile.username, `(${profile.uid})`);
						if (ownerSwitched) {
							console.log('   Owner resolved via profile switch');
						}
						// Добавляем в список для обработки
						unprocessedChats.push({
							chat: chat,
							profile: profile,
						});
						filterStats.ready++;
						cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
							chatId: chat.chatId,
							manName: chat.manName,
							profileName: profile.username,
							decision: 'ready',
							ownerSwitched,
						});
					}
				}

				console.log(
					'[📊 CATCH UP FILTER] ========== FILTER RESULTS ==========',
				);
				console.log('[📊 CATCH UP FILTER] Total found:', catchUpChats.length);
				console.log('[📊 CATCH UP FILTER] Ready to process:', filterStats.ready);
				console.log('[📊 CATCH UP FILTER] Skipped:', JSON.stringify({
					cached: filterStats.cached,
					blacklisted: filterStats.blacklisted,
					excluded: filterStats.excluded,
					profile_not_found: filterStats.profile_not_found,
					retry_wait: filterStats.retry_wait,
				}));
				utils.log(
					'AI Auto',
					`📊 Catch Up filter: ready=${filterStats.ready}, cached=${filterStats.cached}, blacklisted=${filterStats.blacklisted}, excluded=${filterStats.excluded}, not_found=${filterStats.profile_not_found}, retry_wait=${filterStats.retry_wait}`,
				);
				cycleLogger.logEvent(accountId, 'catchup', 'filter_results', {
					total: catchUpChats.length,
					...filterStats,
				});
				// Полный проход выполнен — обновляем TTL-метку.
				// Следующий заход: при смене count сразу, иначе через 5 минут.
				lastCatchUpFullCheck.set(accountId, Date.now());

					if (unprocessedChats.length > 0) {
						utils.log(
							'AI Auto',
							`🎯 Processing ${unprocessedChats.length} Catch Up chats...`,
						);

						console.log(
							'[🚦 NAVIGATION] ========== PROCESSING CATCH UP CHATS ==========',
						);
						console.log(
							'[🚦 NAVIGATION] Total unprocessed:',
							unprocessedChats.length,
						);
						console.log(
							'[� NAVIGATION] Will process ONE AT A TIME (FIFO queue)',
						);

						for (const item of unprocessedChats) {
							const { chat, profile } = item;

							// 🚫 Исключённая анкета — пропускаем без кеширования,
							// чтобы после снятия исключения чат обработался
						if (isProfileExcluded(account.user, profile.uid)) {
							utils.log(
								'AI Auto',
								`🚫 Skipping Catch Up: ${chat.manName} on ${profile.username} (profile excluded)`,
							);
							filterStats.excluded++;
							cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
								chatId: chat.chatId,
								manName: chat.manName,
								profileName: profile.username,
								decision: 'excluded',
								reason: 'profile_excluded',
							});
							continue;
						}

							// � ПРОВЕРКА ЧЕРНОГО СПИСКА (Catch Up)
							console.log(
								`[� BLACKLIST CHECK] Checking Catch Up: userUid=${chat.manUid}, category=catchUp`,
							);
							const isBlacklisted = await isUserBlacklisted(
								accountId,
								chat.manUid,
								'catchUp',
							);
							console.log(
								`[� BLACKLIST CHECK] Result: ${isBlacklisted ? 'BLACKLISTED ❌' : 'ALLOWED ✅'}`,
							);

							if (isBlacklisted) {
								const messageCount = chat.messageCount || 0;
								if (
									shouldSkipDueToLoop(
										accountId,
										profile.uid,
										chat.manUid,
										messageCount,
									)
								) {
									utils.log(
										'AI Auto',
										`⏭️  Skipping Catch Up: ${chat.manName} on ${profile.username} (blacklist loop)`,
									);
									continue;
								}

							utils.log(
								'AI Auto',
								`🚫 Skipping Catch Up: ${chat.manName} on ${profile.username} (blacklisted)`,
							);
							filterStats.blacklisted++;
							cycleLogger.logEvent(accountId, 'catchup', 'chat_filtered', {
								chatId: chat.chatId,
								manName: chat.manName,
								profileName: profile.username,
								decision: 'blacklisted',
								reason: 'blacklisted',
							});
							continue;
							}

							console.log(
								'[🚦 NAVIGATION] ========================================',
							);
							console.log('[🚦 NAVIGATION] 📝 PROCESSING CATCH UP CHAT');
							console.log('[🚦 NAVIGATION] Chat ID:', chat.chatId);
							console.log('[🚦 NAVIGATION] Man:', chat.manName);
							console.log('[🚦 NAVIGATION] Profile:', profile.username);
							console.log(
								'[🚦 NAVIGATION] Current URL BEFORE processing:',
								page.url(),
							);
							console.log('[🚦 NAVIGATION] Time:', new Date().toISOString());

							utils.log(
								'AI Auto',
								`Processing Catch Up: ${chat.manName} (profile: ${profile.username})`,
							);

							// ⏱️ ЖДЁМ обработки чата (СИНХРОННО!)
							console.log(
								'[🚦 NAVIGATION] ⏳ Starting processSingleChat (AWAIT)...',
							);
							const result = await chatProcessor.processSingleChat({
								accountId,
								userId,
								page,
								profile: profile,
								chat: chat,
								isCatchUp: true,
							});
							console.log('[🚦 NAVIGATION] ✅ processSingleChat COMPLETED');
							console.log('[🚦 NAVIGATION] Result:', result);
							console.log(
								'[🚦 NAVIGATION] Current URL AFTER processing:',
								page.url(),
							);

							if (result.sent) {
								// ✅ УСПЕХ → Сохраняем в кеш (10-16 часов)
								catchUpScanner.markChatAsProcessed(
									accountId,
									profile.uid,
									chat.manUid,
								);

								utils.log(
									'AI Auto',
									`✅ Replied to Catch Up: ${chat.manName} on ${profile.username}`,
								);

							// ✅ ВЫХОД после первой успешной отправки
							messageSent = true;

							const duration = Math.round((Date.now() - startTime) / 1000);
							cycleLogger.logEvent(accountId, 'catchup', 'chat_result', {
								chatId: chat.chatId,
								manName: chat.manName,
								profileName: profile.username,
								sent: true,
								reason: 'catch_up_sent',
								durationSec: duration,
							});
								utils.log(
									'AI Auto',
									`✅ Finished cycle - message sent from Catch Up (${duration}s)`,
								);

								console.log(
									'[🚦 NAVIGATION] ========== EXITING AFTER FIRST CATCH UP SEND ==========',
								);
								console.log('[🚦 NAVIGATION] Final URL:', page.url());
								console.log('[🚦 NAVIGATION] Duration:', duration, 'seconds');

								// 🔄 ОБНОВЛЯЕМ СТРАНИЦУ для стабильности (вернемся на /chats/)
								console.log(
									'[🚦 NAVIGATION] 🔄 Reloading page to return to /chats/...',
								);
								await page.reload({
									waitUntil: 'domcontentloaded',
									timeout: 10000,
								});
							await utils.sleep(2000);
							console.log(
								'[🚦 NAVIGATION] ✅ Page reloaded, back to stable state',
							);
							cycleLogger.logEvent(accountId, 'catchup', 'exit', {
								mode: 'after_send',
							});

							return {
									processed: true,
									reason: 'catch_up_sent',
									profile: profile.username,
									manName: chat.manName,
								};
							} else {
								// ⛔ Вечное состояние: собеседник заблокировал анкету.
								// Повторять бессмысленно — долгий кеш + подсказка в blacklist.
								// (Единственное исключение из "неуспех = повтор".)
								if (result.reason === 'user_blocked') {
									catchUpScanner.markChatAsProcessed(
										accountId,
										profile.uid,
										chat.manUid,
									);
									utils.log(
										'AI Auto',
										`⛔ ${chat.manName} (${chat.manUid}) blocked ${profile.username} — cached, add man to blacklist to hide forever`,
									);
									cycleLogger.logEvent(accountId, 'catchup', 'chat_result', {
										chatId: chat.chatId,
										manName: chat.manName,
										profileName: profile.username,
										sent: false,
										reason: 'user_blocked',
										cached: true,
									});
								} else {
								// ❌ НЕУДАЧА → ОБЯЗАТЕЛЬНЫЙ повтор, а не кеш на полдня.
								// Долгий кеш (10-16ч) только для УСПЕХА. Неудача идёт
								// в короткий retry-кеш (5 мин, после 5 fails подряд — 1ч),
								// иначе одно неотправленное сообщение умирает навсегда.
								catchUpScanner.markRetryLater(accountId, chat.chatId);
								const fails = catchUpScanner.getRetryFails(accountId, chat.chatId);

								console.log(
									'[🚦 NAVIGATION] ⚠️ Chat NOT sent, reason:',
									result.reason,
								);
								console.log(
									`[🚦 NAVIGATION] 🔁 Will retry (fail #${fails}), no long cache`,
								);

							utils.log(
								'AI Auto',
								`🔁 Failed chat ${chat.manName} (reason: ${result.reason}, fail #${fails}) — scheduled retry, no long cache`,
							);
							cycleLogger.logEvent(accountId, 'catchup', 'chat_result', {
								chatId: chat.chatId,
								manName: chat.manName,
								profileName: profile.username,
								sent: false,
								reason: result.reason,
								cached: false,
								fails,
							});
								}
							}

							console.log(
								'[🚦 NAVIGATION] Continuing to next Catch Up chat...',
							);
						}
						
					// 🔄 ПОСЛЕ обработки всех unprocessedChats - если НЕ отправили, reload
					if (!messageSent) {
						console.log('[🚦 NAVIGATION] ⚠️  No messages sent from Catch Up, exiting...');
						console.log('[🚦 NAVIGATION] 🔄 Reloading page to exit Catch Up...');
						await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
						await utils.sleep(2000);
						console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
						cycleLogger.logEvent(accountId, 'catchup', 'exit', {
							mode: 'no_send',
							unprocessed: unprocessedChats.length,
						});
					}
				} else {
					utils.log(
						'AI Auto',
						`✅ No Catch Up chats ready (cached=${filterStats.cached}, blacklisted=${filterStats.blacklisted}, excluded=${filterStats.excluded}, not_found=${filterStats.profile_not_found}, retry_wait=${filterStats.retry_wait})`,
					);

					// 🔄 ОБНОВЛЯЕМ СТРАНИЦУ для выхода из Catch Up (все в кеше)
					console.log('[🚦 NAVIGATION] 🔄 Reloading page to exit Catch Up (all cached)...');
					await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
					await utils.sleep(2000);
					console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
					cycleLogger.logEvent(accountId, 'catchup', 'exit', {
						mode: 'all_cached',
					});
					}
			} else {
				utils.log('AI Auto', '📭 No chats in Catch Up (after opening)');
				cycleLogger.logEvent(accountId, 'catchup', 'empty', {});
				// Тоже считаем полным проходом — не дёргать overlay каждый тик
				lastCatchUpFullCheck.set(accountId, Date.now());
			}
			}
		}

		// ===================================================================
		// 🔔 4. ОБРАБОТКА ACTIVITY CENTER (новые уведомления)
		// ===================================================================
		// Мастер-выключатель раздела: OFF = скип целиком (см. aiSections)
		if (!messageSent && !secActivityCenter) {
			utils.log('AI Auto', `⏭️  Section activityCenter disabled — skipping`);
			cycleLogger.logEvent(accountId, 'cycle', 'section_disabled', {
				reason: 'section_activityCenter_disabled',
			});
		}
		if (!messageSent && secActivityCenter) {
			utils.log('AI Auto', '🔔 Checking Activity Center...');

			// Проверяем есть ли непрочитанные уведомления (класс has-new)
			const hasUnread = await activityCenterScanner.getUnreadCount(page);

			if (hasUnread > 0) {
				utils.log(
					'AI Auto',
					'📬 Found unread notifications in Activity Center',
				);

				// Открываем Activity Center
				const opened = await activityCenterScanner.openActivityCenter(page);

				if (!opened) {
					utils.log('AI Auto', '❌ Could not open Activity Center');
				} else {
					// Получаем все непрочитанные уведомления (с классом .new)
					const notifications =
						await activityCenterScanner.getUnreadNotifications(page);

					if (notifications.length > 0) {
						utils.log(
							'AI Auto',
							`📋 Found ${notifications.length} unread notifications`,
						);

						// Обрабатываем ПЕРВОЕ уведомление (FIFO)
						const notification = notifications[0];

						// 🚫 ПРОВЕРКА ЧЕРНОГО СПИСКА (Activity Center)
						if (
							await isUserBlacklisted(
								accountId,
								notification.userUid,
								'activityCenter',
							)
						) {
						utils.log(
							'AI Auto',
							`🚫 Skipping Activity Center notification from ${notification.manName} (blacklisted)`,
						);
						await activityCenterScanner.closeActivityCenter(page);
						cycleLogger.logEvent(accountId, 'activity_center', 'skipped', {
							manName: notification.manName,
							reason: 'activity_center_blacklisted',
						});
							return {
								processed: false,
								reason: 'activity_center_blacklisted',
							};
						}

						utils.log(
							'AI Auto',
							`🖱️  Processing notification: ${notification.manName} (${notification.activityType})`,
						);

					// Получаем активный профиль ДО клика
					const activeProfile = await utils.getActiveProfile(page, accountId);

					if (!activeProfile) {
						utils.log('AI Auto', '❌ No active profile for Activity Center');
						await activityCenterScanner.closeActivityCenter(page);
						cycleLogger.logEvent(accountId, 'activity_center', 'skipped', {
							reason: 'no_active_profile',
						});
						return { processed: false, reason: 'no_active_profile' };
					}

					// 🚫 Активный профиль исключён — уведомление игнорируем
					if (isProfileExcluded(account.user, activeProfile.uid)) {
					utils.log(
						'AI Auto',
						`🚫 Skipping Activity Center notification from ${notification.manName} (profile ${activeProfile.username} excluded)`,
					);
					await activityCenterScanner.closeActivityCenter(page);
					cycleLogger.logEvent(accountId, 'activity_center', 'skipped', {
						manName: notification.manName,
						reason: 'activity_center_profile_excluded',
					});
						return {
							processed: false,
							reason: 'activity_center_profile_excluded',
						};
					}

						// ✅ Кликаем на уведомление → чат откроется автоматически
						const clickResult = await activityCenterScanner.clickNotification(
							page,
							notification,
							activeProfile.uid,
						);

					if (!clickResult || !clickResult.success) {
						utils.log(
							'AI Auto',
							`❌ Could not open chat with ${notification.manName}`,
						);
						await activityCenterScanner.closeActivityCenter(page);
						cycleLogger.logEvent(accountId, 'activity_center', 'skipped', {
							manName: notification.manName,
							reason: 'chat_not_opened',
						});
							return { processed: false, reason: 'chat_not_opened' };
						}

					utils.log('AI Auto', `✅ Chat opened: ${clickResult.chatId}`);

					// 🔍 Проверка владельца чата: чат должен принадлежать активной анкете.
					// Клик мог открыть чат ДРУГОЙ анкеты аккаунта (ownerUid ∉ allUids) —
					// отправка с активной анкеты тогда невозможна по построению
					// (selectChat не найдёт чужой чат → 3 ретрая → exception).
					// Поэтому либо переключаемся на владельца, либо честно скипаем
					// БЕЗ генерации (не тратим токены впустую).
					let targetProfile = activeProfile;
					// Владелец = часть chatId, НЕ равная userUid мужчины
					// (порядок частей не фиксирован: profile_man и man_profile).
					// userUid из уведомления авторитетен (data-user-uid).
					const chatParts = clickResult.chatId.split('_');
					const chatOwnerUid =
						chatParts.find(p => p !== String(notification.userUid)) ||
						chatParts[0];
					const ownerMatches = activeProfile.allUids
						? activeProfile.allUids.map(String).includes(String(chatOwnerUid))
						: String(activeProfile.uid) === String(chatOwnerUid);

					if (!ownerMatches) {
						utils.log(
							'AI Auto',
							`⚠️  Chat ${clickResult.chatId} belongs to another profile (active: ${activeProfile.username})`,
						);
						cycleLogger.logEvent(accountId, 'activity_center', 'owner_mismatch', {
							chatId: clickResult.chatId,
							manName: notification.manName,
							activeProfileName: activeProfile.username,
							chatOwnerUid,
						});

						// Пробуем резолвить владельца (как в Catch Up) и переключиться
						const ownerBudget = { count: 0 };
						const ownerProfile =
							(await utils.getProfileByUid(page, chatOwnerUid)) ||
							(await catchUpScanner.resolveOwnerProfile(
								page,
								accountId,
								chatOwnerUid,
								{ switchesUsed: ownerBudget, maxSwitches: 3 },
							));

						if (
							ownerProfile &&
							!isProfileExcluded(account.user, ownerProfile.uid)
						) {
							const switched = await utils.switchToProfile(
								page,
								accountId,
								ownerProfile.uid,
							);
							if (switched) {
								targetProfile = ownerProfile;
								utils.log(
									'AI Auto',
									`✅ Switched to chat owner ${ownerProfile.username} (${ownerProfile.uid})`,
								);
								cycleLogger.logEvent(accountId, 'activity_center', 'owner_switched', {
									chatId: clickResult.chatId,
									manName: notification.manName,
									profileName: ownerProfile.username,
								});
							}
						}

						if (targetProfile === activeProfile) {
							// Владелец не найден — генерация бессмысленна, скип
							utils.log(
								'AI Auto',
								`⏭️  Chat owner ${chatOwnerUid} not resolved, skipping (no wasted generation)`,
							);
							await activityCenterScanner.closeActivityCenter(page);
							cycleLogger.logEvent(accountId, 'activity_center', 'skipped', {
								chatId: clickResult.chatId,
								manName: notification.manName,
								reason: 'foreign_profile_unresolved',
							});
							return { processed: false, reason: 'foreign_profile_unresolved' };
						}
					}

					// ✅ Генерируем и отправляем сообщение через aiResponseService
					utils.log('AI Auto', '🤖 Generating and sending first message...');

						try {
							// Используем aiResponseService.generateAndSend напрямую
						const aiResponse = await aiResponseService.generateAndSend({
							userId,
							accountId,
							profileUid: targetProfile.uid,
							chatId: clickResult.chatId,
							profile: {
								uid: targetProfile.uid,
								username: targetProfile.username,
								age: targetProfile.age,
								country: targetProfile.country,
								city: targetProfile.city,
							},
							manMessage: '', // Для Activity Center нет сообщения от мужчины
							formattedHistory: '', // Нет истории
							profileName: targetProfile.username,
								manName: notification.manName,
								typeInstructions: '', // Пустые инструкции - используется кастомная логика
								messageType: 'activity_center', // Специальный тип
								// Передаем данные Activity Center
								activityCenterData: {
									activityType: notification.activityType,
									isFirstMessage: true,
								},
							});

							if (
								aiResponse &&
								aiResponse.success &&
								aiResponse.sendResult?.success
							) {
								utils.log(
									'AI Auto',
									`✅ Sent message to ${notification.manName} from Activity Center`,
								);

								const generatedText =
									aiResponse.generatedResponse?.response || 'N/A';
								utils.log(
									'AI Auto',
									`📝 Message: "${generatedText.substring(0, 60)}..."`,
								);

								messageSent = true;

								// Возвращаемся к чатам
								await page.goto('https://luxee.io/chats/', {
									waitUntil: 'domcontentloaded',
									timeout: 10000,
								});
								await utils.sleep(2000);

							const elapsed = Date.now() - startTime;
							utils.log(
								'AI Auto',
								`✅ Finished cycle - message sent from Activity Center (${Math.round(elapsed / 1000)}s)`,
							);
							cycleLogger.logEvent(accountId, 'cycle', 'finished', {
								processed: true,
								reason: 'activity_center',
								durationSec: Math.round(elapsed / 1000),
								chatId: clickResult.chatId,
								manName: notification.manName,
								sent: true,
							});
							return { processed: true, reason: 'activity_center' };
						} else {
							utils.log(
								'AI Auto',
								`❌ Failed to send message to ${notification.manName}`,
							);
							cycleLogger.logEvent(accountId, 'activity_center', 'failed', {
								manName: notification.manName,
								reason: 'send_failed',
								sent: false,
							});
						}
						} catch (aiError) {
							utils.logError(
								'AI Auto',
								`❌ AI error for ${notification.manName}:`,
								aiError,
							);
						}

						// Закрываем Activity Center
						await activityCenterScanner.closeActivityCenter(page);
					} else {
						utils.log('AI Auto', '📭 No unread notifications');
					}
				}
			} else {
				utils.log('AI Auto', '📭 No unread in Activity Center');
			}
		}

		// ===================================================================
		// 🏁 ФИНАЛ: Если ничего не отправили
		// ===================================================================
		if (!messageSent) {
			const duration = Math.round((Date.now() - startTime) / 1000);
			utils.log(
				'AI Auto',
				`✅ Finished cycle - no messages sent (${duration}s)`,
			);
			cycleLogger.logEvent(accountId, 'cycle', 'finished', {
				processed: false,
				reason: 'no_messages_to_send',
				durationSec: duration,
			});
			return { processed: false, reason: 'no_messages_to_send' };
		}
	} catch (error) {
		utils.logError('AI Auto', 'Error in processAccountMessages:', error);
		cycleLogger.logEvent(accountId, 'cycle', 'exception', {
			reason: 'exception',
			error: error.message,
			sent: false,
		});
		return { processed: false, reason: 'exception', error: error.message };
	} finally {
		// ========== РАЗБЛОКИРОВАТЬ АККАУНТ ==========
		processingLocks.delete(accountId);
		utils.log('AI Auto', `🔓 Account ${accountId} UNLOCKED`);
	}
};

/**
 * Получить статус блокировки аккаунта
 * @param {string} accountId - ID аккаунта
 * @returns {Object|null} - Информация о блокировке или null
 */
const getAccountLockStatus = accountId => {
	if (!processingLocks.has(accountId)) {
		return null;
	}

	const lock = processingLocks.get(accountId);
	return {
		isLocked: true,
		startedAt: lock.startedAt,
		elapsed: Date.now() - lock.startedAt,
	};
};

/**
 * Принудительно разблокировать аккаунт (для отладки)
 * @param {string} accountId - ID аккаунта
 * @returns {boolean} - Был ли аккаунт заблокирован
 */
const forceUnlock = accountId => {
	if (processingLocks.has(accountId)) {
		processingLocks.delete(accountId);
		utils.log('AI Auto', `🔓 Force unlocked account ${accountId}`);
		return true;
	}
	return false;
};

/**
 * Получить количество заблокированных аккаунтов
 * @returns {number}
 */
const getLockedAccountsCount = () => {
	return processingLocks.size;
};

/**
 * Последнее известное значение Catch Up счётчика (для диагностики)
 */
const getLastCatchUpCount = accountId => {
	return lastCatchUpCounts.has(accountId)
		? lastCatchUpCounts.get(accountId)
		: null;
};

export default {
	processAccountMessages,
	getAccountLockStatus,
	getLastCatchUpCount,
	forceUnlock,
	getLockedAccountsCount,
};
