// Модуль для построения промптов и контекста

import { SYSTEM_PROMPT } from './config.js';

/**
 * Построить контекст профиля для AI
 */
export const buildProfileContext = (profile, customRules) => {
	let profileContext = `My profile information:
- Name: ${profile.username}
- Age: ${profile.age || 'not specified'}
- Country: ${profile.country || 'not specified'}
- City: ${profile.city || 'not specified'}`;

	// Добавляем кастомные правила если есть
	if (customRules && customRules.trim()) {
		profileContext += `\n\nAdditional rules for this profile:\n${customRules}`;
	}

	profileContext += `\n\nI should use this information ONLY when he asks where I'm from, how old I am, or who I am. Don't mention it in every message.`;

	return profileContext;
};

/**
 * Построить массив сообщений для AI API
 */
export const buildMessages = ({ conversationHistory, manMessage, profile, customRules }) => {
	const messages = [];
	const profileContext = buildProfileContext(profile, customRules);

	// Добавляем историю переписки если есть
	if (conversationHistory && conversationHistory.length > 0) {
		conversationHistory.forEach(msg => {
			messages.push({
				role: msg.from === 'man' ? 'user' : 'assistant',
				content: msg.body,
			});
		});
	}

	// Добавляем текущее сообщение от мужчины С ПРОМПТОМ В НАЧАЛЕ
	const messageWithPrompt = `${SYSTEM_PROMPT}

${profileContext}

---

Man's message: ${manMessage}

Your response (as ${profile.username}):`;

	messages.push({
		role: 'user',
		content: messageWithPrompt,
	});

	return messages;
};
