import axios from './axios';

/**
 * API для управления расписаниями работы ИИ
 */

/**
 * Получить статус расписания пользователя (для админа)
 */
export const getScheduleStatus = async (userId) => {
  const response = await axios.get(`/ai-schedule/${userId}`);
  return response.data.schedule; // Возвращаем вложенный объект schedule
};

/**
 * Получить своё расписание (для текущего пользователя)
 */
export const getMyScheduleStatus = async () => {
  const response = await axios.get('/ai-schedule/me');
  return response.data.schedule; // Возвращаем вложенный объект schedule
};

/**
 * Обновить настройки расписания
 */
export const updateScheduleSettings = async (userId, settings) => {
  const response = await axios.put(`/ai-schedule/${userId}`, settings);
  return response.data.schedule; // Возвращаем вложенный объект schedule
};

/**
 * Сбросить расписание (вернуться к режиму 24/7)
 */
export const resetSchedule = async (userId) => {
  const response = await axios.delete(`/ai-schedule/${userId}`);
  return response.data;
};
