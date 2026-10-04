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
import chatMessagesExtractorService from './luxeeApi/chatMessagesExtractorService.js';
import { vlog } from './verbose.js';

// Нормализация для сравнения текстов: без смайлов/пунктуации/регистра/лишних
// пробелов. Иначе несовпадение рендера (эмодзи-шрифты, кавычки, тире) даёт
// ложный fail и мы бесконечно переотправляем доставленное.
const normalizeForMatch = s =>
	String(s || '')
		.toLowerCase()
		.replace(
			/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu,
			'',
		)
		.replace(/[^\p{L}\p{N}\s]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();

const headsMatch = (a, b, n = 60) => {
	const A = normalizeForMatch(a).slice(0, n);
	const B = normalizeForMatch(b).slice(0, n);
	return !!A && !!B && (A.startsWith(B) || B.startsWith(A));
};

// Проверка доставки по ПЕРЕЧИТАННОЙ истории (6 последних сообщений):
// 1) последнее сообщение — точно наше (isFromProfile),
// 2) его текст совпадает с отправленным (без учёта смайлов и ерунды).
// Флаг unAnswered доказательством НЕ считается — замечен врущим в обе
// стороны (false без сообщения; true при фантомном посте).
const verifyDeliveryByHistory = async (page, chatId, message) => {
	try {
		const activeChatId = await page
			.evaluate(() => window.modelsChat?.getChats?.active?.identity)
			.catch(() => null);
		if (activeChatId !== chatId) {
			return { delivered: false, reason: 'chat_changed' };
		}
		const hist = await chatMessagesExtractorService.getChatHistory(page, 6);
		if (!hist || hist.error || !hist.lastMessage) {
			return { delivered: false, reason: 'no_history' };
		}
		const last = hist.lastMessage;
		if (!last.isFromProfile) {
			return {
				delivered: false,
				reason: 'last_not_ours',
				lastAuthor: last.author || null,
			};
		}
		if (!headsMatch(last.text, message)) {
			return { delivered: false, reason: 'text_mismatch' };
		}
		return { delivered: true, verifiedBy: 'history_match' };
	} catch (e) {
		return { delivered: false, reason: `verify_error: ${e.message}` };
	}
};

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
		activityCenterData = null,
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
			activityCenterData,
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
	/**
	 * ⌨️ PRIMARY SEND: доверенный ручной ввод (без programmatic вставки).
	 * Клик по видимому редактору → проверка фокуса → очистка →
	 * keyboard.type → Enter → проверка доставки. Именно этот путь в логах
	 * доставляет сообщение детерминированно, поэтому он идёт первым;
	 * execCommand + modelsChat.sendMessage() остались запасным путём.
	 * Переносы строк сплющиваются: иначе Enter внутри текста отправил бы
	 * пол-сообщения досрочно.
	 */
	_keyboardSend: async (page, { chatId, message }) => {
		const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
		// Текст для печати: в одну строку (Enter внутри = досрочная отправка)
		const flat = String(message || '').replace(/\r?\n/g, ' ');
		try {
			// 1. Навигация к чату
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
			if (!navOk) throw new Error(`Failed to navigate to chat ${chatId}`);
			await sleep(800);
			const activeOk = await page
				.evaluate(cId => {
					try {
						return modelsChat?.getChats?.active?.identity === cId;
					} catch (e) {
						return false;
					}
				}, chatId)
				.catch(() => false);
			if (!activeOk) throw new Error(`Failed to navigate to chat ${chatId}`);

		// 2. Anti-double по ПЕРЕЧИТАННОЙ истории (а не локальному списку —
		// он бывает оптимистичным: фантомный пост виден локально, но его
		// нет в треде). Если наше сообщение реально последнее — не печатаем.
		const histBefore = await chatMessagesExtractorService
			.getChatHistory(page, 6)
			.catch(() => null);
		const beforeLast =
			histBefore && !histBefore.error ? histBefore.lastMessage : null;
		if (
			beforeLast &&
			beforeLast.isFromProfile &&
			headsMatch(beforeLast.text, flat)
		) {
			return {
				success: true,
				delivered: true,
				message: 'Message already in chat history (duplicate prevented)',
				chatId,
				verifiedBy: 'history_match',
			};
		}

			// 3. Доверенный клик по ВИДИМОМУ редактору + проверка фокуса
			const editorLocator = page.locator('.emojionearea-editor:visible').first();
			await editorLocator.click({ timeout: 5000 });
			await sleep(400);
			let focused = await page
				.evaluate(() => {
					const ae = document.activeElement;
					return (
						!!ae && ae.classList && ae.classList.contains('emojionearea-editor')
					);
				})
				.catch(() => null);
			if (focused !== true) {
				await editorLocator.click({ timeout: 5000 }).catch(() => {});
				await sleep(400);
				focused = await page
					.evaluate(() => {
						const ae = document.activeElement;
						return (
							!!ae && ae.classList && ae.classList.contains('emojionearea-editor')
						);
					})
					.catch(() => null);
			}

			// 4. Очистка + печать настоящей клавиатурой
			await page.keyboard.press('ControlOrMeta+a');
			await sleep(200);
			await page.keyboard.press('Backspace');
			await sleep(300);
			await page.keyboard.type(flat, { delay: 20 });
			await sleep(500);

			// 4b. Readback редактора ПЕРЕД Enter: текст реально лёг в поле?
			// Если страница за это время ушла (в т.ч. ручной клик по контексту)
			// или редактор пересоздался — Enter вслепую не жмём.
			const readEditorLen = () =>
				page
					.evaluate(() => {
						try {
							const editors = Array.from(
								document.querySelectorAll('.emojionearea-editor'),
							);
							const vis = editors.find(el => {
								try {
									const r = el.getBoundingClientRect();
									return r.width > 0 && r.height > 0 && el.offsetParent !== null;
								} catch (e) {
									return false;
								}
							});
							return (vis?.textContent || '').trim().length;
						} catch (e) {
							return -1;
						}
					})
					.catch(() => -1);
			const chatStillOk = await page
				.evaluate(cId => {
					try {
						return modelsChat?.getChats?.active?.identity === cId;
					} catch (e) {
						return false;
					}
				}, chatId)
				.catch(() => false);
			if (!chatStillOk) {
				return {
					success: false,
					delivered: false,
					error: 'Chat changed before Enter (page navigated away)',
					debug: { focused },
				};
			}
			let editorLen = await readEditorLen();
			if (!editorLen || editorLen < 0) {
				// Поле пустое — печать ушла в никуда (тред не успел прогрузиться,
				// редактор подменился). Перекликиваем и печатаем заново один раз.
				console.log('[AI Response Service] ⚠️  Editor empty after typing, re-click + re-type once...');
				try {
					await editorLocator.click({ timeout: 5000 }).catch(() => {});
					await sleep(400);
					await page.keyboard.press('ControlOrMeta+a');
					await sleep(200);
					await page.keyboard.press('Backspace');
					await sleep(300);
					await page.keyboard.type(flat, { delay: 20 });
					await sleep(500);
				} catch (e) {}
				editorLen = await readEditorLen();
				if (!editorLen || editorLen < 0) {
					return {
						success: false,
						delivered: false,
						error: 'Editor empty after re-type, Enter skipped',
						debug: { focused },
					};
				}
			}

		// 5. Anti-double перед Enter — тоже по истории: если текст уже в треде,
		// Enter не жмём (не плодим дубли).
		const histPre = await chatMessagesExtractorService
			.getChatHistory(page, 6)
			.catch(() => null);
		const preLast = histPre && !histPre.error ? histPre.lastMessage : null;
		if (preLast && preLast.isFromProfile && headsMatch(preLast.text, flat)) {
			return {
				success: true,
				delivered: true,
				message: 'Message already in chat history, Enter skipped',
				chatId,
				verifiedBy: 'history_match',
			};
		}
		await page.keyboard.press('Enter');
		// Даём сайту persist: историю перечитываем только после паузы 2с.
		// Проверяем по ПЕРЕЧИТАННОЙ истории (последнее — наше + текст совпал),
		// а не по мгновенному локальному слепку — он бывает оптимистичным.
		await sleep(2000);
		const verify = await verifyDeliveryByHistory(page, chatId, flat);
		console.log(
			`[AI Response Service] ⌨️  History-verify: delivered=${verify.delivered} (${verify.reason || verify.verifiedBy})`,
		);
		if (verify.delivered) {
			return {
				success: true,
				delivered: true,
				message: 'Message verified in chat history',
				chatId,
				verifiedBy: 'history_match',
			};
		}
		return {
			success: false,
			delivered: false,
			error: `Message not in chat history (${verify.reason || 'unknown'})`,
			debug: {
				focused,
				verifyReason: verify.reason,
			},
		};
		} catch (kbError) {
			return { success: false, delivered: false, error: kbError.message };
		}
	},

	sendResponse: async ({ userId, accountId, profileUid, chatId, message }) => {
		try {
			console.log('[AI Response Service] Sending AI response...');
			console.log('[AI Response Service] Chat:', chatId);

			// 0. Пустое сообщение не отправляем вообще (не жмём Enter впустую):
			// бывает после чистки кривого ответа ИИ (одна кавычка и т.п.)
			if (!message || !String(message).trim()) {
				throw new Error('AI Message is empty — refusing to send, will regenerate');
			}

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
				vlog('[AI Response Service] 📤 Starting message send with delivery verification...');
				
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
					vlog(`[AI Response Service] 🔄 Send attempt ${sendAttempt}/${MAX_SEND_ATTEMPTS}...`);

					// ⌨️ PRIMARY: сразу доверенный ручной ввод (без programmatic
					// вставки): клик по видимому редактору → очистка →
					// keyboard.type → Enter. Так ответ доходит детерминированно.
					result = await aiResponseService._keyboardSend(page, {
						chatId,
						message,
					});
					if (result && result.success && result.delivered) {
						console.log(
							`[AI Response Service] ✅ Keyboard-primary delivered on attempt ${sendAttempt} (verified by: ${result.verifiedBy || 'history_match'})`,
						);
						messageSent = true;
					}

					// Запасной путь: programmatic вставка через evaluate
					// (только если ручной ввод не дошёл).
					if (!messageSent) {
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
							// Порядок строгий: focus → click → ввод (никогда write → focus).
							editor.focus();
							if (typeof editor.click === 'function') editor.click();
							const activeIsEditor =
								!!document.activeElement &&
								(document.activeElement === editor ||
									(document.activeElement.classList &&
										document.activeElement.classList.contains(
											'emojionearea-editor',
										)));
							editorDebug.focused = activeIsEditor;
							try {
								const ae = document.activeElement;
								editorDebug.activeElement = ae
									? `${ae.tagName}.${String(ae.className || '').slice(0, 60)}`
									: 'none';
							} catch (e) {
								editorDebug.activeElement = 'unknown';
							}
							if (!activeIsEditor) {
								console.log(
									'[AI Response] ⚠️  Editor not focused after focus()+click() — execCommand may fail, keyboard fallback may be needed',
								);
							}

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
										delivered: false,
										needsHistoryVerify: true,
										message: 'Message already delivered (duplicate prevented)',
										chatId: cId,
									};
								}
							}

							// Отправляем штатным путём сайта
							console.log(`[AI Response] 📤 Calling modelsChat.sendMessage()... (attempt ${attempt})`);
							modelsChat.sendMessage();

							// Небольшая пауза, чтобы ввод осел. Итоговая проверка —
							// снаружи (Node): перечитанная история через 2с.
							// Здесь успех НЕ объявляем: локальный слепок бывает
							// оптимистичным (фантомный пост + висящий unAnswered).
							await new Promise(resolve => setTimeout(resolve, 700));

							return {
								success: true,
								delivered: false,
								needsHistoryVerify: true,
								chatId: cId,
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
					} // end запасного programmatic-пути (выполняется только если keyboard-primary не доставил)

					// Единая проверка доставки: перечитанная история
					// (последнее — наше + текст совпал без учёта смайлов).
					// Keyboard-путь уже проверен внутри _keyboardSend; здесь —
					// programmatic-путь. Флаг unAnswered доказательством НЕ считается.
					if (result && result.success && result.needsHistoryVerify && !messageSent) {
						await new Promise(resolve => setTimeout(resolve, 2000));
						const hv = await verifyDeliveryByHistory(page, chatId, message);
						console.log(
							`[AI Response Service] 📜 History-verify: delivered=${hv.delivered} (${hv.reason || hv.verifiedBy})`,
						);
						if (hv.delivered) {
							result = {
								success: true,
								delivered: true,
								message: 'Message verified in chat history',
								chatId,
								verifiedBy: 'history_match',
							};
						} else {
							result = {
								success: false,
								delivered: false,
								error: `Message not in chat history (${hv.reason || 'unknown'})`,
								chatId,
							};
						}
					}

					// Проверяем результат
					if (result.success && result.delivered) {
						console.log(`[AI Response Service] ✅ Message delivered on attempt ${sendAttempt} (verified by: ${result.verifiedBy || 'history_match'})`);
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

				// Keyboard-ввод уже идёт первичным в каждой попытке выше
				// (_keyboardSend), дублирующий пост-fallback удалён.

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
