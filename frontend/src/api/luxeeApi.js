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
    const response = await api.get('/luxee/messages/check-all');
    return response.data;
  },

  // Проверить сообщения на конкретном аккаунте
  checkAccountMessages: async (accountId) => {
    const response = await api.get('/luxee/messages/check-account', { params: { accountId } });
    return response.data;
  },

  // Отправить сообщение в чат
  sendMessage: async (accountId, profileUid, memberUid, text, chatIdentity = null) => {
    const response = await api.post('/luxee/messages/send', { 
      accountId, 
      profileUid, 
      memberUid, 
      text,
      chatIdentity 
    });
    return response.data;
  },

  // Загрузить чаты профиля (при клике на профиль)
  loadProfileChats: async (accountId, profileUid) => {
    const response = await api.get('/luxee/profile-chats', { 
      params: { accountId, profileUid } 
    });
    return response.data;
  },

  // Открыть чат и получить последнее сообщение
  openChat: async (accountId, profileUid, chatId) => {
    const response = await api.get('/luxee/chat/open', { 
      params: { accountId, profileUid, chatId } 
    });
    return response.data;
  },

  // Включить/выключить AI для Luxee аккаунта (для админа)
  toggleAccountAi: async (accountId, enabled) => {
    const response = await api.post(`/ai/accounts/${accountId}/set`, { enabled });
    return response.data;
  },
};
