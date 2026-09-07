/**
 * Spambot Polling Service
 * 
 * Периодически опрашивает Python Spambot Service для получения 
 * актуальных статусов активных рассылок и отправляет обновления через WebSocket
 */

import SpambotDistributionModel from '../models/SpambotDistributionModel.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
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
				// Пропустить сироты — они обработаются в checkActiveDistributions
				if (!distribution.user || !distribution.luxeeAccount) {
					console.log(
						`[Spambot Polling] ⚠️  Skipping orphaned distribution ${distribution.distributionId} during recovery`
					);
					continue;
				}

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
	 * Обработать "сироту" — running-рассылку, у которой luxeeAccount или user удалены.
	 * Вызывается лениво: только когда polling пытается опросить эту рассылку.
	 * - Аккаунт с тем же luxeeEmail найден → перепривязываем, трекинг продолжается как обычно.
	 * - Аккаунта нет → running уходит в error с понятным текстом "аккаунт удалён",
	 *   а queued-сироты с тем же email каскадно удаляются (пробуем найти → нету → удаляем).
	 */
	async handleOrphanedDistribution(distribution) {
		const accountEmail = distribution.accountEmail || 'Unknown';
		const hasAccount = !!distribution.luxeeAccount;
		const hasUser = !!distribution.user;

		console.log(
			`[Spambot Polling] 🔗 Orphaned running distribution ${distribution.distributionId}: ` +
			`account=${hasAccount ? 'OK' : 'DELETED'}, user=${hasUser ? 'OK' : 'DELETED'}, email=${accountEmail}`
		);

		// Один поиск аккаунта на весь проход
		let newAccount = null;
		if (accountEmail !== 'Unknown') {
			newAccount = await LuxeeAccountModel.findOne({ luxeeEmail: accountEmail });
		}

		// Аккаунт с таким email существует (пересоздан) — перепривязать и продолжить трекинг
		if (newAccount) {
			distribution.luxeeAccount = newAccount._id;
			distribution.user = newAccount.user;
			await distribution.save();

			console.log(
				`[Spambot Polling] ✅ Rebound orphaned distribution ${distribution.distributionId} ` +
				`to account ${newAccount._id} (${newAccount.luxeeEmail}). Tracking resumes.`
			);
			return;
		}

		// Аккаунта нет — running уходит в error с понятным текстом
		console.log(
			`[Spambot Polling] 💥 No account for email '${accountEmail}'. ` +
			`Marking orphaned distribution ${distribution.distributionId} as error.`
		);

		// Best-effort: остановить задачу в Python (могла продолжать работать)
		try {
			const axios = (await import('axios')).default;
			const PYTHON_SERVICE_URL = process.env.SPAMBOT_SERVICE_URL || 'http://localhost:8001';
			await axios.post(
				`${PYTHON_SERVICE_URL}/api/distribution/${distribution.distributionId}/stop`,
				{},
				{ timeout: 5000 },
			);
		} catch (stopError) {
			console.log(
				`[Spambot Polling] ⚠️  Python stop failed for ${distribution.distributionId} (ignored):`,
				stopError.message
			);
		}

		const errorMessage = `Luxee account '${accountEmail}' was deleted.`;
		distribution.status = 'error';
		distribution.errorMessage = errorMessage;
		distribution.completedAt = new Date();
		await distribution.save();

		const ownerId = distribution.user?._id?.toString() || distribution.user?.toString();
		socketService.emitDistributionError(ownerId, {
			distributionId: distribution.distributionId,
			id: distribution._id,
			status: 'error',
			errorMessage,
			accountEmail,
			profileName: distribution.config?.profileName || 'N/A',
			distributionType: distribution.config?.distributionType || 'chat',
			sentMessagesCount: distribution.sentMessagesCount || 0,
			skippedClientsCount: distribution.skippedClientsCount || 0,
		});

		// Каскад: queued-сироты с тем же email — аккаунта нет, удаляем полностью.
		// Живые (не сироты) не трогаем.
		if (accountEmail === 'Unknown') {
			return;
		}

		const queuedOrphans = await SpambotDistributionModel.find({
			accountEmail,
			status: 'queued',
		}).populate('luxeeAccount');

		for (const queued of queuedOrphans) {
			if (queued.luxeeAccount) {
				continue;
			}

			console.log(
				`[Spambot Polling] 🗑️  Cascading delete of queued orphan ${queued.distributionId} (${accountEmail})`
			);

			const queuedOwnerId = queued.user?._id?.toString() || queued.user?.toString();
			await SpambotDistributionModel.deleteOne({ _id: queued._id });

			socketService.emitToUserAndAdmins(
				queuedOwnerId,
				'spambot:distribution:removed',
				{
					distributionId: queued.distributionId,
					id: queued._id,
					accountEmail,
					profileName: queued.config?.profileName || 'N/A',
					timestamp: new Date().toISOString(),
				},
			);
		}
	}

	/**
	 * Проверить статус конкретной рассылки
	 */
	async checkDistributionStatus(distribution) {
		// Проверить не является ли рассылка "сиротой" (удалённый аккаунт или юзер)
		if (!distribution.luxeeAccount || !distribution.user) {
			await this.handleOrphanedDistribution(distribution);
			return;
		}

		const accountEmail = distribution.luxeeAccount?.luxeeEmail || distribution.accountEmail || 'Unknown';
		const userId = distribution.user?._id?.toString() || distribution.user?.toString();

		try {
			console.log(`[Spambot Polling] 📡 Fetching status for distribution ${distribution.distributionId} (user: ${distribution.user?.email || 'Unknown'})`);

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
					accountEmail,
					profileName: distribution.config?.profileName || 'N/A',
					timestamp: new Date().toISOString()
				};

				// Выбрать правильный метод в зависимости от статуса
				if (status.status === 'completed') {
					socketService.emitDistributionCompleted(userId, {
						...eventData,
						completedAt: new Date().toISOString()
					});
					
					// Запустить следующую рассылку из очереди
					console.log(`[Spambot Polling] 🎯 Distribution completed, checking queue for account ${distribution.luxeeAccount._id}`);
					await spambotQueueService.startNextInQueue(distribution.luxeeAccount._id.toString());
					
				} else if (status.status === 'error') {
					socketService.emitDistributionError(userId, {
						...eventData,
						errorMessage: status.errorMessage || 'Unknown error'
					});
					
					// При ошибке тоже запустить следующую рассылку
					console.log(`[Spambot Polling] 💥 Distribution failed, checking queue for account ${distribution.luxeeAccount._id}`);
					await spambotQueueService.startNextInQueue(distribution.luxeeAccount._id.toString());
					
				} else if (status.status === 'running') {
					socketService.emitToUserAndAdmins(
						userId,
						'spambot:distribution:status',
						eventData
					);
				} else {
					socketService.emitToUserAndAdmins(
						userId,
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

			// Если Python Service недоступен или рассылка не найдена
			if (error.message.includes('not found') || error.message.includes('not available')) {
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

						const eventData = {
							distributionId: distribution.distributionId,
							id: distribution._id,
							status: finalStatus.status,
							accountEmail,
							profileName: distribution.config?.profileName || 'N/A',
							distributionType: distribution.config?.distributionType || 'chat',
							sentMessagesCount: finalStatus.sentMessagesCount || 0,
							skippedClientsCount: finalStatus.skippedClientsCount || 0,
							createdAt: distribution.createdAt?.toISOString(),
							startedAt: distribution.startedAt?.toISOString(),
							completedAt: new Date().toISOString()
						};

						if (finalStatus.status === 'completed') {
							socketService.emitDistributionCompleted(userId, eventData);
						} else if (finalStatus.status === 'error') {
							socketService.emitDistributionError(userId, {
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
