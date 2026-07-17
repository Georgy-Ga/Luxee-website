/**
 * Сервис управления Socket.io
 * Singleton для управления WebSocket соединениями и broadcast событий
 * Используется для real-time синхронизации AI статусов
 */

import { SOCKET_EVENTS } from '../config/socket.js';

class SocketService {
	constructor() {
		this.io = null;
		this.connectedUsers = new Map(); // userId -> Set of socketIds
	}

	/**
	 * Инициализация Socket.io instance
	 * @param {Server} io - Socket.io server instance
	 */
	initialize(io) {
		if (this.io) {
			console.warn('[Socket Service] Already initialized');
			return;
		}

		this.io = io;
		console.log('[Socket Service] ✓ Initialized');

		// Настраиваем обработчики соединений
		this.setupConnectionHandlers();
	}

	/**
	 * Настройка обработчиков подключения/отключения
	 */
	setupConnectionHandlers() {
		this.io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
			const userId = socket.userId;
			const socketId = socket.id;

			// Добавляем пользователя в список подключенных
			if (!this.connectedUsers.has(userId)) {
				this.connectedUsers.set(userId, new Set());
			}
			this.connectedUsers.get(userId).add(socketId);

			console.log(`[Socket Service] User connected: ${userId} (socket: ${socketId}), total connections: ${this.connectedUsers.get(userId).size}`);

			// Обработка отключения
			socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
				this.handleDisconnect(userId, socketId, reason);
			});
		});
	}

	/**
	 * Обработка отключения пользователя
	 */
	handleDisconnect(userId, socketId, reason) {
		const userSockets = this.connectedUsers.get(userId);
		if (userSockets) {
			userSockets.delete(socketId);
			if (userSockets.size === 0) {
				this.connectedUsers.delete(userId);
			}
		}

		console.log(`[Socket Service] User disconnected: ${userId} (socket: ${socketId}), reason: ${reason}`);
	}

	/**
	 * Проверка инициализации
	 */
	ensureInitialized() {
		if (!this.io) {
			console.error('[Socket Service] Not initialized! Call initialize() first.');
			return false;
		}
		return true;
	}

	/**
	 * Broadcast события всем подключенным клиентам
	 * @param {string} event - Название события
	 * @param {Object} data - Данные для отправки
	 */
	broadcastToAll(event, data) {
		if (!this.ensureInitialized()) return;

		this.io.emit(event, data);
		console.log(`[Socket Service] Broadcast to all: ${event}`, data);
	}

	/**
	 * Отправить событие конкретному пользователю (всем его соединениям)
	 * @param {string} userId - ID пользователя
	 * @param {string} event - Название события
	 * @param {Object} data - Данные для отправки
	 */
	emitToUser(userId, event, data) {
		if (!this.ensureInitialized()) return;

		const userSockets = this.connectedUsers.get(userId);
		if (!userSockets || userSockets.size === 0) {
			console.log(`[Socket Service] User ${userId} not connected, skipping emit: ${event}`);
			return;
		}

		userSockets.forEach(socketId => {
			this.io.to(socketId).emit(event, data);
		});

		console.log(`[Socket Service] Emit to user ${userId} (${userSockets.size} connections): ${event}`, data);
	}

	/**
	 * Emit события изменения AI статуса
	 * Отправляет всем подключенным клиентам для синхронизации
	 * 
	 * @param {Object} data - Данные об изменении AI статуса
	 * @param {string} data.type - Тип изменения: 'account' | 'user' | 'bulk'
	 * @param {string} data.accountId - ID аккаунта (для type='account')
	 * @param {string} data.userId - ID пользователя
	 * @param {boolean} data.aiEnabled - Флаг AI включен пользователем
	 * @param {boolean} data.aiEnabledByAdmin - Флаг AI разрешен админом
	 * @param {string} data.changedBy - Кто изменил: 'admin' | 'user'
	 */
	emitAIStatusChanged(data) {
		if (!this.ensureInitialized()) return;

		const event = SOCKET_EVENTS.AI_STATUS_CHANGED;

		// Broadcast всем для полной синхронизации
		this.broadcastToAll(event, {
			...data,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Emit события изменения AI для одного аккаунта
	 */
	emitAccountAIChanged(accountId, userId, aiEnabled, aiEnabledByAdmin, changedBy = 'user') {
		this.emitAIStatusChanged({
			type: 'account',
			accountId,
			userId,
			aiEnabled,
			aiEnabledByAdmin,
			changedBy
		});
	}

	/**
	 * Emit события массового изменения AI (toggle all)
	 */
	emitBulkAIChanged(userId, accounts, changedBy = 'user') {
		this.emitAIStatusChanged({
			type: 'bulk',
			userId,
			accounts, // Array of { accountId, aiEnabled, aiEnabledByAdmin }
			changedBy
		});
	}

	/**
	 * Emit события создания нового Luxee аккаунта
	 * Используется для динамического обновления списка аккаунтов в админ-панели
	 */
	emitAccountCreated(userId, accountData) {
		if (!this.ensureInitialized()) return;

		const event = 'luxee:account:created';

		// Broadcast всем для синхронизации (админы видят все аккаунты)
		this.broadcastToAll(event, {
			userId,
			account: accountData,
			timestamp: new Date().toISOString()
		});

	console.log(`[Socket Service] Emitted account created: userId=${userId}, accountId=${accountData._id}`);
}

/**
 * Emit события удаления Luxee аккаунта для синхронизации с админ-панелью
 * @param {string} userId - ID пользователя
 * @param {string} accountId - ID удалённого аккаунта
 */
emitAccountDeleted(userId, accountId) {
	if (!this.io) {
		console.error('[Socket Service] Socket.io not initialized');
		return;
	}

	const eventData = {
		userId,
		accountId,
		timestamp: new Date().toISOString(),
	};

	console.log(`[Socket Service] Broadcast to all: luxee:account:deleted`, eventData);

	// Broadcast всем подключенным клиентам
	this.io.emit('luxee:account:deleted', eventData);

	console.log(`[Socket Service] Emitted account deleted: userId=${userId}, accountId=${accountId}`);
}

/**
 * Получить количество подключенных пользователей
 */
getConnectedUsersCount() {
	return this.connectedUsers.size;
}

	/**
	 * Получить количество всех соединений
	 */
	getTotalConnectionsCount() {
		let total = 0;
		this.connectedUsers.forEach(sockets => {
			total += sockets.size;
		});
		return total;
	}

	/**
	 * Проверить подключен ли пользователь
	 */
	isUserConnected(userId) {
		return this.connectedUsers.has(userId) && this.connectedUsers.get(userId).size > 0;
	}

	/**
	 * Получить статистику подключений (для отладки)
	 */
	getStats() {
		return {
			connectedUsers: this.getConnectedUsersCount(),
			totalConnections: this.getTotalConnectionsCount(),
			userConnections: Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => ({
				userId,
				connections: sockets.size
			}))
		};
	}

	/**
	 * Emit события обновления статуса рассылки (Spambot)
	 * @param {string} userId - ID пользователя-владельца
	 * @param {Object} data - Данные о статусе рассылки
	 */
	emitDistributionStatusUpdate(userId, data) {
		if (!this.ensureInitialized()) return;

		const event = SOCKET_EVENTS.DISTRIBUTION_STATUS_UPDATE;
		
		// Отправляем только владельцу рассылки
		this.emitToUser(userId, event, {
			...data,
			timestamp: new Date().toISOString()
		});

		console.log(`[Socket Service] Distribution status update sent to user ${userId}:`, data.distributionId);
	}

	/**
	 * Emit события запуска рассылки
	 */
	emitDistributionStarted(userId, distributionData) {
		if (!this.ensureInitialized()) return;

		this.emitToUser(userId, SOCKET_EVENTS.DISTRIBUTION_STARTED, {
			...distributionData,
			timestamp: new Date().toISOString()
		});

		console.log(`[Socket Service] Distribution started event sent to user ${userId}`);
	}

	/**
	 * Emit события завершения рассылки
	 */
	emitDistributionCompleted(userId, distributionData) {
		if (!this.ensureInitialized()) return;

		this.emitToUser(userId, SOCKET_EVENTS.DISTRIBUTION_COMPLETED, {
			...distributionData,
			timestamp: new Date().toISOString()
		});

		console.log(`[Socket Service] Distribution completed event sent to user ${userId}`);
	}

	/**
	 * Emit события остановки рассылки
	 */
	emitDistributionStopped(userId, distributionData) {
		if (!this.ensureInitialized()) return;

		this.emitToUser(userId, SOCKET_EVENTS.DISTRIBUTION_STOPPED, {
			...distributionData,
			timestamp: new Date().toISOString()
		});

		console.log(`[Socket Service] Distribution stopped event sent to user ${userId}`);
	}

	/**
	 * Emit события ошибки в рассылке
	 */
	emitDistributionError(userId, distributionData) {
		if (!this.ensureInitialized()) return;

		this.emitToUser(userId, SOCKET_EVENTS.DISTRIBUTION_ERROR, {
			...distributionData,
			timestamp: new Date().toISOString()
		});

		console.log(`[Socket Service] Distribution error event sent to user ${userId}`);
	}
}

// Экспортируем singleton instance
const socketService = new SocketService();

export default socketService;
