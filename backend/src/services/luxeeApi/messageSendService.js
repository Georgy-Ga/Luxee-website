// Сервис для отправки сообщений через Luxee
// ✅ Работает через очередь
// ✅ Переключается на профиль
// ✅ Открывает чат
// ✅ Отправляет сообщение

// 🚨🚨🚨 KILL SWITCH - БЛОКИРОВКА ОТПРАВКИ AI СООБЩЕНИЙ 🚨🚨🚨
// Установите в false для разрешения отправки
// Установите в true для блокировки (РЕКОМЕНДУЕТСЯ во время разработки)
const AI_MESSAGE_SENDING_DISABLED = false;

import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import answeredChatService from '../answeredChatService.js';
import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import requestQueueService from '../browser/requestQueueService.js';
import chatOpenService from './chatOpenService.js';

const messageSendService = {
	/**
	 * Отправить сообщение в чат
	 */
	sendMessage: async ({
		userId,
		accountId,
		profileUid,
		memberUid,
		text,
		chatIdentity,
	}) => {
		// 🚨 УРОВЕНЬ 3 ЗАЩИТЫ: Финальная блокировка отправки сообщений
		if (AI_MESSAGE_SENDING_DISABLED) {
			console.log(
				`🛑 [Message Send] AI MESSAGE SENDING GLOBALLY DISABLED - blocking send to ${memberUid}`,
			);
			throw new Error('AI message sending is globally disabled for safety');
		}

		console.log(
			`[Message Send] Sending message from profile ${profileUid} to member ${memberUid}`,
		);

		// Проверяем что аккаунт принадлежит пользователю
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw new Error('Account not found');
		}

		// Формируем chatId
		const chatId = chatIdentity || `${profileUid}_${memberUid}`;

		// Выполняем в очереди чтобы не конфликтовать с другими операциями
		return await requestQueueService.executeInQueue(accountId, async () => {
			try {
				// Получаем контекст
				const context = browserService.getContext(accountId);
				if (!context) {
					throw new Error('Context not found');
				}

				// Получаем страницу
				const page = await pageHelpers.getOrCreatePage(context);

				// Отправляем сообщение
				const result = await page.evaluate(
					async ({ pUid, cId, message }) => {
						try {
							if (typeof modelsChat === 'undefined') {
								throw new Error('modelsChat API not available');
							}

							// 1. Переключаемся на профиль
							if (!modelsChat.selectProfile) {
								throw new Error('modelsChat.selectProfile not available');
							}

							modelsChat.selectProfile(pUid);

							// Ждём загрузки профиля
							await new Promise(resolve => setTimeout(resolve, 500));

							// 2. Открываем чат
							if (!modelsChat.selectChat) {
								throw new Error('modelsChat.selectChat not available');
							}

							modelsChat.selectChat(cId);

							// Ждём загрузки чата
							await new Promise(resolve => setTimeout(resolve, 800));

							// 3. Находим emojionearea editor
							const editor = document.querySelector('.emojionearea-editor');

							if (!editor) {
								throw new Error('Message input editor not found');
							}

							console.log('[Message Send] Found emojionearea editor');

							// Очищаем editor если там что-то есть
							if (editor.textContent && editor.textContent.trim() !== '') {
								console.log('[Message Send] Clearing existing text');
								editor.textContent = '';
								editor.innerHTML = '';
								await new Promise(resolve => setTimeout(resolve, 300));
							}

							// 4. 🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: message должен быть строкой
							console.log('[Message Send] 🔍 Validating message...');
							console.log('[Message Send] 🔍 Message type:', typeof message);
							console.log('[Message Send] 🔍 Message value:', message);
							console.log('[Message Send] 🔍 Message length:', message?.length);

							if (typeof message !== 'string') {
								console.error('❌ [CRITICAL] Message is not a string!');
								console.error('❌ Type:', typeof message);
								console.error('❌ Value:', message);
								throw new Error(
									`Message must be string, got ${typeof message}`,
								);
							}

							if (!message || message.trim() === '') {
								console.error('❌ [CRITICAL] Message is empty!');
								throw new Error('Message is empty');
							}

							if (
								message === '[object Object]' ||
								message.includes('[object')
							) {
								console.error('❌ [CRITICAL] Message is serialized object!');
								throw new Error('Message contains serialized object');
							}

							console.log('[Message Send] ✅ Message validation passed');

							// 5. Устанавливаем текст в editor
							editor.textContent = message;
							editor.innerHTML = message;

							// Устанавливаем фокус
							editor.focus();

							// Триггерим события
							const events = ['input', 'change', 'keyup', 'keydown', 'focus'];
							events.forEach(eventType => {
								const event = new Event(eventType, {
									bubbles: true,
									cancelable: true,
								});
								editor.dispatchEvent(event);
							});

							// Ждём перед отправкой
							console.log('[Message Send] Waiting 700ms before sending...');
							await new Promise(resolve => setTimeout(resolve, 700));

							// 6. Отправляем сообщение
							if (!modelsChat.sendMessage) {
								throw new Error('modelsChat.sendMessage not available');
							}

							console.log('[Message Send] Calling modelsChat.sendMessage()...');
							modelsChat.sendMessage();

							// Ждём отправки И остаёмся в чате 2 секунды
							console.log(
								'[Message Send] ⏳ Waiting 2 seconds for message delivery...',
							);
							await new Promise(resolve => setTimeout(resolve, 2000));

							console.log(
								'[Message Send] ✅ 2 seconds passed, message should be delivered',
							);

							return {
								success: true,
								message: 'Message sent successfully',
							};
						} catch (error) {
							return {
								success: false,
								error: error.message,
							};
						}
					},
					{ pUid: profileUid, cId: chatId, message: text },
				);

				if (!result.success) {
					throw new Error(result.error || 'Failed to send message');
				}

				console.log(
					`[Message Send] ✅ Message sent successfully to chat ${chatId}`,
				);

				// ✅ ФОНОВАЯ обработка - НЕ ждём результата
				// Проверяем статус и сохраняем в MongoDB БЕЗ блокировки
				setImmediate(async () => {
					try {
						// Ждем 2 секунды чтобы Luxee обновил состояние
						await new Promise(resolve => setTimeout(resolve, 2000));

						console.log(
							'[Message Send Background] Checking unAnswered status...',
						);
						const chatData = await chatOpenService.openChat({
							accountId,
							profileUid,
							chatId,
						});

						console.log(
							`[Message Send Background] unAnswered: ${chatData.unAnswered}`,
						);

						// Если unAnswered === false (мы ответили), сохраняем в MongoDB
						if (chatData.unAnswered === false) {
							console.log(
								'[Message Send Background] Chat is answered, saving to MongoDB...',
							);

							await answeredChatService.saveAnsweredChat({
								accountId,
								profileUid,
								chatData: {
									chatId: chatData.chatId,
									memberUid: chatData.man?.uid || memberUid,
									memberUsername: chatData.man?.username,
									memberAvatar: chatData.man?.avatar,
									lastManMessage: chatData.lastManMessage,
									lastWomanMessage: chatData.lastWomanMessage,
									lastActivity: chatData.lastActivity,
								},
							});

							console.log(
								'[Message Send Background] Chat saved to MongoDB successfully',
							);
						} else {
							console.log(
								'[Message Send Background] Chat still unanswered, not saving',
							);
						}
					} catch (error) {
						console.error(
							'[Message Send Background] Error checking/saving answered chat:',
							error,
						);
						// Не критично, сообщение уже отправлено
					}
				});

				// ✅ Возвращаем результат СРАЗУ (мгновенный ответ frontend)
				return {
					success: true,
					chatId,
					profileUid,
					memberUid,
					message: text,
					timestamp: Date.now(),
				};
			} catch (error) {
				console.error('[Message Send] Error sending message:', error);
				throw error;
			}
		});
	},
};

export default messageSendService;
