// AI Auto Response - Chat Processor
// Обработка одного чата: навигация, извлечение истории, генерация, отправка

import aiResponseService from '../aiResponseService.js';
import { MAX_REPLY_CHARS, replyLength } from '../aiService/responseValidator.js';
import chatMessagesExtractorService from '../luxeeApi/chatMessagesExtractorService.js';
import profileScanner from './profileScanner.js';
import cycleLogger from './cycleLogger.js';
import utils from './utils.js';
import { vlog } from '../verbose.js';

// Кэш сгенерированных, но НЕ отправленных ответов.
// Сгенерировали за токены, а отправка упала (сеть/таймаут/недоставка):
// следующий цикл сначала пробует отправить ЭТОТ ЖЕ текст по ТОМУ ЖЕ
// сообщению мужчины — без нового обращения к ИИ. Новое сообщение мужчины
// или истечение TTL (10 мин) = новый ключ = новая генерация.
// Отправленный ответ из кэша удаляется.
const PENDING_REPLY_TTL_MS = 10 * 60 * 1000;
const PENDING_REPLY_MAX = 200;
const pendingReplies = new Map(); // key(`${chatId}||${manKey}`) -> { text, ts }
const pendingReplyKey = (chatId, manKey) => `${chatId}||${manKey}`;
const getPendingReply = (chatId, manKey) => {
	const key = pendingReplyKey(chatId, manKey);
	const rec = pendingReplies.get(key);
	if (!rec) return null;
	if (Date.now() - rec.ts > PENDING_REPLY_TTL_MS) {
		pendingReplies.delete(key);
		return null;
	}
	return rec.text;
};
const storePendingReply = (chatId, manKey, text) => {
	if (pendingReplies.size >= PENDING_REPLY_MAX) {
		pendingReplies.delete(pendingReplies.keys().next().value);
	}
	pendingReplies.set(pendingReplyKey(chatId, manKey), { text, ts: Date.now() });
};
const dropPendingReply = (chatId, manKey) => {
	pendingReplies.delete(pendingReplyKey(chatId, manKey));
};

// Предохранитель от вечного цикла navigation_failed: один битый чат
// (не открывается навигацией) не должен парализовать весь аккаунт.
// После NAV_FAIL_MAX подряд идущих fails чат откладывается на NAV_BACKOFF_MS.
const NAV_FAIL_MAX = 3;
const NAV_BACKOFF_MS = 10 * 60 * 1000;
const navFailures = new Map(); // key(`${accountId}||${chatId}`) -> { fails, skipUntil }
const navFailKey = (accountId, chatId) => `${accountId}||${chatId}`;
const recordNavFail = (accountId, chatId) => {
	const key = navFailKey(accountId, chatId);
	const prev = navFailures.get(key) || { fails: 0, skipUntil: 0 };
	prev.fails += 1;
	if (prev.fails >= NAV_FAIL_MAX) {
		prev.skipUntil = Date.now() + NAV_BACKOFF_MS;
	}
	navFailures.set(key, prev);
	return prev;
};
const clearNavFail = (accountId, chatId) => {
	navFailures.delete(navFailKey(accountId, chatId));
};

// Собеседник заблокировал анкету: отвечать невозможно, разбан
// маловероятен — откладываем чат на BLOCKED_BACKOFF_MS (1.5 суток),
// чтобы не жечь по ~4с каждый цикл на заведомо мёртвый чат.
// Проверка баннера требует открытого чата, поэтому первая проверка
// после рестарта всё равно делает один заход, дальше — пропуск без goto.
const BLOCKED_BACKOFF_MS = 36 * 60 * 60 * 1000;
const blockedChats = new Map(); // key(`${accountId}||${chatId}`) -> skipUntil ts
const blockedKey = (accountId, chatId) => `${accountId}||${chatId}`;

// Часть chatId, принадлежащая анкете. Порядок частей НЕ фиксирован
// (profile_man и man_profile), поэтому позиция НЕ используется —
// только точное знание, по приоритетам:
// 1) chat.profileUidOuter (выставляет CatchUp-сканер),
// 2) часть, НЕ равная manUid (manUid — из members сайта, авторитетен),
// 3) часть, входящая в allUids профиля,
// 4) fallback — первая часть (старое поведение) + warn в лог.
const resolveProfileUidOuter = (chat, profile) => {
	const [splitA, splitB] = String(chat.chatId || '').split('_');
	if (chat.profileUidOuter) {
		return { profileUidOuter: String(chat.profileUidOuter), way: 'catchup' };
	}
	if (chat.manUid) {
		const other = [splitA, splitB].find(
			p => p && String(p) !== String(chat.manUid),
		);
		if (other) {
			return { profileUidOuter: String(other), way: 'manUid' };
		}
	}
	const allUidsStr = (profile.allUids || [profile.uid]).map(String);
	const hit = [splitA, splitB].find(p => p && allUidsStr.includes(String(p)));
	if (hit) {
		return { profileUidOuter: String(hit), way: 'allUids' };
	}
	return { profileUidOuter: String(splitA || ''), way: 'fallback' };
};

// Сравнение chatId без учёта порядка частей (profile_man == man_profile).
const normalizeChatId = id =>
	String(id || '')
		.split('_')
		.sort()
		.join('_');

// Флаг unAnswered врёт в обе стороны (false без нашего сообщения; true при
// фантомном посте). При false перепроверяем по истории: если последнее от
// мужчины — отвечать НАДО, иначе вечный скип без ответа.
// Возвращает true (точно отвечен) / false (точно не отвечен) / null (неизвестно).
const isTrulyAnswered = async page => {
	try {
		const hist = await chatMessagesExtractorService.getChatHistory(page, 6);
		if (!hist || hist.error || !hist.lastMessage) return null;
		return !!hist.lastMessage.isFromProfile;
	} catch (e) {
		return null;
	}
};

/**
 * Обработать один чат
 * @param {Object} params - Параметры
 * @param {string} params.accountId - ID аккаунта
 * @param {string} params.userId - ID пользователя
 * @param {Object} params.page - Playwright page
 * @param {Object} params.profile - Данные профиля
 * @param {Object} params.chat - Данные чата
 * @param {boolean} params.isCatchUp - Флаг что чат из Catch Up (опционально)
 * @returns {Promise<Object>} - { sent: boolean, reason: string }
 */
const processSingleChat = async ({
	accountId,
	userId,
	page,
	profile,
	chat,
	isCatchUp = false,
}) => {
	const startTime = Date.now();

	utils.log('Chat Processor', `📝 Processing chat ${chat.chatId}...`);
	utils.log(
		'Chat Processor',
		`Profile: ${profile.username}, Man: ${chat.manName}`,
	);

	console.log('[🔧 PROCESSOR] ========== PROCESSING CHAT ==========');
	console.log('[🔧 PROCESSOR] Chat:', {
		chatId: chat.chatId,
		manName: chat.manName,
		manUid: chat.manUid,
		lastActivity: chat.lastActivity,
	});
	console.log('[🔧 PROCESSOR] Profile:', {
		uid: profile.uid,
		username: profile.username,
		allUids: profile.allUids,
	});

	// Предохранитель: чат в backoff после серии navigation_failed —
	// пропускаем сразу, без goto, чтобы не жечь цикл каждые 5 секунд.
	const navState = navFailures.get(navFailKey(accountId, chat.chatId));
	if (navState && Date.now() < navState.skipUntil) {
		utils.log(
			'Chat Processor',
			`⏸️  Chat ${chat.chatId} in nav-backoff (${navState.fails} fails), skipping`,
		);
		return { sent: false, reason: 'nav_backoff' };
	}

	// Предохранитель: чат заблокирован собеседником — пропускаем сразу,
	// без goto. Просроченные записи чистим лениво.
	const blockedUntil = blockedChats.get(blockedKey(accountId, chat.chatId));
	if (blockedUntil) {
		if (Date.now() < blockedUntil) {
			utils.log(
				'Chat Processor',
				`⛔ Chat ${chat.chatId} blocked by user (backoff), skipping`,
			);
			return { sent: false, reason: 'user_blocked_backoff' };
		}
		blockedChats.delete(blockedKey(accountId, chat.chatId));
	}

	try {
		// ========== НАВИГАЦИЯ К ЧАТУ ==========
		const { profileUidOuter, way } = resolveProfileUidOuter(chat, profile);
		if (way === 'fallback') {
			utils.log(
				'Chat Processor',
				`⚠️  Could not resolve profile part of ${chat.chatId}, using first part`,
			);
		}
		const [splitA, splitB] = String(chat.chatId || '').split('_');
		const userUid =
			chat.manUid ||
			[splitA, splitB].find(
				p => p && String(p) !== String(profileUidOuter),
			) ||
			splitB;
		const url = `https://luxee.io/chats/?ownerUid=${profile.uid}&profileUid=${profileUidOuter}&userUid=${userUid}`;

		console.log('[🚦 CHAT PROCESSOR] ========================================');
		console.log('[🚦 CHAT PROCESSOR] 🌐 NAVIGATION START');
		vlog('[🚦 CHAT PROCESSOR] From URL:', page.url());
		vlog('[🚦 CHAT PROCESSOR] To URL:', url);
		vlog('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		vlog('[🚦 CHAT PROCESSOR] Profile:', profile.username, `(${profile.uid})`);
		vlog('[🚦 CHAT PROCESSOR] Man:', chat.manName);
		vlog('[🚦 CHAT PROCESSOR] isCatchUp:', isCatchUp);
		vlog('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());

		utils.log('Chat Processor', `🌐 Navigating to: ${url}`);
		vlog('[🔧 PROCESSOR] Navigation URL:', url);

		try {
			vlog('[🚦 CHAT PROCESSOR] ⏳ Executing page.goto()...');
			await page.goto(url, {
				waitUntil: 'domcontentloaded',
				timeout: 10000,
			});
			vlog('[🚦 CHAT PROCESSOR] ✅ page.goto() completed');
	} catch (navError) {
		console.log('[🚦 CHAT PROCESSOR] ❌ page.goto() FAILED:', navError.message);
		utils.logError(
			'Chat Processor',
			`❌ Navigation error: ${navError.message}`,
		);
		const st = recordNavFail(accountId, chat.chatId);
		if (st.fails >= NAV_FAIL_MAX) {
			utils.log(
				'Chat Processor',
				`⏸️  ${chat.chatId}: ${st.fails} nav fails in a row — backoff 10 min`,
			);
		}
		cycleLogger.logEvent(accountId, 'chat', 'nav_failed', {
			chatId: chat.chatId,
			manName: chat.manName,
			profileName: profile.username,
			isCatchUp,
			reason: 'navigation_timeout',
			sent: false,
		});
		return { sent: false, reason: 'navigation_timeout' };
	}

		vlog('[🚦 CHAT PROCESSOR] ⏳ Sleeping 3 seconds...');
		await utils.sleep(3000);
		vlog('[🚦 CHAT PROCESSOR] ✅ Sleep completed');
		vlog('[🚦 CHAT PROCESSOR] Current URL after navigation:', page.url());

		// Проверка успешности навигации
		const activeChatId = await page.evaluate(() => {
			return window.modelsChat?.getChats?.active?.identity;
		});

	if (normalizeChatId(activeChatId) !== normalizeChatId(chat.chatId)) {
		utils.logError(
			'Chat Processor',
			`❌ Navigation failed: expected ${chat.chatId}, got ${activeChatId}`,
		);
		const st = recordNavFail(accountId, chat.chatId);
		if (st.fails >= NAV_FAIL_MAX) {
			utils.log(
				'Chat Processor',
				`⏸️  ${chat.chatId}: ${st.fails} nav fails in a row — backoff 10 min`,
			);
		}
		cycleLogger.logEvent(accountId, 'chat', 'nav_failed', {
			chatId: chat.chatId,
			manName: chat.manName,
			profileName: profile.username,
			isCatchUp,
			reason: 'navigation_failed',
			gotChatId: activeChatId || null,
			sent: false,
		});
		return { sent: false, reason: 'navigation_failed' };
	}

		utils.log('Chat Processor', `✅ Navigated successfully`);
		clearNavFail(accountId, chat.chatId);

		// ========== ПРОВЕРКА БЛОКИРОВКИ (заблокировавший нас юзер) ==========
		// Если собеседник заблокировал анкету — сайт молча глотает отправку
		// (msgCount не растёт, unAnswered висит). Проверяем баннер ДО генерации,
		// чтобы не жечь токены впустую и не долбить retry вечно.
		const blockCheck = await page
			.evaluate(() => {
				const banner = document.querySelector('#user-block-notify');
				if (!banner) return { blocked: false };
				let visible = false;
				try {
					const rect = banner.getBoundingClientRect();
					const style = window.getComputedStyle(banner);
					visible =
						rect.width > 0 &&
						rect.height > 0 &&
						style.display !== 'none' &&
						style.visibility !== 'hidden';
				} catch (e) {
					visible = false;
				}
				return {
					blocked: visible,
					text: visible ? (banner.textContent || '').trim().slice(0, 80) : '',
				};
			})
			.catch(() => ({ blocked: false, text: '' }));

		if (blockCheck.blocked) {
			blockedChats.set(
				blockedKey(accountId, chat.chatId),
				Date.now() + BLOCKED_BACKOFF_MS,
			);
			utils.log(
				'Chat Processor',
				`⛔ Chat blocked by user ("${blockCheck.text}") — backoff 36h for ${chat.manName} (${chat.manUid})`,
			);
			cycleLogger.logEvent(accountId, 'chat', 'skipped', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'user_blocked',
			});
			return { sent: false, reason: 'user_blocked' };
		}

		// ========== ПРОВЕРКА unAnswered (ТОЛЬКО ДЛЯ ОБЫЧНЫХ ЧАТОВ!) ==========
		if (!isCatchUp) {
			// 📋 ОБЫЧНЫЕ ЧАТЫ: проверяем unAnswered
			utils.log('Chat Processor', `🔍 Checking unAnswered status...`);
			const unAnsweredCheck = await profileScanner.checkActiveChatUnAnswered(
				page,
				chat.chatId,
			);

		if (unAnsweredCheck.error) {
			utils.logError(
				'Chat Processor',
				`❌ unAnswered check failed: ${unAnsweredCheck.error}`,
			);
			cycleLogger.logEvent(accountId, 'chat', 'history_failed', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'unanswered_check_failed',
				sent: false,
			});
			return { sent: false, reason: 'unanswered_check_failed' };
		}

		if (!unAnsweredCheck.isUnAnswered) {
			// Флаг false — но он врёт: проверяем последнее в истории.
			// Если последнее от мужчины — отвечаем (иначе вечный скип).
			const truly = await isTrulyAnswered(page);
			if (truly === false) {
				utils.log(
					'Chat Processor',
					`⚠️  unAnswered=false but last message is from man — proceeding (flag unreliable)`,
				);
			} else {
				utils.log(
					'Chat Processor',
					`⏭️  Chat already answered (unAnswered = false) - skipping`,
				);
				cycleLogger.logEvent(accountId, 'chat', 'skipped', {
					chatId: chat.chatId,
					manName: chat.manName,
					profileName: profile.username,
					isCatchUp,
					reason: 'already_answered',
				});
				return { sent: false, reason: 'already_answered' };
			}
		}

			utils.log('Chat Processor', `✅ unAnswered = true, proceeding...`);
		} else {
			// 🔥 CATCH UP: НЕ проверяем unAnswered - пишем в любом случае!
			utils.log(
				'Chat Processor',
				`🎯 Catch Up mode: skipping unAnswered check`,
			);
		}

	// ========== ИЗВЛЕЧЬ ИСТОРИЮ С RETRY (3 попытки) ==========
	let history = null;
	let retryCount = 0;
	const maxRetries = 3;

	while (retryCount < maxRetries && !history) {
		utils.log(
			'Chat Processor',
			`📜 Extracting history (attempt ${retryCount + 1}/${maxRetries})...`,
		);

		// История для промпта: 6 последних достаточно (было 10 без бюджета —
		// длинные чаты давали +500-1000 токенов сверх system при ответе 20-100).
		// Объём дополнительно режется в formatHistoryForAI + promptBuilder.
		const result = await chatMessagesExtractorService.getChatHistory(page, 6);

		if (!result.error) {
			history = result;
			utils.log(
				'Chat Processor',
				`✅ Extracted ${history.messages.length} messages`,
			);
			break;
		}

		retryCount++;
		if (retryCount < maxRetries) {
			utils.log('Chat Processor', `⏳ Retry in 2 seconds...`);
			await utils.sleep(2000);
		} else {
			utils.logError(
				'Chat Processor',
				`❌ Failed to extract history after ${maxRetries} attempts: ${result.error}`,
			);
		}
	}

	// ========== FALLBACK ДЛЯ CATCH UP: ПЕРВОЕ СООБЩЕНИЕ ==========
	if (!history && isCatchUp) {
		utils.log(
			'Chat Processor',
			'🎯 Catch Up: No history found, will send FIRST MESSAGE...',
		);

		// Создаём минимальную "историю" для первого сообщения
		history = {
			messages: [],
			lastMessage: null,
			formattedHistory: '',
		};

		utils.log('Chat Processor', '💬 Using first message mode for Catch Up');
	}

	// ========== ОБЫЧНЫЕ ЧАТЫ: ПРОПУСКАЕМ ЕСЛИ НЕТ ИСТОРИИ ==========
	if (!history) {
		utils.logError(
			'Chat Processor',
			`❌ Failed to extract history after ${maxRetries} attempts`,
		);
		cycleLogger.logEvent(accountId, 'chat', 'history_failed', {
			chatId: chat.chatId,
			manName: chat.manName,
			profileName: profile.username,
			isCatchUp,
			reason: 'history_extraction_failed',
			sent: false,
		});
		return { sent: false, reason: 'history_extraction_failed' };
	}

	// ========== ОПРЕДЕЛЯЕМ ТИП ПРОМТА ==========
	let typeInstructions = '';

	if (isCatchUp) {
		// 🔥 CATCH UP ЛОГИКА
		utils.log('Chat Processor', '🎯 Processing Catch Up chat...');

		// ✅ ПРОВЕРКА: есть ли история?
		if (!history.lastMessage) {
			// 📭 НЕТ ИСТОРИИ → ПЕРВОЕ СООБЩЕНИЕ
			typeInstructions = `This is a FIRST MESSAGE to start a conversation. Write a short, friendly, and natural greeting that shows interest in getting to know him. Keep it simple, warm, and inviting (1-2 sentences max). Don't ask too many questions at once.`;
			utils.log('Chat Processor', '💬 Catch Up: FIRST MESSAGE (no history)');
		} else {
			// 📬 ЕСТЬ ИСТОРИЯ → СТАНДАРТНЫЙ ПРОМТ
			typeInstructions =
				chatMessagesExtractorService.getAIInstructionsForMessageType(
					history.lastMessage.messageType,
				);

		// Если последнее от девушки → добавляем короткую подсказку
		if (history.lastMessage.isFromProfile) {
			typeInstructions += `\n\nNOTE: The man saw your last message but didn't reply. Re-engage him with a fresh question based on chat history.`;
			utils.log(
				'Chat Processor',
				'💬 Catch Up: last from profile, added re-engagement note',
			);
			// СВЕРКА С ФИЛЬТРОМ: фильтр решает по хвосту list.message БЕЗ открытия
			// чата, процессор — по DOM открытой страницы. Расхождение этих двух
			// вердиктов = признак инвертированного порядка массива list.message.
			console.log('[🔍 PROCESSOR VS FILTER] Catch Up authorship (DOM truth):', {
				chatId: chat.chatId,
				lastAuthor: history.lastMessage.author,
				isFromProfile: history.lastMessage.isFromProfile,
				isFromMan: history.lastMessage.isFromMan,
				filterTailUid: chat.lastMsgUid ?? 'n/a',
				filterTailUType: chat.lastMsgUType ?? 'n/a',
				filterManUid: chat.manUid ?? 'n/a',
			});
		} else {
			utils.log(
				'Chat Processor',
				'📬 Catch Up: last from man, standard reply',
			);
			console.log('[🔍 PROCESSOR VS FILTER] Catch Up authorship (DOM truth):', {
				chatId: chat.chatId,
				lastAuthor: history.lastMessage.author,
				isFromProfile: history.lastMessage.isFromProfile,
				isFromMan: history.lastMessage.isFromMan,
				filterTailUid: chat.lastMsgUid ?? 'n/a',
				filterTailUType: chat.lastMsgUType ?? 'n/a',
				filterManUid: chat.manUid ?? 'n/a',
			});
		}
		}
	} else {
			// 📋 ОБЫЧНЫЙ ЧАТ: проверяем shouldReply
			const shouldReply = chatMessagesExtractorService.shouldReplyToChat(
				history.lastMessage,
			);

			vlog('[🔧 PROCESSOR] Should reply check:', {
				shouldReply: shouldReply.shouldReply,
				reason: shouldReply.reason,
				lastMessageAuthor: history.lastMessage?.author,
				lastMessageIsFromProfile: history.lastMessage?.isFromProfile,
				lastMessageIsFromMan: history.lastMessage?.isFromMan,
			});

		if (!shouldReply.shouldReply) {
			utils.log('Chat Processor', `⏭️  ${shouldReply.reason}`);
			console.log('[🔧 PROCESSOR] ❌ SKIPPING CHAT:', shouldReply.reason);
			cycleLogger.logEvent(accountId, 'chat', 'skipped', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'shouldnt_reply',
			});
			return { sent: false, reason: 'shouldnt_reply' };
		}

			typeInstructions =
				chatMessagesExtractorService.getAIInstructionsForMessageType(
					history.lastMessage.messageType,
				);
		}

		vlog('[🔧 PROCESSOR] ✅ Will generate AI response');

		// Форматирование истории для AI
		const formattedHistory = chatMessagesExtractorService.formatHistoryForAI(
			history.messages,
			profile.username,
			history.manName,
		);

		// 📊 ЛОГИРОВАНИЕ ПРОМТА
		vlog(
			'Chat Processor',
			`📋 Type instructions length: ${typeInstructions.length} chars`,
		);
		if (typeInstructions) {
			const preview = typeInstructions.substring(0, 100).replace(/\n/g, ' ');
			vlog(
				'Chat Processor',
				`📄 Type instructions preview: ${preview}...`,
			);
		} else {
			vlog('Chat Processor', `⚠️  NO type instructions provided!`);
		}

		const messageType = history.lastMessage?.messageType || 'text';
		utils.log(
			'Chat Processor',
			`🤖 Generating response (type: ${messageType})...`,
		);

	// ========== АДАПТИВНАЯ ЗАДЕРЖКА НА "ПЕЧАТАНИЕ" (дедлайн, лимиты без изменений) ==========
	// Лимиты ТЕ ЖЕ (7–13с / 25с минимум / 45с urgent / 0.5с техминимум): ответ
	// никогда не уйдёт раньше, чем уходил раньше. Новое: генерация идёт ВНУТРИ
	// окна задержки, а не после него — типичный кейс ~35-40с вместо ~45-50с,
	// худший успех ограничен генерацией (45с) + отправкой.
	const MIN_DELAY = 7000;  // 7 секунд
	const MAX_DELAY = 13000; // 13 секунд
	const MIN_REALISTIC_TIME = 25000; // 25 секунд - минимальное реалистичное время ответа
	const URGENT_THRESHOLD = 45000;   // 45 секунд - порог "срочности" (было 50000)
	const MIN_TECHNICAL_DELAY = 500;  // 0.5 секунды - технический минимум

	console.log('[🚦 CHAT PROCESSOR] ========================================');
	console.log('[🚦 CHAT PROCESSOR] ⏱️  ADAPTIVE TYPING DELAY START');
	
	let typingDelay;
	
	// АДАПТИВНАЯ ЗАДЕРЖКА ТОЛЬКО ДЛЯ ОБЫЧНЫХ ЧАТОВ (НЕ CATCH UP)
	if (!isCatchUp) {
		// ✅ ПЕРЕСЧИТЫВАЕМ elapsed ЗДЕСЬ (после всех проверок/навигации)
		// Это даёт более точное время, учитывая overhead на обработку
		const elapsed = Date.now() - chat.lastActivity;
			const targetDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
			const calculatedDelay = targetDelay - elapsed;
			
			// Проверяем минимальное реалистичное время (25 секунд)
			const projectedResponseTime = elapsed + Math.max(0, calculatedDelay);
			
		if (elapsed >= URGENT_THRESHOLD) {
			// СРОЧНО: Сообщение висит 45+ секунд - отвечаем максимально быстро
			typingDelay = MIN_TECHNICAL_DELAY;
			vlog('[🚦 ADAPTIVE DELAY] ⚠️  URGENT MODE: Message is 45+ seconds old');
			} else if (projectedResponseTime < MIN_REALISTIC_TIME) {
				// Если ответим слишком быстро - ждём до 25 секунд
				const additionalWait = MIN_REALISTIC_TIME - elapsed;
				typingDelay = Math.max(MIN_TECHNICAL_DELAY, additionalWait);
				vlog('[🚦 ADAPTIVE DELAY] ⏱️  Extending delay to meet 25s minimum');
			} else {
				// Используем вычисленную задержку
				typingDelay = Math.max(MIN_TECHNICAL_DELAY, calculatedDelay);
			}

			vlog(`[🚦 ADAPTIVE DELAY] Message age: ${Math.round(elapsed / 1000)}s`);
			vlog(`[🚦 ADAPTIVE DELAY] Target delay range: ${MIN_DELAY / 1000}-${MAX_DELAY / 1000}s`);
			vlog(`[🚦 ADAPTIVE DELAY] Random target: ${Math.round(targetDelay / 1000)}s`);
			vlog(`[🚦 ADAPTIVE DELAY] Calculated delay: ${Math.round(calculatedDelay / 1000)}s`);
			vlog(`[🚦 ADAPTIVE DELAY] Actual delay: ${Math.round(typingDelay / 1000)}s`);
			vlog(`[🚦 ADAPTIVE DELAY] Projected response time: ${Math.round((elapsed + typingDelay) / 1000)}s from message`);

			utils.log(
				'Chat Processor',
				`⏱️  Adaptive typing delay: ${Math.round(typingDelay / 1000)}s (message age: ${Math.round(elapsed / 1000)}s)`,
			);
		} else {
			// CATCH UP: обычная случайная задержка (БЕЗ адаптивной логики)
			typingDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

			vlog('[🚦 CATCH UP DELAY] Using standard random delay');
			vlog(`[🚦 CATCH UP DELAY] Range: ${MIN_DELAY / 1000}-${MAX_DELAY / 1000}s`);
			vlog(`[🚦 CATCH UP DELAY] Actual delay: ${Math.round(typingDelay / 1000)}s`);

			utils.log(
				'Chat Processor',
				`⏱️  Catch Up typing delay: ${Math.round(typingDelay / 1000)}s`,
			);
		}
		
		console.log(`[🚦 CHAT PROCESSOR] 💭 TYPING DELAY TARGET: ${Math.round(typingDelay / 1000)} seconds (generation runs inside this window)`);
		// Дедлайн: момент, когда закончилась бы старая задержка.
		// НЕ спим здесь — спим остаток ПОСЛЕ генерации ниже.
		const delayDeadline = Date.now() + typingDelay;

		// ========== КЭШ НЕОТПРАВЛЕННОГО ОТВЕТА (без повторной генерации) ==========
		// Ключ: чат + последнее сообщение мужчины. Тот же ключ = тот же контекст
		// для ИИ = отправляем готовый текст, новое обращение НЕ нужно.
		const manKey = history.lastMessage
			? `${history.lastMessage.messageType}:${String(history.lastMessage.text || '').slice(0, 120)}`
			: 'first-message';
		let replyText = null;
		const cachedReply = getPendingReply(chat.chatId, manKey);
		if (cachedReply) {
			utils.log('Chat Processor', `♻️  Reusing generated reply (no new AI call)`);
			console.log('[🚦 CHAT PROCESSOR] ♻️  Cached reply found, skipping AI generation');
			replyText = cachedReply;
		} else {
			// ========== ГЕНЕРАЦИЯ ОТВЕТА (внутри окна задержки) ==========
			vlog('[🚦 CHAT PROCESSOR] ========================================');
			vlog('[🚦 CHAT PROCESSOR] 🤖 AI GENERATION START');
			vlog('[🚦 CHAT PROCESSOR] Current URL:', page.url());
		vlog('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		vlog('[🚦 CHAT PROCESSOR] Profile part:', profileUidOuter, `(via ${way})`);
			vlog('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());

			utils.log('Chat Processor', `🤖 Generating AI response (type: ${messageType})...`);

			vlog('[🚦 CHAT PROCESSOR] ⏳ Calling aiResponseService.generateResponse()...');
			const genResult = await aiResponseService.generateResponse({
				userId,
				accountId,
				profile: {
					// uid обязателен: без него getProfilePrompt(uid) всегда возвращает
					// дефолтный SYSTEM_PROMPT, кастомные промпты из Mongo молча не работали
					uid: profile.uid,
					username: profile.username,
					age: profile.age,
					country: profile.country,
					city: profile.city,
				},
				manMessage: history.lastMessage?.text || '',
				formattedHistory: formattedHistory,
				profileName: profile.username,
				manName: chat.manName || history.manName || 'there',
				typeInstructions: typeInstructions,
				messageType: messageType,
			});
			replyText = genResult.response;
			storePendingReply(chat.chatId, manKey, replyText);
		}

		// Досыпаем остаток задержки: генерация была быстрой — ждём как раньше;
		// долгой — она уже покрыла окно (ответ и так не моментальный).
		const remainDelay = delayDeadline - Date.now();
		if (remainDelay > 0) {
			vlog(`[🚦 CHAT PROCESSOR] 💭 Sleeping remaining ${Math.round(remainDelay / 1000)}s of typing delay`);
			await utils.sleep(remainDelay);
		} else {
			vlog('[🚦 CHAT PROCESSOR] ✅ Generation covered typing delay, no extra sleep');
		}
		vlog('[🚦 CHAT PROCESSOR] ✅ Typing delay completed');

		// Повторная проверка unAnswered ПОСЛЕ задержки (только обычные чаты).
		// Зачем: задержка 7-25с — за это время в чат могли уже ответить
		// (другой процесс/рука). Без перепроверки мы генерировали ответ за токены
		// и тут же выкидывали его как already_answered — x2 расход ни за что.
		if (!isCatchUp) {
			const recheck = await profileScanner.checkActiveChatUnAnswered(
				page,
				chat.chatId,
			);
		if (!recheck.error && !recheck.isUnAnswered) {
			// Тот же кросс-чек: флаг false + последнее от мужчины = отвечаем.
			const trulyRechecked = await isTrulyAnswered(page);
			if (trulyRechecked !== false) {
				utils.log(
					'Chat Processor',
					`⏭️  Chat answered during typing delay (unAnswered = false) - skipping generation`,
				);
				cycleLogger.logEvent(accountId, 'chat', 'skipped', {
					chatId: chat.chatId,
					manName: chat.manName,
					profileName: profile.username,
					isCatchUp,
					reason: 'already_answered',
				});
				return { sent: false, reason: 'already_answered' };
			}
			utils.log(
				'Chat Processor',
				`⚠️  unAnswered=false but last message is from man — proceeding (flag unreliable)`,
			);
		}
		}

		// ========== ОТПРАВКА ГОТОВОГО ОТВЕТА (без повторной генерации) ==========
		// Финальная гарантия лимита сайта: длиннее 200 — НЕ отправляем вообще
		// (без обрезки), кэш сбрасываем, следующий цикл сгенерирует заново.
		if (replyLength(replyText) > MAX_REPLY_CHARS) {
			utils.logError(
				'Chat Processor',
				`❌ Reply exceeds ${MAX_REPLY_CHARS} chars (${replyLength(replyText)}) — dropping, will regenerate`,
			);
			dropPendingReply(chat.chatId, manKey);
			cycleLogger.logEvent(accountId, 'chat', 'generation_failed', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'reply_too_long',
				sent: false,
			});
			return { sent: false, reason: 'generation_failed' };
		}
		vlog('[🚦 CHAT PROCESSOR] ========================================');
		vlog('[🚦 CHAT PROCESSOR] 📤 AI SEND START (text ready, no regeneration)');
		vlog('[🚦 CHAT PROCESSOR] Current URL:', page.url());
		vlog('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		vlog('[🚦 CHAT PROCESSOR] Time:', new Date().toISOString());

		utils.log('Chat Processor', `📤 Sending AI response...`);

		vlog('[🚦 CHAT PROCESSOR] ⏳ Calling aiResponseService.sendResponse()...');
		const sendResult = await aiResponseService.sendResponse({
			userId,
			accountId,
			profileUid: profile.uid,
			chatId: chat.chatId,
			message: replyText,
		});

		// ========== ПРОВЕРКА РЕЗУЛЬТАТА ==========
		vlog('[🔧 PROCESSOR] ========== AI RESPONSE RESULT ==========');
		vlog('[🔧 PROCESSOR] Response structure:', {
			hasResponse: !!replyText,
			generatedText: String(replyText || '').substring(0, 50),
			hasSendResult: !!sendResult,
			sendSuccess: sendResult?.success,
			sendTimestamp: sendResult?.timestamp,
		});

		utils.log('Chat Processor', `🔍 Checking send result...`);

		if (!sendResult || !sendResult.success) {
			utils.logError('Chat Processor', `❌ Message sending failed`);
			console.log(
				'[🔧 PROCESSOR] ❌ SEND FAILED - sendResult:',
				sendResult,
			);
			cycleLogger.logEvent(accountId, 'chat', 'send_failed', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'send_failed',
				sent: false,
			});
			// Кэш НЕ удаляем: следующий цикл отправит этот же текст без новой генерации
			return { sent: false, reason: 'send_failed' };
		}
		utils.log('Chat Processor', `   ✓ Sending: SUCCESS`);

		// Отправлено — кэш больше не нужен
		dropPendingReply(chat.chatId, manKey);

		// Извлекаем сгенерированный текст из правильного места
		const generatedText = replyText || 'N/A';
		const sendTime = new Date(
			sendResult.timestamp,
		).toLocaleTimeString();

		utils.log(
			'Chat Processor',
			`✅ Generated and sent: "${generatedText.substring(0, 50)}..."`,
		);
		utils.log('Chat Processor', `✅ Message delivered at ${sendTime}`);

		console.log('[🔧 PROCESSOR] ✅ MESSAGE SENT SUCCESSFULLY');
		vlog(
			'[🔧 PROCESSOR] Generated text:',
			generatedText.substring(0, 100),
		);
		vlog(
			'[🔧 PROCESSOR] Send timestamp:',
			sendResult.timestamp,
		);

		// ✅ Сообщение УЖЕ отправлено - возвращаем успех
		const elapsed = Date.now() - startTime;

		console.log('[🚦 CHAT PROCESSOR] ✅ MESSAGE SENT SUCCESSFULLY');
		console.log('[🚦 CHAT PROCESSOR] Chat ID:', chat.chatId);
		console.log('[🚦 CHAT PROCESSOR] Duration:', Math.round(elapsed / 1000), 'seconds');
		
	utils.log(
		'Chat Processor',
		`✅ Successfully processed chat with ${chat.manName} (${Math.round(elapsed / 1000)}s)`,
	);
	cycleLogger.logEvent(accountId, 'chat', 'sent', {
		chatId: chat.chatId,
		manName: chat.manName,
		profileName: profile.username,
		isCatchUp,
		reason: isCatchUp ? 'catch_up_sent' : 'sent',
		durationSec: Math.round(elapsed / 1000),
		textPreview: generatedText.substring(0, 80),
		sent: true,
	});

		return {
			sent: true,
			chatId: chat.chatId,
			profileUid: profile.uid,
			manName: chat.manName,
			generatedText: generatedText.substring(0, 100),
			timestamp: sendResult.timestamp,
		};
	} catch (error) {
		const isContextClosed = error.message && error.message.includes('Target page, context or browser has been closed');
		const isPayment = error.isPaymentRequired || error.response?.status === 402;
		if (isContextClosed) {
			utils.log('Chat Processor', `⚠️ Context closed (AI stopped mid-flight) — aborting gracefully: ${error.message.slice(0,120)}`);
			cycleLogger.logEvent(accountId, 'chat', 'context_closed', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'context_closed',
				sent: false,
			});
			return { sent: false, reason: 'context_closed', error: error.message };
		}
		if (isPayment) {
			utils.logError('Chat Processor', `❌ Payment required (DeepSeek balance) — set AI_PROVIDER=nvidia or top up`, error);
			cycleLogger.logEvent(accountId, 'chat', 'payment_required', {
				chatId: chat.chatId,
				manName: chat.manName,
				profileName: profile.username,
				isCatchUp,
				reason: 'payment_required',
				sent: false,
			});
			return { sent: false, reason: 'payment_required', error: error.message };
		}
		utils.logError('Chat Processor', `❌ Unexpected error:`, error);
		cycleLogger.logEvent(accountId, 'chat', 'exception', {
			chatId: chat.chatId,
			manName: chat.manName,
			profileName: profile.username,
			isCatchUp,
			reason: 'exception',
			error: error.message,
			sent: false,
		});
		return {
			sent: false,
			reason: 'exception',
			error: error.message,
		};
	}
};

export default {
	processSingleChat,
};
