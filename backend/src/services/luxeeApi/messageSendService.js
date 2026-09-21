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
import luxeeAccountOnlineService from '../luxeeAccountOnlineService.js';

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

				// Отправляем сообщение: навигация + доверенный фокус + нативный
				// ввод + проверка доставки. Порядок строгий: focus → ввод
				// (никогда write → focus), клик — только по видимому редактору.
				let result = await page.evaluate(
					async ({ pUid, cId, message }) => {
						const norm = s =>
							String(s || '')
								.replace(/\s+/g, ' ')
								.trim()
								.slice(0, 40);
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

							// 3. Находим ВИДИМЫЙ emojionearea editor (первый в DOM
							// часто скрытый от другого чата — писать в него
							// бесполезно: sendMessage его игнорирует).
							const editors = Array.from(
								document.querySelectorAll('.emojionearea-editor'),
							);
							const visibleEditors = editors.filter(el => {
								try {
									const rect = el.getBoundingClientRect();
									return (
										rect.width > 0 &&
										rect.height > 0 &&
										el.offsetParent !== null
									);
								} catch (e) {
									return false;
								}
							});
							const editor = visibleEditors[0] || null;

							if (!editor) {
								throw new Error(
									`Message input editor not found (${editors.length} hidden present, 0 visible)`,
								);
							}

							console.log('[Message Send] Found visible emojionearea editor');

							// Очищаем editor если там что-то есть
							if (editor.textContent && editor.textContent.trim() !== '') {
								console.log('[Message Send] Clearing existing text');
								editor.textContent = '';
								editor.innerHTML = '';
								await new Promise(resolve => setTimeout(resolve, 300));
							}

							// 4. 🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: message должен быть строкой
							console.log('[Message Send] 🔍 Validating message...');

							if (typeof message !== 'string') {
								throw new Error(
									`Message must be string, got ${typeof message}`,
								);
							}

							if (!message || message.trim() === '') {
								throw new Error('Message is empty');
							}

							if (
								message === '[object Object]' ||
								message.includes('[object')
							) {
								throw new Error('Message contains serialized object');
							}

							console.log('[Message Send] ✅ Message validation passed');

							// 5. Фокус ДО ввода + проверка, что поле реально в фокусе
							editor.focus();
							if (typeof editor.click === 'function') editor.click();
							const activeEl = document.activeElement;
							const focused =
								!!activeEl &&
								(activeEl === editor ||
									(activeEl.classList &&
										activeEl.classList.contains('emojionearea-editor')));
							const debug = {
								editorsTotal: editors.length,
								editorsVisible: visibleEditors.length,
								focused,
								activeElement: activeEl
									? `${activeEl.tagName}.${String(activeEl.className || '').slice(0, 60)}`
									: 'none',
							};
							if (!focused) {
								console.log(
									'[Message Send] ⚠️  Editor not focused after focus()+click() — input may not register',
								);
							}

							// 6. Нативный ввод (execCommand требует фокус)
							let inserted = false;
							try {
								inserted = document.execCommand('insertText', false, message);
							} catch (execError) {
								inserted = false;
							}
							if (!inserted) {
								editor.textContent = message;
								editor.innerHTML = message;
								const events = ['input', 'change', 'keyup', 'keydown', 'focus'];
								events.forEach(eventType => {
									const event = new Event(eventType, {
										bubbles: true,
										cancelable: true,
									});
									editor.dispatchEvent(event);
								});
							}

							// Readback: текст обязан быть в редакторе
							const wantHead = norm(message);
							const gotHead = norm(editor.textContent);
							if (
								!gotHead ||
								!(gotHead.startsWith(wantHead) || wantHead.startsWith(gotHead))
							) {
								throw new Error('Editor input not registered (readback mismatch)');
							}

							// Ждём перед отправкой
							console.log('[Message Send] Waiting 700ms before sending...');
							await new Promise(resolve => setTimeout(resolve, 700));

							// 7. Отправляем сообщение с проверкой доставки
							if (!modelsChat.sendMessage) {
								throw new Error('modelsChat.sendMessage not available');
							}

							const activeBefore = modelsChat.getChats?.active;
							const unAnsweredBefore = activeBefore?.unAnswered;
							const listBefore = activeBefore?.message || [];
							const countBefore = listBefore.length;

							console.log('[Message Send] Calling modelsChat.sendMessage()...');
							modelsChat.sendMessage();

							await new Promise(resolve => setTimeout(resolve, 2000));

							const activeAfter = modelsChat.getChats?.active;
							const unAnsweredAfter = activeAfter?.unAnswered;
							const listAfter = activeAfter?.message || [];
							if (unAnsweredAfter === false || listAfter.length > countBefore) {
								console.log('[Message Send] ✅ Message delivered (verified)');
								return {
									success: true,
									delivered: true,
									message: 'Message sent successfully',
									debug: { ...debug, unAnsweredBefore, unAnsweredAfter },
								};
							}

							console.error('[Message Send] ❌ Message NOT delivered (unAnswered still true)');
							return {
								success: false,
								delivered: false,
								error: 'Message not delivered - unAnswered still true',
								debug: {
									...debug,
									unAnsweredBefore,
									unAnsweredAfter,
									msgCountBefore: countBefore,
									msgCountAfter: listAfter.length,
								},
							};
						} catch (error) {
							return {
								success: false,
								delivered: false,
								error: error.message,
							};
						}
					},
					{ pUid: profileUid, cId: chatId, message: text },
				);

				// ⌨️ FALLBACK: доверенная клавиатура, если evaluate-ввод не дошёл
				// (поле не в фокусе / запись в скрытый редактор). Печатаем
				// настоящим вводом и жмём Enter — штатный путь emojionearea.
				const needsKbFallback =
					result &&
					result.delivered !== true &&
					result.error &&
					(result.error.includes('unAnswered still true') ||
						result.error.includes('readback mismatch') ||
						result.error.includes('editor not found') ||
						result.error.includes('not registered'));
				if (needsKbFallback) {
					console.log('[Message Send] ⌨️  Trying keyboard-type + Enter fallback...');
					try {
						const normHead = String(text || '')
							.replace(/\s+/g, ' ')
							.trim()
							.slice(0, 40);
						const editorLocator = page.locator('.emojionearea-editor:visible').first();
						await editorLocator.click({ timeout: 5000 });
						await new Promise(resolve => setTimeout(resolve, 400));
						await page.keyboard.press('ControlOrMeta+a');
						await new Promise(resolve => setTimeout(resolve, 200));
						await page.keyboard.press('Backspace');
						await new Promise(resolve => setTimeout(resolve, 300));
						await page.keyboard.type(text, { delay: 20 });
						await new Promise(resolve => setTimeout(resolve, 500));
						await page.keyboard.press('Enter');
						await new Promise(resolve => setTimeout(resolve, 4000));
						const verify = await page
							.evaluate(msgHead => {
								const norm = s =>
									String(s || '')
										.replace(/\s+/g, ' ')
										.trim()
										.slice(0, 40);
								const active = modelsChat?.getChats?.active;
								const list = active?.message || [];
								const last = list.length > 0 ? list[list.length - 1] : null;
								const manUid = active?.members?.find(m => m.type === 10)?.uid;
								const lastBody = last?.body ? norm(last.body) : '';
								return {
									unAnswered: active?.unAnswered ?? null,
									appeared:
										!!last &&
										manUid !== undefined &&
										last.uid !== manUid &&
										msgHead !== '' &&
										(lastBody.startsWith(msgHead) || msgHead.startsWith(lastBody)),
								};
							}, normHead)
							.catch(() => ({ unAnswered: null, appeared: false }));
						if (verify.unAnswered === false || verify.appeared) {
							console.log('[Message Send] ✅ Keyboard-submit delivered the message');
							result = {
								success: true,
								delivered: true,
								message: 'Message sent via keyboard-submit',
							};
						}
					} catch (kbError) {
						console.log(`[Message Send] ⚠️  Keyboard fallback failed: ${kbError.message}`);
					}
				}

				if (!result.success) {
					throw new Error(result.error || 'Failed to send message');
				}

				console.log(
					`[Message Send] ✅ Message sent successfully to chat ${chatId}`,
				);

				// 🎯 ТРЕКИНГ РУЧНОЙ АКТИВНОСТИ: Отправка сообщения = ручное действие
				try {
					await luxeeAccountOnlineService.trackManualActivity(userId, accountId);
					console.log(`[Message Send] ✅ Manual activity tracked for user ${userId}`);
				} catch (trackError) {
					console.error('[Message Send] ⚠️ Error tracking manual activity:', trackError.message);
					// Не критично, продолжаем
				}

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
