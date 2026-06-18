// Модуль для работы с AI API

import axios from 'axios';
import { AI_API_URL, AI_API_KEY, AI_MODEL } from './config.js';

/**
 * Отправить запрос к AI API
 */
export const sendAIRequest = async (messages, retryCount = 0) => {
	try {
		console.log('');
		console.log('🤖 [AI DEBUG] ===== SENDING REQUEST TO DEEPSEEK API =====');
		console.log(`  🔄 Attempt: ${retryCount + 1}`);
		console.log('  🌐 API URL:', AI_API_URL);
		console.log('  🎯 Model:', AI_MODEL);
		console.log('  📨 Messages count:', messages.length);
		console.log('  ⚙️ Parameters:');
		console.log('    - Temperature: 0.8 (creative)');
		console.log('    - Max tokens: 200 (short responses)');
		console.log('    - Top P: 0.9');
		console.log('    - Timeout: 30000ms');

		const requestBody = {
			model: AI_MODEL,
			messages: messages,
			temperature: 0.8, // Более креативные ответы
		max_tokens: 200, // Увеличено с 150 до 200 для предотвращения обрезания
			top_p: 0.9,
		};

		console.log('  📦 Full request body:');
		console.log(JSON.stringify(requestBody, null, 2));
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
		
		// ⚠️ Проверка на пустой ответ
		if (!aiResponse || aiResponse.length === 0) {
			console.log('');
			console.error('❌ [AI DEBUG] ===== EMPTY RESPONSE FROM AI =====');
			console.error('  🚨 DeepSeek returned empty response!');
			console.error('  🔄 Attempt:', retryCount + 1);
			console.error('  📊 Tokens used:', response.data.usage?.total_tokens || 'N/A');
			console.error('═'.repeat(80));
			console.log('');
			throw new Error('Empty response from DeepSeek AI');
		}
		
		console.log('  ✅ Response received in', duration, 'ms');
		console.log('  📥 Raw AI response:', aiResponse);
		console.log('  📊 Response length:', aiResponse.length, 'characters');
		console.log('  🔍 Response stats:');
		console.log('    - Tokens used (prompt):', response.data.usage?.prompt_tokens || 'N/A');
		console.log('    - Tokens used (completion):', response.data.usage?.completion_tokens || 'N/A');
		console.log('    - Tokens used (total):', response.data.usage?.total_tokens || 'N/A');
		console.log('═'.repeat(80));
		console.log('');

		return aiResponse;
	} catch (error) {
		console.log('');
		console.error('❌ [AI DEBUG] ===== ERROR CALLING DEEPSEEK API =====');
		console.error('  🚨 Error message:', error.message);
		
		// Логируем детали ошибки от API
		if (error.response) {
			console.error('  📛 HTTP Status:', error.response.status);
			console.error('  📄 Error data:', JSON.stringify(error.response.data, null, 2));
		}
		
		if (error.code) {
			console.error('  🔧 Error code:', error.code);
		}
		
		console.error('═'.repeat(80));
		console.log('');
		
		throw error;
	}
};
