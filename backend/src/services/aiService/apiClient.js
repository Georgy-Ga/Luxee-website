// Модуль для работы с AI API

import axios from 'axios';
import { AI_API_URL, AI_API_KEY, AI_MODEL } from './config.js';

/**
 * Отправить запрос к AI API
 */
export const sendAIRequest = async (messages, retryCount = 0) => {
	try {
		console.log(`[AI Service] Sending request to AI API (attempt ${retryCount + 1})...`);
		console.log('[AI Service] Messages count:', messages.length);

		const response = await axios.post(
			`${AI_API_URL}/chat/completions`,
			{
				model: AI_MODEL,
				messages: messages,
				temperature: 0.8, // Более креативные ответы
				max_tokens: 150, // Короткие ответы
				top_p: 0.9,
			},
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${AI_API_KEY}`,
				},
				timeout: 30000, // 30 секунд таймаут
			},
		);

		const aiResponse = response.data.choices[0].message.content.trim();
		console.log('[AI Service] AI Response (raw):', aiResponse);

		return aiResponse;
	} catch (error) {
		console.error('[AI Service] Error calling AI API:', error.message);
		
		// Логируем детали ошибки от API
		if (error.response) {
			console.error('[AI Service] Error status:', error.response.status);
			console.error('[AI Service] Error data:', JSON.stringify(error.response.data, null, 2));
		}
		
		throw error;
	}
};
