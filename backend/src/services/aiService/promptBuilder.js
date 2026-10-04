// Модуль для построения промптов и контекста

import { SYSTEM_PROMPT, ACTIVITY_CENTER_PROMPT } from './config.js';
import { getSampleActivityExamples } from './activityCenterExamples.js';
import { getProfilePrompt } from '../profilePromptService.js';
import { vlog } from '../verbose.js';

// Лимиты чтобы не раздувать prompt_tokens:
// - кастомных правил максимум 5, каждое до 300 символов
const MAX_CUSTOM_RULES = 5;
const MAX_RULE_CHARS = 300;
// - история максимум ~1500 символов (хвост, самое свежее)
const MAX_HISTORY_CHARS = 1500;
// - fallback-история: максимум 6 сообщений, каждое до 300 символов
const MAX_FALLBACK_MESSAGES = 6;
const MAX_FALLBACK_MSG_CHARS = 300;

/**
 * Построить контекст профиля для AI
 */
export const buildProfileContext = (profile, customRules) => {
	let profileContext = `My profile information:
- Name: ${profile?.username || 'not specified'}`;

	// ✅ Добавляем только если есть данные
	if (profile?.age) {
		profileContext += `\n- Age: ${profile.age}`;
	}
	if (profile?.country) {
		profileContext += `\n- Country: ${profile.country}`;
	}
	if (profile?.city) {
		profileContext += `\n- City: ${profile.city}`;
	}

	// Добавляем кастомные правила если есть (customRules это массив объектов)
	// Лимит: не больше MAX_CUSTOM_RULES, каждое обрезано — иначе prompt_tokens растут без контроля
	if (customRules && Array.isArray(customRules) && customRules.length > 0) {
		const limited = customRules.slice(0, MAX_CUSTOM_RULES);
		const rulesText = limited
			.map(rule => String(rule.content || '').slice(0, MAX_RULE_CHARS))
			.join('\n');
		profileContext += `\n\nAdditional rules for this profile:\n${rulesText}`;
		if (customRules.length > MAX_CUSTOM_RULES) {
			vlog(`  ⚠️ Custom rules truncated: ${customRules.length} → ${MAX_CUSTOM_RULES}`);
		}
	}

	profileContext += `\n\nI should use this information ONLY when he asks where I'm from, how old I am, or who I am. Don't mention it in every message.`;

	return profileContext;
};

/**
 * Построить массив сообщений для AI API
 * 📜 НОВОЕ: Поддержка formattedHistory и typeInstructions из chatMessagesExtractorService
 * 🎭 НОВОЕ: Поддержка кастомных промптов для профилей
 */
export const buildMessages = async ({ 
	conversationHistory, 
	manMessage, 
	messageType, 
	profile, 
	customRules,
	formattedHistory = '',
	typeInstructions = '',
	profileName = '',
	manName = '',
	activityCenterData = null,
}) => {
	vlog('');
	vlog('📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====');
	vlog('  👤 Profile:', profile?.username || profileName || 'N/A');
	vlog('  🆔 Profile UID:', profile?.uid || 'N/A');
	vlog('  👨 Man name:', manName || 'N/A');
	vlog('  💬 Man message:', manMessage);
	vlog('  📊 Message type:', messageType);
	vlog('  📜 Conversation history length:', conversationHistory?.length || 0);
	vlog('  📋 Custom rules count:', customRules?.length || 0);
	vlog('  🆕 Using formatted history:', formattedHistory ? 'YES' : 'NO');
	vlog('  🆕 Using type instructions:', typeInstructions ? 'YES' : 'NO');
	
	const messages = [];
	
	// 🔔 Детекция Activity Center: нет сообщения и нет инструкций
	const isActivityCenter = !manMessage && !typeInstructions && !formattedHistory;
	
	if (isActivityCenter) {
		vlog('  🔔 ACTIVITY CENTER MODE DETECTED - using special prompt');

		// Личность анкеты: ИИ должна знать, от чьего имени пишет первое сообщение
		const profileContext = buildProfileContext(profile, customRules);

		// Используем специальный промпт для Activity Center
		messages.push({
			role: 'system',
			content: ACTIVITY_CENTER_PROMPT,
		});

		// Тип активности: favorite / like / wink — от этого зависит тон сообщения.
		// Раньше тип терялся по дороге (activityCenterData дропался), теперь доходит.
		const activityType = activityCenterData?.activityType || 'unknown';
		let activityLine = 'showed interest in your profile';
		if (activityType === 'favorite') {
			activityLine = 'subscribed to/favorited your profile — start warm and welcoming, show you noticed him';
		} else if (activityType === 'like') {
			activityLine = 'liked your profile — start warm and slightly flirty, show you noticed him';
		} else if (activityType === 'wink') {
			activityLine = 'winked at you — this is a playful first move, be fun and flirty';
		}
		vlog('  🔔 Activity type:', activityType);

		// Для Activity Center НЕ нужен возраст/город в явном виде, но имя анкеты —
		// обязательно: без него ИИ не понимает, кто она.
		// Свежую выборку примеров подставляем сюда (не в system) — разнообразие без ~1500 токенов за раз
		const sampleExamples = getSampleActivityExamples(2);
		const userMessage = `${profileContext}

A man named ${manName || 'him'} just ${activityLine}.
Write ONE engaging question to start a conversation with him. Make it unique, interesting, and thought-provoking. Keep it under 200 characters.

FINAL REMINDER — reply with ONLY the question text. No greetings, no explanations, no commentary, no analysis, nothing else. Just the question.

Style examples (do NOT copy, vary the topic):\n${sampleExamples}`;
		
		messages.push({
			role: 'user',
			content: userMessage,
		});
		
		vlog('  📨 Total messages in array:', messages.length);
		vlog('  📄 Messages structure:');
		messages.forEach((msg, idx) => {
			const preview = msg.content.substring(0, 100);
			vlog(`    ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
		});
		vlog('═'.repeat(80));
		vlog('');
		
		return messages;
	}
	
	// 📬 ОБЫЧНЫЙ ЧАТ: Используем стандартный промпт
	const profileContext = buildProfileContext(profile, customRules);
	vlog('  🎭 Profile context:', profileContext);

	// 🆕 НОВОЕ: Получаем промпт для конкретного профиля (кастомный или дефолтный)
	const systemPrompt = await getProfilePrompt(profile?.uid);
	vlog('  🎯 System prompt type:', systemPrompt === SYSTEM_PROMPT ? 'DEFAULT' : 'CUSTOM');

	// Добавляем system message (кастомный или дефолтный)
	messages.push({
		role: 'system',
		content: systemPrompt,
	});

	// 📜 НОВОЕ: Если есть отформатированная история - используем её
	// Бюджет: хвост до MAX_HISTORY_CHARS — свежее важнее, токены под контролем
	if (formattedHistory) {
		const truncatedHistory =
			formattedHistory.length > MAX_HISTORY_CHARS
				? '... (earlier trimmed)\n' +
					formattedHistory.slice(-MAX_HISTORY_CHARS)
				: formattedHistory;
		if (formattedHistory.length > MAX_HISTORY_CHARS) {
			vlog(`  ✂️ Formatted history truncated: ${formattedHistory.length} → ${truncatedHistory.length} chars`);
		}

		// Добавляем историю как контекст
		messages.push({
			role: 'user',
			content: truncatedHistory,
		});
	} else if (conversationHistory && conversationHistory.length > 0) {
		// Fallback - старый метод, тоже с бюджетом
		const recent = conversationHistory.slice(-MAX_FALLBACK_MESSAGES);
		recent.forEach(msg => {
			messages.push({
				role: msg.from === 'man' ? 'user' : 'assistant',
				content: String(msg.body || '').slice(0, MAX_FALLBACK_MSG_CHARS),
			});
		});
		if (conversationHistory.length > recent.length) {
			vlog(`  ✂️ Fallback history truncated: ${conversationHistory.length} → ${recent.length} messages`);
		}
	}

	// ⭐ Определяем контекст для типа сообщения
	let messageContext = '';
	
	// НОВОЕ: Если есть typeInstructions - используем их
	if (typeInstructions) {
		messageContext = typeInstructions + '\n';
		vlog('  🎯 Using type instructions from chatMessagesExtractorService');
		vlog('  📏 Type instructions length:', typeInstructions.length, 'chars');
		const preview = typeInstructions.substring(0, 150).replace(/\n/g, ' ');
		vlog('  📝 Type instructions preview:', preview + '...');
	} else {
		// Пустые инструкции — норма для обычных текстовых ответов
		// (typeInstructions есть только для wink/emoji/image/video/gift).
		// История и системный промпт несут контекст и без них.
		vlog('  ℹ️  No type instructions (plain reply, system prompt + history apply)');
		if (manMessage && manMessage.includes('[Emoji]')) {
			// Fallback - старый метод для эмодзи
			messageContext = '[The man sent you an emoji/sticker - respond warmly with emotion and ask a question]\n';
			vlog('  😊 Detected emoji message - added emoji context (fallback)');
		}
	}

	// Страховка от неограниченного роста инструкций (catch-up дописывает NOTE)
	if (messageContext.length > 800) {
		vlog(`  ✂️ Type instructions truncated: ${messageContext.length} → 800 chars`);
		messageContext = messageContext.slice(-800);
	}

	// Добавляем текущее сообщение от мужчины
	const userName = profileName || profile?.username || 'yourself';
	const userMessage = `${profileContext}

${messageContext}Man's message: "${manMessage}"

Generate a natural, friendly response as ${userName}. Write a complete message (1-3 sentences, strictly under 200 characters total — the site rejects longer messages).

FINAL REMINDER — output ONLY the message text itself. No analysis of him or his message, no labels like "Message:" or "Response:", no swipe talk (this site has no swipes), no character counts, no quoting these instructions. Just the message a real woman would send.`;

	messages.push({
		role: 'user',
		content: userMessage,
	});

	vlog('  📨 Total messages in array:', messages.length);
	vlog('  📄 Messages structure:');
	messages.forEach((msg, idx) => {
		const preview = msg.content.substring(0, 100);
		vlog(`    ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
	});
	vlog('═'.repeat(80));
	vlog('');

	return messages;
};

