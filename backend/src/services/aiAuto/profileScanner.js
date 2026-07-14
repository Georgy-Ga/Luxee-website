// AI Auto Response - Profile Scanner
// Поиск профилей с сообщениями и их чатов

import utils from './utils.js';

/**
 * Получить все профили с новыми сообщениями
 * @param {Object} page - Playwright page
 * @returns {Promise<Array>} - Массив профилей с newMessages > 0
 */
const getAllProfilesWithMessages = async page => {
	try {
		const profiles = await page.evaluate(() => {
			if (!window.modelsChat?.getProfile?.data) return [];

			const profilesData = window.modelsChat.getProfile.data;
			const result = [];

			for (const uid in profilesData) {
				const profile = profilesData[uid];
				const inner = profile.inner;
				const newMessages = profile.newMessages || 0;

				// Добавляем профиль если есть новые сообщения
				if (newMessages > 0) {
					// Собираем ВСЕ UIDs профиля (inner + outer)
					const allUids = [inner.uid];
					if (profile.outer) {
						for (const outerKey in profile.outer) {
							allUids.push(profile.outer[outerKey].uid);
						}
					}

					result.push({
						uid: inner.uid, // Inner UID для переключения профиля
						allUids: allUids, // Все UIDs (inner + outer) для поиска чатов
						username: inner.username,
						age: inner.age,
						country: inner.country,
						city: inner.city,
						newMessages: newMessages,
					});
				}
			}

			return result;
		});

		return profiles;
	} catch (error) {
		utils.logError('Profile Scanner', 'Error getting profiles:', error);
		return [];
	}
};

/**
 * Получить список UNANSWERED чатов профиля (container level API)
 * @param {Object} page - Playwright page
 * @param {Array} allUids - Все UIDs профиля (inner + outer)
 * @returns {Promise<Array>} - Массив { chatId, manName, lastActivity }
 */
const getAllChatsForProfile = async (page, allUids) => {
	try {
		const chats = await page.evaluate(uids => {
			if (!window.modelsChat?.getChats?.list) return [];

			const chatsList = window.modelsChat.getChats.list;
			const result = [];

			console.log('[🔍 SCAN] ========== SCANNING CHATS ==========');
			console.log('[🔍 SCAN] Profile UIDs:', uids);
			console.log('[🔍 SCAN] Total chats in system:', Object.keys(chatsList).length);

			let scannedCount = 0;
			let belongsToProfile = 0;
			let hasUnAnswered = 0;
			let skippedByUType = 0; // ✅ Новая статистика: пропущено по uType=1

			for (const chatId in chatsList) {
				scannedCount++;
				const chat = chatsList[chatId];

				// Проверка что чат принадлежит этому профилю
				// chatId формат: "outerUid_manUid"
				const [chatProfileUid, manUid] = chatId.split('_');
				
				// Проверяем что chatProfileUid есть в любом из UIDs профиля
				const belongs = uids.includes(parseInt(chatProfileUid));
				
				if (belongs) {
					belongsToProfile++;
					console.log(`[🔍 SCAN] Chat ${chatId}:`, {
						profileUid: chatProfileUid,
						manUid: manUid,
						unAnswered: chat.unAnswered,
						lastActivity: chat.lastActivity,
						membersCount: chat.members?.length,
					});
				}
				
				if (!belongs) continue;

				// ✅ ПРАВИЛЬНО: Проверка unAnswered на уровне container (БЕЗ навигации!)
				// modelsChat.getChats.list[chatId].unAnswered работает НА ВСЕЙ АНКЕТЕ
				if (chat.unAnswered !== true) {
					console.log(`[🔍 SCAN] ❌ Chat ${chatId} skipped: unAnswered=${chat.unAnswered}`);
					continue;
				}

				hasUnAnswered++;

				// ✅ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Последнее сообщение через chat.message[]
				// Проверяем uType последнего сообщения: 1 = profile sent, 2 = man sent
				if (chat.message && chat.message.length > 0) {
					const lastMessage = chat.message[chat.message.length - 1];
					
					// Если последнее сообщение от профиля (uType = 1) → ПРОПУСКАЕМ!
					if (lastMessage.uType === 1) {
						skippedByUType++; // ✅ Увеличиваем счётчик
						console.log(`[🔍 SCAN] ❌ Chat ${chatId} skipped: last message from PROFILE (uType=1)`);
						console.log(`[🔍 SCAN]   📝 Message preview: "${(lastMessage.body || '').substring(0, 50)}..."`);
						console.log(`[🔍 SCAN]   ⚠️  unAnswered=true BUT we already replied! Skipping.`);
						continue;
					}
					
					// Если последнее сообщение от мужчины (uType = 2) → БЕРЁМ!
					if (lastMessage.uType === 2) {
						console.log(`[🔍 SCAN] ✅ Chat ${chatId} OK: last message from MAN (uType=2)`);
						console.log(`[🔍 SCAN]   📝 Message preview: "${(lastMessage.body || '').substring(0, 50)}..."`);
					} else {
						// Неизвестный uType - логируем для отладки
						console.log(`[🔍 SCAN] ⚠️  Chat ${chatId}: Unknown uType=${lastMessage.uType}, taking chat (fallback)`);
					}
				} else {
					// Нет message[] → берём чат (fallback)
					console.log(`[🔍 SCAN] ⚠️  Chat ${chatId}: No message[] array - taking chat (fallback)`);
				}

				// Найти мужчину через members.gender = 1
				const manMember = chat.members?.find(m => m.gender === 1);

				console.log(`[🔍 SCAN] ✅ UNANSWERED Chat ${chatId}:`, {
					manMember: manMember ? {
						uid: manMember.uid,
						username: manMember.username,
						firstName: manMember.first_name,
						gender: manMember.gender,
					} : 'NOT_FOUND',
				});

				if (manMember) {
					result.push({
						chatId: chat.identity || chatId,
						manUid: manMember.uid,
						manName: manMember.username || manMember.first_name || 'Unknown',
						lastActivity: chat.lastActivity || 0,
					});
				}
			}

			// Сортировка по lastActivity (старые первые - FIFO)
			result.sort((a, b) => a.lastActivity - b.lastActivity);

			console.log('[🔍 SCAN] ========== SCAN COMPLETE ==========');
			console.log('[🔍 SCAN] Total scanned:', scannedCount);
			console.log('[🔍 SCAN] Belongs to profile:', belongsToProfile);
			console.log('[🔍 SCAN] Has unAnswered=true:', hasUnAnswered);
			console.log('[🔍 SCAN] Skipped by uType=1:', skippedByUType, '(already replied)');
			console.log('[🔍 SCAN] Final result:', result.length, 'chats to process');
			if (result.length > 0) {
				console.log('[🔍 SCAN] First 3 chats:', result.slice(0, 3).map(c => ({
					chatId: c.chatId,
					manName: c.manName,
					lastActivity: c.lastActivity,
				})));
			}

			return result;
		}, allUids);

		return chats;
	} catch (error) {
		utils.logError('Profile Scanner', 'Error getting chats:', error);
		return [];
	}
};

/**
 * Проверить unAnswered статус активного чата (ПОСЛЕ навигации)
 * Согласно API_LUXEE_DOCUMENTATION: работает только ПОСЛЕ навигации к чату
 * @param {Object} page - Playwright page
 * @param {string} expectedChatId - Ожидаемый chatId для проверки
 * @returns {Promise<Object>} - { isUnAnswered, actualChatId, error }
 */
const checkActiveChatUnAnswered = async (page, expectedChatId) => {
	try {
		const result = await page.evaluate(chatId => {
			const activeChatId = window.modelsChat?.getChats?.active?.identity;
			const unAnswered = window.modelsChat?.getChats?.active?.unAnswered;

			return {
				activeChatId,
				unAnswered,
			};
		}, expectedChatId);

		// Проверка что мы в правильном чате
		if (result.activeChatId !== expectedChatId) {
			return {
				isUnAnswered: false,
				actualChatId: result.activeChatId,
				error: `Wrong chat: expected ${expectedChatId}, got ${result.activeChatId}`,
			};
		}

		return {
			isUnAnswered: result.unAnswered === true,
			actualChatId: result.activeChatId,
			error: null,
		};
	} catch (error) {
		utils.logError('Profile Scanner', 'Error checking unAnswered:', error);
		return {
			isUnAnswered: false,
			actualChatId: null,
			error: error.message,
		};
	}
};

/**
 * Получить количество чатов с сообщениями на всех профилях
 * (для статистики)
 * @param {Object} page - Playwright page
 * @returns {Promise<Object>} - { total, byProfile: { uid: count } }
 */
const getChatStats = async page => {
	try {
		const stats = await page.evaluate(() => {
			if (!window.modelsChat?.getChats?.list) {
				return { total: 0, byProfile: {} };
			}

			const chatsList = window.modelsChat.getChats.list;
			const byProfile = {};
			let total = 0;

			for (const chatId in chatsList) {
				total++;

				const [profileUid] = chatId.split('_');
				const uid = parseInt(profileUid);

				if (!byProfile[uid]) {
					byProfile[uid] = 0;
				}
				byProfile[uid]++;
			}

			return { total, byProfile };
		});

		return stats;
	} catch (error) {
		utils.logError('Profile Scanner', 'Error getting stats:', error);
		return { total: 0, byProfile: {} };
	}
};

export default {
	getAllProfilesWithMessages,
	getAllChatsForProfile,
	checkActiveChatUnAnswered,
	getChatStats,
};
