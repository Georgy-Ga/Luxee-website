// AI Response Service
// Сервис для генерации и отправки AI ответов с проверками статуса
// Работает через отдельный браузерный контекст для параллельной работы

// 🐛🐛🐛 DEBUG MODE - РЕЖИМ ОТЛАДКИ БЕЗ ОТПРАВКИ СООБЩЕНИЙ 🐛🐛🐛
// Установите в false для включения реальной отправки (после тестирования)
// Установите в true для режима отладки (сообщения НЕ отправляются, только логи)
const AI_DEBUG_MODE = false;

import aiManagementService from './aiManagementService/index.js';
import aiService from './aiService/index.js';
import aiBrowserContextService from './browser/aiBrowserContextService.js';
import pageHelpers from './browser/pageHelpers.js';

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
	 * @param {string} params.formattedHistory - Отформатированная история для промпта (опционально)
	 * @param {string} params.typeInstructions - Инструкции для типа сообщения (опционально)
	 * @param {string} params.profileName - Имя профиля девушки (опционально)
	 * @param {string} params.manName - Имя мужчины (опционально)
	 * @returns {Promise<string>} - Ответ AI
	 */
	generateResponse: async ({
		userId,
		accountId,
		profile,
		manMessage,
		messageType = 1,
		conversationHistory = [],
		formattedHistory = '',
		typeInstructions = '',
		profileName = '',
		manName = '',
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
			const canAccountUse = await aiManagementService.canAccountUseAi(
				userId,
				accountId,
			);
			if (!canAccountUse) {
				throw new Error('AI disabled for account');
			}

			console.log(
				'[AI Response Service] AI checks passed, generating response...',
			);

			// 3. Генерируем ответ через aiService с историей
			const response = await aiService.generateResponse({
				profile,
				manMessage,
				messageType,
				conversationHistory,
				formattedHistory,
				typeInstructions,
				profileName,
				manName,
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
			const canUse = await aiManagementService.canAccountUseAi(
				userId,
				accountId,
			);
			if (!canUse) {
				console.log('[AI Response Service] AI was disabled, cancelling send');
				throw new Error('AI disabled before send');
			}

			// 2. Получаем или создаём AI контекст
			const aiContext =
				await aiBrowserContextService.getOrCreateAiContext(accountId);
			const page = await pageHelpers.getOrCreatePage(aiContext);

			console.log('[AI Response Service] AI context ready, sending message...');

			// 🐛 DEBUG MODE: Блокируем отправку и выводим детальные логи
			let result;

			if (AI_DEBUG_MODE) {
				// ========== DEBUG MODE: ОТПРАВКА ЗАБЛОКИРОВАНА ==========
				console.log('');
				console.log(
					'🚫🚫🚫 [AI DEBUG] MESSAGE SEND BLOCKED - Debug Mode Enabled 🚫🚫🚫',
				);
				console.log('═'.repeat(80));
				console.log('📨 [AI DEBUG] Message details:');
				console.log('  - Chat ID:', chatId);
				console.log('  - Profile UID:', profileUid);
				console.log('  - Message text:', message);
				console.log('  - Message length:', message.length, 'characters');
				console.log('  - Account ID:', accountId);
				console.log('  - User ID:', userId);
				console.log('═'.repeat(80));
				console.log(
					'✅ [AI DEBUG] Message would be sent if AI_DEBUG_MODE = false',
				);
				console.log(
					'🔧 [AI DEBUG] To enable real sending: Set AI_DEBUG_MODE = false in aiResponseService.js',
				);
				console.log('═'.repeat(80));
				console.log('');

				// Симулируем успешную отправку
				result = {
					success: true,
					message: 'DEBUG MODE: Send skipped',
				};
			} else {
				// ========== PRODUCTION MODE: РЕАЛЬНАЯ ОТПРАВКА С ПРОВЕРКОЙ ДОСТАВКИ ==========
				console.log('[AI Response Service] 📤 Starting message send with delivery verification...');
				
				// 🔄 КРИТИЧНО: Переключение профиля ДО page.evaluate через глобальный сервис
				const profileSwitchService = (await import('./luxeeApi/profileSwitchService.js')).default;
				const switchSuccess = await profileSwitchService.switchProfile(
					page,
					accountId,
					profileUid,
					'AI Response Service',
				);
				
				if (!switchSuccess) {
					console.error('[AI Response Service] ❌ Failed to switch profile');
					throw new Error('Profile switch failed');
				}
				
				// 3. Отправляем сообщение через AI контекст с retry механизмом
				const MAX_SEND_ATTEMPTS = 3;
				let sendAttempt = 0;
				let messageSent = false;
				
				while (sendAttempt < MAX_SEND_ATTEMPTS && !messageSent) {
					sendAttempt++;
					console.log(`[AI Response Service] 🔄 Send attempt ${sendAttempt}/${MAX_SEND_ATTEMPTS}...`);

					// 🖱️ Доверенный клик по видимому редактору ПЕРЕД evaluate:
					// programmatic focus() внутри evaluate может быть недостаточным
					// для внутренних проверок sendMessage — нужен настоящий клик.
					try {
						await page
							.locator('.emojionearea-editor')
							.first()
							.click({ timeout: 3000 });
					} catch (clickError) {
						console.log(
							`[AI Response Service] ⚠️  Pre-click on editor failed: ${clickError.message}`,
						);
					}

					result = await page.evaluate(
						async ({ cId, msg, attempt }) => {
							try {
								if (typeof modelsChat === 'undefined') {
									throw new Error('modelsChat API not available');
								}

								// 📍 ЛОГ: В каком чате мы находимся СЕЙЧАС
								const currentChat = modelsChat.getChats?.active?.identity || 'unknown';
								console.log(`[AI Response] 📍 Current chat BEFORE navigation: ${currentChat}`);

								// ✅ Профиль УЖЕ переключен через profileSwitchService!
								// Просто открываем чат
								console.log(`[AI Response] 💬 Opening chat ${cId}...`);
								modelsChat.selectChat(cId);
								await new Promise(resolve => setTimeout(resolve, 800));

								// 📍 ЛОГ: В каком чате мы находимся ПОСЛЕ навигации
								const targetChat = modelsChat.getChats?.active?.identity || 'unknown';
								console.log(`[AI Response] 📍 Current chat AFTER navigation: ${targetChat}`);
								
								// Проверяем что мы в правильном чате
								if (targetChat !== cId) {
									console.error(`[AI Response] ❌ Chat mismatch! Expected: ${cId}, Got: ${targetChat}`);
									throw new Error(`Failed to navigate to chat ${cId}`);
								}
								
								console.log(`[AI Response] ✅ Successfully navigated to chat ${cId}`);

							// Находим editor: на странице может быть НЕСКОЛЬКО
							// .emojionearea-editor (скрытые от других чатов после
							// навигаций). querySelector берёт ПЕРВЫЙ — часто скрытый:
							// текст в него пишется, readback проходит, а sendMessage
							// его игнорирует → msgCount не растёт. Берём ВИДИМЫЙ.
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
							console.log(
								`[AI Response] 📝 Editors found: ${editors.length}, visible: ${visibleEditors.length}`,
							);
							const editorDebug = {
								editorsTotal: editors.length,
								editorsVisible: visibleEditors.length,
							};
							// Диагностика кнопок отправки: какие submit-контролы вообще есть
							// рядом (для выбора альтернативного способа отправки).
							try {
								const btnInfo = [];
								const btns = document.querySelectorAll(
									'button, input[type="submit"], [role="button"]',
								);
								btns.forEach(b => {
									if (btnInfo.length >= 20) return;
									let rect = { width: 0, height: 0 };
									try {
										rect = b.getBoundingClientRect();
									} catch (e) {
										/* ignore */
									}
									if (rect.width > 0 && rect.height > 0) {
										btnInfo.push({
											tag: b.tagName,
											cls: String(b.className || '').slice(0, 80),
											text: String(b.textContent || '').trim().slice(0, 30),
											aria: (b.getAttribute && b.getAttribute('aria-label')) || '',
										});
									}
								});
								editorDebug.visibleButtons = btnInfo;
							} catch (e) {
								/* ignore */
							}
							const editor = visibleEditors[0] || null;
							if (!editor) {
								throw new Error(
									`Message input editor not found (${editors.length} hidden present, 0 visible)`,
								);
							}

								// Очищаем editor
								editor.textContent = '';
								editor.innerHTML = '';
								await new Promise(resolve => setTimeout(resolve, 300));

								// 🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: msg должен быть строкой
								console.log('[AI Response] 🔍 Validating AI message...');
								console.log('[AI Response] 🔍 AI Message type:', typeof msg);
								console.log('[AI Response] 🔍 AI Message value:', msg);
								console.log('[AI Response] 🔍 AI Message length:', msg?.length);

								if (typeof msg !== 'string') {
									console.error('❌ [CRITICAL] AI Message is not a string!');
									console.error('❌ Type:', typeof msg);
									console.error('❌ Value:', msg);
									throw new Error(`AI Message must be string, got ${typeof msg}`);
								}

								if (!msg || msg.trim() === '') {
									console.error('❌ [CRITICAL] AI Message is empty!');
									throw new Error('AI Message is empty');
								}

								if (msg === '[object Object]' || msg.includes('[object')) {
									console.error('❌ [CRITICAL] AI Message is serialized object!');
									throw new Error('AI Message contains serialized object');
								}

								console.log('[AI Response] ✅ AI Message validation passed');

							// Устанавливаем текст НАТИВНЫМ вводом, чтобы фреймворк сайта
							// зарегистрировал его (прямая запись textContent иногда
							// игнорируется — сообщение тогда молча не уходит:
							// msgCount не растёт, unAnswered висит true).
							editor.focus();
							if (typeof editor.click === 'function') editor.click();

							let inserted = false;
							try {
								inserted = document.execCommand('insertText', false, msg);
							} catch (execError) {
								inserted = false;
							}
							if (!inserted) {
								// Fallback: прямая запись + события (как было раньше)
								editor.textContent = msg;
								editor.innerHTML = msg;
								const events = ['input', 'change', 'keyup', 'keydown', 'focus'];
								events.forEach(eventType => {
									const event = new Event(eventType, {
										bubbles: true,
										cancelable: true,
									});
									editor.dispatchEvent(event);
								});
							}

							// Ждём перед отправкой
							await new Promise(resolve => setTimeout(resolve, 700));

							// Readback: текст ОБЯЗАН быть в редакторе, иначе слать нечего
							const normText = s =>
								String(s || '')
									.replace(/\s+/g, ' ')
									.trim()
									.slice(0, 40);
							const wantHead = normText(msg);
							const gotHead = normText(editor.textContent);
							if (
								!gotHead ||
								!(gotHead.startsWith(wantHead) || wantHead.startsWith(gotHead))
							) {
								throw new Error(
									'Editor input not registered (readback mismatch)',
								);
							}

							// 📍 ЛОГ: Статус ПЕРЕД отправкой
							const activeChat = modelsChat.getChats?.active;
							const unAnsweredBefore = activeChat?.unAnswered;
							console.log(`[AI Response] 📊 unAnswered BEFORE send: ${unAnsweredBefore}`);

							// Снапшот сообщений ДО отправки (для проверки по факту появления)
							const norm = s =>
								String(s || '')
									.replace(/\s+/g, ' ')
									.trim()
									.slice(0, 40);
							const msgHead = norm(msg);
							const snapshotMessages = () => {
								const list = modelsChat.getChats?.active?.message || [];
								const last = list.length > 0 ? list[list.length - 1] : null;
								const manUid = modelsChat.getChats?.active?.members?.find(
									m => m.type === 10,
								)?.uid;
								return {
									count: list.length,
									lastId: last?._id || last?.id || null,
									lastBody: last?.body ? norm(last.body) : '',
									lastFromProfile:
										!!last && manUid !== undefined
											? last.uid !== manUid
											: null,
								};
							};
							const before = snapshotMessages();

							// 🛡️ ANTI-DOUBLE-SEND: на повторной попытке проверяем что
							// предыдущая НЕ ушла (флаг unAnswered мог просто отстать).
							// Если наше сообщение уже последнее от профиля — успех, не слать дубль.
							if (attempt > 1 && before.lastFromProfile === true) {
								if (
									msgHead &&
									(before.lastBody.startsWith(msgHead) ||
										msgHead.startsWith(before.lastBody))
								) {
									console.log('[AI Response] ✅ Message already present (no duplicate send)');
									return {
										success: true,
										delivered: true,
										message: 'Message already delivered (duplicate prevented)',
										chatId: cId,
										verifiedBy: 'message_present',
									};
								}
							}

							// Отправляем
							console.log(`[AI Response] 📤 Calling modelsChat.sendMessage()... (attempt ${attempt})`);
							modelsChat.sendMessage();

							// ⏱️ Ждём 300ms для WebSocket обновления
							console.log('[AI Response] ⏳ Waiting 300ms for WebSocket update...');
							await new Promise(resolve => setTimeout(resolve, 300));

							// 🔍 ПРОВЕРКА ДОСТАВКИ #1: unAnswered должен стать false
							const unAnsweredAfter = modelsChat.getChats?.active?.unAnswered;
							console.log(`[AI Response] 📊 unAnswered AFTER send: ${unAnsweredAfter}`);

							if (unAnsweredAfter === false) {
								console.log('[AI Response] ✅ Message delivered successfully (unAnswered=false)');
								return {
									success: true,
									delivered: true,
									message: 'Message sent and delivered',
									chatId: cId,
									verifiedBy: 'unanswered_flag',
								};
							}

							// Если ещё true - даём второй шанс (3 секунды)
							console.log('[AI Response] ⚠️  unAnswered still true, waiting 3 seconds...');
							await new Promise(resolve => setTimeout(resolve, 3000));

							// 🔍 ПРОВЕРКА ДОСТАВКИ #2: флаг + факт появления сообщения.
							// Флаг может отставать (медленный WS) — тогда доказательством
							// служит выросший счётчик + наше сообщение последним от профиля.
							const unAnsweredFinal = modelsChat.getChats?.active?.unAnswered;
							console.log(`[AI Response] 📊 unAnswered FINAL check: ${unAnsweredFinal}`);
							const after = snapshotMessages();
							console.log(
								`[AI Response] 📊 Messages: ${before.count} → ${after.count}, lastFromProfile=${after.lastFromProfile}`
							);

							if (unAnsweredFinal === false) {
								console.log('[AI Response] ✅ Message delivered after delay (unAnswered=false)');
								return {
									success: true,
									delivered: true,
									message: 'Message sent and delivered after delay',
									chatId: cId,
									verifiedBy: 'unanswered_flag',
								};
							}

							const appeared =
								after.count > before.count &&
								after.lastFromProfile === true &&
								after.lastId !== before.lastId &&
								msgHead !== '' &&
								(after.lastBody.startsWith(msgHead) ||
									msgHead.startsWith(after.lastBody));

							if (appeared) {
								console.log('[AI Response] ✅ Message verified by presence (flag lagged)');
								return {
									success: true,
									delivered: true,
									message: 'Message verified by presence in chat',
									chatId: cId,
									verifiedBy: 'message_present',
								};
							}

							// Сообщение НЕ доставлено
							console.error('[AI Response] ❌ Message NOT delivered (unAnswered still true)');
							return {
								success: false,
								delivered: false,
								error: 'Message not delivered - unAnswered still true',
								chatId: cId,
								debug: {
									unAnsweredBefore,
									unAnsweredAfter,
									unAnsweredFinal,
									msgCountBefore: before.count,
									msgCountAfter: after.count,
									...(typeof editorDebug !== 'undefined' ? editorDebug : {}),
								},
							};
							} catch (error) {
								console.error('[AI Response] ❌ Error during send:', error.message);
								return {
									success: false,
									delivered: false,
									error: error.message,
								};
							}
						},
						{ cId: chatId, msg: message, attempt: sendAttempt },
					);

					// Проверяем результат
					if (result.success && result.delivered) {
						console.log(`[AI Response Service] ✅ Message delivered on attempt ${sendAttempt} (verified by: ${result.verifiedBy || 'unanswered_flag'})`);
						messageSent = true;
						break;
					}

					// Если не доставлено и есть ещё попытки
					if (sendAttempt < MAX_SEND_ATTEMPTS) {
						console.log(`[AI Response Service] ⚠️  Delivery failed, retrying in 2 seconds...`);
						console.log(`[AI Response Service] 📝 Reason: ${result.error || 'Unknown'}`);
						if (result.debug) {
							console.log(`[AI Response Service] 📊 Send debug: ${JSON.stringify(result.debug)}`);
						}
						await new Promise(resolve => setTimeout(resolve, 2000));
					} else if (result.debug) {
						console.log(`[AI Response Service] 📊 Send debug: ${JSON.stringify(result.debug)}`);
					}
				}

				// 🔄 FALLBACK: Enter-submit доверенной клавиатурой.
				// modelsChat.sendMessage() иногда молча no-op (текст в редакторе
				// есть, readback ок, но сообщение не появляется). Enter в редакторе —
				// штатный путь отправки emojionearea. Только если fill сработал
				// (иначе слать нечего) и сообщения ещё нет (anti-double-send).
				if (
					!messageSent &&
					result &&
					result.error &&
					result.error.includes('unAnswered still true')
				) {
					console.log('[AI Response Service] ⌨️  Trying keyboard-type + Enter fallback...');
					try {
						const normHead = String(message || '')
							.replace(/\s+/g, ' ')
							.trim()
							.slice(0, 40);

						// Навигация к чату (свежая, как в основном пути)
						const navOk = await page
							.evaluate(cId => {
								try {
									if (typeof modelsChat === 'undefined') return false;
									modelsChat.selectChat(cId);
									return true;
								} catch (e) {
									return false;
								}
							}, chatId)
							.catch(() => false);
						if (!navOk) {
							throw new Error('Failed to navigate to chat for keyboard fallback');
						}
						await new Promise(resolve => setTimeout(resolve, 1000));

						// Очистить редактор доверенным способом
						const editorLocator = page.locator('.emojionearea-editor').first();
						await editorLocator.click({ timeout: 5000 });
						await new Promise(resolve => setTimeout(resolve, 400));
						await page.keyboard.press('ControlOrMeta+a');
						await new Promise(resolve => setTimeout(resolve, 200));
						await page.keyboard.press('Backspace');
						await new Promise(resolve => setTimeout(resolve, 300));

						// Печатаем текст настоящей клавиатурой (доверенные события)
						await page.keyboard.type(message, { delay: 20 });
						await new Promise(resolve => setTimeout(resolve, 500));

						// Anti-double-send: сообщение могло уже уйти
						const preCheck = await page
							.evaluate(msgHead => {
								const norm = s =>
									String(s || '')
										.replace(/\s+/g, ' ')
										.trim()
										.slice(0, 40);
								const list = modelsChat?.getChats?.active?.message || [];
								const last = list.length > 0 ? list[list.length - 1] : null;
								const manUid = modelsChat?.getChats?.active?.members?.find(
									m => m.type === 10,
								)?.uid;
								const lastBody = last?.body ? norm(last.body) : '';
								return {
									alreadyThere:
										!!last &&
										manUid !== undefined &&
										last.uid !== manUid &&
										msgHead !== '' &&
										(lastBody.startsWith(msgHead) || msgHead.startsWith(lastBody)),
									count: list.length,
								};
							}, normHead)
							.catch(() => ({ alreadyThere: false, count: -1 }));

						if (preCheck.alreadyThere) {
							console.log('[AI Response Service] ✅ Message already present, Enter skipped');
							messageSent = true;
							result = {
								success: true,
								delivered: true,
								message: 'Message verified by presence in chat',
								chatId,
								verifiedBy: 'message_present',
							};
						} else {
							await page.keyboard.press('Enter');
							console.log('[AI Response Service] ⌨️  Typed + Enter pressed, waiting 4s...');
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
										count: list.length,
										appeared:
											!!last &&
											manUid !== undefined &&
											last.uid !== manUid &&
											msgHead !== '' &&
											(lastBody.startsWith(msgHead) || msgHead.startsWith(lastBody)),
									};
								}, normHead)
								.catch(() => ({ unAnswered: null, count: -1, appeared: false }));

							console.log(`[AI Response Service] ⌨️  Keyboard-submit check: ${JSON.stringify(verify)}`);
							if (verify.unAnswered === false || verify.appeared) {
								console.log('[AI Response Service] ✅ Keyboard-submit delivered the message');
								messageSent = true;
								result = {
									success: true,
									delivered: true,
									message: 'Message sent via keyboard-submit',
									chatId,
									verifiedBy: verify.appeared ? 'message_present' : 'unanswered_flag',
								};
							}
						}
					} catch (enterError) {
						console.log(`[AI Response Service] ⚠️  Keyboard-submit fallback failed: ${enterError.message}`);
					}
				}

				// Проверяем финальный результат
				if (!messageSent) {
					console.error(`[AI Response Service] ❌ Failed to deliver message after ${MAX_SEND_ATTEMPTS} attempts`);
					throw new Error(`Message not delivered after ${MAX_SEND_ATTEMPTS} attempts: ${result.error || 'Unknown reason'}`);
				}

				console.log('[AI Response Service] ✅ AI message sent and delivered successfully');
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
		formattedHistory = '',
		typeInstructions = '',
		profileName = '',
		manName = '',
	}) => {
		try {
			console.log('[AI Response Service] Starting generate and send cycle...');

			// 1. Генерируем ответ с новыми параметрами
			const aiResponse = await aiResponseService.generateResponse({
				userId,
				accountId,
				profile,
				manMessage,
				messageType,
				conversationHistory,
				formattedHistory,
				typeInstructions,
				profileName,
				manName,
			});

			console.log('[AI Response Service] AI response:', aiResponse);

			// 2. Проверяем статус AI ещё раз перед отправкой
			const canUse = await aiManagementService.canAccountUseAi(
				userId,
				accountId,
			);
			if (!canUse) {
				console.log(
					'[AI Response Service] AI was disabled during generation, not sending',
				);
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

			console.log(
				'[AI Response Service] Generate and send cycle completed successfully',
			);

			return {
				success: true,
				generatedResponse: aiResponse,
				sendResult,
			};
		} catch (error) {
			console.error(
				'[AI Response Service] Error in generate and send cycle:',
				error,
			);
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
					from:
						last.uid === chat.members?.find(m => m.type === 10)?.uid
							? 'man'
							: 'woman',
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
