// Сервис для отслеживания онлайн статуса Luxee аккаунтов
// Трекает РУЧНУЮ активность (не AI, не Spambot)
// Автоматически переводит аккаунты в offline через 15 минут неактивности

import LuxeeAccount from '../models/LuxeeAccountModel.js';
import User from '../models/UserModel.js';
import socketService from './socketService.js';

const MANUAL_ACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 минут
const MONITOR_INTERVAL = 30 * 1000; // 30 секунд

let monitorIntervalId = null;

const luxeeAccountOnlineService = {
	/**
	 * Трекинг ручной активности пользователя
	 * При любом ручном действии на любом Luxee аккаунте - ВСЕ аккаунты пользователя становятся online
	 * 
	 * @param {string} userId - ID пользователя
	 * @param {string} accountId - ID аккаунта (опционально, для проверки владельца)
	 */
	trackManualActivity: async (userId, accountId = null) => {
		try {
			console.log(`[Luxee Online] 📍 Tracking manual activity for user ${userId}, account ${accountId}`);

			// 🛡️ ЗАЩИТА: Если это AI контекст - игнорируем
			if (accountId && accountId.toString().endsWith('_ai')) {
				console.log(`[Luxee Online] ⚠️ Ignoring AI context ${accountId}`);
				return;
			}

			// Если указан accountId - проверяем что аккаунт принадлежит пользователю
			if (accountId) {
				const account = await LuxeeAccount.findOne({
					_id: accountId,
					user: userId,
				});

				if (!account) {
					console.log(`[Luxee Online] ⚠️ Account ${accountId} not found or doesn't belong to user ${userId}`);
					return;
				}
			}

			const now = new Date();

			// Обновляем ВСЕ Luxee аккаунты пользователя
			const result = await LuxeeAccount.updateMany(
				{ user: userId },
				{
					$set: {
						manualLastActivity: now,
						isManuallyOnline: true,
					},
				}
			);

			console.log(`[Luxee Online] ✅ Updated ${result.modifiedCount} accounts for user ${userId} → online`);

			// Обновляем пользователя
			await User.findByIdAndUpdate(userId, {
				luxeeAccountsManualActivity: now,
			});

			// Emit WebSocket событие для frontend
			socketService.emitAccountsOnlineStatus(userId, { isOnline: true });

			return {
				success: true,
				accountsUpdated: result.modifiedCount,
				status: 'online',
			};
		} catch (error) {
			console.error('[Luxee Online] ❌ Error tracking manual activity:', error);
			throw error;
		}
	},

	/**
	 * Получить статус онлайн для всех аккаунтов пользователя
	 * 
	 * @param {string} userId - ID пользователя
	 * @returns {Object} { isOnline: boolean, lastActivity: Date, accountsCount: number }
	 */
	getUserAccountsOnlineStatus: async userId => {
		try {
			// Получаем любой аккаунт пользователя для проверки статуса
			const account = await LuxeeAccount.findOne({ user: userId });

			if (!account) {
				return {
					isOnline: false,
					lastActivity: null,
					accountsCount: 0,
				};
			}

			// Получаем количество аккаунтов
			const accountsCount = await LuxeeAccount.countDocuments({ user: userId });

			return {
				isOnline: account.isManuallyOnline || false,
				lastActivity: account.manualLastActivity,
				accountsCount,
			};
		} catch (error) {
			console.error('[Luxee Online] ❌ Error getting online status:', error);
			throw error;
		}
	},

	/**
	 * Мониторинг неактивных пользователей
	 * Каждые 30 секунд проверяет всех пользователей
	 * Если прошло 15+ минут без ручной активности - переводит ВСЕ аккаунты в offline
	 */
	startMonitoring: () => {
		if (monitorIntervalId) {
			console.log('[Luxee Online Monitor] Already running');
			return;
		}

		console.log('[Luxee Online Monitor] 🚀 Starting monitoring (check every 30s, timeout 15 min)');

		monitorIntervalId = setInterval(async () => {
			try {
				console.log('[Luxee Online Monitor] 🔍 Checking inactive users...');

				// Находим всех пользователей у кого есть ручная активность
				const users = await User.find({
					luxeeAccountsManualActivity: { $ne: null },
				}).select('_id email luxeeAccountsManualActivity');

				if (users.length === 0) {
					console.log('[Luxee Online Monitor] No users with manual activity');
					return;
				}

				console.log(`[Luxee Online Monitor] Found ${users.length} users to check`);

				for (const user of users) {
					const timeSinceActivity = Date.now() - user.luxeeAccountsManualActivity.getTime();
					const inactivityMinutes = Math.floor(timeSinceActivity / 60000);

					// Если прошло 15+ минут - переводим в offline
					if (timeSinceActivity > MANUAL_ACTIVITY_TIMEOUT) {
						console.log(
							`[Luxee Online Monitor] ⏸️  User ${user.email} inactive for ${inactivityMinutes} min → offline`
						);

						// Обновляем ВСЕ аккаунты пользователя
						const result = await LuxeeAccount.updateMany(
							{ user: user._id },
							{
								$set: {
									isManuallyOnline: false,
								},
							}
						);

						console.log(
							`[Luxee Online Monitor] 🛑 Set offline for ${result.modifiedCount} accounts of user ${user.email}`
						);

						// Emit WebSocket событие
						socketService.emitAccountsOnlineStatus(user._id.toString(), { isOnline: false });
					} else {
						// Еще не прошло 15 минут - пользователь активен
						const remainingMinutes = 15 - inactivityMinutes;
						console.log(
							`[Luxee Online Monitor] ✅ User ${user.email} still online (${remainingMinutes} min remaining)`
						);
					}
				}

				console.log('[Luxee Online Monitor] ✓ Check completed');
			} catch (error) {
				console.error('[Luxee Online Monitor] ❌ Error in monitoring:', error);
			}
		}, MONITOR_INTERVAL);

		console.log('[Luxee Online Monitor] ✅ Monitoring started');
	},

	/**
	 * Остановить мониторинг
	 */
	stopMonitoring: () => {
		if (monitorIntervalId) {
			clearInterval(monitorIntervalId);
			monitorIntervalId = null;
			console.log('[Luxee Online Monitor] Stopped');
		}
	},

	/**
	 * Получить статистику
	 */
	getStats: async () => {
		try {
			const totalAccounts = await LuxeeAccount.countDocuments();
			const onlineAccounts = await LuxeeAccount.countDocuments({
				isManuallyOnline: true,
			});
			const usersWithActivity = await User.countDocuments({
				luxeeAccountsManualActivity: { $ne: null },
			});

			return {
				totalAccounts,
				onlineAccounts,
				offlineAccounts: totalAccounts - onlineAccounts,
				usersWithActivity,
				monitoringActive: monitorIntervalId !== null,
			};
		} catch (error) {
			console.error('[Luxee Online] Error getting stats:', error);
			return null;
		}
	},
};

export default luxeeAccountOnlineService;
