// Модуль для построения промптов и контекста

import { SYSTEM_PROMPT } from './config.js';

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
	if (customRules && Array.isArray(customRules) && customRules.length > 0) {
		const rulesText = customRules.map(rule => rule.content).join('\n');
		profileContext += `\n\nAdditional rules for this profile:\n${rulesText}`;
	}

	profileContext += `\n\nI should use this information ONLY when he asks where I'm from, how old I am, or who I am. Don't mention it in every message.`;

	return profileContext;
};

/**
 * Построить массив сообщений для AI API
 * 📜 НОВОЕ: Поддержка formattedHistory и typeInstructions из chatMessagesExtractorService
 */
export const buildMessages = ({ 
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
	console.log('  👨 Man name:', manName || 'N/A');
	console.log('  � Man message:', manMessage);
	console.log('  📊 Message type:', messageType);
	console.log('  📜 Conversation history length:', conversationHistory?.length || 0);
	console.log('  📋 Custom rules count:', customRules?.length || 0);
	console.log('  🆕 Using formatted history:', formattedHistory ? 'YES' : 'NO');
	console.log('  🆕 Using type instructions:', typeInstructions ? 'YES' : 'NO');
	
	const messages = [];
	const profileContext = buildProfileContext(profile, customRules);

	console.log('  🎭 Profile context:', profileContext);

	// Добавляем system message отдельно (лучше для AI)
	messages.push({
		role: 'system',
		content: SYSTEM_PROMPT,
	});

	// 📜 НОВОЕ: Если есть отформатированная история - используем её
	if (formattedHistory) {
		console.log('  📜 Using NEW formatted history from chatMessagesExtractorService');
		
		// Добавляем историю как контекст
		messages.push({
			role: 'user',
			content: formattedHistory,
		});
		console.log('  💬 Added formatted history as context');
	} else if (conversationHistory && conversationHistory.length > 0) {
		// Fallback - старый метод
		console.log('  📜 Using OLD conversation history format (fallback)');
		conversationHistory.forEach(msg => {
			messages.push({
				role: msg.from === 'man' ? 'user' : 'assistant',
				content: msg.body,
			});
		});
		console.log('  💬 Added', conversationHistory.length, 'history messages');
	}

	// ⭐ Определяем контекст для типа сообщения
	let messageContext = '';
	
	// НОВОЕ: Если есть typeInstructions - используем их
	if (typeInstructions) {
		messageContext = typeInstructions + '\n';
		console.log('  🎯 Using type instructions from chatMessagesExtractorService');
	} else if (manMessage.includes('[Emoji]')) {
		// Fallback - старый метод для эмодзи
		messageContext = '[The man sent you an emoji/sticker - respond warmly with emotion and ask a question]\n';
		console.log('  😊 Detected emoji message - added emoji context (fallback)');
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
