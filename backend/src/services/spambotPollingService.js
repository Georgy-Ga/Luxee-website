/**
 * Spambot Polling Service
 * 
 * Периодически опрашивает Python Spambot Service для получения 
 * актуальных статусов активных рассылок и отправляет обновления через WebSocket
 */

import SpambotDistributionModel from '../models/SpambotDistributionModel.js';
import SpambotService from './spambotService.js';
import socketService from './socketService.js';
import spambotQueueService from './SpambotQueueService.js';

class SpambotPollingService {
	constructor() {
		this.pollingInterval = null;
		this.isPolling = false;
		this.pollIntervalMs = 10000; // 10 секунд
	}

	/**
	 * Восстановить потерянные обновления при старте
	 */
	async recoverLostUpdates() {
		try {
			console.log('[Spambot Polling] 🔄 Checking for lost updates...');
			
			// Найти все рассылки со статусом running в MongoDB
			const runningDistributions = await SpambotDistributionModel.find({
				status: 'running'
			}).populate('user luxeeAccount');
			
			if (runningDistributions.length === 0) {
				console.log('[Spambot Polling] ✅ No running distributions to recover');
				return;
			}
			
			console.log(`[Spambot Polling] 🔍 Found ${runningDistributions.length} running distributions, checking Python...`);
			
			// Проверить каждую у Python Service
			for (const distribution of runningDistributions) {
				try {
					const status = await SpambotService.getDistributionStatus(
						distribution._id,
						distribution.user._id
					);
					
					// Если статус изменился - обновляем
					if (status.status !== 'running' || 
						status.sentMessagesCount !== distribution.sentMessagesCount) {
						
						console.log(
							`[Spambot Polling] 🔧 Recovering distribution ${distribution.distributionId}: ` +
							`${distribution.status} -> ${status.status}, ` +
							`sent: ${distribution.sentMessagesCount} -> ${status.sentMessagesCount}`
						);
						
						await distribution.updateStatus({
							status: status.status,
							sent_messages_count: status.sentMessagesCount,
							skipped_clients: status.skippedClientsCount
						});
					}
				} catch (error) {
					console.error(
						`[Spambot Polling] ❌ Failed to recover ${distribution.distributionId}:`,
						error.message
					);
				}
			}
			
			console.log('[Spambot Polling] ✅ Recovery complete');
			
		} catch (error) {
			console.error('[Spambot Polling] ❌ Recovery failed:', error);
		}
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

		// Восстановление при старте
		this.recoverLostUpdates().then(() => {
			// Немедленная проверка после восстановления
			this.checkActiveDistributions();
		});

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

			console.log(`[Spambot Polling] 🔍 Checking ${activeDistributions.length} active distributions`);

			// Проверить каждую рассылку
			for (const distribution of activeDistributions) {
				await this.checkDistributionStatus(distribution);
			}

		} catch (error) {
			console.error('[Spambot Polling] ❌ Error checking distributions:', error);
		}
	}

	/**
	 * Проверить статус конкретной рассылки
	 */
	async checkDistributionStatus(distribution) {
		try {
			console.log(`[Spambot Polling] 📡 Fetching status for distribution ${distribution.distributionId} (user: ${distribution.user.email})`);

			// Получить актуальный статус из Python Service
			const status = await SpambotService.getDistributionStatus(
				distribution._id,
				distribution.user._id
			);

			console.log(`[Spambot Polling] 📊 Status received: ${status.status}, sent: ${status.sentMessagesCount}, skipped: ${status.skippedClientsCount}`);

			// Проверить изменился ли статус
			const statusChanged = 
				distribution.status !== status.status ||
				distribution.sentMessagesCount !== status.sentMessagesCount ||
				distribution.skippedClientsCount !== status.skippedClientsCount;

			if (statusChanged) {
				console.log(`[Spambot Polling] 🔄 Status changed for distribution ${distribution.distributionId}`);
				console.log(`[Spambot Polling] 🔄 Old: status=${distribution.status}, sent=${distribution.sentMessagesCount}, skipped=${distribution.skippedClientsCount}`);
				console.log(`[Spambot Polling] 🔄 New: status=${status.status}, sent=${status.sentMessagesCount}, skipped=${status.skippedClientsCount}`);
				console.log(
					`[Spambot Polling] Status update for ${distribution.distributionId}: ` +
					`${distribution.status} -> ${status.status}, ` +
					`sent: ${distribution.sentMessagesCount} -> ${status.sentMessagesCount}`
				);

				// Подготовить данные события
				const eventData = {
					distributionId: distribution.distributionId,
					id: distribution._id,
					status: status.status,
					sentMessagesCount: status.sentMessagesCount,
					skippedClientsCount: status.skippedClientsCount,
					currentClient: status.currentClient,
					accountEmail: distribution.luxeeAccount.luxeeEmail,
					profileName: distribution.config?.profileName || 'N/A',
					timestamp: new Date().toISOString()
				};

				// Выбрать правильный метод в зависимости от статуса
				if (status.status === 'completed') {
					// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
					socketService.emitDistributionCompleted(distribution.user._id.toString(), {
						...eventData,
						completedAt: new Date().toISOString()
					});
					
					// Запустить следующую рассылку из очереди
					console.log(`[Spambot Polling] 🎯 Distribution completed, checking queue for account ${distribution.luxeeAccount._id}`);
					await spambotQueueService.startNextInQueue(distribution.luxeeAccount._id.toString());
					
				} else if (status.status === 'error') {
					// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
					socketService.emitDistributionError(distribution.user._id.toString(), {
						...eventData,
						errorMessage: status.errorMessage || 'Unknown error'
					});
					
					// При ошибке тоже запустить следующую рассылку
					console.log(`[Spambot Polling] 💥 Distribution failed, checking queue for account ${distribution.luxeeAccount._id}`);
					await spambotQueueService.startNextInQueue(distribution.luxeeAccount._id.toString());
					
				} else if (status.status === 'running') {
					// Для progress updates используем общее событие status
					// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
					socketService.emitToUserAndAdmins(
						distribution.user._id.toString(),
						'spambot:distribution:status',
						eventData
					);
				} else {
					// Для других статусов (stopped, idle) используем общее событие
					// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
					socketService.emitToUserAndAdmins(
						distribution.user._id.toString(),
						'spambot:distribution:status',
						eventData
					);
				}
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

						// Подготовить данные с датами и дополнительными полями
						const eventData = {
							distributionId: distribution.distributionId,
							id: distribution._id,
							status: finalStatus.status,
							accountEmail: distribution.luxeeAccount.luxeeEmail,
							profileName: distribution.config?.profileName || 'N/A',
							distributionType: distribution.config?.distributionType || 'chat',
							sentMessagesCount: finalStatus.sentMessagesCount || 0,
							skippedClientsCount: finalStatus.skippedClientsCount || 0,
							createdAt: distribution.createdAt?.toISOString(),
							startedAt: distribution.startedAt?.toISOString(),
							completedAt: new Date().toISOString()
						};

						// Использовать правильные методы socketService
						if (finalStatus.status === 'completed') {
							// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
							socketService.emitDistributionCompleted(distribution.user._id.toString(), eventData);
						} else if (finalStatus.status === 'error') {
							// ВАЖНО: distribution.user._id это ObjectId, конвертируем в string
							socketService.emitDistributionError(distribution.user._id.toString(), {
								...eventData,
								errorMessage: finalStatus.errorMessage || 'Unknown error'
							});
						}
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
