// Сервис для навигации в раздел чатов Luxee
// Использует прямой переход вместо кликов по меню

const chatNavigationService = {
	// Перейти в раздел чатов (упрощённый метод)
	navigateToChats: async ({ page }) => {
		try {
			console.log('[Chat Navigation] Starting navigation to chats');

			// Проверяем, может уже на странице чатов
			const currentUrl = page.url();
			if (currentUrl.includes('/chats/')) {
				console.log('[Chat Navigation] Already on chats page');
				return { success: true, url: currentUrl };
			}

			// Просто переходим на /chats/ - Luxee сам откроет нужную страницу
			console.log('[Chat Navigation] Navigating directly to /chats/');
			await page.goto('https://luxee.io/chats/', { 
				waitUntil: 'domcontentloaded',
				timeout: 30000 
			});

			// Ждём загрузки JavaScript API (2 секунды)
			console.log('[Chat Navigation] Waiting for page to load');
			await page.waitForTimeout(2000);

			const finalUrl = page.url();
			console.log('[Chat Navigation] Navigation completed:', finalUrl);

			// Проверяем что API доступен
			const apiAvailable = await page.evaluate(() => {
				return typeof modelsChat !== 'undefined' && 
				       typeof modelsChat.getProfile !== 'undefined';
			}).catch(() => false);

			if (!apiAvailable) {
				console.warn('[Chat Navigation] modelsChat API not available yet');
			} else {
				console.log('[Chat Navigation] modelsChat API is available');
			}

			return {
				success: true,
				url: finalUrl,
				apiAvailable,
			};
		} catch (error) {
			console.error('[Chat Navigation] Error:', error);
			throw error;
		}
	},

	// Проверить, находимся ли на странице чатов
	isOnChatsPage: page => {
		const url = page.url();
		return url.includes('/chats/');
	},

	// Убедиться что страница на luxee.io и modelsChat загружен.
	// Лечит класс ошибок 'modelsChat API not available' (страница на
	// about:blank / упавший контекст / недогруженный SPA).
	// Возвращает true если API готов, иначе false (кидать нечего — вызывающий решает).
	ensureModelsChatReady: async ({ page, timeoutMs = 15000 }) => {
		try {
			const currentUrl = page.url();
			if (currentUrl === 'about:blank' || !currentUrl.includes('luxee.io')) {
				console.log(`[Chat Navigation] Page at ${currentUrl}, navigating to chats...`);
				await chatNavigationService.navigateToChats({ page });
			}

			const deadline = Date.now() + timeoutMs;
			while (Date.now() < deadline) {
				const ready = await page
					.evaluate(
						() =>
							typeof modelsChat !== 'undefined' &&
							!!modelsChat.getProfile?.data,
					)
					.catch(() => false);
				if (ready) return true;
				await page.waitForTimeout(1000);
			}

			console.warn('[Chat Navigation] modelsChat API not ready after wait');
			return false;
		} catch (error) {
			console.error('[Chat Navigation] ensureModelsChatReady error:', error.message);
			return false;
		}
	},
};

export default chatNavigationService;
