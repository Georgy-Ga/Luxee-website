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

			for (const chatId in chatsList) {
				const chat = chatsList[chatId];

				// Проверка что чат принадлежит этому профилю
				// chatId формат: "outerUid_manUid"
				const [chatProfileUid, manUid] = chatId.split('_');
				
				// Проверяем что chatProfileUid есть в любом из UIDs профиля
				if (!uids.includes(parseInt(chatProfileUid))) continue;

				// ✅ ПРАВИЛЬНО: Проверка unAnswered на уровне container (БЕЗ навигации!)
				// modelsChat.getChats.list[chatId].unAnswered работает НА ВСЕЙ АНКЕТЕ
				if (chat.unAnswered !== true) continue;

				// Найти мужчину через members.gender = 1
				const manMember = chat.members?.find(m => m.gender === 1);

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
