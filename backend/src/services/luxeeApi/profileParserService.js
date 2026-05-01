// Сервис для получения профилей и сообщений через JavaScript API Luxee
// Использует modelsChat.getProfile.data и modelsChat.getChats.list
import chatNavigationService from './chatNavigationService.js';

const profileParserService = {
	// Получить только активный профиль с количеством новых сообщений
	getActiveProfile: async ({ page }) => {
		try {
			console.log('[Profile Parser] Getting active profile via API');

			// Убедимся что мы на странице чатов
			if (!chatNavigationService.isOnChatsPage(page)) {
				console.log('[Profile Parser] Not on chats page, navigating...');
				await chatNavigationService.navigateToChats({ page });
			}

			// Получаем только активный профиль
			const profileData = await page.evaluate(() => {
				if (
					typeof modelsChat === 'undefined' ||
					!modelsChat.getProfile ||
					!modelsChat.getProfile.data
				) {
					throw new Error('modelsChat.getProfile.data API not available');
				}

				const data = modelsChat.getProfile.data;
				
				// Ищем активный профиль
				for (const uid in data) {
					const profile = data[uid];
					
					// Проверяем что это активный профиль
					if (profile.active === true || profile.isActive === true) {
						return {
							uid: profile.inner.uid,
							username: profile.inner.username,
							avatar:
								profile.inner.avatar?.thumbnail ||
								profile.inner.avatar?.src ||
								null,
							newMessages: profile.newMessages || 0,
							lastActivity: profile.lastActivity,
							projectsCount: Object.keys(profile.outer || {}).length,
						};
					}
				}

				// Если не нашли активный, берём первый
				const firstUid = Object.keys(data)[0];
				if (firstUid) {
					const profile = data[firstUid];
					return {
						uid: profile.inner.uid,
						username: profile.inner.username,
						avatar:
							profile.inner.avatar?.thumbnail ||
							profile.inner.avatar?.src ||
							null,
						newMessages: profile.newMessages || 0,
						lastActivity: profile.lastActivity,
						projectsCount: Object.keys(profile.outer || {}).length,
					};
				}

				return null;
			});

			if (!profileData) {
				console.log('[Profile Parser] No profiles found');
				return {
					profile: null,
					hasProfile: false,
				};
			}

			console.log(`[Profile Parser] Found active profile: ${profileData.username}`);

			return {
				profile: profileData,
				hasProfile: true,
			};
		} catch (error) {
			console.error('[Profile Parser] Error getting active profile:', error);
			throw error;
		}
	},

	// Получить список всех профилей с количеством новых сообщений
	getProfiles: async ({ page }) => {
		try {
			console.log('[Profile Parser] Getting profiles via API');

			// Убедимся что мы на странице чатов
			if (!chatNavigationService.isOnChatsPage(page)) {
				console.log('[Profile Parser] Not on chats page, navigating...');
				await chatNavigationService.navigateToChats({ page });
			}

			// Используем modelsChat.getProfile.data для получения всех профилей
			const profilesData = await page.evaluate(() => {
				if (
					typeof modelsChat === 'undefined' ||
					!modelsChat.getProfile ||
					!modelsChat.getProfile.data
				) {
					throw new Error('modelsChat.getProfile.data API not available');
				}

				const data = modelsChat.getProfile.data;
				const result = [];

				// Проходим по всем профилям
				for (const uid in data) {
					const profile = data[uid];

					result.push({
						uid: profile.inner.uid,
						username: profile.inner.username,
						avatar:
							profile.inner.avatar?.thumbnail ||
							profile.inner.avatar?.src ||
							null,
						newMessages: profile.newMessages || 0,
						lastActivity: profile.lastActivity,
						projectsCount: Object.keys(profile.outer || {}).length,
					});
				}

				return result;
			});

			console.log(
				`[Profile Parser] Found ${profilesData.length} profiles via API`,
			);

			// Подсчитываем общее количество новых сообщений
			const totalUnread = profilesData.reduce(
				(sum, profile) => sum + profile.newMessages,
				0,
			);

			console.log(`[Profile Parser] Total new messages: ${totalUnread}`);

			return {
				profiles: profilesData,
				totalUnread,
				profilesCount: profilesData.length,
			};
		} catch (error) {
			console.error('[Profile Parser] Error:', error);
			throw error;
		}
	},

	// Получить профили только с новыми сообщениями
	getProfilesWithUnread: async ({ page }) => {
		try {
			const { profiles } = await profileParserService.getProfiles({ page });

			const unreadProfiles = profiles.filter(
				profile => profile.newMessages > 0,
			);

			console.log(
				`[Profile Parser] Profiles with new messages: ${unreadProfiles.length}`,
			);

			const totalUnread = unreadProfiles.reduce(
				(sum, p) => sum + p.newMessages,
				0,
			);

			return {
				profiles: unreadProfiles,
				totalUnread,
				profilesCount: unreadProfiles.length,
			};
		} catch (error) {
			console.error('[Profile Parser] Error getting unread profiles:', error);
			throw error;
		}
	},

	// Получить количество неотвеченных чатов для профиля
	getProfileUnansweredCount: async ({ page, profileUid }) => {
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
	},


	// Получить чаты конкретного профиля с неотвеченными сообщениями
	getProfileChatsWithUnanswered: async ({ page, profileUid }) => {
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
								result.push({
									chatId: chatId,
									memberUid: chat.member?.uid,
									memberUsername: chat.member?.username,
									profileUid: chat.profile?.uid,
									profileUsername: chat.profile?.username,
									newMessages: chat.newMessages || 0,
									unAnswered: chat.unAnswered === true,
									lastMessage: chat.lastMessage || null,
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
	},

	// Получить все чаты со всех профилей с новыми/неотвеченными сообщениями
	getAllChatsWithUnanswered: async ({ page }) => {
		try {
			console.log('[Profile Parser] Getting all chats from all profiles');

			// Получаем все профили
			const { profiles } = await profileParserService.getProfiles({ page });

			// Получаем чаты для каждого профиля с новыми сообщениями
			const results = [];

			for (const profile of profiles) {
				if (profile.newMessages > 0) {
					try {
						const profileChats =
							await profileParserService.getProfileChatsWithUnanswered({
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
	},
};

export default profileParserService;
