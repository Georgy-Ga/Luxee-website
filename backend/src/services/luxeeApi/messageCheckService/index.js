// Главный модуль messageCheckService
// Объединяет все подмодули и экспортирует единый интерфейс

import { checkAllMessages } from './checkAllMessages.js';
import { checkAccountMessages } from './checkAccountMessages.js';

/**
 * Сервис для проверки новых сообщений на Luxee
 * 
 * Рефакторинг: разбит на модули для улучшения читаемости
 * - checkAllMessages.js - проверка всех аккаунтов
 * - checkAccountMessages.js - проверка одного аккаунта
 * - profileDataExtractor.js - извлечение данных из браузера
 */
const messageCheckService = {
	checkAllMessages,
	checkAccountMessages,
};

export default messageCheckService;
