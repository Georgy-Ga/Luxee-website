import axios from 'axios';
import Cookies from 'js-cookie';

// API URL: same-origin через nginx по умолчанию.
// - Если задан VITE_API_URL (build-arg / .env) — используем его (локальный dev: :5000).
// - Иначе '/api' того же origin: работает и по IP, и по домену, и через
//   SSH-туннель (не требует открытого :5001). Nginx проксирует /api на backend.
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api';
};

const API_URL = getApiUrl();

// Логируем для отладки
console.log('[API] Using API URL:', API_URL);

// Создаём экземпляр axios
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Для отправки cookies (refresh token)
  timeout: 180000, // ✅ FIX: 180 секунд (логин + парсинг профилей spambot может идти дольше 90с)
});

// Флаг для предотвращения множественных запросов на обновление токена
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor для добавления access token к запросам
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor для обработки ошибок и автоматического обновления токена
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если это запрос на refresh, не пытаемся обновить токен снова
    if (originalRequest.url?.includes('/refresh')) {
      return Promise.reject(error);
    }

    // Если ошибка 401 и это не повторный запрос
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Если уже идёт обновление токена, добавляем запрос в очередь
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Пытаемся обновить токен
        // Используем отдельный экземпляр axios чтобы избежать рекурсии interceptor'ов
        const refreshInstance = axios.create({
          baseURL: API_URL,
          withCredentials: true,
        });
        const response = await refreshInstance.get('/refresh');

        const { accessToken } = response.data;
        
        // Сохраняем новый access token
        Cookies.set('accessToken', accessToken, { 
          secure: false, // В продакшене должно быть true
          sameSite: 'strict',
        });

        // Обновляем заголовок для оригинального запроса
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Обрабатываем очередь запросов
        processQueue(null, accessToken);

        isRefreshing = false;

        // Повторяем оригинальный запрос
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Если обновление токена не удалось, просто отклоняем запрос
        // НЕ перенаправляем на логин автоматически
        Cookies.remove('accessToken');
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
