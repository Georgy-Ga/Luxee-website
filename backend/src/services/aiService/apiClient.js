// Модуль для работы с AI API

import axios from 'axios';
import { vlog } from '../verbose.js';
import { AI_API_KEY, AI_API_URL, AI_MODEL, AI_PROVIDER } from './config.js';

// TEMP (NVIDIA stalls, 2026-09): таймаут поднят 45→60с. Вернуть 30000 при
// переезде обратно на deepseek (см. docs/AI_PROVIDER_SWITCH.md).
const AI_REQUEST_TIMEOUT_MS = 60000;

// Глобальный семафор параллельных ИИ-запросов (на процесс; бэкенд у нас
// один инстанс и локально, и в докере). Endpoint не отвечает 429, а молча
// складывает лишние запросы — и они гниют до таймаута. Поэтому режем
// конкурентность: не больше AI_MAX_CONCURRENT одновременно, остальные ждут
// локально (дешевле висящего 60с запроса). Deadlock исключён: слот всегда
// освобождается в finally, передача строго FIFO.
const AI_MAX_CONCURRENT = 4;
let aiActiveSlots = 0;
const aiWaiters = [];
const acquireAiSlot = () => {
	if (aiActiveSlots < AI_MAX_CONCURRENT) {
		aiActiveSlots++;
		return Promise.resolve();
	}
	return new Promise(resolve => aiWaiters.push(resolve));
};
const releaseAiSlot = () => {
	if (aiWaiters.length > 0) {
		aiWaiters.shift()(); // слот переходит ждущему напрямую
	} else {
		aiActiveSlots = Math.max(0, aiActiveSlots - 1);
	}
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Сетевой сбой (таймаут/DNS/обрыв) без HTTP-ответа? Да — ретраить можно.
// HTTP-статус (4xx/5xx) — нет, это отказ, а не глитч.
const isTimeoutLikeError = e =>
	!e.response &&
	(e.code === 'ECONNABORTED' ||
		/timeout|etimedout|econnreset|socket hang up|enotfound|eai_again/i.test(
			e.message || '',
		));

// Один POST со слотом семафора и максимум ОДНИМ повтором при сетевом
// таймауте (bounded: шторм дауна не раздуваем).
const postToAI = async requestBody => {
	const queuedAt = Date.now();
	await acquireAiSlot();
	try {
		const queuedMs = Date.now() - queuedAt;
		if (queuedMs > 2000) {
			console.log(`  ⏳ Waited ${queuedMs}ms for AI slot (${aiActiveSlots}/${AI_MAX_CONCURRENT} busy)...`);
		}
		let lastError = null;
		for (let attempt = 0; attempt <= 1; attempt++) {
			try {
				return await axios.post(
					`${AI_API_URL}/chat/completions`,
					requestBody,
					{
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${AI_API_KEY}`,
						},
						timeout: AI_REQUEST_TIMEOUT_MS,
					},
				);
			} catch (e) {
				lastError = e;
				if (attempt === 0 && isTimeoutLikeError(e)) {
					console.log('  ⏳ AI network timeout, single bounded retry in 5s...');
					await sleep(5000);
					continue;
				}
				throw e;
			}
		}
		throw lastError;
	} finally {
		releaseAiSlot();
	}
};

/**
 * Отправить запрос к AI API
 * Активный провайдер выбирается в config.js (AI_PROVIDER=nvidia|deepseek).
 * DeepSeek-код сохранён: возврат — одной переменной окружения.
 */
export const sendAIRequest = async (messages, retryCount = 0) => {
	try {
		vlog('');
		vlog('🤖 [AI DEBUG] ===== SENDING REQUEST TO AI API =====');
		vlog(`  🔄 Attempt: ${retryCount + 1}`);
		vlog('  🔌 Provider:', AI_PROVIDER);
		vlog('  🌐 API URL:', AI_API_URL);
		vlog('  🎯 Model:', AI_MODEL);
		vlog('  📨 Messages count:', messages.length);
		// Параметры зависят от провайдера: DeepSeek reasoning жрёт токены, ему нужен
		// запас 800; NVIDIA с выключенным thinking хватает 250 (см. историю Oski).
		const isDeepSeek = AI_PROVIDER === 'deepseek';
		const maxTokens = isDeepSeek ? 800 : 250;
		const temperature = isDeepSeek ? 1.1 : 0.9;

		console.log('  ⚙️ Parameters:');
		vlog(`    - Temperature: ${temperature} ${isDeepSeek ? '(deepseek high variety)' : '(nvidia coherent)'}`);
		vlog(`    - Max tokens: ${maxTokens} ${isDeepSeek ? '(deepseek: reasoning buffer)' : '(nvidia: no thinking)'}`);
		vlog('    - Top P: 0.95 (more diverse)');
		vlog('    - Frequency penalty: 0.7 (avoid repetition)');
		vlog('    - Presence penalty: 0.6 (encourage new topics)');
		vlog('    - Timeout: 60000ms (TEMP, see top of file)');

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
		vlog(`  📦 Request summary: ${messages.length} messages, ~${promptChars} chars (full body NOT logged)`);
		vlog('  ⏳ Sending request...');

		const startTime = Date.now();
		const response = await postToAI(requestBody);
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
		vlog('  🔍 Response stats:');
		vlog(
			'    - Tokens used (prompt):',
			response.data.usage?.prompt_tokens || 'N/A',
		);
		vlog(
			'    - Tokens used (completion):',
			response.data.usage?.completion_tokens || 'N/A',
		);
		vlog(
			'    - Tokens used (total):',
			response.data.usage?.total_tokens || 'N/A',
		);
		vlog('═'.repeat(80));
		vlog('');

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
