import { Schema, model } from 'mongoose';

/**
 * Модель для кеширования данных профилей Luxee
 * Данные парсятся с https://luxee.io/profile/ и /profile/update/{uid}/
 */
const LuxeeProfileSchema = new Schema({
	// Связь с аккаунтом
	accountId: {
		type: Schema.Types.ObjectId,
		ref: 'LuxeeAccount',
		required: true,
	},
	
	// UID профиля (inner UID из Luxee)
	profileUid: {
		type: Number,
		required: true,
	},
	
	// ========== Базовые данные (из списка /profile/) ==========
	username: {
		type: String,
		required: true,
	},
	
	age: {
		type: Number,
	},
	
	country: {
		type: String,
	},
	
	imageUrl: {
		type: String,
	},
	
	isDisabled: {
		type: Boolean,
		default: false,
	},
	
	// ========== Детальные данные (из /profile/update/{uid}/) ==========
	birthday: {
		type: String, // Формат: '1988-10-10'
	},
	
	city: {
		type: String,
	},
	
	bio: {
		type: String,
	},
	
	occupation: {
		type: String,
	},
	
	height: {
		type: Number,
	},
	
	weight: {
		type: Number,
	},
	
	// ========== Мета-информация ==========
	lastFetchedAt: {
		type: Date,
		default: Date.now,
	},
	
	createdAt: {
		type: Date,
		default: Date.now,
	},
	
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// ========== ИНДЕКСЫ ==========

// Уникальный индекс: один профиль на аккаунт
LuxeeProfileSchema.index({ accountId: 1, profileUid: 1 }, { unique: true });

// Индекс для поиска устаревших профилей
LuxeeProfileSchema.index({ lastFetchedAt: 1 });

// ========== MIDDLEWARE ==========

// Обновляем updatedAt при сохранении
LuxeeProfileSchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	next();
});

// ========== МЕТОДЫ ==========

/**
 * Проверить, свежие ли данные профиля
 * @param {number} ttlDays - TTL в днях (по умолчанию 2)
 * @returns {boolean}
 */
LuxeeProfileSchema.methods.isFresh = function (ttlDays = 2) {
	const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
	return Date.now() - this.lastFetchedAt.getTime() < ttlMs;
};

/**
 * Получить возраст из даты рождения
 * @returns {number|null}
 */
LuxeeProfileSchema.methods.getAge = function () {
	if (!this.birthday) return this.age || null;
	
	const birthDate = new Date(this.birthday);
	const ageDate = new Date(Date.now() - birthDate.getTime());
	return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// ========== СТАТИЧЕСКИЕ МЕТОДЫ ==========

/**
 * Получить профиль или создать запись-заглушку
 * @param {string} accountId - ID аккаунта
 * @param {number} profileUid - UID профиля
 * @param {Object} basicData - Базовые данные (username обязателен)
 * @returns {Promise<Object>}
 */
LuxeeProfileSchema.statics.getOrCreate = async function (accountId, profileUid, basicData = {}) {
	let profile = await this.findOne({ accountId, profileUid });
	
	if (!profile && basicData.username) {
		profile = await this.create({
			accountId,
			profileUid,
			...basicData,
			lastFetchedAt: new Date(0), // Принудительно устаревший
		});
	}
	
	return profile;
};

/**
 * Получить все устаревшие профили аккаунта
 * @param {string} accountId - ID аккаунта
 * @param {number} ttlDays - TTL в днях
 * @returns {Promise<Array>}
 */
LuxeeProfileSchema.statics.getStaleProfiles = async function (accountId, ttlDays = 2) {
	const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
	const staleDate = new Date(Date.now() - ttlMs);
	
	return this.find({
		accountId,
		lastFetchedAt: { $lt: staleDate },
	});
};

export default model('LuxeeProfile', LuxeeProfileSchema);
