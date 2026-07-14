// AI Auto Response - Main Orchestrator
// Главный оркестратор с глобальной блокировкой (Mutex)

import chatProcessor from './chatProcessor.js';
import profileScanner from './profileScanner.js';
import utils from './utils.js';

// Глобальная блокировка для аккаунтов (Mutex)
const processingLocks = new Map(); // accountId → { isProcessing: true, startedAt: timestamp }

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
				const switched = await utils.switchToProfile(page, accountId, targetUid);

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
			let messageSent = false;
			for (let i = 0; i < sortedChats.length; i++) {
				const chat = sortedChats[i];
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
					await utils.randomDelay(3000, 6000);
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

		if (otherProfiles.length === 0) {
			const elapsed = Date.now() - startTime;
			utils.log(
				'AI Auto',
				`✅ No more profiles to process (${Math.round(elapsed / 1000)}s)`,
			);
			return { processed: false, reason: 'no_other_profiles' };
		}

		// 4️⃣ Обработать другие профили
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
			let messageSent = false;
			for (let i = 0; i < sortedChats.length; i++) {
				const chat = sortedChats[i];
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
					await utils.randomDelay(3000, 6000);
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

		const elapsed = Date.now() - startTime;
		utils.log(
			'AI Auto',
			`✅ Finished cycle - no messages sent (${Math.round(elapsed / 1000)}s)`,
		);
		return { processed: false, reason: 'no_messages_sent' };
	} catch (error) {
		utils.logError('AI Auto', `❌ Critical error:`, error);
		return {
			processed: false,
			reason: 'exception',
			error: error.message,
		};
	} finally {
		// ========== ВСЕГДА РАЗБЛОКИРОВАТЬ ==========
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
