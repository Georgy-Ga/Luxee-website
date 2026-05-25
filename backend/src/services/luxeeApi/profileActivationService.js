// Сервис для активации профиля на Luxee
// Активирует первый профиль чтобы modelsChat.getProfile.active был заполнен

/**
 * Активировать первый профиль на странице
 * @param {Page} page - Puppeteer/Playwright страница
 * @returns {Promise<{success: boolean, profileUid: number|null}>}
 */
export const activateFirstProfile = async ({ page }) => {
	try {
		console.log('[Profile Activation] Activating first profile...');

		const result = await page.evaluate(async () => {
			// Проверяем что API доступен
			if (
				typeof modelsChat === 'undefined' ||
				!modelsChat.getProfile ||
				!modelsChat.getProfile.data
			) {
				return { success: false, error: 'modelsChat API not available' };
			}

			// Получаем все профили
			const profilesData = modelsChat.getProfile.data;
			const profileUids = Object.keys(profilesData);

			if (profileUids.length === 0) {
				return { success: false, error: 'No profiles found' };
			}

			// Берём первый профиль
			const firstProfileUid = parseInt(profileUids[0]);
			const firstProfile = profilesData[profileUids[0]];

			console.log('[Browser] Activating profile:', firstProfileUid, firstProfile.inner.username);

			// Активируем профиль
			try {
				modelsChat.selectProfile(firstProfileUid);
				
				// ⏳ Ждём загрузки профиля (как в chatOpenService)
				await new Promise(resolve => setTimeout(resolve, 500));

				// Проверяем что профиль активирован
				const activeUid = modelsChat.getProfile.active?.inner?.uid;
				
				console.log('[Browser] After activation - active UID:', activeUid);

				return {
					success: true,
					profileUid: firstProfileUid,
					profileUsername: firstProfile.inner.username,
					activeUid: activeUid
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to activate profile: ${error.message}`
				};
			}
		});

		if (!result.success) {
			console.error('[Profile Activation] Failed:', result.error);
			return { success: false, profileUid: null, error: result.error };
		}

		console.log(`[Profile Activation] ✅ Activated profile ${result.profileUid} (${result.profileUsername}), active UID: ${result.activeUid}`);

		return {
			success: true,
			profileUid: result.profileUid,
			profileUsername: result.profileUsername
		};
	} catch (error) {
		console.error('[Profile Activation] Error:', error);
		return { success: false, profileUid: null, error: error.message };
	}
};

export default {
	activateFirstProfile
};
