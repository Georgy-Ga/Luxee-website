// Вспомогательные функции для работы со страницами Playwright

const pageHelpers = {
	// Получить или создать страницу в контексте
	getOrCreatePage: async context => {
		const pages = context.pages();
		return pages.length > 0 ? pages[0] : await context.newPage();
	},

	// Безопасный переход на страницу
	navigateTo: async ({ page, url, waitUntil = 'domcontentloaded', timeout = 30000 }) => {
		try {
			await page.goto(url, { waitUntil, timeout });
			return { success: true, url: page.url() };
		} catch (error) {
			console.error(`[Page Helper] Navigation error to ${url}:`, error.message);
			throw error;
		}
	},

	// Безопасный клик с ожиданием
	safeClick: async ({ page, selector, timeout = 5000 }) => {
		try {
			await page.waitForSelector(selector, { state: 'visible', timeout });
			await page.click(selector);
			return { success: true };
		} catch (error) {
			console.error(`[Page Helper] Click error on ${selector}:`, error.message);
			throw error;
		}
	},

	// Безопасное заполнение поля
	safeFill: async ({ page, selector, value, timeout = 5000 }) => {
		try {
			await page.waitForSelector(selector, { state: 'visible', timeout });
			await page.fill(selector, value);
			return { success: true };
		} catch (error) {
			console.error(`[Page Helper] Fill error on ${selector}:`, error.message);
			throw error;
		}
	},

	// Ожидание селектора
	waitForElement: async ({ page, selector, state = 'visible', timeout = 15000 }) => {
		try {
			await page.waitForSelector(selector, { state, timeout });
			return { success: true };
		} catch (error) {
			console.error(`[Page Helper] Wait error for ${selector}:`, error.message);
			throw error;
		}
	},

	// Извлечение данных со страницы
	extractData: async ({ page, extractor }) => {
		try {
			const data = await page.evaluate(extractor);
			return { success: true, data };
		} catch (error) {
			console.error('[Page Helper] Extract data error:', error.message);
			throw error;
		}
	},

	// Получить текущий URL
	getCurrentUrl: page => page.url(),

	// Получить заголовок страницы
	getPageTitle: async page => await page.title(),

	// Скриншот страницы (для отладки)
	takeScreenshot: async ({ page, path }) => {
		try {
			await page.screenshot({ path, fullPage: true });
			return { success: true, path };
		} catch (error) {
			console.error('[Page Helper] Screenshot error:', error.message);
			throw error;
		}
	},

	// Ожидание загрузки страницы
	waitForLoad: async ({ page, state = 'networkidle', timeout = 30000 }) => {
		try {
			await page.waitForLoadState(state, { timeout });
			return { success: true };
		} catch (error) {
			console.error('[Page Helper] Wait for load error:', error.message);
			throw error;
		}
	},

	// Проверка наличия элемента
	elementExists: async ({ page, selector }) => {
		try {
			const element = await page.$(selector);
			return !!element;
		} catch (error) {
			return false;
		}
	},

	// Получить содержимое страницы
	getPageContent: async ({ page, maxLength = 5000 }) => {
		try {
			const content = await page.content();
			return content.substring(0, maxLength);
		} catch (error) {
			console.error('[Page Helper] Get content error:', error.message);
			throw error;
		}
	},
};

export default pageHelpers;
