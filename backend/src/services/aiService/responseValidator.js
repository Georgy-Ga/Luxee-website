// Модуль для валидации ответов AI

import { FORBIDDEN_PHRASES } from './config.js';

// Жёсткий лимит сайта: сообщения длиннее не принимаются
export const MAX_REPLY_CHARS = 200;

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
 * Очистить ответ от лишних элементов — строго только сырой текст
 */
export const cleanResponse = (response) => {
	let cleaned = String(response || '').trim();

	// Срезаем обёртку в кавычках: "hi" → hi / 'hi' → hi
	if (
		(cleaned.startsWith('"') && cleaned.endsWith('"')) ||
		(cleaned.startsWith("'") && cleaned.endsWith("'")) ||
		(cleaned.startsWith('«') && cleaned.endsWith('»'))
	) {
		cleaned = cleaned.slice(1, -1).trim();
	}

	// Срезаем префиксы вида "Сообщение:", "Message:", "Ответ:", "Reply:" и т.п.
	// с/без кавычек и пробелов — оставляем только тело сообщения
	cleaned = cleaned.replace(
		/^(?:Сообщение|Соообщение|Message|Ответ|Reply|Response|Answer)\s*:\s*["'«]?\s*/i,
		'',
	);
	// Если после среза осталась открывающая кавычка — убрать хвостовую
	cleaned = cleaned.replace(/^["'«]\s*/, '').replace(/\s*["'»]\s*$/, '').trim();

	// Легаси: Response:/Answer:/Reply:
	cleaned = cleaned.replace(/^(Response|Answer|Reply):\s*/i, '');

	return cleaned.trim();
};

/**
 * Длина в кодпоинтах (эмодзи не рвём и считаем как 1 символ)
 */
export const replyLength = text => Array.from(String(text || '')).length;
