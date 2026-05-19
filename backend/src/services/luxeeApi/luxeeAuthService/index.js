// Главный модуль luxeeAuthService
// Объединяет все подмодули и экспортирует единый интерфейс

import { login } from './loginService.js';
import { getLuxeeAccounts, deleteLuxeeAccount } from './accountService.js';
import { restoreSession, restoreAllSessions } from './sessionService.js';

/**
 * Сервис для авторизации и управления Luxee аккаунтами
 * 
 * Рефакторинг: разбит на модули для улучшения читаемости
 * - loginService.js - авторизация на Luxee
 * - accountService.js - управление аккаунтами
 * - sessionService.js - управление сессиями
 */
const luxeeAuthService = {
	// Авторизация
	login,

	// Управление аккаунтами
	getLuxeeAccounts,
	deleteLuxeeAccount,

	// Управление сессиями
	restoreSession,
	restoreAllSessions,
};

export default luxeeAuthService;
