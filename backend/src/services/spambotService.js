import axios from 'axios';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import SpambotDistributionModel from '../models/SpambotDistributionModel.js';
import spambotQueueService from './SpambotQueueService.js';
import socketService from './socketService.js';

/**
 * Spambot Service
 *
 * Управляет рассылками через Python Spambot Service.
 *
 * ВАЖНО: Блокировки для предотвращения параллельных рассылок:
 * - Один Luxee аккаунт = одна активная рассылка
 * - Проверка перед запуском
 * - Mutex через MongoDB (атомарные операции)
 */

const PYTHON_SERVICE_URL =
	process.env.SPAMBOT_SERVICE_URL || 'http://localhost:8001';

// Константы
const MAX_DISTRIBUTION_LIMIT = 30; // Максимальное количество рассылок

// In-memory блокировки (дополнительная защита)
const accountLocks = new Map();

class SpambotService {
	/**
	 * Проверить есть ли активная (running) рассылка на аккаунте
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object|null>} - Активная рассылка или null
	 */
	async getRunningDistribution(accountId) {
		const running = await SpambotDistributionModel.findOne({
			luxeeAccount: accountId,
			status: 'running',
		});

		return running;
	}

	/**
	 * Получить список профилей для аккаунта
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @param {string} userId - ID пользователя
	 * @returns {Promise<Array>} - Список профилей
	 */
	async getProfiles(accountId, userId) {
		// Проверка прав доступа
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw new Error('Account not found or access denied');
		}

		try {
			// Запрос к Python Service
			const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
				params: {
					username: account.luxeeEmail,
					password: account.luxeePassword,
				},
				timeout: 90000, // 90 секунд (операция долгая - login + парсинг профилей)
			});

			return response.data.profiles;
		} catch (error) {
			console.error('[Spambot Service] Error getting profiles:', error.message);
			throw new Error(
				`Failed to get profiles: ${error.response?.data?.detail || error.message}`,
			);
		}
	}

	/**
	 * Запустить рассылку (с поддержкой очереди)
	 *
	 * @param {Object} params
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {string} params.userId - ID пользователя
	 * @param {string} params.userRole - Роль пользователя ('admin' | 'user')
	 * @param {Object} params.config - Конфигурация рассылки
	 * @returns {Promise<Object>} - Данные созданной рассылки
	 */
	async startDistribution({ accountId, userId, userRole = 'user', config }) {
		// 0. Валидация лимита рассылок
		if (
			!config.limit ||
			config.limit < 1 ||
			config.limit > MAX_DISTRIBUTION_LIMIT
		) {
			throw new Error(
				`Distribution limit must be between 1 and ${MAX_DISTRIBUTION_LIMIT}`,
			);
		}

		// 1. Проверка доступа к аккаунту
		// Админ может запускать рассылки на любых аккаунтах
		let account;
		if (userRole === 'admin') {
			account = await LuxeeAccountModel.findById(accountId).populate(
				'user',
				'email',
			);
		} else {
			account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			}).populate('user', 'email');
		}

		if (!account) {
			throw new Error('Account not found or access denied');
		}

		// 2. Проверить есть ли уже running рассылка
		const shouldQueue = await spambotQueueService.shouldQueue(accountId);

		// 3. Создать запись в MongoDB с правильным статусом
		const distribution = new SpambotDistributionModel({
			user: account.user._id, // ID владельца аккаунта (не админа!)
			luxeeAccount: accountId,
			distributionId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Временный ID
			config: {
				profileUid: config.profileUid,
				profileName: config.profileName,
				distributionType: config.distributionType,
				purchased: config.purchased,
				free: config.free,
				onlyEmptyChat: config.onlyEmptyChat,
				onlyNotEmptyChat: config.onlyNotEmptyChat,
				messages: config.messages,
				mailMessage: config.mailMessage,
				excludeIds: config.excludeIds,
				specificUsers: config.specificUsers,
				limit: config.limit,
				filterUpdateLimit: config.filterUpdateLimit,
				maxTimeMinutes: config.maxTimeMinutes,
			},
			status: shouldQueue ? 'queued' : 'running',
			queuedAt: shouldQueue ? new Date() : undefined,
		});

		await distribution.save();

		// 4. Если нужно поставить в очередь - отправить событие и вернуть
		if (shouldQueue) {
			const position = await spambotQueueService.getQueuePosition(
				distribution._id,
			);
			console.log(
				`[Spambot Service] Distribution queued (#${position}): ${distribution.distributionId} for account ${account.luxeeEmail}`,
			);

			// Отправить WebSocket событие о добавлении в очередь
			await spambotQueueService.emitQueuedEvent(distribution, position);

			return {
				id: distribution._id,
				distributionId: distribution.distributionId,
				status: 'queued',
				accountEmail: account.luxeeEmail,
				user: account.user._id,
				config: distribution.config,
				queuePosition: position,
				queuedAt: distribution.queuedAt,
				createdAt: distribution.createdAt,
			};
		}

		// 5. Если не в очереди - запустить сразу
		// Установить in-memory блокировку
		accountLocks.set(accountId, Date.now());

		try {
			// Подготовить конфигурацию с credentials
			const fullConfig = {
				username: account.luxeeEmail,
				password: account.luxeePassword,
				profile_uid: config.profileUid,
				profile_name: config.profileName,
				distribution_type: config.distributionType,
				purchased: config.purchased ?? true,
				free: config.free ?? true,
				only_empty_chat: config.onlyEmptyChat ?? false,
				only_not_empty_chat: config.onlyNotEmptyChat ?? false,
				messages: config.messages?.map(m => ({
					text: m.text,
					interval: m.interval || 0,
				})),
				mail_message: config.mailMessage
					? {
							title: config.mailMessage.title,
							text: config.mailMessage.text,
							pictures_number: config.mailMessage.picturesNumber || [],
						}
					: null,
				exclude_ids: config.excludeIds || [],
				specific_users: config.specificUsers || [],
				limit: config.limit,
				filter_update_limit: config.filterUpdateLimit,
				max_time_minutes: config.maxTimeMinutes || 180,
			};

			// Запустить в Python Service
			const response = await axios.post(
				`${PYTHON_SERVICE_URL}/api/distribution/start`,
				fullConfig,
				{ timeout: 30000 },
			);

			const { distribution_id } = response.data;

			// Обновить distributionId в MongoDB
			distribution.distributionId = distribution_id;
			distribution.startedAt = new Date();
			await distribution.save();

			console.log(
				`[Spambot Service] Distribution started: ${distribution_id} for account ${account.luxeeEmail}`,
			);

			// Отправить WebSocket событие
			socketService.emitDistributionStarted(account.user._id.toString(), {
				distributionId: distribution_id,
				id: distribution._id,
				status: 'running',
				accountEmail: account.luxeeEmail,
				profileName: config.profileName || 'N/A',
				distributionType: config.distributionType || 'chat',
				sentMessagesCount: 0,
				skippedClientsCount: 0,
				createdAt: distribution.createdAt?.toISOString(),
				startedAt: distribution.startedAt?.toISOString(),
			});

			return {
				id: distribution._id,
				distributionId: distribution_id,
				status: 'running',
				accountEmail: account.luxeeEmail,
				user: account.user._id,
				config: distribution.config,
				createdAt: distribution.createdAt,
				startedAt: distribution.startedAt,
			};
		} catch (error) {
			// При ошибке запуска - удалить запись или пометить как error
			accountLocks.delete(accountId);

			distribution.status = 'error';
			distribution.errorMessage = error.message;
			distribution.completedAt = new Date();
			await distribution.save();

			console.error(
				'[Spambot Service] Error starting distribution:',
				error.message,
			);
			console.error(
				'[Spambot Service] Error details:',
				error.response?.data || error.stack,
			);

			// Отправить WebSocket событие об ошибке
			socketService.emitDistributionError(account.user._id.toString(), {
				distributionId: distribution.distributionId,
				id: distribution._id,
				status: 'error',
				errorMessage: error.message,
				accountEmail: account.luxeeEmail,
				profileName: config.profileName || 'N/A',
				distributionType: config.distributionType || 'chat',
			});

			let errorMessage = 'Unknown error';
			if (error.response) {
				errorMessage =
					error.response.data?.detail ||
					error.response.data?.message ||
					`HTTP ${error.response.status}`;
			} else if (error.request) {
				errorMessage =
					'Python Spambot Service is not available. Make sure it is running on ' +
					PYTHON_SERVICE_URL;
			} else {
				errorMessage = error.message;
			}

			throw new Error(`Failed to start distribution: ${errorMessage}`);
		} finally {
			// Снять in-memory блокировку через 5 секунд
			setTimeout(() => {
				accountLocks.delete(accountId);
			}, 5000);
		}
	}

	/**
	 * Получить статус рассылки
	 *
	 * @param {string} distributionId - ID рассылки (MongoDB)
	 * @param {string} userId - ID пользователя
	 * @returns {Promise<Object>} - Статус рассылки
	 */
	async getDistributionStatus(distributionId, userId) {
		// Найти рассылку
		const distribution = await SpambotDistributionModel.findOne({
			_id: distributionId,
			user: userId,
		}).populate('luxeeAccount', 'luxeeEmail');

		if (!distribution) {
			throw new Error('Distribution not found or access denied');
		}

		// Если рассылка завершена, вернуть из БД
		if (['completed', 'error', 'stopped'].includes(distribution.status)) {
			return {
				id: distribution._id,
				distributionId: distribution.distributionId,
				status: distribution.status,
				sentMessagesCount: distribution.sentMessagesCount,
				skippedClientsCount: distribution.skippedClientsCount,
				currentClient: distribution.currentClient,
				errorMessage: distribution.errorMessage,
				accountEmail: distribution.luxeeAccount.luxeeEmail,
				startedAt: distribution.startedAt,
				completedAt: distribution.completedAt,
			};
		}

		// Если активна, запросить актуальный статус из Python Service
		try {
			const response = await axios.get(
				`${PYTHON_SERVICE_URL}/api/distribution/${distribution.distributionId}/status`,
				{ timeout: 10000 },
			);

			const statusData = response.data;

			// Обновить в БД
			await distribution.updateStatus(statusData);

			return {
				id: distribution._id,
				distributionId: distribution.distributionId,
				status: statusData.status,
				sentMessagesCount: statusData.sent_messages_count,
				skippedClientsCount: statusData.skipped_clients,
				currentClient: statusData.current_client,
				errorMessage: statusData.error_message,
				accountEmail: distribution.luxeeAccount.luxeeEmail,
				startedAt: distribution.startedAt,
				completedAt: distribution.completedAt,
			};
		} catch (error) {
			console.error('[Spambot Service] Error getting status:', error.message);

			// Вернуть последний известный статус из БД
			return {
				id: distribution._id,
				distributionId: distribution.distributionId,
				status: distribution.status,
				sentMessagesCount: distribution.sentMessagesCount,
				skippedClientsCount: distribution.skippedClientsCount,
				errorMessage: 'Failed to fetch latest status from Python Service',
				accountEmail: distribution.luxeeAccount.luxeeEmail,
			};
		}
	}

	/**
	 * Остановить рассылку
	 *
	 * @param {string} distributionId - ID рассылки (UUID от Python Service)
	 * @param {string} userId - ID пользователя
	 * @param {string} userRole - Роль пользователя ('admin' | 'user')
	 * @returns {Promise<Object>} - Результат остановки
	 */
	async stopDistribution(distributionId, userId, userRole = 'user') {
		// Найти рассылку по distributionId (UUID), а не по _id (MongoDB ObjectId)
		// Админ может остановить любую рассылку, обычный пользователь - только свою
		const query = { distributionId: distributionId };
		if (userRole !== 'admin') {
			query.user = userId;
		}

		const distribution = await SpambotDistributionModel.findOne(query).populate(
			'luxeeAccount',
			'luxeeEmail',
		);

		if (!distribution) {
			throw new Error('Distribution not found or access denied');
		}

		// Если уже остановлена
		if (['completed', 'error', 'stopped'].includes(distribution.status)) {
			return {
				id: distribution._id,
				status: distribution.status,
				message: 'Distribution already stopped',
			};
		}

		try {
			// Отправить запрос на остановку в Python Service
			await axios.post(
				`${PYTHON_SERVICE_URL}/api/distribution/${distribution.distributionId}/stop`,
				{},
				{ timeout: 10000 },
			);

			// Обновить статус в БД
			distribution.status = 'stopped';
			distribution.stoppedAt = new Date();
			await distribution.save();

			console.log(
				`[Spambot Service] Distribution stopped: ${distribution.distributionId}`,
			);

			// Отправить WebSocket событие об остановке
			socketService.emitDistributionStopped(distribution.user.toString(), {
				distributionId: distribution.distributionId,
				id: distribution._id,
				status: 'stopped',
				accountEmail: distribution.luxeeAccount?.luxeeEmail,
				profileName: distribution.config?.profileName || 'N/A',
				distributionType: distribution.config?.distributionType || 'chat',
				sentMessagesCount: distribution.sentMessagesCount || 0,
				skippedClientsCount: distribution.skippedClientsCount || 0,
				createdAt: distribution.createdAt?.toISOString(),
				startedAt: distribution.startedAt?.toISOString(),
				stoppedAt: distribution.stoppedAt?.toISOString(),
			});

			// Запустить следующую рассылку из очереди
			console.log(
				`[Spambot Service] 🎯 Distribution stopped, checking queue for account ${distribution.luxeeAccount._id}`,
			);
			await spambotQueueService.startNextInQueue(
				distribution.luxeeAccount._id.toString(),
			);

			return {
				id: distribution._id,
				status: 'stopped',
				message: 'Distribution stopped successfully',
			};
		} catch (error) {
			console.error(
				'[Spambot Service] Error stopping distribution:',
				error.message,
			);
			throw new Error(
				`Failed to stop distribution: ${error.response?.data?.detail || error.message}`,
			);
		}
	}

	/**
	 * Получить список рассылок пользователя
	 *
	 * @param {string} userId - ID пользователя
	 * @param {Object} filters - Фильтры
	 * @returns {Promise<Array>} - Список рассылок
	 */
	async getUserDistributions(userId, filters = {}) {
		const query = { user: userId };

		if (filters.accountId) {
			query.luxeeAccount = filters.accountId;
		}

		if (filters.status) {
			query.status = filters.status;
		}

		const distributions = await SpambotDistributionModel.find(query)
			.populate('luxeeAccount', 'luxeeEmail')
			.sort({ createdAt: -1 })
			.limit(filters.limit || 50);

		return distributions.map(d => ({
			id: d._id,
			distributionId: d.distributionId,
			status: d.status,
			accountEmail: d.luxeeAccount.luxeeEmail,
			profileName: d.config.profileName,
			distributionType: d.config.distributionType,
			sentMessagesCount: d.sentMessagesCount,
			skippedClientsCount: d.skippedClientsCount,
			limit: d.config.limit,
			startedAt: d.startedAt,
			completedAt: d.completedAt,
			createdAt: d.createdAt,
		}));
	}

	/**
	 * ADMIN: Получить все Luxee аккаунты, сгруппированные по пользователям
	 *
	 * @returns {Promise<Array>} - Список пользователей с их аккаунтами
	 */
	async getAllAccountsGroupedByUser() {
		const accounts = await LuxeeAccountModel.find()
			.populate('user', 'email role')
			.sort({ 'user.email': 1, luxeeEmail: 1 });

		// Группировать по пользователям
		const grouped = {};

		for (const account of accounts) {
			// Пропустить аккаунты с удаленным пользователем (race condition или старые данные)
			if (!account.user) {
				console.warn(
					`[Spambot Service] ⚠️  Account ${account._id} (${account.luxeeEmail}) has no user, skipping...`,
				);
				continue;
			}

			const userId = account.user._id.toString();

			if (!grouped[userId]) {
				grouped[userId] = {
					user: {
						_id: account.user._id,
						email: account.user.email,
						role: account.user.role,
					},
					accounts: [],
				};
			}

			grouped[userId].accounts.push({
				_id: account._id,
				luxeeEmail: account.luxeeEmail,
				isActive: account.isActive,
				lastActivity: account.lastActivity,
				createdAt: account.createdAt,
			});
		}

		return Object.values(grouped);
	}

	/**
	 * ADMIN: Получить все рассылки всех пользователей
	 *
	 * @param {Object} filters - Фильтры
	 * @returns {Promise<Array>} - Список всех рассылок с информацией о пользователе
	 */
	async getAllDistributions(filters = {}) {
		const query = {};

		if (filters.status) {
			query.status = filters.status;
		}

		if (filters.userId) {
			query.user = filters.userId;
		}

		const distributions = await SpambotDistributionModel.find(query)
			.populate('luxeeAccount', 'luxeeEmail')
			.populate('user', 'email')
			.sort({ createdAt: -1 }) // ✅ FIX: Самые новые рассылки сверху
			.limit(filters.limit || 100);

		return distributions.map(d => ({
			id: d._id,
			distributionId: d.distributionId,
			status: d.status,
			accountEmail: d.luxeeAccount.luxeeEmail,
			userEmail: d.user.email,
			userId: d.user._id,
			profileName: d.config.profileName,
			distributionType: d.config.distributionType,
			sentMessagesCount: d.sentMessagesCount,
			skippedClientsCount: d.skippedClientsCount,
			limit: d.config.limit,
			startedAt: d.startedAt,
			completedAt: d.completedAt,
			createdAt: d.createdAt,
		}));
	}

	/**
	 * ADMIN: Получить профили для любого аккаунта (без проверки владельца)
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Array>} - Список профилей
	 */
	async getProfilesAdmin(accountId) {
		const account = await LuxeeAccountModel.findById(accountId);

		if (!account) {
			throw new Error('Account not found');
		}

		try {
			const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
				params: {
					username: account.luxeeEmail,
					password: account.luxeePassword,
				},
				timeout: 90000, // 90 секунд (операция долгая - login + парсинг профилей)
			});

			return response.data.profiles;
		} catch (error) {
			console.error(
				'[Spambot Service] Error getting profiles (admin):',
				error.message,
			);
			throw new Error(
				`Failed to get profiles: ${error.response?.data?.detail || error.message}`,
			);
		}
	}
}

export default new SpambotService();
