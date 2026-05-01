import api from './axios';

export const luxeeApi = {
  // Авторизация в Luxee аккаунте
  loginLuxee: async (luxeeEmail, luxeePassword) => {
    const response = await api.post('/luxee/login', { luxeeEmail, luxeePassword });
    return response.data;
  },

  // Получить все Luxee аккаунты
  getAccounts: async () => {
    const response = await api.get('/luxee/accounts');
    return response.data;
  },

  // Удалить Luxee аккаунт
  deleteAccount: async (accountId) => {
    const response = await api.delete(`/luxee/accounts/${accountId}`);
    return response.data;
  },

  // Восстановить сессию Luxee аккаунта
  restoreSession: async (accountId) => {
    const response = await api.post(`/luxee/accounts/${accountId}/restore`);
    return response.data;
  },

  // Получить профили (анкеты) аккаунта
  getProfiles: async (accountId) => {
    const response = await api.get('/luxee/profiles', { params: { accountId } });
    return response.data;
  },

  // Получить содержимое страницы
  getPageContent: async (accountId, url) => {
    const response = await api.get('/luxee/page-content', { params: { accountId, url } });
    return response.data;
  },

  // Проверить сообщения на всех аккаунтах
  checkAllMessages: async () => {
    const response = await api.get('/luxee/check-messages');
    return response.data;
  },

  // Проверить сообщения на конкретном аккаунте
  checkAccountMessages: async (accountId) => {
    const response = await api.get('/luxee/check-messages/account', { params: { accountId } });
    return response.data;
  },

  // Получить только непрочитанные сообщения
  checkUnreadMessages: async () => {
    const response = await api.get('/luxee/check-messages/unread');
    return response.data;
  },
};
