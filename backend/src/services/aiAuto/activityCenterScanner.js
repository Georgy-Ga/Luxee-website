/**
 * Activity Center Scanner
 * Сканирует уведомления в колокольчике (Activity Center)
 * Обрабатывает: favorite (подписка), like (лайк), wink (подмигивание)
 */

import utils from './utils.js';

/**
 * Открыть Activity Center (колокольчик)
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} - Успешно ли открыт
 */
async function openActivityCenter(page) {
	try {
		utils.log('Activity Center', '🔔 Opening Activity Center...');

		// Ждём кнопку колокольчика
		const bellButton = await page.locator('#activity-center-btn').first();
		if (!(await bellButton.isVisible())) {
			utils.log('Activity Center', '❌ Bell button not found');
			return false;
		}

		// Кликаем на колокольчик
		await bellButton.click();
		await utils.randomDelay(1000, 1500);

		// Проверяем что открылся список
		const activityList = await page
			.locator('.activity-center-list')
			.first()
			.isVisible();
		if (!activityList) {
			utils.log('Activity Center', '❌ Activity list did not open');
			return false;
		}

		utils.log('Activity Center', '✅ Activity Center opened');
		return true;
	} catch (error) {
		utils.log('Activity Center', `❌ Error opening: ${error.message}`);
		return false;
	}
}

/**
 * Закрыть Activity Center
 * @param {Page} page - Playwright page
 */
async function closeActivityCenter(page) {
	try {
		const closeButton = await page.locator('.activity-center-close').first();
		if (await closeButton.isVisible()) {
			await closeButton.click();
			await utils.randomDelay(500, 1000);
			utils.log('Activity Center', '✅ Activity Center closed');
		}
	} catch (error) {
		utils.log('Activity Center', `⚠️  Error closing: ${error.message}`);
	}
}

/**
 * Получить количество непрочитанных уведомлений
 * @param {Page} page - Playwright page
 * @returns {Promise<number>} - Количество непрочитанных
 */
async function getUnreadCount(page) {
	try {
		const bellButton = await page.locator('#activity-center-btn').first();
		if (!(await bellButton.isVisible())) {
			return 0;
		}

		// Проверяем класс has-new (есть новые уведомления)
		const hasNew = await bellButton.evaluate(el =>
			el.classList.contains('has-new'),
		);

		return hasNew ? 1 : 0; // Возвращаем 1 если есть новые, 0 если нет
	} catch (error) {
		utils.log('Activity Center', `❌ Error checking count: ${error.message}`);
		return 0;
	}
}

/**
 * Получить все непрочитанные уведомления
 * @param {Page} page - Playwright page
 * @returns {Promise<Array>} - Массив непрочитанных уведомлений
 */
async function getUnreadNotifications(page) {
	try {
		// Ищем все элементы с классом 'new' (непрочитанные)
		const notifications = await page.locator('.activity-center-link.new').all();

		utils.log(
			'Activity Center',
			`📋 Found ${notifications.length} unread notifications`,
		);

		const result = [];

		for (let i = 0; i < notifications.length; i++) {
			const notif = notifications[i];

			try {
				// Получаем атрибуты
				const uid = await notif.getAttribute('data-uid');
				const userUid = await notif.getAttribute('data-user-uid');
				const profileUid = await notif.getAttribute('data-profile-uid');

				// Определяем тип активности
				const classes = await notif.getAttribute('class');
				let activityType = 'unknown';
				if (classes.includes('favorite')) activityType = 'favorite';
				else if (classes.includes('like')) activityType = 'like';
				else if (classes.includes('wink')) activityType = 'wink';

				// Получаем текст (имя мужчины и действие)
				const titleText = await notif
					.locator('.activity-center-data-title')
					.textContent();
				const timeText = await notif
					.locator('.activity-center-data-time')
					.textContent();

				// Извлекаем имя мужчины (первый <strong>)
				const manName =
					(await notif
						.locator('.activity-center-data-title strong')
						.first()
						.textContent()) || 'Unknown';

				result.push({
					uid,
					userUid,
					profileUid,
					activityType,
					manName,
					titleText: titleText.trim(),
					time: timeText.trim(),
					element: notif,
				});

				utils.log(
					'Activity Center',
					`  ${i + 1}. ${manName} - ${activityType} (${timeText.trim()})`,
				);
			} catch (error) {
				utils.log(
					'Activity Center',
					`⚠️  Error parsing notification ${i + 1}: ${error.message}`,
				);
			}
		}

		return result;
	} catch (error) {
		utils.log(
			'Activity Center',
			`❌ Error getting notifications: ${error.message}`,
		);
		return [];
	}
}

/**
 * Кликнуть на уведомление (чат откроется автоматически)
 * @param {Page} page - Playwright page
 * @param {Object} notification - Объект уведомления
 * @param {number} ownerUid - UID активного профиля
 * @returns {Promise<Object|null>} - { success: boolean, chatId: string } или null
 */
async function clickNotification(page, notification, ownerUid) {
	try {
		utils.log(
			'Activity Center',
			`🖱️  Clicking notification: ${notification.manName} (${notification.activityType})`,
		);

		// ✅ КЛИКАЕМ НА ЭЛЕМЕНТ УВЕДОМЛЕНИЯ - чат откроется автоматически
		try {
			await notification.element.click();
			utils.log('Activity Center', `✅ Notification clicked`);
		} catch (clickError) {
			utils.logError('Activity Center', `❌ Click error: ${clickError.message}`);
			return null;
		}
		
		// Ждём открытия чата
		utils.log('Activity Center', '⏳ Waiting for chat to open...');
		await utils.sleep(3000);
		
		// Проверяем что чат открылся
		const activeChatId = await page.evaluate(() => {
			return window.modelsChat?.getChats?.active?.identity;
		});
		
		if (!activeChatId) {
			utils.log('Activity Center', `❌ No active chat after click`);
			return null;
		}
		
		// ✅ Expected chat ID: ownerUid_userUid
		const expectedChatId = `${ownerUid}_${notification.userUid}`;
		
		if (activeChatId === expectedChatId) {
			utils.log('Activity Center', `✅ Chat opened: ${expectedChatId}`);
			return {
				success: true,
				chatId: activeChatId,
			};
		} else {
			utils.log('Activity Center', `⚠️  Different chat opened: expected ${expectedChatId}, got ${activeChatId}`);
			// Возвращаем успех, но с другим chatId
			return {
				success: true,
				chatId: activeChatId,
			};
		}
	} catch (error) {
		utils.logError(
			'Activity Center',
			`❌ Error clicking notification: ${error.message}`,
		);
		return null;
	}
}

/**
 * Получить информацию о чате после открытия из Activity Center
 * @param {Page} page - Playwright page
 * @param {Object} notification - Объект уведомления
 * @returns {Promise<Object|null>} - Информация о чате
 */
async function getChatInfoFromNotification(page, notification) {
	try {
		// Получаем URL чата
		const url = page.url();
		const chatIdMatch = url.match(/\/chat\/(\d+)/);
		const chatId = chatIdMatch ? chatIdMatch[1] : null;

		if (!chatId) {
			utils.log('Activity Center', '❌ Could not extract chatId from URL');
			return null;
		}

		return {
			chatId,
			manName: notification.manName,
			userUid: notification.userUid,
			activityType: notification.activityType,
			fromActivityCenter: true, // Флаг что это из Activity Center
		};
	} catch (error) {
		utils.log(
			'Activity Center',
			`❌ Error getting chat info: ${error.message}`,
		);
		return null;
	}
}

/**
 * Основная функция сканирования Activity Center
 * @param {Page} page - Playwright page
 * @param {Function} processCallback - Callback для обработки чата
 * @returns {Promise<number>} - Количество обработанных уведомлений
 */
async function scanActivityCenter(page, processCallback) {
	let processedCount = 0;

	try {
		utils.log('Activity Center', '🔍 Starting Activity Center scan...');

		// Проверяем есть ли непрочитанные уведомления
		const unreadCount = await getUnreadCount(page);
		if (unreadCount === 0) {
			utils.log('Activity Center', '✅ No unread notifications');
			return 0;
		}

		utils.log('Activity Center', `📬 Has unread notifications, opening...`);

		// Открываем Activity Center
		const opened = await openActivityCenter(page);
		if (!opened) {
			utils.log('Activity Center', '❌ Failed to open Activity Center');
			return 0;
		}

		// Получаем все непрочитанные уведомления
		const notifications = await getUnreadNotifications(page);
		if (notifications.length === 0) {
			utils.log('Activity Center', '✅ No unread notifications in list');
			await closeActivityCenter(page);
			return 0;
		}

		utils.log(
			'Activity Center',
			`📋 Processing ${notifications.length} notifications...`,
		);

		// Обрабатываем каждое уведомление
		for (const notification of notifications) {
			try {
				utils.log(
					'Activity Center',
					`\n📌 Processing: ${notification.manName} (${notification.activityType})`,
				);

				// Кликаем на уведомление
				const chatOpened = await clickNotification(page, notification);
				if (!chatOpened) {
					utils.log(
						'Activity Center',
						`⚠️  Could not open chat with ${notification.manName}`,
					);
					continue;
				}

				// Получаем информацию о чате
				const chatInfo = await getChatInfoFromNotification(page, notification);
				if (!chatInfo) {
					utils.log('Activity Center', '⚠️  Could not get chat info');
					// Возвращаемся в чаты
					await page.goto('https://luxee.date/chats');
					await utils.randomDelay(2000, 3000);
					continue;
				}

				// Вызываем callback для обработки чата
				if (processCallback) {
					utils.log(
						'Activity Center',
						`🤖 Processing chat with ${chatInfo.manName}...`,
					);
					await processCallback(page, chatInfo);
					processedCount++;
				}

				// Возвращаемся в чаты
				utils.log('Activity Center', '↩️  Returning to chats...');
				await page.goto('https://luxee.date/chats');
				await utils.randomDelay(2000, 3000);

				// Снова открываем Activity Center для следующего уведомления
				if (notifications.indexOf(notification) < notifications.length - 1) {
					await openActivityCenter(page);
					await utils.randomDelay(1000, 1500);
				}
			} catch (error) {
				utils.log(
					'Activity Center',
					`❌ Error processing notification: ${error.message}`,
				);
				// Пытаемся вернуться в чаты
				try {
					await page.goto('https://luxee.date/chats');
					await utils.randomDelay(2000, 3000);
				} catch (e) {
					utils.log(
						'Activity Center',
						`❌ Error returning to chats: ${e.message}`,
					);
				}
			}
		}

		utils.log(
			'Activity Center',
			`✅ Activity Center scan complete. Processed: ${processedCount}/${notifications.length}`,
		);
	} catch (error) {
		utils.log(
			'Activity Center',
			`❌ Error in scanActivityCenter: ${error.message}`,
		);
	}

	return processedCount;
}

export default {
	scanActivityCenter,
	openActivityCenter,
	closeActivityCenter,
	getUnreadCount,
	getUnreadNotifications,
	clickNotification,
	getChatInfoFromNotification,
};
