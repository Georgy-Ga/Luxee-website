import AuditLogModel from '../models/AuditLogModel.js';
import socketService from './socketService.js';
import { SOCKET_EVENTS } from '../config/socket.js';

/**
 * append-only журнал действий. Не бросает: аудит не должен ломать основной запрос.
 */
const auditService = {
	log: async ({ userId, action, accountId = null, detail = null, meta = undefined, req = null }) => {
		try {
			if (!userId || !action) return null;
			const entry = await AuditLogModel.create({
				user: userId,
				actorEmail: req?.user?.email || null,
				deviceName: req?.headers?.['x-device-name'] || null,
				action,
				accountId: accountId || null,
				detail,
				meta,
			});
			// Живое обновление: все вкладки/люди на этом userId видят событие сразу.
			try {
				socketService.emitToUser(userId.toString(), SOCKET_EVENTS.AUDIT_NEW, {
					id: entry._id.toString(),
					action: entry.action,
					accountId: entry.accountId ? entry.accountId.toString() : null,
					detail: entry.detail,
					actorEmail: entry.actorEmail,
					deviceName: entry.deviceName,
					createdAt: entry.createdAt,
				});
			} catch {
				// socket не инициализирован (тесты) — игнорируем
			}
			return entry;
		} catch (error) {
			console.error('[Audit] failed to write log:', error.message);
			return null;
		}
	},
	list: async (userId, { limit = 50, accountId = null } = {}) => {
		const q = { user: userId };
		if (accountId) q.accountId = accountId;
		const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
		return AuditLogModel.find(q).sort({ createdAt: -1 }).limit(safeLimit).lean();
	},
};

export default auditService;
