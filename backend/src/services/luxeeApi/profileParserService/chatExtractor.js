// Модуль для извлечения данных чатов
import chatNavigationService from '../chatNavigationService.js';
import { getProfiles } from './profileExtractor.js';

/**
 * Получить количество неотвеченных чатов для профиля
 */
export const getProfileUnansweredCount = async ({ page, profileUid }) => {
	try {
		console.log(`[Profile Parser] Counting unanswered for profile ${profileUid}`);

		// Убедимся что мы на странице чатов
		if (!chatNavigationService.isOnChatsPage(page)) {
			await chatNavigationService.navigateToChats({ page });
		}

		// Переключаемся на профиль и считаем unAnswered
		const unansweredCount = await page.evaluate(uid => {
			if (typeof modelsChat === 'undefined' || !modelsChat.selectProfile) {
				throw new Error('modelsChat.selectProfile not available');
			}

			modelsChat.selectProfile(uid);

			// Ждём немного чтобы чаты загрузились
			return new Promise(resolve => {
				setTimeout(() => {
					if (!modelsChat.getChats || !modelsChat.getChats.list) {
						resolve(0);
						return;
					}

					const chats = modelsChat.getChats.list;
					let count = 0;

					// Считаем чаты с unAnswered: true
					for (const chatId in chats) {
						const chat = chats[chatId];
						if (chat.unAnswered === true) {
							count++;
						}
					}

					resolve(count);
				}, 1000);
			});
		}, profileUid);

		console.log(`[Profile Parser] Profile ${profileUid} has ${unansweredCount} unanswered chats`);

		return unansweredCount;
	} catch (error) {
		console.error('[Profile Parser] Error counting unanswered:', error);
		return 0;
	}
};

/**
 * Получить чаты конкретного профиля с неотвеченными сообщениями
 */
export const getProfileChatsWithUnanswered = async ({ page, profileUid }) => {
	try {
		console.log(`[Profile Parser] Getting chats for profile ${profileUid}`);

		// Убедимся что мы на странице чатов
		if (!chatNavigationService.isOnChatsPage(page)) {
			await chatNavigationService.navigateToChats({ page });
		}

		// Переключаемся на профиль и получаем его чаты
		const chatsData = await page.evaluate(uid => {
			// Переключаемся на профиль
			if (typeof modelsChat === 'undefined' || !modelsChat.selectProfile) {
				throw new Error('modelsChat.selectProfile not available');
			}

			modelsChat.selectProfile(uid);

			// Ждём немного чтобы чаты загрузились
			return new Promise(resolve => {
				setTimeout(() => {
					if (!modelsChat.getChats || !modelsChat.getChats.list) {
						resolve([]);
						return;
					}

					const chats = modelsChat.getChats.list;
					const result = [];

					// Проходим по всем чатам
					for (const chatId in chats) {
						const chat = chats[chatId];

						// Проверяем новые ИЛИ неотвеченные
						if (chat.newMessages > 0 || chat.unAnswered === true) {
							// Получаем данные мужчины из members (type: 10)
							let memberData = null;
							let profileData = null;
							
							if (chat.members && Array.isArray(chat.members)) {
								memberData = chat.members.find(m => m.type === 10);
								profileData = chat.members.find(m => m.type === 2);
							}

							// Извлекаем memberUid из chatId как fallback (формат: profileUid_memberUid)
							let memberUid = memberData?.uid;
							if (!memberUid && chatId && typeof chatId === 'string' && chatId.includes('_')) {
								const parts = chatId.split('_');
								memberUid = parseInt(parts[1], 10);
							}

							result.push({
								chatId: chatId,
								memberUid: memberUid,
								memberUsername: memberData?.username || memberData?.first_name || 'Unknown',
								memberAvatar: memberData?.avatar?.thumbnail || memberData?.avatar?.src || null,
								profileUid: profileData?.uid || uid,
								profileUsername: profileData?.username || profileData?.first_name,
								profileAvatar: profileData?.avatar?.thumbnail || profileData?.avatar?.src || null,
								newMessages: chat.newMessages || 0,
								unAnswered: chat.unAnswered === true,
								lastMessage: chat.message?.[chat.message.length - 1]?.body || null,
								lastActivity: chat.lastActivity || null,
							});
						}
					}

					resolve(result);
				}, 1000);
			});
		}, profileUid);

		console.log(
			`[Profile Parser] Found ${chatsData.length} chats with new/unanswered messages`,
		);

		return {
			profileUid,
			chats: chatsData,
			totalChats: chatsData.length,
			totalUnread: chatsData.reduce((sum, c) => sum + c.newMessages, 0),
			totalUnanswered: chatsData.filter(c => c.unAnswered).length,
		};
	} catch (error) {
		console.error('[Profile Parser] Error getting profile chats:', error);
		throw error;
	}
};

/**
 * Получить все чаты со всех профилей с новыми/неотвеченными сообщениями
 */
export const getAllChatsWithUnanswered = async ({ page }) => {
	try {
		console.log('[Profile Parser] Getting all chats from all profiles');

		// Получаем все профили
		const { profiles } = await getProfiles({ page });

		// Получаем чаты для каждого профиля с новыми сообщениями
		const results = [];

		for (const profile of profiles) {
			if (profile.newMessages > 0) {
				try {
					const profileChats = await getProfileChatsWithUnanswered({
						page,
						profileUid: profile.uid,
					});

					if (profileChats.chats.length > 0) {
						results.push({
							profile: {
								uid: profile.uid,
								username: profile.username,
								avatar: profile.avatar,
							},
							...profileChats,
						});
					}
				} catch (error) {
					console.error(
						`[Profile Parser] Error getting chats for ${profile.username}:`,
						error.message,
					);
				}
			}
		}

		const totalChats = results.reduce((sum, r) => sum + r.totalChats, 0);
		const totalUnread = results.reduce((sum, r) => sum + r.totalUnread, 0);
		const totalUnanswered = results.reduce(
			(sum, r) => sum + r.totalUnanswered,
			0,
		);

		console.log(
			`[Profile Parser] Total: ${totalChats} chats, ${totalUnread} unread, ${totalUnanswered} unanswered`,
		);

		return {
			profiles: results,
			totalChats,
			totalUnread,
			totalUnanswered,
		};
	} catch (error) {
		console.error('[Profile Parser] Error getting all chats:', error);
		throw error;
	}
};
