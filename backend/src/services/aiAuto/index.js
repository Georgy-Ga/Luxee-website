// AI Auto Response - Main Orchestrator
// Главный оркестратор с глобальной блокировкой (Mutex)

import profileScanner from './profileScanner.js';
import chatProcessor from './chatProcessor.js';
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

		// 2️⃣ Получить чаты АКТИВНОГО профиля (ПРИОРИТЕТ!)
		utils.log(
			'AI Auto',
			`🔍 Checking chats on ACTIVE profile ${activeProfile.username}...`,
		);

		const activeChats = await profileScanner.getAllChatsForProfile(
			page,
			activeProfile.allUids || [activeProfile.uid],
		);

		if (activeChats.length > 0) {
			utils.log(
				'AI Auto',
				`🎯 Found ${activeChats.length} chats on ACTIVE profile`,
			);

			// Обрабатываем ПЕРВЫЙ чат активного профиля
			const firstChat = activeChats[0];
			utils.log('AI Auto', `Processing first chat: ${firstChat.manName}`);

			const result = await chatProcessor.processSingleChat({
				accountId,
				userId,
				page,
				profile: activeProfile,
				chat: firstChat,
			});

			if (result.sent) {
				const elapsed = Date.now() - startTime;
				utils.log(
					'AI Auto',
					`✅ Message sent on active profile (${Math.round(elapsed / 1000)}s)`,
				);
				await utils.randomDelay(3000, 6000);
				return { processed: true, reason: 'active_profile_processed' };
			} else {
				utils.log(
					'AI Auto',
					`⚠️  Failed to send on active profile: ${result.reason}`,
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
		const otherProfiles = allProfiles.filter(
			p => p.uid !== activeProfile.uid,
		);

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
			const switched = await utils.switchToProfile(page, accountId, profile.uid);
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
			utils.log('AI Auto', `Processing first chat: ${chats[0].manName}`);

			// Обработать ПЕРВЫЙ чат
			const result = await chatProcessor.processSingleChat({
				accountId,
				userId,
				page,
				profile,
				chat: chats[0],
			});

			if (result.sent) {
				const elapsed = Date.now() - startTime;
				utils.log(
					'AI Auto',
					`✅ Message sent on profile ${profile.username} (${Math.round(elapsed / 1000)}s)`,
				);
				await utils.randomDelay(3000, 6000);
				return { processed: true, reason: 'other_profile_processed' };
			} else {
				utils.log(
					'AI Auto',
					`⚠️  Failed to send on ${profile.username}: ${result.reason}`,
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
