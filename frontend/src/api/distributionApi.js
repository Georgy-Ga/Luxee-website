import api from './axios.js';

export const distributionApi = {
  /**
   * Создать новую рассылку
   */
  create: async (config) => {
    const response = await api.post('/distributions', config);
    return response.data;
  },

  /**
   * Получить список рассылок
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.luxeeAccountId) params.append('luxeeAccountId', filters.luxeeAccountId);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.skip) params.append('skip', filters.skip);

    const response = await api.get(`/distributions?${params}`);
    return response.data;
  },

  /**
   * Получить одну рассылку
   */
  getOne: async (id) => {
    const response = await api.get(`/distributions/${id}`);
    return response.data;
  },

  /**
   * Запустить рассылку
   */
  start: async (id) => {
    const response = await api.post(`/distributions/${id}/start`);
    return response.data;
  },

  /**
   * Остановить рассылку
   */
  stop: async (id) => {
    const response = await api.post(`/distributions/${id}/stop`);
    return response.data;
  },

  /**
   * Синхронизировать статус рассылки
   * Проверяет реальный статус в Python и исправляет MongoDB если нужно
   */
  sync: async (id) => {
    const response = await api.post(`/distributions/${id}/sync`);
    return response.data;
  },

  /**
   * Удалить рассылку
   */
  delete: async (id) => {
    const response = await api.delete(`/distributions/${id}`);
    return response.data;
  },

  /**
   * Авторизовать Luxee аккаунт в spambot
   */
  authenticateAccount: async (accountId) => {
    const response = await api.post(`/distributions/authenticate/${accountId}`);
    return response.data;
  },

  /**
   * Получить профили для авторизованного аккаунта из spambot
   */
  getAccountProfiles: async (accountId) => {
    const response = await api.get(`/distributions/profiles/${accountId}`);
    return response.data;
  },
};
