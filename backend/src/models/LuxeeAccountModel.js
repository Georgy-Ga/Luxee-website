import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const LuxeeAccountSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	luxeeEmail: { type: String, required: true },
	luxeePassword: { type: String, required: true },
	sessionData: { type: String }, // Сохранённая сессия браузера
	isActive: { type: Boolean, default: false },
	lastActivity: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
	aiEnabled: { type: Boolean, default: false }, // AI для этого аккаунта (пользователь может выключить)
	aiEnabledByAdmin: { type: Boolean, default: false }, // Разрешил ли админ использовать AI (по умолчанию выключен)
	aiContext: { type: String }, // ID отдельного браузерного контекста для AI (для параллельной работы)
	spambotAuthenticated: { type: Boolean, default: false }, // Авторизован ли аккаунт в spambot service
});

export default model('LuxeeAccount', LuxeeAccountSchema);
