import User from '../models/UserModel.js';
import socketService from './socketService.js';
import utils from './aiAuto/utils.js';

const { log } = utils;

/**
 * Сервис управления интервалами работы/отдыха ИИ на уровне пользователя
 */
class AiScheduleService {
  /**
   * Проверить можно ли сейчас работать для данного пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<{shouldRun: boolean, currentState: string, nextToggleTime: Date, mode: string}>}
   */
  async checkUserSchedule(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return { 
          shouldRun: false, 
          reason: 'user_not_found' 
        };
      }
      
      // Если интервалы выключены → всегда работать (режим 24/7)
      if (!user.aiSchedule || !user.aiSchedule.enabled) {
        return { 
          shouldRun: true, 
          mode: 'always' 
        };
      }
      
      const now = Date.now();
      const nextToggle = user.aiSchedule.nextToggleTime;
      
      // Если время переключения не установлено или наступило
      if (!nextToggle || now >= nextToggle.getTime()) {
        // Переключаем состояние
        await this.toggleScheduleState(userId);
        
        // Перезагружаем данные после переключения
        const updatedUser = await User.findById(userId);
        
        return {
          shouldRun: updatedUser.aiSchedule.currentState === 'working',
          currentState: updatedUser.aiSchedule.currentState,
          nextToggleTime: updatedUser.aiSchedule.nextToggleTime,
          mode: 'scheduled',
          justToggled: true
        };
      }
      
      // Возвращаем текущее состояние
      return {
        shouldRun: user.aiSchedule.currentState === 'working',
        currentState: user.aiSchedule.currentState,
        nextToggleTime: user.aiSchedule.nextToggleTime,
        mode: 'scheduled'
      };
    } catch (error) {
      log('AI Schedule Error', `❌ checkUserSchedule: ${error.message}`);
      // В случае ошибки разрешаем работать
      return { shouldRun: true, error: error.message };
    }
  }
  
  /**
   * Переключить состояние (working ↔ resting)
   * @param {string} userId - ID пользователя
   */
  async toggleScheduleState(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Определяем новое состояние
      const newState = user.aiSchedule.currentState === 'working' 
        ? 'resting' 
        : 'working';
      
      // Выбираем длительность в зависимости от нового состояния
      const minutes = newState === 'working' 
        ? user.aiSchedule.workMinutes 
        : user.aiSchedule.restMinutes;
      
      const now = Date.now();
      const nextToggleTime = new Date(now + (minutes * 60 * 1000));
      
      // Обновляем состояние
      user.aiSchedule.currentState = newState;
      user.aiSchedule.lastToggleTime = new Date(now);
      user.aiSchedule.nextToggleTime = nextToggleTime;
      
      await user.save();
      
      // WebSocket уведомление всем
      socketService.emitAIScheduleChanged({
        userId: user._id.toString(),
        email: user.email,
        currentState: newState,
        nextToggleTime: nextToggleTime,
        mode: 'scheduled'
      });
      
      const stateEmoji = newState === 'working' ? '⚡' : '💤';
      const stateText = newState === 'working' ? 'РАБОТА' : 'ОТДЫХ';
      
      log('AI Schedule', `${stateEmoji} User ${user.email} → ${stateText} до ${nextToggleTime.toLocaleString('ru-RU')}`);
      
      return {
        currentState: newState,
        nextToggleTime: nextToggleTime
      };
    } catch (error) {
      log('AI Schedule Error', `❌ toggleScheduleState: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Обновить настройки интервалов
   * @param {string} userId - ID пользователя
   * @param {object} settings - { enabled, workMinutes, restMinutes }
   * @returns {Promise<object>} Обновлённое расписание
   */
  async updateScheduleSettings(userId, settings) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const { enabled, workMinutes, restMinutes } = settings;
      
      // Валидация
      if (workMinutes !== undefined) {
        if (workMinutes < 1 || workMinutes > 1440) {
          throw new Error('workMinutes должно быть от 1 до 1440 минут');
        }
      }
      
      if (restMinutes !== undefined) {
        if (restMinutes < 1 || restMinutes > 1440) {
          throw new Error('restMinutes должно быть от 1 до 1440 минут');
        }
      }
      
      // Обновляем настройки
      if (enabled !== undefined) {
        user.aiSchedule.enabled = enabled;
      }
      
      if (workMinutes !== undefined) {
        user.aiSchedule.workMinutes = workMinutes;
      }
      
      if (restMinutes !== undefined) {
        user.aiSchedule.restMinutes = restMinutes;
      }
      
      // Если включаем интервалы → начинаем с "working"
      if (enabled === true) {
        const now = Date.now();
        const minutes = user.aiSchedule.workMinutes;
        
        user.aiSchedule.currentState = 'working';
        user.aiSchedule.lastToggleTime = new Date(now);
        user.aiSchedule.nextToggleTime = new Date(now + (minutes * 60 * 1000));
        
        log('AI Schedule', `✅ Интервалы ВКЛЮЧЕНЫ для ${user.email}: ${minutes} мин работы, ${user.aiSchedule.restMinutes} мин отдыха`);
      } else if (enabled === false) {
        // Выключаем → режим 24/7
        user.aiSchedule.currentState = 'disabled';
        user.aiSchedule.lastToggleTime = null;
        user.aiSchedule.nextToggleTime = null;
        
        log('AI Schedule', `⚪ Интервалы ВЫКЛЮЧЕНЫ для ${user.email} (режим 24/7)`);
      }
      
      await user.save();
      
      // WebSocket уведомление
      socketService.emitAIScheduleChanged({
        userId: user._id.toString(),
        email: user.email,
        currentState: user.aiSchedule.currentState,
        nextToggleTime: user.aiSchedule.nextToggleTime,
        mode: user.aiSchedule.enabled ? 'scheduled' : 'always',
        settings: {
          enabled: user.aiSchedule.enabled,
          workMinutes: user.aiSchedule.workMinutes,
          restMinutes: user.aiSchedule.restMinutes
        }
      });
      
      return {
        enabled: user.aiSchedule.enabled,
        workMinutes: user.aiSchedule.workMinutes,
        restMinutes: user.aiSchedule.restMinutes,
        currentState: user.aiSchedule.currentState,
        lastToggleTime: user.aiSchedule.lastToggleTime,
        nextToggleTime: user.aiSchedule.nextToggleTime,
      };
    } catch (error) {
      log('AI Schedule Error', `❌ updateScheduleSettings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Получить текущий статус расписания
   * @param {string} userId - ID пользователя
   * @returns {Promise<object>} Статус расписания
   */
  async getScheduleStatus(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        enabled: user.aiSchedule?.enabled || false,
        workMinutes: user.aiSchedule?.workMinutes || 960,
        restMinutes: user.aiSchedule?.restMinutes || 480,
        currentState: user.aiSchedule?.currentState || 'disabled',
        lastToggleTime: user.aiSchedule?.lastToggleTime || null,
        nextToggleTime: user.aiSchedule?.nextToggleTime || null,
      };
    } catch (error) {
      log('AI Schedule Error', `❌ getScheduleStatus: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Сбросить интервалы (при выключении ИИ админом)
   * @param {string} userId - ID пользователя
   */
  async resetSchedule(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      user.aiSchedule.enabled = false;
      user.aiSchedule.currentState = 'disabled';
      user.aiSchedule.lastToggleTime = null;
      user.aiSchedule.nextToggleTime = null;
      
      await user.save();
      
      log('AI Schedule', `🔄 Расписание СБРОШЕНО для ${user.email}`);
      
      // WebSocket уведомление
      socketService.emitAIScheduleChanged({
        userId: user._id.toString(),
        email: user.email,
        currentState: 'disabled',
        mode: 'always',
        reset: true
      });
      
      return { success: true };
    } catch (error) {
      log('AI Schedule Error', `❌ resetSchedule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Инициализация сервиса при старте сервера
   */
  async initialize() {
    try {
      log('AI Schedule', '🚀 Initializing AI Schedule Service...');
      
      // Загружаем всех пользователей с активными расписаниями
      const users = await User.find({
        'aiSchedule.enabled': true
      });
      
      log('AI Schedule', `✓ Initialized successfully`);
      log('AI Schedule', `📊 Restored ${users.length} active schedules`);
      
      if (users.length > 0) {
        users.forEach(user => {
          log('AI Schedule', `  - ${user.email}: ${user.aiSchedule.currentState}, next toggle: ${user.aiSchedule.nextToggleTime}`);
        });
      }
      
      return { success: true, count: users.length };
    } catch (error) {
      log('AI Schedule Error', `❌ initialize: ${error.message}`);
      throw error;
    }
  }
}

export default new AiScheduleService();
