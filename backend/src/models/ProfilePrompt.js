import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Модель для хранения кастомных промптов для профилей
 * Промпт привязывается к profileUid, не зависит от аккаунта
 */
const ProfilePromptSchema = new Schema({
	// UID профиля (из Luxee, profile.inner.uid)
	profileUid: {
		type: Number,
		required: true,
		unique: true,
		index: true,
	},

	// Имя профиля (для удобства)
	profileName: {
		type: String,
		required: true,
	},

	// Полный кастомный промпт (заменяет SYSTEM_PROMPT полностью)
	customPrompt: {
		type: String,
		required: true,
		minlength: 50,
	},

	// Дополнительные метаданные (опционально)
	metadata: {
		dateOfBirth: String,
		zodiacSign: String,
		height: String,
		weight: String,
		eyeColor: String,
		hairColor: String,
		bodyType: String,
		englishLevel: String,
		maritalStatus: String,
		children: String,
		religion: String,
		occupation: String,
		interests: [String],
		bio: String,
	},

	// Статус
	isActive: {
		type: Boolean,
		default: true,
	},

	// Timestamps
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Middleware для обновления updatedAt
ProfilePromptSchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	next();
});

// Индекс для быстрого поиска активных промптов
ProfilePromptSchema.index({ isActive: 1, profileUid: 1 });

export default model('ProfilePrompt', ProfilePromptSchema);
