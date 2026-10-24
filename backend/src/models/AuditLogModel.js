import mongoose from 'mongoose';
const { Schema, model } = mongoose;

// Лента действий: «кто включил/выключил ИИ» — видно всем сессиям одного userId.
// Пишется из AI/blacklist/spambot/auth контроллеров, читается через GET /api/audit.
const AuditLogSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		actorEmail: { type: String, default: null },
		deviceName: { type: String, default: null },
		action: { type: String, required: true, index: true },
		accountId: { type: Schema.Types.ObjectId, ref: 'LuxeeAccount', default: null },
		detail: { type: String, default: null },
		meta: { type: Schema.Types.Mixed, default: undefined },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

// Лента хранится 90 дней, чтобы не раздувать БД.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default model('AuditLog', AuditLogSchema);
