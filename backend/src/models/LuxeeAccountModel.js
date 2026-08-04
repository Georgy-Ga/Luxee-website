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
	// Ручная активность пользователя (не AI, не Spambot)
	manualLastActivity: { type: Date, default: null }, // Последняя ручная активность
	isManuallyOnline: { type: Boolean, default: false }, // Онлайн ли аккаунт (ручной режим)
	
	// Черный список для AI (игнорировать определенных мужчин)
	blacklist: {
		enabled: { type: Boolean, default: false }, // Включен ли черный список
		userIds: [{ type: String }], // Массив ID мужчин (userUid)
		categories: {
			newMessages: { type: Boolean, default: false }, // Игнорировать в новых сообщениях
			catchUp: { type: Boolean, default: false }, // Игнорировать в Catch Up
			activityCenter: { type: Boolean, default: false } // Игнорировать в Activity Center
		}
	}
});

export default model('LuxeeAccount', LuxeeAccountSchema);
