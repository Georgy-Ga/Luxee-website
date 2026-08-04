// AI Auto Response - Main Orchestrator
// Главный оркестратор с глобальной блокировкой (Mutex)

import LuxeeAccount from '../../models/LuxeeAccountModel.js';
import aiResponseService from '../aiResponseService.js';
import aiScheduleService from '../aiScheduleService.js';
import activityCenterScanner from './activityCenterScanner.js';
import { isUserBlacklisted, shouldSkipDueToLoop } from './blacklistService.js';
import catchUpScanner from './catchUpScanner.js';
import chatProcessor from './chatProcessor.js';
import profileScanner from './profileScanner.js';
import utils from './utils.js';

// Глобальная блокировка для аккаунтов (Mutex)
const processingLocks = new Map(); // accountId → { isProcessing: true, startedAt: timestamp }

// Кеш последних значений Catch Up счётчика (для оптимизации)
const lastCatchUpCounts = new Map(); // accountId → lastCount

/**
 * Обработать сообщения аккаунта
 * @param {string} accountId - ID аккаунта
 * @param {string} userId - ID пользователя
 * @param {Object} page - Playwright page
 * @returns {Promise<Object>} - { processed: boolean, reason: string }
 */
const processAccountMessages = async (accountId, userId, page) => {
	const startTime = Date.now();

	// ========== ПРОВЕРКА БЛОКИРОВКИ ==========
	if (processingLocks.has(accountId)) {
		const lock = processingLocks.get(accountId);
		const elapsed = Date.now() - lock.startedAt;
		utils.log(
			'AI Auto',
			`⏸️  Account ${accountId} is LOCKED (${Math.round(elapsed / 1000)}s) - skipping cycle`,
		);
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

		// 1️⃣ Получить активный профиль
		const activeProfile = await utils.getActiveProfile(page);

		if (!activeProfile) {
			utils.log('AI Auto', `❌ No active profile found`);
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

		// 2️⃣ Получить чаты АКТИВНОГО профиля (ПРИОРИТЕТ!)
		utils.log(
			'AI Auto',
			`🔍 Checking chats on ACTIVE profile ${activeProfile.username}...`,
		);

		// Глобальный флаг для отслеживания успешной отправки
		let messageSent = false;

		let activeChats = await profileScanner.getAllChatsForProfile(
			page,
			activeProfile.allUids || [activeProfile.uid],
		);

		console.log('[🤖 AI AUTO] Active chats found:', activeChats.length);

		// ========== ДЕТЕКЦИЯ И ИСПРАВЛЕНИЕ API РАССИНХРОНА ==========
		if (activeProfile.newMessages > 0 && activeChats.length === 0) {
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
					const reloadedProfile = await utils.getActiveProfile(page);
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
		if (activeChats.length > 0) {
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
				const userUid = chat.chatId.split('_')[1];
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
		} else {
			utils.log(
				'AI Auto',
				`No chats on active profile ${activeProfile.username}`,
			);
		}

		// 3️⃣ Получить ДРУГИЕ профили с сообщениями
		utils.log('AI Auto', `🔍 Scanning other profiles...`);
		const allProfiles = await profileScanner.getAllProfilesWithMessages(page);
		const otherProfiles = allProfiles.filter(p => p.uid !== activeProfile.uid);

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
					const userUid = chat.chatId.split('_')[1];
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
		if (!messageSent) {
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
			let shouldCheckCatchUp = false;
			let skipReason = '';

			if (catchUpCount === 0) {
				shouldCheckCatchUp = false;
				skipReason = 'count is 0 (empty)';
			} else if (catchUpCount === lastCount) {
				shouldCheckCatchUp = false;
				skipReason = `count unchanged (${catchUpCount}) - same cached chats`;
			} else {
				shouldCheckCatchUp = true;
				skipReason = '';
			}

			// Сохраняем текущий count для следующего цикла
			lastCatchUpCounts.set(accountId, catchUpCount);

			if (!shouldCheckCatchUp) {
				utils.log('AI Auto', `⏭️  Skipping Catch Up: ${skipReason}`);
				console.log('[🚦 NAVIGATION] ⏭️  SKIPPING CATCH UP:', skipReason);
				console.log('[🚦 NAVIGATION] ✅ Staying at /chats/ (optimization)');
			} else {
				utils.log(
					'AI Auto',
					`📬 Catch Up count changed (${lastCount} → ${catchUpCount}), opening...`,
				);
				console.log(
					'[🚦 NAVIGATION] 📬 Catch Up count CHANGED, will check inside',
				);

				console.log(
					'[🚦 NAVIGATION] ========== ENTERING CATCH UP MODE ==========',
				);
				console.log('[🚦 NAVIGATION] Current URL:', page.url());
				console.log('[🚦 NAVIGATION] Time:', new Date().toISOString());

				const catchUpChats = await catchUpScanner.getAllCatchUpChats(page);

				console.log('[🚦 NAVIGATION] After opening Catch Up:');
				console.log('[🚦 NAVIGATION] Current URL:', page.url());
				console.log('[🚦 NAVIGATION] Found chats:', catchUpChats.length);

				if (catchUpChats.length > 0) {
					utils.log(
						'AI Auto',
						`📬 Found ${catchUpChats.length} chats in Catch Up`,
					);

					// Фильтруем уже обработанные (по кешу с учётом profileUid + manUid)
					const unprocessedChats = [];

					console.log(
						'[📊 CATCH UP FILTER] ========== FILTERING CHATS ==========',
					);
					console.log(
						'[📊 CATCH UP FILTER] Total chats found:',
						catchUpChats.length,
					);

					for (const chat of catchUpChats) {
						// Получаем профиль чтобы узнать inner UID
						const profile = await utils.getProfileByUid(
							page,
							chat.profileUidOuter,
						);

						if (!profile) {
							console.log('[❌ CATCH UP FILTER] Profile not found:');
							console.log('   Chat ID:', chat.chatId);
							console.log('   Man:', chat.manName);
							console.log('   Profile UID (outer):', chat.profileUidOuter);
							utils.log(
								'AI Auto',
								`⚠️  Profile ${chat.profileUidOuter} not found, skipping`,
							);
							continue;
						}

						// Проверяем кеш: accountId_profileUid_manUid
						const isInCache = catchUpScanner.isChatProcessed(
							accountId,
							profile.uid,
							chat.manUid,
						);

						if (isInCache) {
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
						} else {
							console.log('[✅ CATCH UP FILTER] Chat READY for processing:');
							console.log('   Chat ID:', chat.chatId);
							console.log('   Man:', chat.manName, `(${chat.manUid})`);
							console.log('   Profile:', profile.username, `(${profile.uid})`);
							// Добавляем в список для обработки
							unprocessedChats.push({
								chat: chat,
								profile: profile,
							});
						}
					}

					console.log(
						'[📊 CATCH UP FILTER] ========== FILTER RESULTS ==========',
					);
					console.log('[📊 CATCH UP FILTER] Total found:', catchUpChats.length);
					console.log(
						'[📊 CATCH UP FILTER] In cache (skipped):',
						catchUpChats.length - unprocessedChats.length,
					);
					console.log(
						'[📊 CATCH UP FILTER] Ready to process:',
						unprocessedChats.length,
					);

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

								return {
									processed: true,
									reason: 'catch_up_sent',
									profile: profile.username,
									manName: chat.manName,
								};
							} else {
								// ❌ НЕУДАЧА → проверяем нужно ли кешировать
								console.log(
									'[🚦 NAVIGATION] ⚠️ Chat NOT sent, reason:',
									result.reason,
								);

								// Список причин для кеширования (чтобы не долбить бесконечно)
								const shouldCacheFailure = [
									'history_extraction_failed', // История не извлекается после 3 попыток
									'generation_failed', // AI не может сгенерировать ответ
									'send_failed', // Отправка не работает (заблокирован?)
									'exception', // Критическая ошибка
								].includes(result.reason);

								if (shouldCacheFailure) {
									console.log(
										'[🚦 NAVIGATION] 💾 Caching FAILED chat to avoid infinite retries',
									);
									console.log('[🚦 NAVIGATION] Cache reason:', result.reason);

									// Кешируем как обработанный (чтобы больше не пытаться)
									catchUpScanner.markChatAsProcessed(
										accountId,
										profile.uid,
										chat.manUid,
									);

									utils.log(
										'AI Auto',
										`💾 Cached failed chat: ${chat.manName} (reason: ${result.reason})`,
									);
								} else {
									console.log(
										'[🚦 NAVIGATION] ⏭️  NOT caching (temporary issue):',
										result.reason,
									);
								}

								console.log(
									'[🚦 NAVIGATION] Continuing to next Catch Up chat...',
								);
							}
						}
						
						// 🔄 ПОСЛЕ обработки всех unprocessedChats - если НЕ отправили, reload
						if (!messageSent) {
							console.log('[🚦 NAVIGATION] ⚠️  No messages sent from Catch Up, exiting...');
							console.log('[🚦 NAVIGATION] 🔄 Reloading page to exit Catch Up...');
							await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
							await utils.sleep(2000);
							console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
						}
					} else {
						utils.log(
							'AI Auto',
							'✅ All Catch Up chats already processed (in cache)',
						);

						// 🔄 ОБНОВЛЯЕМ СТРАНИЦУ для выхода из Catch Up (все в кеше)
						console.log('[🚦 NAVIGATION] 🔄 Reloading page to exit Catch Up (all cached)...');
						await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
						await utils.sleep(2000);
						console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
					}
				} else {
					utils.log('AI Auto', '📭 No chats in Catch Up (after opening)');
				}
			}
		}

		// ===================================================================
		// 🔔 4. ОБРАБОТКА ACTIVITY CENTER (новые уведомления)
		// ===================================================================
		if (!messageSent) {
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
						const activeProfile = await utils.getActiveProfile(page);

						if (!activeProfile) {
							utils.log('AI Auto', '❌ No active profile for Activity Center');
							await activityCenterScanner.closeActivityCenter(page);
							return { processed: false, reason: 'no_active_profile' };
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
							return { processed: false, reason: 'chat_not_opened' };
						}

						utils.log('AI Auto', `✅ Chat opened: ${clickResult.chatId}`);

						// ✅ Генерируем и отправляем сообщение через aiResponseService
						utils.log('AI Auto', '🤖 Generating and sending first message...');

						try {
							// Используем aiResponseService.generateAndSend напрямую
							const aiResponse = await aiResponseService.generateAndSend({
								userId,
								accountId,
								profileUid: activeProfile.uid,
								chatId: clickResult.chatId,
								profile: {
									username: activeProfile.username,
									age: activeProfile.age,
									country: activeProfile.country,
									city: activeProfile.city,
								},
								manMessage: '', // Для Activity Center нет сообщения от мужчины
								formattedHistory: '', // Нет истории
								profileName: activeProfile.username,
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
								return { processed: true, reason: 'activity_center' };
							} else {
								utils.log(
									'AI Auto',
									`❌ Failed to send message to ${notification.manName}`,
								);
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
			return { processed: false, reason: 'no_messages_to_send' };
		}
	} catch (error) {
		utils.logError('AI Auto', 'Error in processAccountMessages:', error);
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

export default {
	processAccountMessages,
	getAccountLockStatus,
	forceUnlock,
	getLockedAccountsCount,
};
