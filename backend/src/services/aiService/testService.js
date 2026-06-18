// Модуль для тестирования AI

import { buildMessages } from './promptBuilder.js';
import { sendAIRequest } from './apiClient.js';
import { cleanResponse } from './responseValidator.js';

/**
 * Тестовый метод для проверки AI
 */
export const testAI = async ({ manMessage, profile, conversationHistory = [] }) => {
	try {
		console.log('[AI Service] Testing AI...');

		// Строим сообщения
		const messages = buildMessages({
			conversationHistory,
			manMessage,
			profile,
			customRules: [], // Без кастомных правил для теста (пустой массив вместо null)
		});

		// Отправляем запрос
		const aiResponse = await sendAIRequest(messages);

		// Очищаем ответ
		const cleanedResponse = cleanResponse(aiResponse);

		console.log('[AI Service] Test response:', cleanedResponse);

		return {
			response: cleanedResponse,
			success: true,
		};
	} catch (error) {
		console.error('[AI Service] Test error:', error);
		throw error;
	}
};
