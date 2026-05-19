// Главный модуль AI сервиса
// Объединяет все подмодули и экспортирует единый интерфейс

import { generateResponse } from './responseGenerator.js';
import { testAI } from './testService.js';

/**
 * Сервис для генерации AI ответов
 * 
 * Рефакторинг: разбит на модули для улучшения читаемости
 * - config.js - конфигурация и константы
 * - promptBuilder.js - построение промптов
 * - apiClient.js - работа с AI API
 * - responseValidator.js - валидация ответов
 * - responseGenerator.js - основная логика генерации
 * - testService.js - тестирование
 */
const aiService = {
	generateResponse,
	testAI,
};

export default aiService;
