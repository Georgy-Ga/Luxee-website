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
};
