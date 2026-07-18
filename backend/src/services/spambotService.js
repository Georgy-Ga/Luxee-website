import axios from 'axios';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import SpambotDistributionModel from '../models/SpambotDistributionModel.js';

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

// In-memory блокировки (дополнительная защита)
const accountLocks = new Map();

class SpambotService {
	/**
	 * Проверить доступность аккаунта для рассылки
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<{available: boolean, reason?: string}>}
	 */
	async checkAccountAvailability(accountId) {
		// Проверка 1: In-memory lock
		if (accountLocks.has(accountId)) {
			return {
				available: false,
				reason: 'Account is currently locked for another distribution',
			};
		}

		// Проверка 2: MongoDB - активные рассылки
		const activeDistributions =
			await SpambotDistributionModel.getAccountActiveDistributions(accountId);

		if (activeDistributions.length > 0) {
			return {
				available: false,
				reason: `Account has ${activeDistributions.length} active distribution(s)`,
				activeDistributions: activeDistributions.map(d => ({
					id: d._id,
					distributionId: d.distributionId,
					status: d.status,
					startedAt: d.startedAt,
				})),
			};
		}

		return { available: true };
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
				timeout: 60000, // 60 секунд (операция долгая)
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
	 * Запустить рассылку
	 *
	 * @param {Object} params
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {string} params.userId - ID пользователя
	 * @param {string} params.userRole - Роль пользователя ('admin' | 'user')
	 * @param {Object} params.config - Конфигурация рассылки
	 * @returns {Promise<Object>} - Данные созданной рассылки
	 */
	async startDistribution({ accountId, userId, userRole = 'user', config }) {
		// 1. Проверка доступа к аккаунту
		// Админ может запускать рассылки на любых аккаунтах
		let account;
		if (userRole === 'admin') {
			account = await LuxeeAccountModel.findById(accountId);
		} else {
			account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});
		}

		if (!account) {
			throw new Error('Account not found or access denied');
		}

		// 2. Проверка доступности аккаунта (блокировки)
		const availability = await this.checkAccountAvailability(accountId);

		if (!availability.available) {
			throw new Error(availability.reason);
		}

		// 3. Установить in-memory блокировку
		accountLocks.set(accountId, Date.now());

		try {
			// 4. Подготовить конфигурацию с credentials
			const fullConfig = {
				// Credentials из MongoDB
				username: account.luxeeEmail,
				password: account.luxeePassword,

				// Конфигурация от пользователя
				profile_uid: config.profileUid,
				profile_name: config.profileName,
				distribution_type: config.distributionType,

				// Filters
				purchased: config.purchased ?? true,
				free: config.free ?? true,
				only_empty_chat: config.onlyEmptyChat ?? false,
				only_not_empty_chat: config.onlyNotEmptyChat ?? false,

				// Messages
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

				// Limits
				exclude_ids: config.excludeIds || [],
				specific_users: config.specificUsers || [],
				limit: config.limit,
				filter_update_limit: config.filterUpdateLimit,
				max_time_minutes: config.maxTimeMinutes || 180,
			};

			// 5. Отправить запрос в Python Service
			const response = await axios.post(
				`${PYTHON_SERVICE_URL}/api/distribution/start`,
				fullConfig,
				{
					timeout: 30000, // 30 секунд
				},
			);

			const { distribution_id, status } = response.data;

			// 6. Сохранить в MongoDB
			// ВАЖНО: Сохраняем ID владельца аккаунта, а не того кто запустил рассылку
			// Это важно для WebSocket уведомлений и для связи с аккаунтом
			const distribution = new SpambotDistributionModel({
				user: account.user, // ID владельца аккаунта (не админа!)
				luxeeAccount: accountId,
				distributionId: distribution_id,
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
				status: 'running',
			});

			await distribution.save();

			console.log(
				`[Spambot Service] Distribution started: ${distribution_id} for account ${account.luxeeEmail}`,
			);

			return {
				id: distribution._id,
				distributionId: distribution_id,
				status: 'running',
				accountEmail: account.luxeeEmail,
				user: account.user, // ID владельца аккаунта для WebSocket уведомлений
				config: distribution.config,
				createdAt: distribution.createdAt,
				startedAt: distribution.startedAt,
			};
		} catch (error) {
			// Снять блокировку при ошибке
			accountLocks.delete(accountId);

			console.error(
				'[Spambot Service] Error starting distribution:',
				error.message,
			);
			console.error(
				'[Spambot Service] Error details:',
				error.response?.data || error.stack,
			);

			// Правильная обработка ошибок
			let errorMessage = 'Unknown error';

			if (error.response) {
				// Ответ от Python backend с ошибкой
				errorMessage =
					error.response.data?.detail ||
					error.response.data?.message ||
					`HTTP ${error.response.status}`;
			} else if (error.request) {
				// Запрос отправлен, но ответа не получено (Python backend не доступен)
				errorMessage =
					'Python Spambot Service is not available. Make sure it is running on ' +
					PYTHON_SERVICE_URL;
			} else {
				// Ошибка при настройке запроса
				errorMessage = error.message;
			}

			throw new Error(`Failed to start distribution: ${errorMessage}`);
		} finally {
			// Снять in-memory блокировку через 5 секунд
			// (к этому времени статус уже обновится в БД)
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
			const socketService = (await import('./socketService.js')).default;
			// ВАЖНО: distribution.user это ObjectId, конвертируем в string
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
				console.warn(`[Spambot Service] ⚠️  Account ${account._id} (${account.luxeeEmail}) has no user, skipping...`);
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
			.sort({ status: 1, createdAt: -1 }) // running сверху, потом по дате
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
				timeout: 60000,
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
