import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Модель шаблона рассылки Spambot
 *
 * Шаблон привязан к luxee-аккаунту (account) и его владельцу (user).
 * Один шаблон содержит две НЕЗАВИСИМЫЕ секции (chat / mail), каждую можно
 * заполнить отдельно или обе сразу. Каждая секция хранит собственные
 * глобальные настройки + список анкет с контентом (у chat — массив сообщений,
 * у mail — title/text/picturesNumber).
 */

// Глобальные настройки секции (тот же набор, что в DistributionForm)
const TemplateSettingsSchema = new Schema(
	{
		purchased: { type: Boolean, default: true },
		free: { type: Boolean, default: true },
		onlyEmptyChat: { type: Boolean, default: false },
		onlyNotEmptyChat: { type: Boolean, default: false },
		excludeIds: { type: [Number], default: [] },
		specificUsers: { type: [Number], default: [] },
		limit: { type: Number, default: 30 },
		filterUpdateLimit: { type: Number, default: 10 },
		maxTimeMinutes: { type: Number, default: 180 },
	},
	{ _id: false },
);

// Анкета в chat-секции: на одну анкету можно добавить НЕСКОЛЬКО сообщений
const ChatTemplateProfileSchema = new Schema(
	{
		profileUid: { type: String, required: true },
		profileName: { type: String },
		avatar: { type: String },
		messages: [
			{
				text: { type: String, default: '' },
				interval: { type: Number, default: 0 },
				_id: false,
			},
		],
	},
	{ _id: false },
);

// Анкета в mail-секции: title / text / picturesNumber
const MailTemplateProfileSchema = new Schema(
	{
		profileUid: { type: String, required: true },
		profileName: { type: String },
		avatar: { type: String },
		title: { type: String, default: '' },
		text: { type: String, default: '' },
		picturesNumber: { type: [Number], default: [] },
	},
	{ _id: false },
);

const SpambotTemplateSchema = new Schema(
	{
		// Владелец luxee-аккаунта (НЕ автор шаблона). Шаблон виден по аккаунту.
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},

		// luxee-аккаунт, под который создан шаблон
		account: {
			type: Schema.Types.ObjectId,
			ref: 'LuxeeAccount',
			required: true,
			index: true,
		},

		// Название шаблона (указывает создатель)
		name: { type: String, required: true, trim: true },

		// CHAT секция
		chat: {
			settings: { type: TemplateSettingsSchema, default: () => ({}) },
			profiles: { type: [ChatTemplateProfileSchema], default: [] },
		},

		// MAIL секция
		mail: {
			settings: { type: TemplateSettingsSchema, default: () => ({}) },
			profiles: { type: [MailTemplateProfileSchema], default: [] },
		},
	},
	{ timestamps: true },
);

// Индексы для быстрого поиска
SpambotTemplateSchema.index({ account: 1, createdAt: -1 });

export default model('SpambotTemplate', SpambotTemplateSchema);
