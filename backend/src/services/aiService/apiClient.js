// Модуль для работы с AI API

import axios from 'axios';
import { AI_API_KEY, AI_API_URL, AI_MODEL, AI_PROVIDER } from './config.js';

/**
 * Отправить запрос к AI API
 * Активный провайдер выбирается в config.js (AI_PROVIDER=nvidia|deepseek).
 * DeepSeek-код сохранён: возврат — одной переменной окружения.
 */
export const sendAIRequest = async (messages, retryCount = 0) => {
	try {
		console.log('');
		console.log('🤖 [AI DEBUG] ===== SENDING REQUEST TO AI API =====');
		console.log(`  🔄 Attempt: ${retryCount + 1}`);
		console.log('  🔌 Provider:', AI_PROVIDER);
		console.log('  🌐 API URL:', AI_API_URL);
		console.log('  🎯 Model:', AI_MODEL);
		console.log('  📨 Messages count:', messages.length);
		console.log('  ⚙️ Parameters:');
		console.log('    - Temperature: 0.9 (varied but coherent)');
		console.log('    - Max tokens: 250 (replies are 20-100 tokens, no need for 800)');
		console.log('    - Top P: 0.95 (more diverse)');
		console.log('    - Frequency penalty: 0.7 (avoid repetition)');
		console.log('    - Presence penalty: 0.6 (encourage new topics)');
		console.log('    - Timeout: 30000ms');

		const requestBody = {
			model: AI_MODEL,
			messages: messages,
			temperature: 0.9, // Было 1.1: длинные/разнообразные completions против ТЗ 1-3 sentences; 0.9 держит вариативность короче
			max_tokens: 250, // Было 800: реальные ответы 20-100 токенов; потолок не тратится, но режет риск длинных простыней
			top_p: 0.95, // Увеличено с 0.9 → менее предсказуемые ответы
			frequency_penalty: 0.7, // НОВОЕ! Штрафует за повторение одних и тех же токенов
			presence_penalty: 0.6, // НОВОЕ! Поощряет использование новых тем и слов
		};

		// Только NVIDIA: reasoning обязан быть выключен.
		// Проверено вживую: с enable_thinking=true процесс мышления вываливается
		// в видимый текст и съедает весь max_tokens. DeepSeek этот параметр не знает — не слать.
		if (AI_PROVIDER === 'nvidia') {
			requestBody.chat_template_kwargs = { enable_thinking: false };
		}

		// НЕ дампим всё тело запроса: system ~4К + история в КАЖДОМ чате раздували логи на десятки КБ и светили PII.
		// Для диагностики достаточно размеров.
		const promptChars = messages.reduce(
			(sum, m) => sum + (m.content?.length || 0),
			0,
		);
		console.log(`  📦 Request summary: ${messages.length} messages, ~${promptChars} chars (full body NOT logged)`);
		console.log('  ⏳ Sending request...');

		const startTime = Date.now();
		const response = await axios.post(
			`${AI_API_URL}/chat/completions`,
			requestBody,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${AI_API_KEY}`,
				},
				timeout: 30000, // 30 секунд таймаут
			},
		);
		const duration = Date.now() - startTime;

		const aiResponse = response.data.choices[0].message.content.trim();

		// ⚠️ Проверка на пустой ответ (может быть из-за content filter провайдера)
		if (!aiResponse || aiResponse.length === 0) {
			console.log('');
			console.error('❌ [AI DEBUG] ===== EMPTY RESPONSE FROM AI =====');
			console.error(`  🚨 ${AI_PROVIDER} returned empty response!`);
			console.error('  💡 Likely reason: Content filter blocked the response');
			console.error('  🔄 Attempt:', retryCount + 1);
			console.error(
				'  📊 Tokens used:',
				response.data.usage?.total_tokens || 'N/A',
			);
			console.error(
				'  📋 Response data:',
				JSON.stringify(response.data, null, 2),
			);
			console.error('═'.repeat(80));
			console.log('');

			// Создаём специальную ошибку с информацией о фильтре
			const error = new Error(
				`Empty response from AI (${AI_PROVIDER}) - likely content filter`,
			);
			error.isContentFilter = true;
			error.usage = response.data.usage;
			throw error;
		}

		console.log('  ✅ Response received in', duration, 'ms');
		console.log('  📥 Raw AI response:', aiResponse);
		console.log('  📊 Response length:', aiResponse.length, 'characters');
		console.log('  🔍 Response stats:');
		console.log(
			'    - Tokens used (prompt):',
			response.data.usage?.prompt_tokens || 'N/A',
		);
		console.log(
			'    - Tokens used (completion):',
			response.data.usage?.completion_tokens || 'N/A',
		);
		console.log(
			'    - Tokens used (total):',
			response.data.usage?.total_tokens || 'N/A',
		);
		console.log('═'.repeat(80));
		console.log('');

		return aiResponse;
	} catch (error) {
		console.log('');
		console.error('❌ [AI DEBUG] ===== ERROR CALLING AI API =====');
		console.error(`  🔌 Provider: ${AI_PROVIDER}`);
		console.error('  🚨 Error message:', error.message);

		// Логируем детали ошибки от API
		if (error.response) {
			console.error('  📛 HTTP Status:', error.response.status);
			console.error(
				'  📄 Error data:',
				JSON.stringify(error.response.data, null, 2),
			);
		}

		if (error.code) {
			console.error('  🔧 Error code:', error.code);
		}

		console.error('═'.repeat(80));
		console.log('');

		throw error;
	}
};
