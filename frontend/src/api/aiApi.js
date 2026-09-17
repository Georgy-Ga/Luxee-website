import api from './axios';

export const aiApi = {
	/**
	 * Тестирование ответа AI
	 * @param {Object} data - { profile, message, history }
	 */
	testResponse: async (data) => {
		const response = await api.post('/ai/test', data);
		return response.data;
	},

	/**
	 * Получить системный промпт и правила
	 */
	getPrompt: async () => {
		const response = await api.get('/ai/prompt');
		return response.data;
	},

	/**
	 * Получить свой AI статус
	 */
	getMyAiStatus: async () => {
		const response = await api.get('/ai/my-status');
		return response.data;
	},

	/**
	 * Переключить свой AI
	 */
	toggleMyAi: async (enabled) => {
		const response = await api.post('/ai/my-toggle', { enabled });
		return response.data;
	},

	/**
	 * Получить все правила (для админа - все, для пользователя - активные)
	 */
	getRules: async () => {
		const response = await api.get('/ai/rules');
		return response.data;
	},

	/**
	 * Создать правило (только админ)
	 */
	createRule: async (ruleData) => {
		const response = await api.post('/ai/rules', ruleData);
		return response.data;
	},

	/**
	 * Обновить правило (только админ)
	 */
	updateRule: async (ruleId, ruleData) => {
		const response = await api.put(`/ai/rules/${ruleId}`, ruleData);
		return response.data;
	},

	/**
	 * Удалить правило (только админ)
	 */
	deleteRule: async (ruleId) => {
		const response = await api.delete(`/ai/rules/${ruleId}`);
		return response.data;
	},

	/**
	 * Переключить активность правила (только админ)
	 */
	toggleRuleActive: async (ruleId) => {
		const response = await api.post(`/ai/rules/${ruleId}/toggle`);
		return response.data;
	},

	/**
	 * Получить AI статус всех пользователей (только админ)
	 */
	getAllUsersAiStatus: async () => {
		const response = await api.get('/ai/users');
		return response.data;
	},

	/**
	 * Установить AI статус пользователя админом (только админ)
	 */
	setUserAiByAdmin: async (userId, aiEnabledByAdmin) => {
		const response = await api.post(`/ai/users/${userId}/set`, { aiEnabledByAdmin });
		return response.data;
	},

	/**
	 * Установить AI статус для всех аккаунтов пользователя админом (только админ)
	 */
	setAllUserAccountsAiByAdmin: async (userId, aiEnabledByAdmin) => {
		const response = await api.post(`/ai/users/${userId}/set-all-accounts`, { aiEnabledByAdmin });
		return response.data;
	},

	/**
	 * Получить AI статус всех аккаунтов (только админ)
	 */
	getAllAccountsAiStatus: async () => {
		const response = await api.get('/ai/accounts');
		return response.data;
	},

	/**
	 * Получить AI статус своих аккаунтов
	 */
	getMyAccountsAiStatus: async () => {
		const response = await api.get('/ai/my-accounts');
		return response.data;
	},

	/**
	 * Установить AI статус аккаунта админом (только админ)
	 */
	setAccountAiByAdmin: async (accountId, aiEnabledByAdmin) => {
		const response = await api.post(`/ai/accounts/${accountId}/set`, { aiEnabledByAdmin });
		return response.data;
	},

	/**
	 * Переключить AI своего аккаунта
	 */
	toggleMyAccountAi: async (accountId) => {
		const response = await api.post(`/ai/my-accounts/${accountId}/toggle`);
		return response.data;
	},

	/**
	 * Переключить AI на ВСЕХ своих аккаунтах сразу
	 */
	toggleAllMyAccountsAi: async () => {
		const response = await api.post('/ai/my-accounts/toggle-all');
		return response.data;
	},

	/**
	 * Получить исключённые анкеты пользователя (только админ)
	 * @param {string} userId
	 * @returns {{ success: boolean, excludedProfileUids: string[] }}
	 */
	getExcludedProfiles: async (userId) => {
		const response = await api.get(`/ai/users/${userId}/excluded-profiles`);
		return response.data;
	},

	/**
	 * Обновить исключённые анкеты пользователя (только админ).
	 * Применяется "на горячую" — перезапуск ИИ не нужен.
	 * @param {string} userId
	 * @param {Array<string|number>} excludedProfileUids - inner UID анкет
	 */
	updateExcludedProfiles: async (userId, excludedProfileUids) => {
		const response = await api.put(`/ai/users/${userId}/excluded-profiles`, { excludedProfileUids });
		return response.data;
	},

	/**
	 * Получить мастер-выключатели разделов AI аккаунта (только админ).
	 * @param {string} accountId
	 * @returns {{ success: boolean, sections: { newMessages, catchUp, activityCenter } }}
	 */
	getAccountSections: async (accountId) => {
		const response = await api.get(`/ai/accounts/${accountId}/sections`);
		return response.data;
	},

	/**
	 * Обновить мастер-выключатели разделов AI аккаунта (только админ).
	 * OFF = раздел полностью пропускается циклом (в отличие от черного
	 * списка, который фильтрует только конкретных мужчин).
	 * @param {string} accountId
	 * @param {Object} sections - { newMessages, catchUp, activityCenter }
	 */
	updateAccountSections: async (accountId, sections) => {
		const response = await api.put(`/ai/accounts/${accountId}/sections`, { sections });
		return response.data;
	},
};
