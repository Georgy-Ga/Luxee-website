import { chromium } from 'playwright';
import browserConfig from '../../config/browserConfig.js';

// Один браузер для всех пользователей
let browserInstance = null;
// Map для хранения контекстов: accountId -> context
const contexts = new Map();
// Флаг для отслеживания краша браузера
let browserCrashed = false;
// Флаг для предотвращения множественных восстановлений
let isRecovering = false;

const browserService = {
	// Запуск браузера (один на всё приложение)
	launchBrowser: async ({ headless = browserConfig.headless, slowMo = browserConfig.slowMo } = {}) => {
		if (browserInstance && !browserCrashed) {
			return browserInstance;
		}

		try {
			browserInstance = await chromium.launch({
				headless,
				slowMo, // Замедление действий в мс (чтобы видеть что происходит)
				devtools: browserConfig.devtools, // Открывать DevTools
				executablePath: '/usr/bin/chromium-browser', // Использовать системный Chromium
				args: [
					'--no-sandbox', 
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage', // Для Docker
					'--disable-gpu', // Для headless режима
					'--start-maximized', // Открывать на весь экран
				],
			});

			// Сбросить флаг краша
			browserCrashed = false;

			// Установить обработчик события disconnected
			browserInstance.on('disconnected', async () => {
				console.error('[Browser Service] ⚠️ Browser disconnected unexpectedly!');
				browserCrashed = true;
				browserInstance = null;
				
				// Очистить все контексты из Map (они больше не валидны)
				contexts.clear();
				
				// Запустить автоматическое восстановление
				await browserService.handleBrowserCrash();
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
		// Если браузер крашнулся, перезапустить
		if (browserCrashed || !browserInstance) {
			console.log('[Browser Service] Browser not available, launching...');
			return await browserService.launchBrowser();
		}
		
		// Проверить что браузер действительно работает
		try {
			await browserInstance.version();
			return browserInstance;
		} catch (error) {
			console.error('[Browser Service] Browser check failed:', error.message);
			browserCrashed = true;
			browserInstance = null;
			return await browserService.launchBrowser();
		}
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

	// Обработка краша браузера
	handleBrowserCrash: async () => {
		// Предотвратить множественные восстановления
		if (isRecovering) {
			console.log('[Browser Service] Recovery already in progress, skipping...');
			return;
		}

		isRecovering = true;

		try {
			console.log('[Browser Service] 🔄 Starting automatic recovery after browser crash...');
			
			// Подождать немного перед восстановлением
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			// Импортируем contextRecoveryService динамически чтобы избежать циклических зависимостей
			const { default: contextRecoveryService } = await import('./contextRecoveryService.js');
			
			// Восстановить все контексты
			const result = await contextRecoveryService.recoverAllContexts();
			
			console.log(`[Browser Service] ✅ Recovery complete: ${result.recovered} contexts recovered, ${result.failed} failed`);
			
			if (result.failed > 0) {
				console.warn(`[Browser Service] ⚠️ Some contexts failed to recover. Check logs for details.`);
			}
		} catch (error) {
			console.error('[Browser Service] ❌ Error during automatic recovery:', error);
		} finally {
			isRecovering = false;
		}
	},

	// Проверить статус браузера
	isBrowserHealthy: async () => {
		if (!browserInstance || browserCrashed) {
			return false;
		}

		try {
			await browserInstance.version();
			return true;
		} catch (error) {
			return false;
		}
	},

	// Получить статистику
	getStats: () => ({
		browserRunning: !!browserInstance && !browserCrashed,
		browserCrashed,
		isRecovering,
		activeContexts: contexts.size,
		accountIds: Array.from(contexts.keys()),
	}),
};

export default browserService;
