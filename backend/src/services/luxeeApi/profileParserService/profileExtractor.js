// Модуль для извлечения данных профилей
import chatNavigationService from '../chatNavigationService.js';

/**
 * Получить только активный профиль с количеством новых сообщений
 */
export const getActiveProfile = async ({ page }) => {
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
};

/**
 * Получить список всех профилей с количеством новых сообщений
 */
export const getProfiles = async ({ page }) => {
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
};

/**
 * Получить профили только с новыми сообщениями
 */
export const getProfilesWithUnread = async ({ page }) => {
	try {
		const { profiles } = await getProfiles({ page });

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
};
