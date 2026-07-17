/**
 * Spambot Polling Service
 * 
 * Периодически опрашивает Python Spambot Service для получения 
 * актуальных статусов активных рассылок и отправляет обновления через WebSocket
 */

import SpambotDistributionModel from '../models/SpambotDistributionModel.js';
import SpambotService from './SpambotService.js';
import socketService from './socketService.js';

class SpambotPollingService {
	constructor() {
		this.pollingInterval = null;
		this.isPolling = false;
		this.pollIntervalMs = 10000; // 10 секунд
	}

	/**
	 * Запустить polling
	 */
	start() {
		if (this.isPolling) {
			console.log('[Spambot Polling] Already running');
			return;
		}

		console.log(`[Spambot Polling] Starting (interval: ${this.pollIntervalMs}ms)`);
		this.isPolling = true;

		// Немедленная проверка
		this.checkActiveDistributions();

		// Периодическая проверка
		this.pollingInterval = setInterval(() => {
			this.checkActiveDistributions();
		}, this.pollIntervalMs);
	}

	/**
	 * Остановить polling
	 */
	stop() {
		if (!this.isPolling) {
			return;
		}

		console.log('[Spambot Polling] Stopping');
		this.isPolling = false;

		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * Проверить все активные рассылки
	 */
	async checkActiveDistributions() {
		try {
			// Найти все активные рассылки (running)
			const activeDistributions = await SpambotDistributionModel.find({
				status: 'running'
			}).populate('user luxeeAccount');

			if (activeDistributions.length === 0) {
				return;
			}

			console.log(`[Spambot Polling] Checking ${activeDistributions.length} active distributions`);

			// Проверить каждую рассылку
			for (const distribution of activeDistributions) {
				await this.checkDistributionStatus(distribution);
			}

		} catch (error) {
			console.error('[Spambot Polling] Error checking distributions:', error);
		}
	}

	/**
	 * Проверить статус конкретной рассылки
	 */
	async checkDistributionStatus(distribution) {
		try {
			// Получить актуальный статус из Python Service
			const status = await SpambotService.getDistributionStatus(
				distribution._id,
				distribution.user._id
			);

			// Проверить изменился ли статус
			const statusChanged = 
				distribution.status !== status.status ||
				distribution.sentMessagesCount !== status.sentMessagesCount ||
				distribution.skippedClientsCount !== status.skippedClientsCount;

			if (statusChanged) {
				console.log(
					`[Spambot Polling] Status update for ${distribution.distributionId}: ` +
					`${distribution.status} -> ${status.status}, ` +
					`sent: ${distribution.sentMessagesCount} -> ${status.sentMessagesCount}`
				);

				// Отправить WebSocket событие пользователю
				const eventName = status.status === 'completed' 
					? 'spambot:distribution:completed'
					: status.status === 'error'
					? 'spambot:distribution:error'
					: 'spambot:distribution:status';

				socketService.emitToUser(distribution.user._id, eventName, {
					distributionId: distribution.distributionId,
					id: distribution._id,
					status: status.status,
					sentMessagesCount: status.sentMessagesCount,
					skippedClientsCount: status.skippedClientsCount,
					currentClient: status.currentClient,
					errorMessage: status.errorMessage,
					accountEmail: distribution.luxeeAccount.luxeeEmail,
					timestamp: new Date().toISOString()
				});
			}

		} catch (error) {
			console.error(
				`[Spambot Polling] Error checking distribution ${distribution.distributionId}:`,
				error.message
			);

			// Если Python Service недоступен или рассылка не найдена,
			// возможно она уже завершена - проверим статус в Python
			if (error.message.includes('not found') || error.message.includes('not available')) {
				// Попробуем получить финальный статус
				try {
					const finalStatus = await SpambotService.getDistributionStatus(
						distribution._id,
						distribution.user._id
					);

					if (['completed', 'error'].includes(finalStatus.status)) {
						console.log(
							`[Spambot Polling] Distribution ${distribution.distributionId} ` +
							`finished with status: ${finalStatus.status}`
						);

						socketService.emitToUser(distribution.user._id, 'spambot:distribution:completed', {
							distributionId: distribution.distributionId,
							id: distribution._id,
							status: finalStatus.status,
							sentMessagesCount: finalStatus.sentMessagesCount,
							skippedClientsCount: finalStatus.skippedClientsCount,
							accountEmail: distribution.luxeeAccount.luxeeEmail,
							timestamp: new Date().toISOString()
						});
					}
				} catch (finalError) {
					console.error(
						`[Spambot Polling] Failed to get final status for ${distribution.distributionId}:`,
						finalError.message
					);
				}
			}
		}
	}
}

// Singleton instance
const spambotPollingService = new SpambotPollingService();

export default spambotPollingService;
