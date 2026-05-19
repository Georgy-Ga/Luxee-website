// Модуль для извлечения данных профилей из браузера
// Содержит browser-side код для page.evaluate()

/**
 * Извлечь данные профилей для всех аккаунтов (browser-side функция)
 * Используется в page.evaluate()
 */
export const extractAllProfilesData = () => {
	if (
		typeof modelsChat === 'undefined' ||
		!modelsChat.getProfile ||
		!modelsChat.getProfile.data
	) {
		throw new Error('modelsChat API not available');
	}

	const profilesData = modelsChat.getProfile.data;
	const chatsListData = modelsChat.getChats?.list || {};

	let activeProfileUid = null;
	try {
		activeProfileUid = modelsChat.getProfile.active?.uid;
	} catch (e) {
		// Активный профиль не определен
	}

	const result = [];

	for (const uid in profilesData) {
		const profile = profilesData[uid];
		const profileUid = profile.inner.uid;
		const isActive = activeProfileUid && String(activeProfileUid) === String(profileUid);

		// Получаем все outer UIDs для этого профиля
		const allProfileUids = [profile.inner.uid];
		if (profile.outer) {
			for (const outerUid in profile.outer) {
				allProfileUids.push(profile.outer[outerUid].uid);
			}
		}

		// Базовая информация о профиле
		const profileInfo = {
			uid: profileUid,
			username: profile.inner.username,
			avatar:
				profile.inner.avatar?.thumbnail ||
				profile.inner.avatar?.src ||
				null,
			newMessages: 0,
			unansweredMessages: 0,
			isActive: isActive,
			chats: [],
		};

		if (isActive) {
			// ⭐ ДЛЯ АКТИВНОГО ПРОФИЛЯ: используем modelsChat.getChats.list → unanswered
			const profileChats = [];
			let unansweredCount = 0;
			
			for (const chatId in chatsListData) {
				const chat = chatsListData[chatId];
				
				// Парсим chatId чтобы получить profileUid
				const chatProfileUid = parseInt(chatId.split('_')[0]);
				
				// Проверяем что этот чат принадлежит одному из UID профиля
				if (allProfileUids.includes(chatProfileUid)) {
					// Считаем unanswered
					if (chat.unAnswered === true) {
						unansweredCount++;
						
						// Находим данные мужчины
						const memberData = chat.members?.find(m => m.type === 10);
						const memberUid = memberData?.uid || parseInt(chatId.split('_')[1]);
						
						profileChats.push({
							chatId: chatId,
							memberUid: memberUid,
							memberUsername: memberData?.username || memberData?.first_name || null,
							memberAvatar: memberData?.avatar?.thumbnail || memberData?.avatar?.src || null,
							newMessages: 0,
							unAnswered: true,
							lastActivity: chat.lastActivity || null,
						});
					}
				}
			}

			profileInfo.unansweredMessages = unansweredCount;
			profileInfo.chats = profileChats;
		} else {
			// ⭐ ДЛЯ НЕАКТИВНЫХ ПРОФИЛЕЙ: используем newMessages
			profileInfo.newMessages = profile.newMessages || 0;
			// chats остается пустым - загрузим при клике
		}

		result.push(profileInfo);
	}

	return result;
};

/**
 * Извлечь данные профилей для одного аккаунта (browser-side функция)
 * Используется в page.evaluate()
 */
export const extractAccountProfilesData = () => {
	if (
		typeof modelsChat === 'undefined' ||
		!modelsChat.getProfile ||
		!modelsChat.getProfile.data
	) {
		throw new Error('modelsChat API not available');
	}

	const profilesData = modelsChat.getProfile.data;
	const chatsData = modelsChat.getChats?.list || {};

	let activeProfileUid = null;
	try {
		activeProfileUid = modelsChat.getProfile.active?.uid;
	} catch (e) {
		// Активный профиль не определен
	}

	const result = [];

	for (const uid in profilesData) {
		const profile = profilesData[uid];
		const isActive = activeProfileUid && String(activeProfileUid) === String(uid);

		// Получаем все outer UIDs для этого профиля
		const allProfileUids = [profile.inner.uid];
		if (profile.outer) {
			for (const outerUid in profile.outer) {
				allProfileUids.push(profile.outer[outerUid].uid);
			}
		}

		const profileInfo = {
			uid: profile.inner.uid,
			username: profile.inner.username,
			avatar:
				profile.inner.avatar?.thumbnail ||
				profile.inner.avatar?.src ||
				null,
			newMessages: profile.newMessages || 0,
			unansweredMessages: 0,
			isActive: isActive,
			chats: [], // ⭐ Добавляем чаты
		};

		// Собираем чаты для этого профиля
		// chatId формат: "profileUid_memberUid"
		if (chatsData) {
			let unansweredCount = 0;
			const profileChats = [];
			
			for (const chatId in chatsData) {
				const chat = chatsData[chatId];
				
				// Парсим chatId чтобы получить profileUid
				const chatProfileUid = parseInt(chatId.split('_')[0]);
				
				// Проверяем что этот чат принадлежит одному из UID профиля
				if (allProfileUids.includes(chatProfileUid)) {
					// Считаем unanswered
					if (chat.unAnswered === true) {
						unansweredCount++;
					}
					
					// Добавляем чат если есть новые сообщения или неотвечен
					if (chat.newMessages > 0 || chat.unAnswered === true) {
						// Находим данные мужчины
						const memberData = chat.members?.find(m => m.type === 10);
						const memberUid = memberData?.uid || parseInt(chatId.split('_')[1]);
						
						profileChats.push({
							chatId: chatId,
							memberUid: memberUid,
							memberUsername: memberData?.username || memberData?.first_name || null,
							memberAvatar: memberData?.avatar?.thumbnail || memberData?.avatar?.src || null,
							newMessages: chat.newMessages || 0,
							unAnswered: chat.unAnswered || false,
							lastActivity: chat.lastActivity || null,
						});
					}
				}
			}
			
			profileInfo.unansweredMessages = unansweredCount;
			profileInfo.chats = profileChats;
		}

		result.push(profileInfo);
	}

	return result;
};
