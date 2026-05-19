import { chromium } from 'playwright';
import browserConfig from '../../config/browserConfig.js';

// Один браузер для всех пользователей
let browserInstance = null;
// Map для хранения контекстов: accountId -> context
const contexts = new Map();

const browserService = {
	// Запуск браузера (один на всё приложение)
	launchBrowser: async ({ headless = browserConfig.headless, slowMo = browserConfig.slowMo } = {}) => {
		if (browserInstance) {
			return browserInstance;
		}

		try {
			browserInstance = await chromium.launch({
				headless,
				slowMo, // Замедление действий в мс (чтобы видеть что происходит)
				devtools: browserConfig.devtools, // Открывать DevTools
				args: [
					'--no-sandbox', 
					'--disable-setuid-sandbox',
					'--start-maximized', // Открывать на весь экран
				],
			});

			console.log(`[Browser Service] Browser launched (headless: ${headless}, slowMo: ${slowMo}ms, devtools: ${browserConfig.devtools})`);
			return browserInstance;
		} catch (error) {
			console.error('[Browser Service] Error launching browser:', error);
			throw error;
		}
	},

	// Получить браузер
	getBrowser: async () => {
		if (!browserInstance) {
			return await browserService.launchBrowser();
		}
		return browserInstance;
	},

	// Создать контекст для аккаунта
	createContext: async ({ accountId, sessionData = null }) => {
		try {
			const browser = await browserService.getBrowser();
			
			// Если контекст уже существует, вернуть его
			if (contexts.has(accountId)) {
				console.log(`[Browser Service] Context for account ${accountId} already exists`);
				return contexts.get(accountId);
			}

			let context;
			if (sessionData) {
				// Восстанавливаем сессию
				const storageState = typeof sessionData === 'string' 
					? JSON.parse(sessionData) 
					: sessionData;
				
				context = await browser.newContext({ 
					storageState,
					viewport: { width: 1920, height: 1080 },
				});
				console.log(`[Browser Service] Context restored for account ${accountId}`);
			} else {
				// Новая сессия
				context = await browser.newContext({
					viewport: { width: 1920, height: 1080 },
				});
				console.log(`[Browser Service] New context created for account ${accountId}`);
			}

			contexts.set(accountId, context);
			return context;
		} catch (error) {
			console.error('[Browser Service] Error creating context:', error);
			throw error;
		}
	},

	// Получить контекст аккаунта
	getContext: accountId => {
		return contexts.get(accountId);
	},

	// Получить все контексты
	getAllContexts: () => {
		return contexts;
	},

	// Обновить ключ контекста (при изменении accountId)
	updateContextKey: (oldAccountId, newAccountId) => {
		const context = contexts.get(oldAccountId);
		if (context) {
			contexts.delete(oldAccountId);
			contexts.set(newAccountId, context);
			console.log(`[Browser Service] Context key updated: ${oldAccountId} -> ${newAccountId}`);
		}
	},

	// Сохранить состояние сессии
	saveSessionState: async ({ accountId, context }) => {
		try {
			const sessionData = await context.storageState();
			console.log(`[Browser Service] Session saved for account ${accountId}`);
			return JSON.stringify(sessionData);
		} catch (error) {
			console.error('[Browser Service] Error saving session:', error);
			throw error;
		}
	},

	// Закрыть контекст аккаунта
	closeContext: async accountId => {
		try {
			const context = contexts.get(accountId);
			if (context) {
				await context.close();
				contexts.delete(accountId);
				console.log(`[Browser Service] Context closed for account ${accountId}`);
			}
		} catch (error) {
			console.error('[Browser Service] Error closing context:', error);
		}
	},

	// Закрыть все контексты
	closeAllContexts: async () => {
		try {
			const accountIds = Array.from(contexts.keys());
			for (const accountId of accountIds) {
				await browserService.closeContext(accountId);
			}
			console.log('[Browser Service] All contexts closed');
		} catch (error) {
			console.error('[Browser Service] Error closing all contexts:', error);
		}
	},

	// Закрыть браузер полностью
	closeBrowser: async () => {
		try {
			await browserService.closeAllContexts();
			
			if (browserInstance) {
				await browserInstance.close();
				browserInstance = null;
				console.log('[Browser Service] Browser closed');
			}
		} catch (error) {
			console.error('[Browser Service] Error closing browser:', error);
		}
	},

	// Получить статистику
	getStats: () => ({
		browserRunning: !!browserInstance,
		activeContexts: contexts.size,
		accountIds: Array.from(contexts.keys()),
	}),
};

export default browserService;
