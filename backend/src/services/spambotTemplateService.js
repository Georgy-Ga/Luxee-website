import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import SpambotTemplateModel from '../models/SpambotTemplateModel.js';
import spambotService from './spambotService.js';
import socketService from './socketService.js';

/**
 * Spambot Template Service
 *
 * Управляет шаблонами рассылок. Шаблон привязан к luxee-аккаунту:
 * любой, кто работает с аккаунтом, видит шаблоны этого аккаунта (не по автору).
 * Админ видит/создаёт/применяет шаблоны на любых аккаунтах.
 */

const MAX_CHAT_LIMIT = 30;
const MAX_MAIL_LIMIT = 10;

class SpambotTemplateService {
	/**
	 * Разрешить доступ к аккаунту (user — только свои, admin — любые).
	 * @returns {Promise<Object>} - документ LuxeeAccount
	 */
	async _resolveAccountAccess(accountId, userId, userRole) {
		const account =
			userRole === 'admin'
				? await LuxeeAccountModel.findById(accountId)
				: await LuxeeAccountModel.findOne({ _id: accountId, user: userId });

		if (!account) {
			throw new Error('Account not found or access denied');
		}

		return account;
	}

	/**
	 * Разрешить доступ к шаблону. Проверяем доступ к аккаунту, к которому он привязан.
	 * @returns {Promise<Object>} - документ SpambotTemplate
	 */
	async _resolveTemplateAccess(templateId, userId, userRole) {
		const template = await SpambotTemplateModel.findById(templateId);

		if (!template) {
			throw new Error('Template not found');
		}

		await this._resolveAccountAccess(template.account, userId, userRole);

		return template;
	}

	/**
	 * Загрузить актуальные анкеты аккаунта (существующий источник из spambotService).
	 * @returns {Promise<Array>} - список анкет { uid, name, age, location, image_url }
	 */
	async _loadAccountProfiles(account, userId, userRole) {
		if (userRole === 'admin') {
			return await spambotService.getProfilesAdmin(account._id.toString());
		}
		return await spambotService.getProfiles(account._id.toString(), userId);
	}

	/**
	 * Вернуть количество заполненных анкет (с контентом) в секции.
	 */
	_countFilledProfiles(section) {
		if (!section || !Array.isArray(section.profiles)) return 0;
		return section.profiles.filter(p => this._isProfileFilled(section, p)).length;
	}

	_isProfileFilled(section, p) {
		if (section === 'chat') {
			return Array.isArray(p.messages) && p.messages.some(m => m.text && m.text.trim());
		}
		// mail
		return Boolean(p.title && p.title.trim() && p.text && p.text.trim());
	}

	/**
	 * Сравнить profileUid из шаблона с актуальными анкетами аккаунта.
	 * ЛИШНИЕ (удалённые с аккаунта) — удаляются из обеих секций.
	 * НЕДОСТАЮЩИЕ (нет текста в шаблоне) — возвращаются для уведомления.
	 *
	 * @returns {Promise<Object>} { removed, missing }
	 */
	async _validateAndCleanup(template, account, userId, userRole) {
		let currentProfiles = [];
		try {
			currentProfiles = await this._loadAccountProfiles(account, userId, userRole);
		} catch (error) {
			// Если не удалось получить актуальные анкеты — не удаляем ничего.
			console.warn(
				'[Spambot Template] Could not load profiles for validation:',
				error.message,
			);
			return { removed: [], missing: [], currentProfiles: [] };
		}

		const currentUids = new Set(
			currentProfiles.map(p => String(p.uid || p.owner_uid || p.profileUid)),
		);

		const removed = [];
		let changed = false;

		const chatProfiles = Array.isArray(template.chat?.profiles)
			? template.chat.profiles
			: [];
		const mailProfiles = Array.isArray(template.mail?.profiles)
			? template.mail.profiles
			: [];

		// ЛИШНИЕ: profileUid нет среди актуальных анкет
		const filterExtra = profiles => {
			const kept = [];
			for (const p of profiles) {
				if (currentUids.has(String(p.profileUid))) {
					kept.push(p);
				} else {
					removed.push({
						profileUid: p.profileUid,
						profileName: p.profileName || 'N/A',
					});
					changed = true;
				}
			}
			return kept;
		};

		const cleanedChat = filterExtra(chatProfiles);
		const cleanedMail = filterExtra(mailProfiles);

		if (changed) {
			template.chat = { ...(template.chat || {}), profiles: cleanedChat };
			template.mail = { ...(template.mail || {}), profiles: cleanedMail };
			await template.save();
		}

		// НЕДОСТАЮЩИЕ: актуальная анкета, под которую в шаблоне нет текста
		const filledUids = new Set();
		for (const p of cleanedChat) {
			if (this._isProfileFilled('chat', p)) filledUids.add(String(p.profileUid));
		}
		for (const p of cleanedMail) {
			if (this._isProfileFilled('mail', p)) filledUids.add(String(p.profileUid));
		}

		const missing = currentProfiles
			.filter(p => !filledUids.has(String(p.uid || p.owner_uid || p.profileUid)))
			.map(p => ({
				profileUid: String(p.uid || p.owner_uid || p.profileUid),
				profileName: p.name || 'N/A',
				avatar: p.image_url || '',
			}));

		return { removed, missing, currentProfiles };
	}

	async _emitCount(account, templateId) {
		const accountId = account._id.toString();
		const templateCount = await SpambotTemplateModel.countDocuments({
			account: accountId,
		});
		const payload = { id: templateId, account: accountId, templateCount };
		return payload;
	}

	async _emitCreated(account, templateId) {
		const payload = await this._emitCount(account, templateId);
		socketService.emitTemplateCreated(account.user.toString(), payload);
	}

	async _emitUpdated(account, templateId) {
		const payload = await this._emitCount(account, templateId);
		socketService.emitTemplateUpdated(account.user.toString(), payload);
	}

	async _emitDeleted(account, templateId) {
		const payload = await this._emitCount(account, templateId);
		socketService.emitTemplateDeleted(account.user.toString(), payload);
	}

	/**
	 * Получить список шаблонов аккаунта.
	 */
	async getAccountTemplates(accountId, userId, userRole) {
		const account = await this._resolveAccountAccess(accountId, userId, userRole);

		const templates = await SpambotTemplateModel.find({
			account: account._id,
		}).sort({ createdAt: -1 });

		return templates.map(t => ({
			id: t._id,
			account: t.account,
			name: t.name,
			hasChat: this._countFilledProfiles(t.chat) > 0,
			hasMail: this._countFilledProfiles(t.mail) > 0,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
		}));
	}

	/**
	 * Получить один шаблон (опционально с валидацией анкет).
	 */
	async getTemplateById(templateId, userId, userRole, { validate = false } = {}) {
		const template = await this._resolveTemplateAccess(templateId, userId, userRole);
		const account = await this._resolveAccountAccess(
			template.account.toString(),
			userId,
			userRole,
		);

		const result = {
			template: this._serializeTemplate(template),
			validation: null,
			profiles: [],
		};

		if (validate) {
			const { removed, missing, currentProfiles } =
				await this._validateAndCleanup(template, account, userId, userRole);
			result.template = this._serializeTemplate(template);
			result.validation = { removed, missing };
			result.profiles = currentProfiles;
		}

		return result;
	}

	/**
	 * Создать шаблон.
	 */
	async createTemplate({ accountId, userId, userRole, name, chat, mail }) {
		if (!name || !String(name).trim()) {
			throw new Error('Template name is required');
		}

		const account = await this._resolveAccountAccess(accountId, userId, userRole);

		const template = new SpambotTemplateModel({
			user: account.user,
			account: account._id,
			name: String(name).trim(),
			chat: this._normalizeChat(chat),
			mail: this._normalizeMail(mail),
		});

		await template.save();

		await this._emitCreated(account, template._id.toString());

		return this._serializeTemplate(template);
	}

	/**
	 * Обновить шаблон.
	 */
	async updateTemplate(templateId, { name, chat, mail }, userId, userRole) {
		const template = await this._resolveTemplateAccess(templateId, userId, userRole);
		const account = await this._resolveAccountAccess(
			template.account.toString(),
			userId,
			userRole,
		);

		if (name !== undefined) {
			if (!String(name).trim()) {
				throw new Error('Template name is required');
			}
			template.name = String(name).trim();
		}

		if (chat !== undefined) {
			template.chat = this._normalizeChat(chat);
		}
		if (mail !== undefined) {
			template.mail = this._normalizeMail(mail);
		}

		await template.save();

		await this._emitUpdated(account, template._id.toString());

		return this._serializeTemplate(template);
	}

	/**
	 * Удалить шаблон.
	 */
	async deleteTemplate(templateId, userId, userRole) {
		const template = await this._resolveTemplateAccess(templateId, userId, userRole);
		const account = await this._resolveAccountAccess(
			template.account.toString(),
			userId,
			userRole,
		);

		const accountId = template.account.toString();
		await SpambotTemplateModel.deleteOne({ _id: templateId });

		const templateCount = await SpambotTemplateModel.countDocuments({
			account: accountId,
		});
		socketService.emitTemplateDeleted(account.user.toString(), {
			id: templateId,
			account: accountId,
			templateCount,
		});

		return { id: templateId, account: accountId, templateCount };
	}

	/**
	 * Применить шаблон: создать пачку рассылок (по одной на заполненную анкету).
	 *
	 * @param {string} templateId
	 * @param {Object} payload - (опционально) { name, chat, mail } — текущее состояние редактора
	 */
	async applyTemplate(templateId, userId, userRole, payload = {}) {
		const template = await this._resolveTemplateAccess(templateId, userId, userRole);
		const account = await this._resolveAccountAccess(
			template.account.toString(),
			userId,
			userRole,
		);

		// Используем payload (текущее состояние редактора, уже с актуальными анкетами).
		// Валидация и чистка лишних анкет уже выполнены при открытии шаблона (GET ?validate=1).
		const chat =
			payload.chat !== undefined
				? this._normalizeChat(payload.chat)
				: this._normalizeChat(template.chat);
		const mail =
			payload.mail !== undefined
				? this._normalizeMail(payload.mail)
				: this._normalizeMail(template.mail);

		const chatSettings = chat?.settings || {};
		const mailSettings = mail?.settings || {};

		const chatJobs = [];
		const mailJobs = [];

		for (const p of chat?.profiles || []) {
			if (!this._isProfileFilled('chat', p)) continue;
			chatJobs.push({
				config: this._buildChatConfig(chatSettings, p),
				type: 'chat',
			});
		}

		for (const p of mail?.profiles || []) {
			if (!this._isProfileFilled('mail', p)) continue;
			mailJobs.push({
				config: this._buildMailConfig(mailSettings, p),
				type: 'mail',
			});
		}

		// Валидируем настройки только тех секций, по которым реально пойдут рассылки
		if (chatJobs.length > 0) this._validateSettings(chatSettings, 'chat');
		if (mailJobs.length > 0) this._validateSettings(mailSettings, 'mail');

		const jobs = [...chatJobs, ...mailJobs];

		if (jobs.length === 0) {
			throw new Error(
				'Шаблон пуст: нет ни одной анкеты с заполненным текстом. Заполните хотя бы одну анкету.',
			);
		}

		const created = [];
		for (const job of jobs) {
			const distribution = await spambotService.startDistribution({
				accountId: account._id.toString(),
				userId,
				userRole,
				config: job.config,
			});
			created.push(distribution);
		}

		return {
			createdCount: created.length,
			distributions: created,
		};
	}

	/**
	 * Количество шаблонов по аккаунтам (для бейджей на Шаге 1).
	 * @returns {Promise<Object>} { [accountId]: count }
	 */
	async getTemplateCounts(userId, userRole) {
		let accountFilter = {};
		if (userRole !== 'admin') {
			const accountIds = await LuxeeAccountModel.find({ user: userId }).distinct(
				'_id',
			);
			accountFilter = { account: { $in: accountIds } };
		}

		const aggregated = await SpambotTemplateModel.aggregate([
			{ $match: accountFilter },
			{ $group: { _id: '$account', count: { $sum: 1 } } },
		]);

		const counts = {};
		for (const item of aggregated) {
			counts[item._id.toString()] = item.count;
		}
		return counts;
	}

	// ============================================================
	// Вспомогательные методы нормализации и сборки конфигурации
	// ============================================================

	_normalizeSettings(settings, defaultLimit = MAX_CHAT_LIMIT) {
		const s = settings && typeof settings === 'object' ? settings : {};

		const rawLimit =
			s.limit != null ? Number(s.limit) : defaultLimit;
		// Лимит всегда приводим в допустимый диапазон секции (chat: 1..30, mail: 1..10).
		const limit = Math.min(Math.max(rawLimit || 1, 1), defaultLimit);

		return {
			purchased: s.purchased ?? true,
			free: s.free ?? true,
			onlyEmptyChat: s.onlyEmptyChat ?? false,
			onlyNotEmptyChat: s.onlyNotEmptyChat ?? false,
			excludeIds: Array.isArray(s.excludeIds) ? s.excludeIds : [],
			specificUsers: Array.isArray(s.specificUsers) ? s.specificUsers : [],
			limit,
			filterUpdateLimit: s.filterUpdateLimit ?? 10,
			maxTimeMinutes: s.maxTimeMinutes ?? 180,
		};
	}

	_normalizeChat(chat) {
		if (!chat) return { settings: {}, profiles: [] };
		return {
			settings: this._normalizeSettings(chat.settings, MAX_CHAT_LIMIT),
			profiles: Array.isArray(chat.profiles)
				? chat.profiles.map(p => ({
						profileUid: p.profileUid,
						profileName: p.profileName || '',
						avatar: p.avatar || '',
						messages: Array.isArray(p.messages)
							? p.messages.map(m => ({
									text: m.text || '',
									interval: Number(m.interval) || 0,
								}))
							: [],
					}))
				: [],
		};
	}

	_normalizeMail(mail) {
		if (!mail) return { settings: {}, profiles: [] };
		return {
			settings: this._normalizeSettings(mail.settings, MAX_MAIL_LIMIT),
			profiles: Array.isArray(mail.profiles)
				? mail.profiles.map(p => ({
						profileUid: p.profileUid,
						profileName: p.profileName || '',
						avatar: p.avatar || '',
						title: p.title || '',
						text: p.text || '',
						picturesNumber: Array.isArray(p.picturesNumber)
							? p.picturesNumber
							: [],
					}))
				: [],
		};
	}

	_validateSettings(settings, type) {
		const maxLimit = type === 'mail' ? MAX_MAIL_LIMIT : MAX_CHAT_LIMIT;
		const limit = Number(settings.limit);
		if (!limit || limit < 1 || limit > maxLimit) {
			throw new Error(
				`Distribution limit must be between 1 and ${maxLimit} for ${type}`,
			);
		}
	}

	_buildChatConfig(settings, profile) {
		return {
			profileUid: profile.profileUid,
			profileName: profile.profileName || profile.profileUid,
			distributionType: 'chat',
			purchased: settings.purchased ?? true,
			free: settings.free ?? true,
			onlyEmptyChat: settings.onlyEmptyChat ?? false,
			onlyNotEmptyChat: settings.onlyNotEmptyChat ?? false,
			messages: profile.messages
				.filter(m => m.text && m.text.trim())
				.map(m => ({ text: m.text.trim(), interval: Number(m.interval) || 0 })),
			excludeIds: settings.excludeIds || [],
			specificUsers: settings.specificUsers || [],
			limit: Number(settings.limit),
			filterUpdateLimit: Number(settings.filterUpdateLimit) || 10,
			maxTimeMinutes: Number(settings.maxTimeMinutes) || 180,
		};
	}

	_buildMailConfig(settings, profile) {
		return {
			profileUid: profile.profileUid,
			profileName: profile.profileName || profile.profileUid,
			distributionType: 'mail',
			purchased: settings.purchased ?? true,
			free: settings.free ?? true,
			onlyEmptyChat: settings.onlyEmptyChat ?? false,
			onlyNotEmptyChat: settings.onlyNotEmptyChat ?? false,
			mailMessage: {
				title: profile.title,
				text: profile.text,
				picturesNumber: profile.picturesNumber || [],
			},
			excludeIds: settings.excludeIds || [],
			specificUsers: settings.specificUsers || [],
			limit: Number(settings.limit),
			filterUpdateLimit: Number(settings.filterUpdateLimit) || 10,
			maxTimeMinutes: Number(settings.maxTimeMinutes) || 180,
		};
	}

	_serializeTemplate(template) {
		return {
			id: template._id,
			account: template.account,
			user: template.user,
			name: template.name,
			chat: {
				settings: this._normalizeSettings(template.chat?.settings, MAX_CHAT_LIMIT),
				profiles: template.chat?.profiles || [],
			},
			mail: {
				settings: this._normalizeSettings(template.mail?.settings, MAX_MAIL_LIMIT),
				profiles: template.mail?.profiles || [],
			},
			createdAt: template.createdAt,
			updatedAt: template.updatedAt,
		};
	}
}

export default new SpambotTemplateService();
