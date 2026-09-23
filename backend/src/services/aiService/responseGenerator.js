// Модуль для генерации ответов AI

import aiRuleService from '../aiRuleService.js';
import { sendAIRequest } from './apiClient.js';
import { buildMessages } from './promptBuilder.js';
import {
	cleanResponse,
	containsForbiddenPhrases,
	MAX_REPLY_CHARS,
	replyLength,
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
	activityCenterData = null,
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
			activityCenterData,
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
		let cleanedResponse = cleanResponse(aiResponse);

		// 📏 Лимит сайта: ответ обязан быть ≤200 символов. БЕЗ обрезки:
// сначала просим переписать тот же ответ короче, затем (если всё ещё
// длинно) — сгенерировать новый короткий ответ. Ограничено 3 доп-запросами,
// чтобы не жечь токены. Не влезли — бросаем ошибку: цикл повторит позже
// с новой генерацией, обрезанный кусок не уйдёт никогда.
		const MAX_LENGTH_ATTEMPTS = 3;
		let lengthAttempts = 0;
		while (
			replyLength(cleanedResponse) > MAX_REPLY_CHARS &&
			lengthAttempts < MAX_LENGTH_ATTEMPTS
		) {
			lengthAttempts++;
			console.log(
				`  📏 Too long (${replyLength(cleanedResponse)} chars), shorten attempt ${lengthAttempts}/${MAX_LENGTH_ATTEMPTS}...`,
			);
			messages.push({
				role: 'user',
				content:
					lengthAttempts === 1
						? `Too long — rewrite the same reply strictly under ${MAX_REPLY_CHARS} characters, keep the meaning and stay natural.`
						: `Generate a NEW short reply strictly under ${MAX_REPLY_CHARS} characters. Do not repeat the previous long reply, write it fresh and concise.`,
			});
			try {
				const retryRaw = await sendAIRequest(messages, retryCount);
				const retryCleaned = cleanResponse(retryRaw);
				if (retryCleaned && !containsForbiddenPhrases(retryCleaned)) {
					aiResponse = retryRaw;
					cleanedResponse = retryCleaned;
					console.log(
						`  📏 Attempt ${lengthAttempts} result: ${replyLength(cleanedResponse)} chars`,
					);
				} else {
					console.log('  📏 Attempt produced empty/forbidden text, trying again...');
				}
			} catch (shortenError) {
				console.log(
					`  📏 Shorten attempt failed (${shortenError.message}), stop retrying length`,
				);
				break;
			}
		}
		if (replyLength(cleanedResponse) > MAX_REPLY_CHARS) {
			throw new Error(
				`AI reply exceeds ${MAX_REPLY_CHARS} chars after ${lengthAttempts} shorten attempts — will regenerate on retry`,
			);
		}
		// Пустой ответ после чистки (бывает: модель вернула одну кавычку,
		// finish_reason=length) — отправлять нечего, пусть цикл сгенерирует заново.
		if (!cleanedResponse || replyLength(cleanedResponse) === 0) {
			throw new Error('AI returned empty response after cleaning — will regenerate on retry');
		}

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
