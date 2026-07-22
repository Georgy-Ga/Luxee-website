// User Activity Service
// Управляет активностью пользователей и автоматическим оффлайном профилей

import User from '../models/UserModel.js';
import LuxeeAccount from '../models/LuxeeAccountModel.js';
import keepAliveService from './luxeeApi/keepAliveService.js';
import browserService from './browser/browserService.js';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 минут в миллисекундах

const userActivityService = {
	/**
	 * Обработать активность пользователя
	 * @param {string} userId - ID пользователя
	 */
	handleUserActivity: async (userId) => {
		try {
			console.log(`[User Activity] Activity detected for user ${userId}`);
			
			// Обновляем lastActivity
			await User.findByIdAndUpdate(userId, { 
				lastActivity: new Date() 
			});
			
			// Проверяем: нужно ли запустить keep-alive?
			const accounts = await LuxeeAccount.find({ user: userId });
			
			if (accounts.length === 0) {
				console.log(`[User Activity] User ${userId} has no accounts`);
				return;
			}
			
			// Проверяем для каждого аккаунта: запущен ли keep-alive?
			for (const account of accounts) {
				const accountId = account._id.toString();
				const stats = keepAliveService.getStats();
				const isRunning = stats.accountIds.includes(accountId);
				
				if (!isRunning) {
					// Keep-alive НЕ запущен → нужно запустить
					console.log(`[User Activity] 🔄 Keep-alive stopped for account ${accountId}, restarting...`);
					
					// Получаем контекст
					const context = await browserService.getContext(accountId);
					
					if (context) {
						await keepAliveService.start({ 
							accountId, 
							context 
						});
						console.log(`[User Activity] ✅ Keep-alive restarted for account ${accountId}`);
					} else {
						console.log(`[User Activity] ⚠️  Context not found for account ${accountId}`);
					}
				}
			}
			
			console.log(`[User Activity] ✅ Activity processed for user ${userId}`);
		} catch (error) {
			console.error(`[User Activity] Error handling activity for user ${userId}:`, error);
		}
	},
	
	/**
	 * Проверить активен ли пользователь
	 * @param {string} userId - ID пользователя
	 * @returns {Promise<boolean>}
	 */
	isUserActive: async (userId) => {
		try {
			const user = await User.findById(userId);
			
			if (!user || !user.lastActivity) {
				return false;
			}
			
			const now = Date.now();
			const lastActivityTime = new Date(user.lastActivity).getTime();
			const elapsed = now - lastActivityTime;
			
			return elapsed < INACTIVITY_TIMEOUT;
		} catch (error) {
			console.error(`[User Activity] Error checking activity for user ${userId}:`, error);
			return false;
		}
	},
	
	/**
	 * Получить время неактивности пользователя в минутах
	 * @param {string} userId - ID пользователя
	 * @returns {Promise<number>}
	 */
	getInactivityMinutes: async (userId) => {
		try {
			const user = await User.findById(userId);
			
			if (!user || !user.lastActivity) {
				return Infinity;
			}
			
			const now = Date.now();
			const lastActivityTime = new Date(user.lastActivity).getTime();
			const elapsed = now - lastActivityTime;
			
			return Math.floor(elapsed / 60000); // Минуты
		} catch (error) {
			console.error(`[User Activity] Error getting inactivity for user ${userId}:`, error);
			return Infinity;
		}
	},
	
	/**
	 * Мониторинг неактивности - проверяет всех пользователей каждую минуту
	 * Останавливает keep-alive для неактивных пользователей
	 */
	startInactivityMonitor: () => {
		console.log('[User Activity] 🚀 Starting inactivity monitor (check every 60 seconds)');
		
		const checkInactivity = async () => {
			try {
				// Получаем всех пользователей с Luxee аккаунтами
				const accounts = await LuxeeAccount.find().populate('user');
				
				// Группируем по пользователям
				const userAccountsMap = new Map();
				
				for (const account of accounts) {
					if (!account.user) continue;
					
					const userId = account.user._id.toString();
					
					if (!userAccountsMap.has(userId)) {
						userAccountsMap.set(userId, {
							user: account.user,
							accounts: []
						});
					}
					
					userAccountsMap.get(userId).accounts.push(account);
				}
				
				// Проверяем каждого пользователя
				for (const [userId, data] of userAccountsMap) {
					const { user, accounts } = data;
					
					const isActive = await userActivityService.isUserActive(userId);
					const inactivityMinutes = await userActivityService.getInactivityMinutes(userId);
					
					if (!isActive) {
						// Пользователь неактивен > 15 минут
						console.log(`[User Activity] ⏸️  User ${user.email} inactive for ${inactivityMinutes} minutes → stopping keep-alive`);
						
						// Останавливаем keep-alive для всех аккаунтов пользователя
						for (const account of accounts) {
							const accountId = account._id.toString();
							const stats = keepAliveService.getStats();
							
							if (stats.accountIds.includes(accountId)) {
								keepAliveService.stop(accountId);
								console.log(`[User Activity] 🛑 Keep-alive stopped for account ${accountId}`);
							}
						}
					}
				}
			} catch (error) {
				console.error('[User Activity] Error in inactivity check:', error);
			}
		};
		
		// Первая проверка через 60 секунд
		setTimeout(checkInactivity, 60000);
		
		// Затем каждые 60 секунд
		setInterval(checkInactivity, 60000);
		
		console.log('[User Activity] ✅ Inactivity monitor started');
	},
	
	/**
	 * Получить статус активности пользователя
	 * @param {string} userId - ID пользователя
	 * @returns {Promise<Object>}
	 */
	getUserActivityStatus: async (userId) => {
		try {
			const user = await User.findById(userId);
			
			if (!user) {
				return {
					isActive: false,
					lastActivity: null,
					inactivityMinutes: Infinity
				};
			}
			
			const isActive = await userActivityService.isUserActive(userId);
			const inactivityMinutes = await userActivityService.getInactivityMinutes(userId);
			
			return {
				isActive,
				lastActivity: user.lastActivity,
				inactivityMinutes
			};
		} catch (error) {
			console.error(`[User Activity] Error getting status for user ${userId}:`, error);
			return {
				isActive: false,
				lastActivity: null,
				inactivityMinutes: Infinity
			};
		}
	}
};

export default userActivityService;
