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
		// Параметры зависят от провайдера: DeepSeek reasoning жрёт токены, ему нужен
		// запас 800; NVIDIA с выключенным thinking хватает 250 (см. историю Oski).
		const isDeepSeek = AI_PROVIDER === 'deepseek';
		const maxTokens = isDeepSeek ? 800 : 250;
		const temperature = isDeepSeek ? 1.1 : 0.9;

		console.log('  ⚙️ Parameters:');
		console.log(`    - Temperature: ${temperature} ${isDeepSeek ? '(deepseek high variety)' : '(nvidia coherent)'}`);
		console.log(`    - Max tokens: ${maxTokens} ${isDeepSeek ? '(deepseek: reasoning buffer)' : '(nvidia: no thinking)'}`);
		console.log('    - Top P: 0.95 (more diverse)');
		console.log('    - Frequency penalty: 0.7 (avoid repetition)');
		console.log('    - Presence penalty: 0.6 (encourage new topics)');
		console.log('    - Timeout: 45000ms');

		const requestBody = {
			model: AI_MODEL,
			messages: messages,
			temperature: temperature,
			max_tokens: maxTokens,
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
				timeout: 45000, // 45 секунд таймаут (было 30: NVIDIA на длинных промптах отвечала 28с+)
			},
		);
		const duration = Date.now() - startTime;

		const choice = response.data.choices?.[0] || {};
		const finishReason = choice.finish_reason || 'unknown';
		const reasoningContent = choice.message?.reasoning_content || '';
		const aiResponseRaw = choice.message?.content || '';
		const aiResponse = aiResponseRaw.trim();

		// Логируем finish_reason и reasoning для DeepSeek (там reasoning съедает токены)
		if (isDeepSeek || finishReason !== 'stop') {
			console.log(`  🏁 Finish reason: ${finishReason}`);
			if (reasoningContent) {
				console.log(`  🧠 Reasoning length: ${reasoningContent.length} chars, tokens≈${Math.round(reasoningContent.length / 4)}`);
			}
		}

		// ⚠️ Проверка на пустой ответ (может быть из-за content filter или length)
		if (!aiResponse || aiResponse.length === 0) {
			console.log('');
			console.error('❌ [AI DEBUG] ===== EMPTY RESPONSE FROM AI =====');
			console.error(`  🚨 ${AI_PROVIDER} returned empty response!`);
			if (finishReason === 'length') {
				console.error('  💡 Likely reason: max_tokens hit — reasoning consumed budget (DeepSeek reasoning 800/800 in your logs)');
				console.error('  🔧 Fix: increase max_tokens for deepseek or reduce prompt history');
			} else if (reasoningContent && reasoningContent.length > 500) {
				console.error('  💡 Likely reason: reasoning consumed all tokens, content empty (see reasoning_length above)');
			} else {
				console.error('  💡 Likely reason: Content filter blocked the response');
			}
			console.error('  🔄 Attempt:', retryCount + 1);
			console.error('  🏁 Finish reason:', finishReason);
			console.error(
				'  📊 Tokens used:',
				response.data.usage?.total_tokens || 'N/A',
				`(prompt ${response.data.usage?.prompt_tokens || '?'}, completion ${response.data.usage?.completion_tokens || '?'}, reasoning ${response.data.usage?.completion_tokens_details?.reasoning_tokens || '?'})`,
			);
			console.error(
				'  📋 Response data:',
				JSON.stringify(response.data, null, 2).slice(0, 4000),
			);
			console.error('═'.repeat(80));
			console.log('');

			// Создаём специальную ошибку с информацией о фильтре/длине
			const error = new Error(
				finishReason === 'length'
					? `Empty response from AI (${AI_PROVIDER}) - max_tokens length limit (reasoning consumed budget)`
					: `Empty response from AI (${AI_PROVIDER}) - likely content filter`,
			);
			error.isContentFilter = finishReason !== 'length';
			error.isLengthLimit = finishReason === 'length';
			error.finishReason = finishReason;
			error.usage = response.data.usage;
			error.reasoningLength = reasoningContent.length;
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
		console.error(`  🔌 Provider: ${AI_PROVIDER} (no auto-fallback)`);
		const status = error.response?.status;
		const dataMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
		console.error(`  🚨 Error: ${dataMsg.slice(0, 500)} ${status ? `(HTTP ${status}${status === 402 ? ' Payment Required — пополните баланс DeepSeek или AI_PROVIDER=nvidia' : ''})` : ''}`);
		if (error.code) console.error('  🔧 Code:', error.code);
		console.error('═'.repeat(80));
		console.log('');

		// Кидаем лёгкую ошибку без 5КБ тела и circular refs (ранее спамил 200 строк)
		const concise = new Error(status === 402 ? `DeepSeek 402 Payment Required: ${dataMsg.slice(0, 200)}` : error.message);
		concise.status = status;
		concise.isPaymentRequired = status === 402;
		concise.isRetryable = status !== 402;
		concise.originalMessage = error.message;
		throw concise;
	}
};
