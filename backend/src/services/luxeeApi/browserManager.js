import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const browserManager = {
	browsers: new Map(), // userId -> browser instance
	contexts: new Map(), // userId -> browser context

	getSessionPath: userId => {
		return path.join(process.cwd(), 'sessions', `luxee_${userId}.json`);
	},

	launchBrowser: async userId => {
		try {
			if (browserManager.browsers.has(userId)) {
				return browserManager.browsers.get(userId);
			}

			const browser = await chromium.launch({
				headless: false, // Важно: браузер должен быть видимым чтобы страница оставалась активной
				args: ['--no-sandbox', '--disable-setuid-sandbox'],
			});

			browserManager.browsers.set(userId, browser);
			return browser;
		} catch (error) {
			console.error('Error launching browser:', error);
			throw error;
		}
	},

	createContext: async (userId, sessionData = null) => {
		try {
			const browser = await browserManager.launchBrowser(userId);
			
			let context;
			if (sessionData) {
				// Восстанавливаем сессию
				context = await browser.newContext({
					storageState: JSON.parse(sessionData),
				});
			} else {
				// Новая сессия
				context = await browser.newContext();
			}

			browserManager.contexts.set(userId, context);
			return context;
		} catch (error) {
			console.error('Error creating context:', error);
			throw error;
		}
	},

	getContext: userId => {
		return browserManager.contexts.get(userId);
	},

	saveSession: async (userId, context) => {
		try {
			const sessionData = await context.storageState();
			const sessionPath = browserManager.getSessionPath(userId);
			
			// Создаём папку sessions если её нет
			await fs.mkdir(path.dirname(sessionPath), { recursive: true });
			await fs.writeFile(sessionPath, JSON.stringify(sessionData));
			
			return JSON.stringify(sessionData);
		} catch (error) {
			console.error('Error saving session:', error);
			throw error;
		}
	},

	closeContext: async userId => {
		try {
			const context = browserManager.contexts.get(userId);
			if (context) {
				await context.close();
				browserManager.contexts.delete(userId);
			}
		} catch (error) {
			console.error('Error closing context:', error);
		}
	},

	closeBrowser: async userId => {
		try {
			await browserManager.closeContext(userId);
			
			const browser = browserManager.browsers.get(userId);
			if (browser) {
				await browser.close();
				browserManager.browsers.delete(userId);
			}
		} catch (error) {
			console.error('Error closing browser:', error);
		}
	},

	closeAll: async () => {
		try {
			for (const userId of browserManager.browsers.keys()) {
				await browserManager.closeBrowser(userId);
			}
		} catch (error) {
			console.error('Error closing all browsers:', error);
		}
	},
};

export default browserManager;
