import api from './axios';
import Cookies from 'js-cookie';

export const authApi = {
  // Вход
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    const { accessToken, user, sessionId, deviceId } = response.data;
    
    // Сохраняем access token в cookie
    Cookies.set('accessToken', accessToken, {
      secure: false, // В продакшене должно быть true
      sameSite: 'strict',
    });
    
    return { user, accessToken, sessionId, deviceId };
  },

  // Выход (только текущая сессия; коллеги на том же userId остаются в системе)
  logout: async () => {
    await api.post('/logout');
    Cookies.remove('accessToken');
  },

  // Выйти везде (все сессии userId; здесь бэкенд останавливает AI/браузеры)
  logoutAll: async () => {
    await api.post('/logout-all');
    Cookies.remove('accessToken');
  },

  // Получить текущего пользователя
  getCurrentUser: async () => {
    const response = await api.get('/refresh');
    const { accessToken, user, sessionId, deviceId } = response.data;
    
    Cookies.set('accessToken', accessToken, {
      secure: false,
      sameSite: 'strict',
    });
    
    return { user, accessToken, sessionId, deviceId };
  },

  // Регистрация (только для админов)
  register: async (email, password) => {
    const response = await api.post('/registration', { email, password });
    return response.data;
  },

  // Получить всех пользователей (только для админов)
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  // Удалить пользователя (только для админов)
  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  // Включить/выключить AI для пользователя (только для админов)
  toggleUserAi: async (userId, enabled) => {
    const response = await api.post(`/ai/users/${userId}/set`, { enabled });
    return response.data;
  },

  // Мультивход: активные сессии текущего userId (второй логин не выкидывает первый)
  getSessions: async () => {
    const response = await api.get('/sessions');
    return response.data;
  },

  // Закрыть одну сессию (без остановки AI/браузеров коллег)
  revokeSession: async (sessionId) => {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  },

  // Лента действий: «кто включил/выключил ИИ» (live-обновления идут по socket `audit:new`)
  getAudit: async ({ limit = 50, accountId = null } = {}) => {
    const response = await api.get('/audit', { params: { limit, ...(accountId ? { accountId } : {}) } });
    return response.data;
  },
};
