// Модуль для генерации ответов AI

import aiRuleService from '../aiRuleService.js';
import { sendAIRequest } from './apiClient.js';
import { buildMessages } from './promptBuilder.js';
import {
	cleanResponse,
	containsForbiddenPhrases,
} from './responseValidator.js';

// Ретраи только для forbidden-phrases. Было 3: каждая попытка слала ВЕСЬ
// контекст заново +2 сообщения → до 3x prompt_tokens за 1 ответ юзера.
// Стало 2, плохой ответ храним обрезанным (достаточно для коррекции).
const MAX_RETRIES = 2;
const MAX_BAD_RESPONSE_CHARS = 200;

/**
 * Генерировать ответ AI на сообщение мужчины
 * 📜 НОВОЕ: Поддержка formattedHistory и typeInstructions
 */
export const generateResponse = async ({
	manMessage,
	messageType,
	profile,
	conversationHistory = [],
	formattedHistory = '',
	typeInstructions = '',
	profileName = '',
	manName = '',
}) => {
	try {
		console.log('');
		console.log('🎨 [AI DEBUG] ===== GENERATING AI RESPONSE =====');
		console.log('  👤 Profile:', profile.username || profileName);
		console.log('  👨 Man:', manName || 'N/A');
		console.log('   Man message:', manMessage);
		console.log('  📊 Message type:', messageType);
		console.log(
			'  📜 History: array=',
			conversationHistory.length,
			'formatted=',
			formattedHistory ? `${formattedHistory.length} chars` : 'none',
		);
		console.log('  🆕 Has formatted history:', formattedHistory ? 'YES' : 'NO');
		console.log('  🆕 Has type instructions:', typeInstructions ? 'YES' : 'NO');

		// Получаем активные кастомные правила
		const customRules = await aiRuleService.getActiveRules();
		console.log('  📋 Custom rules loaded:', customRules?.length || 0);

		// Строим сообщения для AI с новыми параметрами
		// 🆕 ВАЖНО: buildMessages теперь async (для получения кастомного промпта)
		const messages = await buildMessages({
			conversationHistory,
			manMessage,
			messageType,
			profile,
			customRules,
			formattedHistory,
			typeInstructions,
			profileName,
			manName,
		});

		// Пытаемся получить ответ (с повторами если AI призналась что она бот)
		let aiResponse = null;
		let retryCount = 0;

		console.log('  🔁 Max retries allowed:', MAX_RETRIES);

		while (retryCount < MAX_RETRIES) {
			// Отправляем запрос к AI
			aiResponse = await sendAIRequest(messages, retryCount);

			// Проверяем на запрещенные фразы
			const hasForbidden = containsForbiddenPhrases(aiResponse);

			if (hasForbidden) {
				console.log('');
				console.log(
					`⚠️ [AI DEBUG] ===== RETRY ${retryCount + 1}/${MAX_RETRIES} - Forbidden Phrases Detected =====`,
				);
				console.log('  🚫 Response contains forbidden phrases!');
				console.log('  📝 Bad response:', aiResponse);
				console.log('  🔄 Adding correction message and retrying...');

				// Добавляем короткое предупреждение (плохой ответ — обрезанным,
				// иначе каждая retry-попытка раздувает контекст и жрёт токены)
				messages.push({
					role: 'assistant',
					content: String(aiResponse).slice(0, MAX_BAD_RESPONSE_CHARS),
				});
				messages.push({
					role: 'user',
					content:
						'You revealed you are AI. Never do that — always stay in character as a real woman. Rewrite the reply naturally.',
				});

				retryCount++;
				console.log('═'.repeat(80));
				console.log('');
				continue;
			}

			// Ответ прошел проверку
			console.log('  ✅ Response passed forbidden phrases check');
			break;
		}

		// Если после всех попыток все еще содержит запрещенные фразы
		if (containsForbiddenPhrases(aiResponse)) {
			console.log('');
			console.error('❌ [AI DEBUG] ===== FATAL ERROR =====');
			console.error(
				'  🚨 Failed to get valid response after',
				MAX_RETRIES,
				'retries',
			);
			console.error('  📝 Final bad response:', aiResponse);
			console.error('═'.repeat(80));
			console.log('');
			throw new Error(
				'AI failed to generate appropriate response after multiple attempts',
			);
		}

		// Очищаем ответ
		const cleanedResponse = cleanResponse(aiResponse);

		console.log('  🧹 Response cleaned');
		console.log('  📤 Final response:', cleanedResponse);
		console.log('  📊 Stats:');
		console.log('    - Original length:', aiResponse.length);
		console.log('    - Cleaned length:', cleanedResponse.length);
		console.log('    - Retries used:', retryCount);
		console.log('═'.repeat(80));
		console.log('');

		return {
			response: cleanedResponse,
			retries: retryCount,
		};
	} catch (error) {
		console.log('');
		console.error('❌ [AI DEBUG] ===== ERROR IN RESPONSE GENERATION =====');
		console.error('  🚨 Error:', error.message);
		console.error('  📚 Stack:', error.stack);
		console.error('═'.repeat(80));
		console.log('');
		throw error;
	}
};
