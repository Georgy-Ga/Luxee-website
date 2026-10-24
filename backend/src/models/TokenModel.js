import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const TokenSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		refreshToken: { type: String, required: true, unique: true },
		// Мультисессии: один документ = одно устройство/браузер.
		// Без default: поле отсутствует у старых сессий → sparse-индекс их пропускает,
		// дубликатов по {user, null} не возникает.
		deviceId: { type: String, index: true },
		deviceName: { type: String },
		ip: { type: String },
		userAgent: { type: String },
		lastUsedAt: { type: Date, default: Date.now },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

// Один браузер = одна запись: повторный логин с тем же deviceId ротирует токен, а не плодит записи.
// sparse: не ломает старые сессии без deviceId.
TokenSchema.index({ user: 1, deviceId: 1 }, { unique: true, sparse: true });

export default model('Token', TokenSchema);