import socketService from '../services/socketService.js';
import spambotService from '../services/spambotService.js';

/**
 * Spambot Controller
 *
 * Обрабатывает HTTP запросы для рассылок
 */

class SpambotController {
	/**
	 * GET /api/spambot/profiles?accountId=X
	 *
	 * Получить список профилей для аккаунта
	 */
	async getProfiles(req, res) {
		try {
			const { accountId } = req.query;
			const userId = req.user.id;

			if (!accountId) {
				return res.status(400).json({
					success: false,
					message: 'accountId is required',
				});
			}

			const profiles = await spambotService.getProfiles(accountId, userId);

			res.json({
				success: true,
				profiles,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error in getProfiles:', error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/admin/accounts
	 *
	 * ADMIN: Получить все Luxee аккаунты, сгруппированные по пользователям
	 */
	async getAdminAccounts(req, res) {
		try {
			const accounts = await spambotService.getAllAccountsGroupedByUser();

			res.json({
				success: true,
				accounts,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error in getAdminAccounts:', error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/admin/distributions
	 *
	 * ADMIN: Получить все рассылки всех пользователей
	 */
	async getAdminDistributions(req, res) {
		try {
			const { status, userId, limit } = req.query;

			const filters = {};
			if (status) filters.status = status;
			if (userId) filters.userId = userId;
			if (limit) filters.limit = parseInt(limit);

			const distributions = await spambotService.getAllDistributions(filters);

			res.json({
				success: true,
				distributions,
			});
		} catch (error) {
			console.error(
				'[Spambot Controller] Error in getAdminDistributions:',
				error,
			);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/admin/profiles?accountId=X
	 *
	 * ADMIN: Получить профили для любого аккаунта
	 */
	async getAdminProfiles(req, res) {
		try {
			const { accountId } = req.query;

			if (!accountId) {
				return res.status(400).json({
					success: false,
					message: 'accountId is required',
				});
			}

			const profiles = await spambotService.getProfilesAdmin(accountId);

			res.json({
				success: true,
				profiles,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error in getAdminProfiles:', error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/accounts/:accountId/availability
	 *
	 * Проверить доступность аккаунта для рассылки
	 */
	async checkAccountAvailability(req, res) {
		try {
			const { accountId } = req.params;

			const availability =
				await spambotService.checkAccountAvailability(accountId);

			res.json({
				success: true,
				...availability,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error checking availability:', error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * POST /api/spambot/distributions
	 *
	 * Создать и запустить новую рассылку
	 *
	 * Body: {
	 *   accountId: string,
	 *   config: {
	 *     profileUid: string,
	 *     profileName: string,
	 *     distributionType: 'chat' | 'mail',
	 *     messages: [{text, interval}],
	 *     mailMessage: {title, text, picturesNumber},
	 *     purchased: boolean,
	 *     free: boolean,
	 *     onlyEmptyChat: boolean,
	 *     onlyNotEmptyChat: boolean,
	 *     excludeIds: number[],
	 *     specificUsers: number[],
	 *     limit: number,
	 *     filterUpdateLimit: number,
	 *     maxTimeMinutes: number
	 *   }
	 * }
	 */
	async createDistribution(req, res) {
		try {
			const { accountId, config } = req.body;
			const userId = req.user.id;

			// DEBUG: Логирование входящих данных
			console.log('[Spambot Controller] createDistribution called');
			console.log('[Spambot Controller] accountId:', accountId);
			console.log(
				'[Spambot Controller] config:',
				JSON.stringify(config, null, 2),
			);
			console.log('[Spambot Controller] userId:', userId);

			// Валидация
			if (!accountId) {
				console.log('[Spambot Controller] ERROR: accountId is missing');
				return res.status(400).json({
					success: false,
					message: 'accountId is required',
				});
			}

			if (!config) {
				console.log('[Spambot Controller] ERROR: config is missing');
				return res.status(400).json({
					success: false,
					message: 'config is required',
				});
			}

			// Валидация конфигурации
			const requiredFields = [
				'profileUid',
				'profileName',
				'distributionType',
				'limit',
				'filterUpdateLimit',
			];
			for (const field of requiredFields) {
				if (!config[field]) {
					console.log(`[Spambot Controller] ERROR: config.${field} is missing`);
					console.log(
						`[Spambot Controller] config.${field} value:`,
						config[field],
					);
					return res.status(400).json({
						success: false,
						message: `config.${field} is required`,
					});
				}
			}

			// Проверка типа и сообщений
			if (
				config.distributionType === 'chat' &&
				(!config.messages || config.messages.length === 0)
			) {
				console.log('[Spambot Controller] ERROR: messages missing for chat');
				console.log('[Spambot Controller] config.messages:', config.messages);
				return res.status(400).json({
					success: false,
					message: 'messages are required for chat distribution',
				});
			}

			if (config.distributionType === 'mail' && !config.mailMessage) {
				return res.status(400).json({
					success: false,
					message: 'mailMessage is required for mail distribution',
				});
			}

			// Запустить рассылку
			const userRole = req.user.role;
			const distribution = await spambotService.startDistribution({
				accountId,
				userId,
				userRole,
				config,
			});

		// Отправить WebSocket событие о запуске
		// ВАЖНО: Конвертируем Date в ISO строки для правильной передачи через WebSocket
		socketService.emitDistributionStarted(userId, {
			distributionId: distribution.distributionId,
			id: distribution.id,
			status: distribution.status,
			accountEmail: distribution.accountEmail,
			profileName: distribution.config?.profileName || 'N/A',
			distributionType: distribution.config?.distributionType || 'chat',
			sentMessagesCount: distribution.sentMessagesCount || 0,
			skippedClientsCount: distribution.skippedClientsCount || 0,
			createdAt: distribution.createdAt?.toISOString() || new Date().toISOString(),
			startedAt: distribution.startedAt?.toISOString() || new Date().toISOString(),
		});

			res.status(201).json({
				success: true,
				distribution,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error creating distribution:', error);

			// Если аккаунт занят
			if (error.message.includes('active distribution')) {
				return res.status(409).json({
					success: false,
					message: error.message,
					code: 'ACCOUNT_BUSY',
				});
			}

			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/distributions
	 *
	 * Получить список рассылок
	 * - Для обычных пользователей: только свои рассылки
	 * - Для админов: все рассылки всех пользователей
	 *
	 * Query params:
	 * - accountId?: string (фильтр по аккаунту)
	 * - status?: string (фильтр по статусу)
	 * - limit?: number (количество)
	 */
	async getDistributions(req, res) {
		try {
			const userId = req.user.id;
			const userRole = req.user.role;
			const { accountId, status, limit } = req.query;

			console.log(
				`[Spambot Controller] 📋 getDistributions called by user ${userId} (role: ${userRole})`,
			);
			console.log(
				`[Spambot Controller] 📋 Filters: accountId=${accountId}, status=${status}, limit=${limit}`,
			);

			let distributions;

			// Админ получает ВСЕ рассылки
			if (userRole === 'admin') {
				console.log(
					'[Spambot Controller] 👑 Admin detected, fetching ALL distributions',
				);
				distributions = await spambotService.getAllDistributions({
					accountId,
					status,
					limit: limit ? parseInt(limit) : 100,
				});
				console.log(
					`[Spambot Controller] ✅ Admin: Found ${distributions.length} distributions (all users)`,
				);
			}
			// Обычный пользователь получает только свои
			else {
				console.log(
					'[Spambot Controller] 👤 Regular user, fetching own distributions',
				);
				distributions = await spambotService.getUserDistributions(userId, {
					accountId,
					status,
					limit: limit ? parseInt(limit) : 50,
				});
				console.log(
					`[Spambot Controller] ✅ User: Found ${distributions.length} distributions`,
				);
			}

			// Детальное логирование первой рассылки
			if (distributions.length > 0) {
				console.log(
					'[Spambot Controller] 📊 First distribution sample:',
					JSON.stringify(distributions[0], null, 2),
				);
			}

			res.json({
				success: true,
				distributions,
			});
		} catch (error) {
			console.error(
				'[Spambot Controller] ❌ Error getting distributions:',
				error,
			);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * GET /api/spambot/distributions/:id/status
	 *
	 * Получить статус рассылки
	 */
	async getDistributionStatus(req, res) {
		try {
			const { id } = req.params;
			const userId = req.user.id;

			const status = await spambotService.getDistributionStatus(id, userId);

			res.json({
				success: true,
				...status,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error getting status:', error);

			if (error.message.includes('not found')) {
				return res.status(404).json({
					success: false,
					message: error.message,
				});
			}

			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}

	/**
	 * POST /api/spambot/distributions/:id/stop
	 *
	 * Остановить рассылку
	 */
	async stopDistribution(req, res) {
		try {
			const { id } = req.params;
			const userId = req.user.id;
			const userRole = req.user.role;

			const result = await spambotService.stopDistribution(
				id,
				userId,
				userRole,
			);

			res.json({
				success: true,
				...result,
			});
		} catch (error) {
			console.error('[Spambot Controller] Error stopping distribution:', error);

			if (error.message.includes('not found')) {
				return res.status(404).json({
					success: false,
					message: error.message,
				});
			}

			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	}
}

export default new SpambotController();
