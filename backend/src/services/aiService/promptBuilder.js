// Модуль для построения промптов и контекста

import { SYSTEM_PROMPT, ACTIVITY_CENTER_PROMPT } from './config.js';
import { getSampleActivityExamples } from './activityCenterExamples.js';
import { getProfilePrompt } from '../profilePromptService.js';

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
			console.log(`  ⚠️ Custom rules truncated: ${customRules.length} → ${MAX_CUSTOM_RULES}`);
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
	manName = ''
}) => {
	console.log('');
	console.log('📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====');
	console.log('  👤 Profile:', profile?.username || profileName || 'N/A');
	console.log('  🆔 Profile UID:', profile?.uid || 'N/A');
	console.log('  👨 Man name:', manName || 'N/A');
	console.log('  💬 Man message:', manMessage);
	console.log('  📊 Message type:', messageType);
	console.log('  📜 Conversation history length:', conversationHistory?.length || 0);
	console.log('  📋 Custom rules count:', customRules?.length || 0);
	console.log('  🆕 Using formatted history:', formattedHistory ? 'YES' : 'NO');
	console.log('  🆕 Using type instructions:', typeInstructions ? 'YES' : 'NO');
	
	const messages = [];
	
	// 🔔 Детекция Activity Center: нет сообщения и нет инструкций
	const isActivityCenter = !manMessage && !typeInstructions && !formattedHistory;
	
	if (isActivityCenter) {
		console.log('  🔔 ACTIVITY CENTER MODE DETECTED - using special prompt');
		
		// Используем специальный промпт для Activity Center
		messages.push({
			role: 'system',
			content: ACTIVITY_CENTER_PROMPT,
		});
		
		// Для Activity Center НЕ нужен profile context (возраст, город и т.д.)
		// Свежую выборку примеров подставляем сюда (не в system) — разнообразие без ~1500 токенов за раз
		const sampleExamples = getSampleActivityExamples(2);
		const userMessage = `Write ONE engaging question to start a conversation with a man named ${manName || 'him'}. Make it unique, interesting, and thought-provoking.\n\nStyle examples (do NOT copy, vary the topic):\n${sampleExamples}`;
		
		messages.push({
			role: 'user',
			content: userMessage,
		});
		
		console.log('  📨 Total messages in array:', messages.length);
		console.log('  📄 Messages structure:');
		messages.forEach((msg, idx) => {
			const preview = msg.content.substring(0, 100);
			console.log(`    ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
		});
		console.log('═'.repeat(80));
		console.log('');
		
		return messages;
	}
	
	// 📬 ОБЫЧНЫЙ ЧАТ: Используем стандартный промпт
	const profileContext = buildProfileContext(profile, customRules);
	console.log('  🎭 Profile context:', profileContext);

	// 🆕 НОВОЕ: Получаем промпт для конкретного профиля (кастомный или дефолтный)
	const systemPrompt = await getProfilePrompt(profile?.uid);
	console.log('  🎯 System prompt type:', systemPrompt === SYSTEM_PROMPT ? 'DEFAULT' : 'CUSTOM');

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
			console.log(`  ✂️ Formatted history truncated: ${formattedHistory.length} → ${truncatedHistory.length} chars`);
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
			console.log(`  ✂️ Fallback history truncated: ${conversationHistory.length} → ${recent.length} messages`);
		}
	}

	// ⭐ Определяем контекст для типа сообщения
	let messageContext = '';
	
	// НОВОЕ: Если есть typeInstructions - используем их
	if (typeInstructions) {
		messageContext = typeInstructions + '\n';
		console.log('  🎯 Using type instructions from chatMessagesExtractorService');
		console.log('  📏 Type instructions length:', typeInstructions.length, 'chars');
		const preview = typeInstructions.substring(0, 150).replace(/\n/g, ' ');
		console.log('  📝 Type instructions preview:', preview + '...');
	} else {
		// Пустые инструкции — норма для обычных текстовых ответов
		// (typeInstructions есть только для wink/emoji/image/video/gift).
		// История и системный промпт несут контекст и без них.
		console.log('  ℹ️  No type instructions (plain reply, system prompt + history apply)');
		if (manMessage && manMessage.includes('[Emoji]')) {
			// Fallback - старый метод для эмодзи
			messageContext = '[The man sent you an emoji/sticker - respond warmly with emotion and ask a question]\n';
			console.log('  😊 Detected emoji message - added emoji context (fallback)');
		}
	}

	// Страховка от неограниченного роста инструкций (catch-up дописывает NOTE)
	if (messageContext.length > 800) {
		console.log(`  ✂️ Type instructions truncated: ${messageContext.length} → 800 chars`);
		messageContext = messageContext.slice(-800);
	}

	// Добавляем текущее сообщение от мужчины
	const userName = profileName || profile?.username || 'yourself';
	const userMessage = `${profileContext}

${messageContext}Man's message: "${manMessage}"

Generate a natural, friendly response as ${userName}. Write a complete message (1-3 sentences).`;

	messages.push({
		role: 'user',
		content: userMessage,
	});

	console.log('  📨 Total messages in array:', messages.length);
	console.log('  📄 Messages structure:');
	messages.forEach((msg, idx) => {
		const preview = msg.content.substring(0, 100);
		console.log(`    ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
	});
	console.log('═'.repeat(80));
	console.log('');

	return messages;
};

/**
 * 🆕 Построить промпт для Activity Center (первое сообщение)
 * Используется когда мужчина поставил лайк/подмигнул/подписался
 * НЕ использует историю сообщений (её нет)
 */
export const buildActivityCenterPrompt = async ({
	activityType,
	manName,
	profile,
	customRules,
}) => {
	console.log('');
	console.log('🔔 [ACTIVITY CENTER] ===== BUILDING FIRST MESSAGE PROMPT =====');
	console.log('  👤 Profile:', profile?.username || 'N/A');
	console.log('  👨 Man name:', manName);
	console.log('  🎯 Activity type:', activityType);
	console.log('  📋 Custom rules count:', customRules?.length || 0);

	const messages = [];
	const profileContext = buildProfileContext(profile, customRules);

	// Получаем системный промпт
	const systemPrompt = await getProfilePrompt(profile?.uid);
	console.log('  🎯 System prompt type:', systemPrompt === SYSTEM_PROMPT ? 'DEFAULT' : 'CUSTOM');

	messages.push({
		role: 'system',
		content: systemPrompt,
	});

	// Определяем инструкции в зависимости от типа активности
	let activityInstructions = '';
	switch (activityType) {
		case 'favorite':
			activityInstructions = `A man named "${manName}" just followed/subscribed to your profile. This is his first action. Write a friendly, welcoming first message to start a conversation. Show interest and ask a question to engage him.`;
			break;
		case 'like':
			activityInstructions = `A man named "${manName}" just liked your profile. This is his first action. Write a warm, flirty first message to start a conversation. Show you noticed and are interested. Ask a question to get him talking.`;
			break;
		case 'wink':
			activityInstructions = `A man named "${manName}" just winked at you. This is a playful first move. Write a fun, flirty first message in response. Be playful and ask an engaging question.`;
			break;
		default:
			activityInstructions = `A man named "${manName}" showed interest in your profile. Write a friendly first message to start a conversation.`;
	}

	console.log('  💬 Activity instructions:', activityInstructions);

	// Собираем финальный промпт
	const userMessage = `${profileContext}

${activityInstructions}

IMPORTANT: This is the FIRST message in the conversation. There is NO previous chat history. Write a complete, standalone message (1-3 sentences) as ${profile?.username || 'yourself'}.`;

	messages.push({
		role: 'user',
		content: userMessage,
	});

	console.log('  📨 Total messages in array:', messages.length);
	console.log('  📄 Messages structure:');
	messages.forEach((msg, idx) => {
		const preview = msg.content.substring(0, 100);
		console.log(`    ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 100 ? '...' : ''}`);
	});
	console.log('═'.repeat(80));
	console.log('');

	return messages;
};
