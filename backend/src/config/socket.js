/**
 * Конфигурация Socket.io для real-time коммуникации
 * Используется для синхронизации AI статусов между клиентами
 */

/**
 * Получить настройки CORS для Socket.io
 */
export const getSocketCorsConfig = () => {
	const allowedOrigins = process.env.FRONTEND_URL 
		? process.env.FRONTEND_URL.split(',')
		: ['http://localhost', 'http://localhost:80', 'http://localhost:3000'];

	return {
		origin: allowedOrigins,
		credentials: true,
		methods: ['GET', 'POST']
	};
};

/**
 * Получить настройки Socket.io server
 */
export const getSocketConfig = () => {
	return {
		cors: getSocketCorsConfig(),
		pingTimeout: 60000,
		pingInterval: 25000,
		transports: ['websocket', 'polling'],
		allowEIO3: true
	};
};

/**
 * События Socket.io для AI синхронизации
 */
export const SOCKET_EVENTS = {
	// Клиент -> Сервер
	CONNECTION: 'connection',
	DISCONNECT: 'disconnect',
	
	// Сервер -> Клиент (AI статусы)
	AI_STATUS_CHANGED: 'ai:status:changed',
	AI_ACCOUNT_CHANGED: 'ai:account:changed',
	AI_USER_CHANGED: 'ai:user:changed',
	AI_BULK_CHANGED: 'ai:bulk:changed',
	AI_SCHEDULE_CHANGED: 'ai:schedule:changed',
	
	// Сервер -> Клиент (Luxee аккаунты)
	LUXEE_ACCOUNT_CREATED: 'luxee:account:created',
	LUXEE_ACCOUNT_UPDATED: 'luxee:account:updated',
	LUXEE_ACCOUNT_DELETED: 'luxee:account:deleted',
	
	// Сервер -> Клиент (Spambot рассылки)
	DISTRIBUTION_STATUS_UPDATE: 'spambot:distribution:status',
	DISTRIBUTION_STARTED: 'spambot:distribution:started',
	DISTRIBUTION_COMPLETED: 'spambot:distribution:completed',
	DISTRIBUTION_STOPPED: 'spambot:distribution:stopped',
	DISTRIBUTION_ERROR: 'spambot:distribution:error',

	// Сервер -> Клиент (Spambot шаблоны)
	TEMPLATE_CREATED: 'spambot:template:created',
	TEMPLATE_UPDATED: 'spambot:template:updated',
	TEMPLATE_DELETED: 'spambot:template:deleted',
	
	// Сервер -> Клиент (Онлайн статус аккаунтов)
	ACCOUNTS_ONLINE_STATUS: 'luxee:accounts:online-status',
	
	// Системные
	ERROR: 'error',
	RECONNECT: 'reconnect'
};

export default {
	getSocketCorsConfig,
	getSocketConfig,
	SOCKET_EVENTS
};
