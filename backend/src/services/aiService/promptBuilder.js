// Модуль для построения промптов и контекста

import { SYSTEM_PROMPT } from './config.js';

/**
 * Построить контекст профиля для AI
 */
export const buildProfileContext = (profile, customRules) => {
	let profileContext = `My profile information:
- Name: ${profile?.username || 'not specified'}
- Age: ${profile?.age || 'not specified'}
- Country: ${profile?.country || 'not specified'}
- City: ${profile?.city || 'not specified'}`;

	// Добавляем кастомные правила если есть (customRules это массив объектов)
	if (customRules && Array.isArray(customRules) && customRules.length > 0) {
		const rulesText = customRules.map(rule => rule.content).join('\n');
		profileContext += `\n\nAdditional rules for this profile:\n${rulesText}`;
	}

	profileContext += `\n\nI should use this information ONLY when he asks where I'm from, how old I am, or who I am. Don't mention it in every message.`;

	return profileContext;
};

/**
 * Построить массив сообщений для AI API
 */
export const buildMessages = ({ conversationHistory, manMessage, messageType, profile, customRules }) => {
	console.log('');
	console.log('📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====');
	console.log('  👤 Profile:', profile?.username || 'N/A');
	console.log('  📨 Man message:', manMessage);
	console.log('  📊 Message type:', messageType);
	console.log('  📜 Conversation history length:', conversationHistory?.length || 0);
	console.log('  📋 Custom rules count:', customRules?.length || 0);
	
	const messages = [];
	const profileContext = buildProfileContext(profile, customRules);

	console.log('  🎭 Profile context:', profileContext);

	// Добавляем историю переписки если есть
	if (conversationHistory && conversationHistory.length > 0) {
		conversationHistory.forEach(msg => {
			messages.push({
				role: msg.from === 'man' ? 'user' : 'assistant',
				content: msg.body,
			});
		});
		console.log('  💬 Added', conversationHistory.length, 'history messages');
	}

	// Добавляем system message отдельно (лучше для AI)
	messages.unshift({
		role: 'system',
		content: SYSTEM_PROMPT,
	});

	// ⭐ Определяем контекст для эмодзи
	let messageContext = '';
	if (manMessage.includes('[Emoji]')) {
		messageContext = '[The man sent you an emoji/sticker - respond warmly with emotion and ask a question]\n';
		console.log('  😊 Detected emoji message - added emoji context');
	}

	// Добавляем текущее сообщение от мужчины
	const userMessage = `${profileContext}

${messageContext}Man's message: "${manMessage}"

Generate a natural, friendly response as ${profile.username}. Write a complete message (1-3 sentences).`;

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
