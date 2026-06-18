// AI Response Service
// Сервис для генерации и отправки AI ответов с проверками статуса
// Работает через отдельный браузерный контекст для параллельной работы

// 🐛🐛🐛 DEBUG MODE - РЕЖИМ ОТЛАДКИ БЕЗ ОТПРАВКИ СООБЩЕНИЙ 🐛🐛🐛
// Установите в false для включения реальной отправки (после тестирования)
// Установите в true для режима отладки (сообщения НЕ отправляются, только логи)
const AI_DEBUG_MODE = true;

import aiService from './aiService/index.js';
import aiManagementService from './aiManagementService/index.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import pageHelpers from './browser/pageHelpers.js';
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';

const aiResponseService = {
	/**
	 * Генерировать AI ответ с проверками
	 * @param {Object} params
	 * @param {string} params.userId - ID пользователя
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {Object} params.profile - Профиль девушки
	 * @param {string} params.manMessage - Сообщение от мужчины
	 * @param {number} params.messageType - Тип сообщения (1 = текст, другие = эмодзи/медиа)
	 * @param {Array} params.conversationHistory - История переписки (опционально)
	 * @returns {Promise<string>} - Ответ AI
	 */
	generateResponse: async ({
		userId,
		accountId,
		profile,
		manMessage,
		messageType = 1,
		conversationHistory = [],
	}) => {
		try {
			console.log('[AI Response Service] Generating response...');
			console.log('[AI Response Service] User:', userId, 'Account:', accountId);

			// 1. Проверяем может ли пользователь использовать AI
			const canUserUse = await aiManagementService.canUserUseAi(userId);
			if (!canUserUse) {
				throw new Error('AI disabled for user');
			}

			// 2. Проверяем может ли аккаунт использовать AI
			const canAccountUse = await aiManagementService.canAccountUseAi(userId, accountId);
			if (!canAccountUse) {
				throw new Error('AI disabled for account');
			}

			console.log('[AI Response Service] AI checks passed, generating response...');

			// 3. Генерируем ответ через aiService
			const response = await aiService.generateResponse({
				profile,
				manMessage,
				messageType,
				conversationHistory,
			});

			console.log('[AI Response Service] Response generated successfully');

			return response;
		} catch (error) {
			console.error('[AI Response Service] Error generating response:', error);
			throw error;
		}
	},

	/**
	 * Отправить AI ответ через отдельный контекст
	 * @param {Object} params
	 * @param {string} params.userId - ID пользователя
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {number} params.profileUid - UID профиля
	 * @param {string} params.chatId - ID чата (формат: "profileUid_memberUid")
	 * @param {string} params.message - Текст сообщения
	 * @returns {Promise<Object>} - Результат отправки
	 */
	sendResponse: async ({ userId, accountId, profileUid, chatId, message }) => {
		try {
			console.log('[AI Response Service] Sending AI response...');
			console.log('[AI Response Service] Chat:', chatId);

			// 1. Проверяем может ли использоваться AI (перед отправкой)
			const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
			if (!canUse) {
				console.log('[AI Response Service] AI was disabled, cancelling send');
				throw new Error('AI disabled before send');
			}

		// 2. Получаем или создаём AI контекст
		const aiContext = await aiBrowserContextService.getOrCreateAiContext(accountId);
		const page = await pageHelpers.getOrCreatePage(aiContext);

		console.log('[AI Response Service] AI context ready, sending message...');

		// 🐛 DEBUG MODE: Блокируем отправку и выводим детальные логи
		let result;
		
		if (AI_DEBUG_MODE) {
			// ========== DEBUG MODE: ОТПРАВКА ЗАБЛОКИРОВАНА ==========
			console.log('');
			console.log('🚫🚫🚫 [AI DEBUG] MESSAGE SEND BLOCKED - Debug Mode Enabled 🚫🚫🚫');
			console.log('═'.repeat(80));
			console.log('📨 [AI DEBUG] Message details:');
			console.log('  - Chat ID:', chatId);
			console.log('  - Profile UID:', profileUid);
			console.log('  - Message text:', message);
			console.log('  - Message length:', message.length, 'characters');
			console.log('  - Account ID:', accountId);
			console.log('  - User ID:', userId);
			console.log('═'.repeat(80));
			console.log('✅ [AI DEBUG] Message would be sent if AI_DEBUG_MODE = false');
			console.log('🔧 [AI DEBUG] To enable real sending: Set AI_DEBUG_MODE = false in aiResponseService.js');
			console.log('═'.repeat(80));
			console.log('');
			
			// Симулируем успешную отправку
			result = {
				success: true,
				message: 'DEBUG MODE: Send skipped',
			};
		} else {
			// ========== PRODUCTION MODE: РЕАЛЬНАЯ ОТПРАВКА ==========
			// 3. Отправляем сообщение через AI контекст
			result = await page.evaluate(
				async ({ pUid, cId, msg }) => {
					try {
						if (typeof modelsChat === 'undefined') {
							throw new Error('modelsChat API not available');
						}

						// Переключаемся на профиль
						modelsChat.selectProfile(pUid);
						await new Promise(resolve => setTimeout(resolve, 500));

						// Открываем чат
						modelsChat.selectChat(cId);
						await new Promise(resolve => setTimeout(resolve, 800));

						// Находим editor
						const editor = document.querySelector('.emojionearea-editor');
						if (!editor) {
							throw new Error('Message input editor not found');
						}

						// Очищаем editor
						editor.textContent = '';
						editor.innerHTML = '';
						await new Promise(resolve => setTimeout(resolve, 300));

						// Устанавливаем текст
						editor.textContent = msg;
						editor.innerHTML = msg;
						editor.focus();

						// Триггерим события
						const events = ['input', 'change', 'keyup', 'keydown', 'focus'];
						events.forEach(eventType => {
							const event = new Event(eventType, { bubbles: true, cancelable: true });
							editor.dispatchEvent(event);
						});

						// Ждём перед отправкой
						await new Promise(resolve => setTimeout(resolve, 700));

						// Отправляем
						modelsChat.sendMessage();
						await new Promise(resolve => setTimeout(resolve, 500));

						return {
							success: true,
							message: 'AI message sent successfully',
						};
					} catch (error) {
						return {
							success: false,
							error: error.message,
						};
					}
				},
				{ pUid: profileUid, cId: chatId, msg: message },
			);

			if (!result.success) {
				throw new Error(result.error || 'Failed to send AI message');
			}

			console.log('[AI Response Service] AI message sent successfully');
		}

			return {
				success: true,
				chatId,
				profileUid,
				message,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error('[AI Response Service] Error sending AI response:', error);
			throw error;
		}
	},

	/**
	 * Полный цикл: генерация + отправка AI ответа
	 * @param {Object} params
	 * @param {string} params.userId - ID пользователя
	 * @param {string} params.accountId - ID Luxee аккаунта
	 * @param {number} params.profileUid - UID профиля
	 * @param {string} params.chatId - ID чата
	 * @param {Object} params.profile - Профиль девушки
	 * @param {string} params.manMessage - Сообщение от мужчины
	 * @param {number} params.messageType - Тип сообщения (1 = текст, другие = эмодзи/медиа)
	 * @param {Array} params.conversationHistory - История переписки
	 * @returns {Promise<Object>} - Результат
	 */
	generateAndSend: async ({
		userId,
		accountId,
		profileUid,
		chatId,
		profile,
		manMessage,
		messageType = 1,
		conversationHistory = [],
	}) => {
		try {
			console.log('[AI Response Service] Starting generate and send cycle...');

			// 1. Генерируем ответ
			const aiResponse = await aiResponseService.generateResponse({
				userId,
				accountId,
				profile,
				manMessage,
				messageType,
				conversationHistory,
			});

			console.log('[AI Response Service] AI response:', aiResponse);

			// 2. Проверяем статус AI ещё раз перед отправкой
			const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
			if (!canUse) {
				console.log('[AI Response Service] AI was disabled during generation, not sending');
				return {
					success: false,
					cancelled: true,
					reason: 'AI disabled during generation',
					generatedResponse: aiResponse.response, // ✅ FIX: Extract text from object
				};
			}

			// 3. Отправляем ответ
			// ✅ FIX: aiResponse is {response: string, retries: number}, extract .response
			const sendResult = await aiResponseService.sendResponse({
				userId,
				accountId,
				profileUid,
				chatId,
				message: aiResponse.response, // ✅ FIX: Was sending [object Object]
			});

			console.log('[AI Response Service] Generate and send cycle completed successfully');

			return {
				success: true,
				generatedResponse: aiResponse,
				sendResult,
			};
		} catch (error) {
			console.error('[AI Response Service] Error in generate and send cycle:', error);
			throw error;
		}
	},

	/**
	 * Загрузить последнее сообщение из чата для контекста
	 * @param {string} accountId - ID Luxee аккаунта
	 * @param {string} chatId - ID чата
	 * @returns {Promise<Object|null>} - Последнее сообщение или null
	 */
	getLastMessage: async (accountId, chatId) => {
		try {
			const aiContext = await aiBrowserContextService.getAiContext(accountId);
			if (!aiContext) {
				console.log('[AI Response Service] No AI context available');
				return null;
			}

			const page = await pageHelpers.getOrCreatePage(aiContext);

			const lastMessage = await page.evaluate(cId => {
				if (typeof modelsChat === 'undefined' || !modelsChat.getChats?.list) {
					return null;
				}

				const chat = modelsChat.getChats.list[cId];
				if (!chat || !chat.message || chat.message.length === 0) {
					return null;
				}

				// Получаем последнее сообщение
				const last = chat.message[chat.message.length - 1];

				return {
					id: last._id,
					uid: last.uid,
					body: last.body,
					createdAt: last.createdAt,
					from: last.uid === chat.members?.find(m => m.type === 10)?.uid ? 'man' : 'woman',
				};
			}, chatId);

			return lastMessage;
		} catch (error) {
			console.error('[AI Response Service] Error getting last message:', error);
			return null;
		}
	},
};

export default aiResponseService;
