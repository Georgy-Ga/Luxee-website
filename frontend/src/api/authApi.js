import api from './axios';
import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = 'http://localhost:5000/api';

export const authApi = {
  // Вход
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    const { accessToken, user } = response.data;
    
    // Сохраняем access token в cookie
    Cookies.set('accessToken', accessToken, {
      secure: false, // В продакшене должно быть true
      sameSite: 'strict',
    });
    
    return { user, accessToken };
  },

  // Выход
  logout: async () => {
    await api.post('/logout');
    Cookies.remove('accessToken');
  },

  // Получить текущего пользователя (используем прямой axios, чтобы избежать interceptor)
  getCurrentUser: async () => {
    const response = await axios.get(`${API_URL}/refresh`, {
      withCredentials: true,
    });
    const { accessToken, user } = response.data;
    
    Cookies.set('accessToken', accessToken, {
      secure: false,
      sameSite: 'strict',
    });
    
    return { user, accessToken };
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
};
