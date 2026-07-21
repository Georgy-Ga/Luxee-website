import SpambotDistributionModel from '../models/SpambotDistributionModel.js';
import socketService from './socketService.js';

/**
 * Spambot Queue Service
 *
 * Управляет очередью рассылок на аккаунтах.
 * Обеспечивает последовательное выполнение рассылок на одном аккаунте.
 */
class SpambotQueueService {
	/**
	 * Проверить есть ли активная рассылка на аккаунте
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
	 * Получить очередь рассылок для аккаунта
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Array>} - Список рассылок в очереди (отсортированные по времени)
	 */
	async getAccountQueue(accountId) {
		const queue = await SpambotDistributionModel.find({
			luxeeAccount: accountId,
			status: 'queued',
		})
			.sort({ queuedAt: 1 }) // Старые первыми (FIFO)
			.populate('user', 'email')
			.populate('luxeeAccount', 'luxeeEmail');

		return queue;
	}

	/**
	 * Получить следующую рассылку из очереди для запуска
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object|null>} - Следующая рассылка или null
	 */
	async getNextInQueue(accountId) {
		const next = await SpambotDistributionModel.findOne({
			luxeeAccount: accountId,
			status: 'queued',
		})
			.sort({ queuedAt: 1 }) // Самая старая
			.populate('user', 'email')
			.populate('luxeeAccount'); // ✅ FIX: Populate ВСЕ поля включая пароль!

		return next;
	}

	/**
	 * Проверить нужно ли ставить рассылку в очередь
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<boolean>} - true если нужно в очередь, false если можно запускать
	 */
	async shouldQueue(accountId) {
		const running = await this.getRunningDistribution(accountId);
		return running !== null;
	}

	/**
	 * Получить позицию рассылки в очереди
	 *
	 * @param {string} distributionId - ID рассылки (MongoDB _id)
	 * @returns {Promise<number>} - Позиция в очереди (1-based) или 0 если не в очереди
	 */
	async getQueuePosition(distributionId) {
		const distribution =
			await SpambotDistributionModel.findById(distributionId);

		if (!distribution || distribution.status !== 'queued') {
			return 0;
		}

		// Получить все рассылки в очереди для этого аккаунта старше текущей
		const olderCount = await SpambotDistributionModel.countDocuments({
			luxeeAccount: distribution.luxeeAccount,
			status: 'queued',
			queuedAt: { $lt: distribution.queuedAt },
		});

		return olderCount + 1; // 1-based позиция
	}

	/**
	 * Отправить WebSocket событие о добавлении в очередь
	 *
	 * @param {Object} distribution - Рассылка
	 * @param {number} position - Позиция в очереди
	 */
	async emitQueuedEvent(distribution, position) {
		const eventData = {
			distributionId: distribution.distributionId,
			id: distribution._id,
			status: 'queued',
			accountEmail: distribution.luxeeAccount?.luxeeEmail || 'Unknown',
			profileName: distribution.config?.profileName || 'N/A',
			distributionType: distribution.config?.distributionType || 'chat',
			sentMessagesCount: 0,
			skippedClientsCount: 0,
			queuePosition: position,
			queuedAt: distribution.queuedAt?.toISOString(),
			createdAt: distribution.createdAt?.toISOString(),
		};

		// Отправить владельцу аккаунта
		socketService.emitToUserAndAdmins(
			distribution.user._id?.toString() || distribution.user.toString(),
			'spambot:distribution:queued',
			eventData,
		);
	}

	/**
	 * Запустить следующую рассылку из очереди (если есть)
	 * Вызывается после завершения текущей рассылки
	 *
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object|null>} - Запущенная рассылка или null
	 */
	async startNextInQueue(accountId) {
		console.log(`[Queue Service] 🔍 Checking queue for account ${accountId}`);

		// Проверить есть ли что-то в очереди
		const next = await this.getNextInQueue(accountId);

		if (!next) {
			console.log(`[Queue Service] ✅ Queue is empty for account ${accountId}`);
			return null;
		}

		console.log(
			`[Queue Service] 🚀 Starting next distribution: ${next.distributionId}`,
		);

		try {
			// Импортировать SpambotService динамически чтобы избежать циклических зависимостей
			const { default: spambotService } = await import('./spambotService.js');

			// Запустить через Python Service
			const account = next.luxeeAccount;
			const config = next.config;

			console.log(`[Queue Service] 🔧 DEBUG: account =`, account);
			console.log(`[Queue Service] 🔧 DEBUG: account.luxeeEmail =`, account.luxeeEmail);
			console.log(`[Queue Service] 🔧 DEBUG: account.luxeePassword =`, account.luxeePassword);
			console.log(`[Queue Service] 🔧 DEBUG: config.distributionType = ${config.distributionType}`);
			console.log(`[Queue Service] 🔧 DEBUG: config.mailMessage =`, config.mailMessage);
			console.log(`[Queue Service] 🔧 DEBUG: config.messages =`, config.messages);

			// Подготовить конфигурацию для Python Service
			// ✅ FIX: Явно мапим только нужные поля (text, interval) без Mongoose метаданных (_id)
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
				exclude_ids: Array.isArray(config.excludeIds) ? config.excludeIds : [],
				specific_users: Array.isArray(config.specificUsers) ? config.specificUsers : [],
				limit: Number(config.limit),
				filter_update_limit: Number(config.filterUpdateLimit),
				max_time_minutes: Number(config.maxTimeMinutes) || 180,
			};

			// ✅ FIX: Добавляем messages или mail_message в зависимости от типа
			// Для 'chat' - добавляем messages
			// Для 'mail' - добавляем mail_message
			// НЕ добавляем оба одновременно!
			if (config.distributionType === 'chat') {
				fullConfig.messages = config.messages?.map(m => ({
					text: String(m.text),
					interval: Number(m.interval) || 0,
				})) || [];
				fullConfig.mail_message = null;
			} else if (config.distributionType === 'mail') {
				fullConfig.messages = null;
				// Для mail проверяем что есть title и text
				if (config.mailMessage && config.mailMessage.title && config.mailMessage.text) {
					fullConfig.mail_message = {
						title: String(config.mailMessage.title),
						text: String(config.mailMessage.text),
						pictures_number: Array.isArray(config.mailMessage.picturesNumber)
							? config.mailMessage.picturesNumber
							: [],
					};
				} else {
					throw new Error('mail_message requires title and text for mail distribution type');
				}
			}

			console.log(`[Queue Service] 📤 Sending to Python service:`, JSON.stringify(fullConfig, null, 2));

			// Запустить в Python Service
			const axios = (await import('axios')).default;
			const PYTHON_SERVICE_URL =
				process.env.SPAMBOT_SERVICE_URL || 'http://localhost:8001';

		const response = await axios.post(
			`${PYTHON_SERVICE_URL}/api/distribution/start`,
			fullConfig,
			{ timeout: 30000 },
		);

		const { distribution_id } = response.data;

		// ✅ FIX: Обновить distributionId и статус в MongoDB
		next.distributionId = distribution_id;
		next.status = 'running';
		next.startedAt = new Date();
		await next.save();

			console.log(
				`[Queue Service] ✅ Distribution ${next.distributionId} started from queue`,
			);

			// Отправить WebSocket событие
			socketService.emitDistributionStarted(next.user._id.toString(), {
				distributionId: next.distributionId,
				id: next._id,
				status: 'running',
				accountEmail: account.luxeeEmail,
				profileName: config.profileName || 'N/A',
				distributionType: config.distributionType || 'chat',
				sentMessagesCount: 0,
				skippedClientsCount: 0,
				createdAt: next.createdAt?.toISOString(),
				startedAt: next.startedAt?.toISOString(),
			});

			return next;
		} catch (error) {
			console.error(
				`[Queue Service] ❌ Error starting next distribution:`,
				error.message,
			);

			// Обновить статус на error
			next.status = 'error';
			next.errorMessage = `Failed to start from queue: ${error.message}`;
			next.completedAt = new Date();
			await next.save();

			// Отправить WebSocket событие об ошибке
			socketService.emitDistributionError(next.user._id.toString(), {
				distributionId: next.distributionId,
				id: next._id,
				status: 'error',
				errorMessage: next.errorMessage,
				accountEmail: next.luxeeAccount.luxeeEmail,
				profileName: next.config?.profileName || 'N/A',
				distributionType: next.config?.distributionType || 'chat',
			});

			// Попробовать запустить следующую в очереди
			console.log(
				`[Queue Service] 🔄 Trying to start next distribution after error...`,
			);
			return await this.startNextInQueue(accountId);
		}
	}

	/**
	 * Удалить рассылку из очереди
	 *
	 * @param {string} distributionId - ID рассылки (MongoDB _id)
	 * @param {string} userId - ID пользователя
	 * @param {string} userRole - Роль пользователя ('admin' | 'user')
	 */
	async removeFromQueue(distributionId, userId, userRole = 'user') {
		// Найти рассылку
		const query = { _id: distributionId };
		if (userRole !== 'admin') {
			query.user = userId;
		}

		const distribution = await SpambotDistributionModel.findOne(query).populate(
			'luxeeAccount user',
			'luxeeEmail email',
		);

		if (!distribution) {
			throw new Error('Distribution not found or access denied');
		}

		// Можно удалять только queued рассылки
		if (distribution.status !== 'queued') {
			throw new Error(
				`Cannot delete distribution with status: ${distribution.status}. Only queued distributions can be deleted.`,
			);
		}

		// Удалить из БД
		await SpambotDistributionModel.deleteOne({ _id: distributionId });

		console.log(
			`[Queue Service] 🗑️  Distribution removed from queue: ${distribution.distributionId}`,
		);

		// Отправить WebSocket событие об удалении
		socketService.emitToUserAndAdmins(
			distribution.user._id.toString(),
			'spambot:distribution:removed',
			{
				distributionId: distribution.distributionId,
				id: distribution._id,
				accountEmail: distribution.luxeeAccount.luxeeEmail,
				profileName: distribution.config?.profileName || 'N/A',
				timestamp: new Date().toISOString(),
			},
		);
	}
}

// Singleton instance
const spambotQueueService = new SpambotQueueService();

export default spambotQueueService;
