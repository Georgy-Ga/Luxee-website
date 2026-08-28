import apiClient from './axios';

/**
 * Spambot API Client
 * Управление массовыми рассылками
 */
export const spambotApi = {
	/**
	 * Получить список профилей для аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Array>} - Список профилей
	 */
	async getProfiles(accountId) {
		const response = await apiClient.get('/spambot/profiles', {
			params: { accountId },
		});
		return response.data.profiles;
	},

	/**
	 * Получить дневные лимиты рассылок по анкетам аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object>} - { owner_uid: {chat: {max, count}, mail: {max, count}} }
	 */
	async getProfileLimits(accountId) {
		const response = await apiClient.get('/spambot/profile-limits', {
			params: { accountId },
		});
		return response.data.limits;
	},

	/**
	 * Проверить доступность аккаунта для рассылки
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object>} - {available: boolean, reason?: string, activeDistributions?: Array}
	 */
	async checkAccountAvailability(accountId) {
		const response = await apiClient.get(`/spambot/accounts/${accountId}/availability`);
		return response.data;
	},

	/**
	 * Создать и запустить рассылку
	 * @param {Object} params
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {Object} params.config - Конфигурация рассылки
	 * @returns {Promise<Object>} - Данные созданной рассылки
	 */
	async createDistribution({ accountId, config }) {
		const response = await apiClient.post('/spambot/distributions', {
			accountId,
			config,
		});
		return response.data.distribution;
	},

	/**
	 * Получить список рассылок
	 * @param {Object} filters
	 * @param {string} filters.accountId - Фильтр по аккаунту
	 * @param {string} filters.status - Фильтр по статусу
	 * @param {number} filters.limit - Количество
	 * @returns {Promise<Array>} - Список рассылок
	 */
	async getDistributions(filters = {}) {
		const response = await apiClient.get('/spambot/distributions', {
			params: filters,
		});
		return response.data.distributions;
	},

	/**
	 * Получить статус рассылки
	 * @param {string} distributionId - ID рассылки
	 * @returns {Promise<Object>} - Статус рассылки
	 */
	async getDistributionStatus(distributionId) {
		const response = await apiClient.get(`/spambot/distributions/${distributionId}/status`);
		return response.data;
	},

	/**
	 * Остановить рассылку
	 * @param {string} distributionId - ID рассылки
	 * @returns {Promise<Object>} - Результат остановки
	 */
	async stopDistribution(distributionId) {
		const response = await apiClient.post(`/spambot/distributions/${distributionId}/stop`);
		return response.data;
	},

	/**
	 * Удалить рассылку из очереди
	 * @param {string} distributionId - ID рассылки (MongoDB _id)
	 * @returns {Promise<Object>} - Результат удаления
	 */
	async deleteDistribution(distributionId) {
		const response = await apiClient.delete(`/spambot/distributions/${distributionId}`);
		return response.data;
	},

	// ========================================
	// ADMIN METHODS
	// ========================================

	/**
	 * ADMIN: Получить все Luxee аккаунты, сгруппированные по пользователям
	 * @returns {Promise<Array>} - [{user: {_id, email, role}, accounts: [...]}]
	 */
	async getAdminAccounts() {
		const response = await apiClient.get('/spambot/admin/accounts');
		return response.data.accounts;
	},

	/**
	 * ADMIN: Получить все рассылки всех пользователей
	 * @param {Object} filters
	 * @param {string} filters.status - Фильтр по статусу
	 * @param {string} filters.userId - Фильтр по пользователю
	 * @param {number} filters.limit - Количество
	 * @returns {Promise<Array>} - Список всех рассылок
	 */
	async getAdminDistributions(filters = {}) {
		const response = await apiClient.get('/spambot/admin/distributions', {
			params: filters,
		});
		return response.data.distributions;
	},

	// ========================================
	// TEMPLATES (ШАБЛОНЫ РАССЫЛОК)
	// ========================================

	/**
	 * Создать шаблон рассылки
	 * @param {string} accountId - ID Luxee аккаунта
	 * @param {Object} data - { name, chat, mail }
	 * @returns {Promise<Object>} - Созданный шаблон
	 */
	async createTemplate(accountId, data) {
		const response = await apiClient.post('/spambot/templates', {
			accountId,
			...data,
		});
		return response.data.template;
	},

	/**
	 * Получить список шаблонов аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Array>} - Список шаблонов
	 */
	async getTemplates(accountId) {
		const response = await apiClient.get('/spambot/templates', {
			params: { accountId },
		});
		return response.data.templates;
	},

	/**
	 * Получить количество шаблонов по аккаунтам (для бейджей)
	 * @returns {Promise<Object>} - { accountId: count }
	 */
	async getTemplateCounts() {
		const response = await apiClient.get('/spambot/templates/counts');
		return response.data.counts;
	},

	/**
	 * Получить один шаблон (с валидацией анкет при validate)
	 * @param {string} id - ID шаблона
	 * @param {Object} options - { validate?: boolean }
	 * @returns {Promise<Object>} - { template, validation }
	 */
	async getTemplate(id, { validate = false } = {}) {
		const response = await apiClient.get(`/spambot/templates/${id}`, {
			params: validate ? { validate: 1 } : {},
		});
		return response.data;
	},

	/**
	 * Обновить шаблон
	 * @param {string} id - ID шаблона
	 * @param {Object} data - { name, chat, mail }
	 * @returns {Promise<Object>} - Обновлённый шаблон
	 */
	async updateTemplate(id, data) {
		const response = await apiClient.put(`/spambot/templates/${id}`, data);
		return response.data.template;
	},

	/**
	 * Удалить шаблон
	 * @param {string} id - ID шаблона
	 * @returns {Promise<Object>} - Результат удаления
	 */
	async deleteTemplate(id) {
		const response = await apiClient.delete(`/spambot/templates/${id}`);
		return response.data;
	},

	/**
	 * Применить шаблон — создать пачку рассылок
	 * @param {string} id - ID шаблона
	 * @param {Object} payload - { chat, mail } (текущее состояние редактора)
	 * @returns {Promise<Object>} - { createdCount, removedProfiles, distributions }
	 */
	async applyTemplate(id, payload = {}) {
		const response = await apiClient.post(`/spambot/templates/${id}/apply`, payload);
		return response.data;
	},

	/**
	 * ADMIN: Получить профили для любого аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Array>} - Список профилей
	 */
	async getAdminProfiles(accountId) {
		const response = await apiClient.get('/spambot/admin/profiles', {
			params: { accountId },
		});
		return response.data.profiles;
	},

	/**
	 * ADMIN: Получить дневные лимиты рассылок по анкетам любого аккаунта
	 * @param {string} accountId - ID Luxee аккаунта
	 * @returns {Promise<Object>} - { owner_uid: {chat: {max, count}, mail: {max, count}} }
	 */
	async getAdminProfileLimits(accountId) {
		const response = await apiClient.get('/spambot/admin/profile-limits', {
			params: { accountId },
		});
		return response.data.limits;
	},
};
