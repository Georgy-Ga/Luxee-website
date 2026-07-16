/**
 * SpambotService - сервис для интеграции с Python Spambot Service
 * Управляет рассылками через HTTP API Python сервиса
 */

import axios from 'axios';
import Distribution from '../models/Distribution.js';

class SpambotService {
	constructor() {
		// БЕЗОПАСНОСТЬ: Используем внутренний Docker URL, НЕ localhost
		// Это гарантирует, что запросы идут ТОЛЬКО внутри Docker сети
		this.spambotUrl = process.env.SPAMBOT_URL || 'http://luxee-spambot:8001';
		
		this.client = axios.create({
			baseURL: this.spambotUrl,
			timeout: 90000, // 90 секунд для аутентификации (Playwright медленный)
			headers: {
				'Content-Type': 'application/json',
			},
		});

		console.log(`[SpambotService] Initialized with URL: ${this.spambotUrl}`);
		console.log(`[SpambotService] 🔒 Security: Using internal Docker network only`);
	}

	/**
	 * Проверка здоровья Python Service
	 */
	async healthCheck() {
		try {
			const response = await this.client.get('/health');
			return response.data;
		} catch (error) {
			console.error('[SpambotService] Health check failed:', error.message);
			throw new Error('Spambot service is unavailable');
		}
	}

	/**
	 * Запуск рассылки
	 * @param {Object} distribution - MongoDB модель Distribution
	 * @param {Object} luxeeAccount - MongoDB модель LuxeeAccount
	 * @param {Object} cookies - Cookies из Playwright контекста
	 */
	async startDistribution(distribution, luxeeAccount, cookies) {
		try {
			console.log(`[SpambotService] Starting distribution ${distribution._id}`);

			// Формируем конфигурацию для Python Service
			// Передаём luxeeAccount чтобы получить username и password
			const config = distribution.toSpambotConfig(luxeeAccount);
			config.cookies = cookies;

			console.log(
				`[SpambotService] Config for distribution ${distribution._id}:`,
				{
					distribution_id: config.distribution_id,
					luxee_account_id: config.luxee_account_id,
					username: config.username,
					profile: config.profile.name,
				},
			);

			// Отправляем запрос на запуск
			const response = await this.client.post('/api/distribution/start', {
				config,
			});

			if (response.data.success) {
				// Обновляем статус в MongoDB
				distribution.markAsRunning();
				await distribution.save();

				console.log(
					`[SpambotService] Distribution ${distribution._id} started successfully`,
				);
				return {
					success: true,
					distribution_id: distribution._id.toString(),
				};
			} else {
				throw new Error(response.data.error || 'Failed to start distribution');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error starting distribution ${distribution._id}:`,
				error.message,
			);

			// Обновляем статус ошибки в MongoDB
			distribution.markAsError(error.message);
			await distribution.save();

			throw error;
		}
	}

	/**
	 * Остановка рассылки
	 * @param {String} distributionId - ID рассылки в MongoDB
	 */
	async stopDistribution(distributionId) {
		try {
			console.log(`[SpambotService] Stopping distribution ${distributionId}`);

			// Получаем distribution чтобы извлечь luxee_account_id
			const distribution = await Distribution.findById(distributionId).populate('luxeeAccount');
			if (!distribution) {
				throw new Error('Distribution not found');
			}

			const luxeeAccountId = distribution.luxeeAccount._id.toString();
			console.log(`[SpambotService] Luxee account ID: ${luxeeAccountId}`);

			const response = await this.client.post('/api/distribution/stop', {
				luxee_account_id: luxeeAccountId,
			});

			if (response.data.success) {
				// Обновляем статус в MongoDB
				distribution.markAsStopped();
				await distribution.save();

				console.log(
					`[SpambotService] Distribution ${distributionId} stopped successfully`,
				);
				return { success: true };
			} else {
				throw new Error(response.data.error || 'Failed to stop distribution');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error stopping distribution ${distributionId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Получение статуса рассылки
	 * @param {String} luxeeAccountId - ID Luxee аккаунта
	 */
	async getStatus(luxeeAccountId) {
		try {
			const response = await this.client.get(
				`/api/distribution/status/${luxeeAccountId}`,
			);
			return response.data;
		} catch (error) {
			console.error(
				`[SpambotService] Error getting status for account ${luxeeAccountId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Синхронизация статуса рассылки между MongoDB и Python
	 * Проверяет реальный статус в Python и исправляет MongoDB если нужно
	 * @param {String} distributionId - ID рассылки в MongoDB
	 */
	async syncDistributionStatus(distributionId) {
		try {
			console.log(`[SpambotService] 🔄 Syncing status for distribution ${distributionId}`);

			// 1. Получаем distribution из MongoDB
			const distribution = await Distribution.findById(distributionId).populate('luxeeAccount');
			if (!distribution) {
				throw new Error('Distribution not found');
			}

			const luxeeAccountId = distribution.luxeeAccount._id.toString();
			console.log(`[SpambotService] 📊 MongoDB status: ${distribution.status}`);

			// 2. Проверяем статус в Python spambot
			let pythonStatus = null;
			let pythonHasActive = false;

			try {
				const statusResponse = await this.getStatus(luxeeAccountId);
				pythonHasActive = statusResponse.is_busy || false;
				pythonStatus = statusResponse.status;
				console.log(`[SpambotService] 🐍 Python status: is_busy=${pythonHasActive}, status=`, pythonStatus);
			} catch (error) {
				console.log(`[SpambotService] ⚠️ Python status check failed (might be OK):`, error.message);
			}

			// 3. Синхронизация
			let needsUpdate = false;
			let newStatus = distribution.status;
			let errorMessage = null;

			// Если MongoDB говорит "running", но Python не знает об этой рассылке
			if (distribution.status === 'running' && !pythonHasActive) {
				console.log(`[SpambotService] ❌ DESYNC DETECTED: MongoDB says "running" but Python doesn't have it`);
				newStatus = 'error';
				errorMessage = 'Рассылка не была запущена в spambot (десинхронизация)';
				needsUpdate = true;
			}

			// Обновляем MongoDB если нужно
			if (needsUpdate) {
				console.log(`[SpambotService] 🔧 Fixing MongoDB status: ${distribution.status} -> ${newStatus}`);
				distribution.status = newStatus;
				if (errorMessage) {
					distribution.error = errorMessage;
				}
				distribution.completed_at = new Date();
				await distribution.save();

				return {
					success: true,
					fixed: true,
					old_status: 'running',
					new_status: newStatus,
					message: 'Status synchronized'
				};
			}

			console.log(`[SpambotService] ✅ Status is in sync`);
			return {
				success: true,
				fixed: false,
				status: distribution.status,
				message: 'Status is already in sync'
			};

		} catch (error) {
			console.error(
				`[SpambotService] Error syncing status for ${distributionId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Закрытие браузерного контекста
	 * @param {String} luxeeAccountId - ID Luxee аккаунта
	 */
	async closeContext(luxeeAccountId) {
		try {
			console.log(
				`[SpambotService] Closing context for account ${luxeeAccountId}`,
			);

			const response = await this.client.delete(
				`/api/distribution/context/${luxeeAccountId}`,
			);

			if (response.data.success) {
				console.log(
					`[SpambotService] Context closed for account ${luxeeAccountId}`,
				);
				return { success: true };
			} else {
				throw new Error(response.data.error || 'Failed to close context');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error closing context for account ${luxeeAccountId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Валидация конфигурации рассылки
	 * @param {Object} config - Конфигурация рассылки
	 */
	async validateConfig(config) {
		try {
			const response = await this.client.post('/api/distribution/validate', {
				config,
			});
			return response.data;
		} catch (error) {
			console.error('[SpambotService] Error validating config:', error.message);
			throw error;
		}
	}

	/**
	 * Обновление прогресса рассылки из Python Service
	 * Вызывается через webhook/callback от Python Service
	 * @param {String} distributionId - ID рассылки
	 * @param {Object} progressData - Данные прогресса
	 */
	async updateProgress(distributionId, progressData) {
		try {
			const distribution = await Distribution.findById(distributionId);
			if (!distribution) {
				throw new Error(`Distribution ${distributionId} not found`);
			}

			distribution.updateProgress(progressData);
			await distribution.save();

			console.log(
				`[SpambotService] Progress updated for distribution ${distributionId}`,
			);
			return { success: true };
		} catch (error) {
			console.error(
				`[SpambotService] Error updating progress for ${distributionId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Обработка завершения рассылки
	 * @param {String} distributionId - ID рассылки
	 * @param {String} status - Финальный статус ('completed', 'stopped', 'error')
	 * @param {String} error - Сообщение об ошибке (если есть)
	 */
	async handleCompletion(distributionId, status, error = null) {
		try {
			const distribution = await Distribution.findById(distributionId);
			if (!distribution) {
				throw new Error(`Distribution ${distributionId} not found`);
			}

			switch (status) {
				case 'completed':
					distribution.markAsCompleted();
					break;
				case 'stopped':
					distribution.markAsStopped();
					break;
				case 'error':
					distribution.markAsError(error);
					break;
				default:
					console.warn(`[SpambotService] Unknown completion status: ${status}`);
			}

			await distribution.save();

			console.log(
				`[SpambotService] Distribution ${distributionId} completed with status: ${status}`,
			);
			return { success: true };
		} catch (error) {
			console.error(
				`[SpambotService] Error handling completion for ${distributionId}:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Авторизация Luxee аккаунта в spambot
	 * @param {Object} data - Данные для авторизации
	 * @param {string} data.luxee_account_id - ID аккаунта в MongoDB
	 * @param {string} data.username - Email для входа
	 * @param {string} data.password - Пароль
	 */
	async authenticateAccount(data) {
		try {
			console.log(`[SpambotService] Authenticating account ${data.luxee_account_id}`);

			const response = await this.client.post('/api/spambot/auth', data);

			if (response.data.success) {
				console.log(
					`[SpambotService] Account ${data.luxee_account_id} authenticated. Profiles: ${response.data.profiles_count}`,
				);
				return {
					success: true,
					luxee_account_id: response.data.luxee_account_id,
					status: response.data.status,
					profiles_count: response.data.profiles_count,
				};
			} else {
				throw new Error(response.data.error || 'Authentication failed');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error authenticating account ${data.luxee_account_id}:`,
				error.message,
			);
			return {
				success: false,
				error: error.response?.data?.error || error.message,
			};
		}
	}

	/**
	 * Получение профилей для авторизованного аккаунта
	 * @param {string} luxeeAccountId - ID аккаунта в MongoDB
	 */
	async getAccountProfiles(luxeeAccountId) {
		try {
			console.log(`[SpambotService] Getting profiles for account ${luxeeAccountId}`);

			const response = await this.client.get(
				`/api/spambot/profiles/${luxeeAccountId}`,
			);

			if (response.data.success) {
				console.log(
					`[SpambotService] Found ${response.data.profiles.length} profiles for account ${luxeeAccountId}`,
				);
				return {
					success: true,
					luxee_account_id: response.data.luxee_account_id,
					profiles: response.data.profiles,
				};
			} else {
				throw new Error(response.data.error || 'Failed to get profiles');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error getting profiles for account ${luxeeAccountId}:`,
				error.message,
			);
			return {
				success: false,
				error: error.response?.data?.detail || error.message,
			};
		}
	}

	/**
	 * Проверка статуса контекста аккаунта
	 * @param {string} luxeeAccountId - ID аккаунта в MongoDB
	 */
	async getContextStatus(luxeeAccountId) {
		try {
			const response = await this.client.get(
				`/api/spambot/status/${luxeeAccountId}`,
			);
			return response.data;
		} catch (error) {
			console.error(
				`[SpambotService] Error getting context status for ${luxeeAccountId}:`,
				error.message,
			);
			return {
				success: false,
				authenticated: false,
			};
		}
	}

	/**
	 * Закрытие контекста аккаунта
	 * @param {string} luxeeAccountId - ID аккаунта в MongoDB
	 */
	async closeContext(luxeeAccountId) {
		try {
			console.log(`[SpambotService] Closing context for account ${luxeeAccountId}`);

			const response = await this.client.delete(
				`/api/spambot/context/${luxeeAccountId}`,
			);

			if (response.data.success) {
				console.log(`[SpambotService] Context closed for account ${luxeeAccountId}`);
				return { success: true };
			} else {
				throw new Error(response.data.error || 'Failed to close context');
			}
		} catch (error) {
			console.error(
				`[SpambotService] Error closing context for ${luxeeAccountId}:`,
				error.message,
			);
			return {
				success: false,
				error: error.response?.data?.detail || error.message,
			};
		}
	}
}

// Singleton instance
const spambotService = new SpambotService();

export default spambotService;
