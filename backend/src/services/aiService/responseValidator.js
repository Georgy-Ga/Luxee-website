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

// Мета-мусор модели (Nemotron любит "думать вслух" в ответе):
// 1) свайпы — на сайте их нет, любое упоминание = палёво
// 2) подсчёт символов — отправлять мужчине нельзя
// 3) анализ сообщения/инструкций вместо самого сообщения.
// Детект → перегенерация (тот же retry-цикл, что forbidden phrases).
const META_LEAK_PATTERNS = [
	/\bswip(e|es|ed|ing)\b/i, // свайпов на сайте нет
	/\(\s*\d+\s*(chars?|characters?|symbols?)\b/i, // "(187 characters)"
	/\b\d{2,3}\s*(chars?|characters?|symbols?)\b/i, // "187 characters"
	/\b(char|character)\s*(count|limit)\b/i, // "character count"
	/\bmessage\s*type\b|\btype\s*of\s*message\b/i, // "message type: ..."
	/\bhere(?:'?s|\s+is)?\s+my\s+(response|reply|answer|message)\b/i, // "here('s/is) my response" // "here is my response"
	/\b(an?alysis|reasoning|thinking)\s*:/i, // "Analysis: ..."
	// Болтовня про "правила" и эхо инструкций (ACKNOWLEDGE→REDIRECT из
	// системного промпта): модель описывает КАК она будет писать вместо
	// самого сообщения. В живом флирте этих слов не бывает.
	/\bcareful about the rules\b/i, // "I need to be careful about the rules"
	/\babout the rules\b/i,
	/\backnow/i, // "ACKNOW!", "acknowledge"
	/\bpivot\b/i, // "pivot to..."
	/\bredirect\b/i, // "redirect to..."
	/\bmy\s+(instructions|rules|guidelines)\b/i,
	/\bfollow(ing)?\s+(these\s+|the\s+|my\s+)?instructions\b/i,
	// Галлюцинации механики платформы ("ping-style" выдумана моделью,
	// в нашем коде этого слова нет): рассуждения о СТИЛЕ/ФОРМАТЕ сообщения
	// вместо самого сообщения. В живом флирте так не пишут.
	/\bping(-|\s)?style\b/i, // "ping-style message"
	/\bstyle\s+message\b/i,
	/\brespond\s+(with|in)\s+an?\s+[\w-]+\s+(message|style)\b/i, // "respond with a ping-style message"
	/\bin\s+the\s+style\s+of\b/i,
	/\bas\s+requested\b/i,
];

// Преамбулы "думания вслух" — проверяем только начало ответа (первые 120 символов),
// чтобы не зацепить живое сообщение, где такие слова в теории возможны дальше.
const META_LEAK_HEAD_PATTERNS = [
	'i will write',
	"i'll write",
	'i will respond',
	"i'll respond",
	'let me write',
	'let me respond',
	'the man is',
	'the man sent',
	'his message is',
	'his message type',
	'he sent a ',
	'about the rules',
	'my rules',
];

export const containsMetaLeak = response => {
	const text = String(response || '');
	for (const re of META_LEAK_PATTERNS) {
		if (re.test(text)) {
			console.log(`[AI Service] ⚠️ META LEAK DETECTED: ${re}`);
			return true;
		}
	}
	const head = text.slice(0, 120).toLowerCase();
	for (const p of META_LEAK_HEAD_PATTERNS) {
		if (head.includes(p)) {
			console.log(`[AI Service] ⚠️ META LEAK (preamble) DETECTED: "${p}"`);
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

	// Срезаем счётчики символов вида "(187 characters)" / "(199 chars)" —
	// модель иногда дописывает их в конец; мужчине это видеть нельзя.
	// Удаляем везде (не только в конце), остатки пробелов схлопываем.
	cleaned = cleaned
		.replace(/\(\s*\d+\s*(chars?|characters?|symbols?)[^)]*\)/gi, '')
		.replace(/\s{2,}/g, ' ')
		.trim();

	// Повторное снятие кавычек: счётчик мог стоять ПОСЛЕ закрывающей
	// кавычки, а открывающая — съедена срезом префикса выше:
	// 'Msg: "hi" (199 chars)' → 'hi"' → 'hi'.
	// Снимаем одиночные крайние кавычки безусловно (внутренние не трогаем).
	cleaned = cleaned
		.replace(/^["'«]\s*/, '')
		.replace(/\s*["'»]\s*$/, '')
		.trim();

	return cleaned.trim();
};

/**
 * Длина в кодпоинтах (эмодзи не рвём и считаем как 1 символ)
 */
export const replyLength = text => Array.from(String(text || '')).length;
