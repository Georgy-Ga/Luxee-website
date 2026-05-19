// Главный модуль profileParserService
// Объединяет все подмодули и экспортирует единый интерфейс

import {
	getActiveProfile,
	getProfiles,
	getProfilesWithUnread,
} from './profileExtractor.js';

import {
	getProfileUnansweredCount,
	getProfileChatsWithUnanswered,
	getAllChatsWithUnanswered,
} from './chatExtractor.js';

import { getChatMessages } from './messageExtractor.js';

/**
 * Сервис для получения профилей и сообщений через JavaScript API Luxee
 * Использует modelsChat.getProfile.data и modelsChat.getChats.list
 * 
 * Рефакторинг: разбит на модули для улучшения читаемости
 * - profileExtractor.js - работа с профилями
 * - chatExtractor.js - работа с чатами
 * - messageExtractor.js - работа с сообщениями
 */
const profileParserService = {
	// Методы работы с профилями
	getActiveProfile,
	getProfiles,
	getProfilesWithUnread,

	// Методы работы с чатами
	getProfileUnansweredCount,
	getProfileChatsWithUnanswered,
	getAllChatsWithUnanswered,

	// Методы работы с сообщениями
	getChatMessages,
};

export default profileParserService;
