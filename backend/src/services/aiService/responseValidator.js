// Модуль для валидации ответов AI

import { FORBIDDEN_PHRASES } from './config.js';

/**
 * Проверить содержит ли ответ запрещенные фразы
 */
export const containsForbiddenPhrases = (response) => {
	const lowerResponse = response.toLowerCase();
	
	for (const phrase of FORBIDDEN_PHRASES) {
		if (lowerResponse.includes(phrase)) {
			console.log(`[AI Service] ⚠️ FORBIDDEN PHRASE DETECTED: "${phrase}"`);
			return true;
		}
	}
	
	return false;
};

/**
 * Очистить ответ от лишних элементов
 */
export const cleanResponse = (response) => {
	let cleaned = response.trim();
	
	// Удаляем префиксы типа "Response:" или "Answer:"
	cleaned = cleaned.replace(/^(Response|Answer|Reply):\s*/i, '');
	
	return cleaned;
};
