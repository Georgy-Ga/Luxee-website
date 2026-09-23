// AI Auto - Cycle Logger
// Структурированный in-memory лог AI-циклов (lock/schedule/profiles/catch-up/activity-center).
// Только память процесса (без БД): переживает тики, НЕ переживает рестарт бэкенда.
// Чтение через API: GET /ai/auto-response/accounts/:accountId/cycle-log
// Диагностика: GET /ai/auto-response/accounts/:accountId/cycle-diagnostics
// В docker stdout ничего не дублируем (там уже есть utils.log/console.log).

import utils from './utils.js';

const MAX_GLOBAL_EVENTS = 5000;
const MAX_ACCOUNT_EVENTS = 500;

const events = []; // глобальная лента (старые вытесняются)
const byAccount = new Map(); // accountId -> массив ссылок на события (cap 500)
const summaries = new Map(); // accountId -> сводка
let seq = 0;

const getSummaryRecord = accountId => {
	let record = summaries.get(accountId);
	if (!record) {
		record = {
			accountId,
			total: 0,
			byStage: {},
			lastEventAt: null,
			lastCatchUp: null, // { count, lastCount, shouldCheck, skipReason, at }
			lastSent: null, // { at, stage, chatId, manName, profileName, reason }
			lastFail: null, // { at, stage, chatId, manName, profileName, reason }
			lastSkip: null, // { at, stage, event, reason }
		};
		summaries.set(accountId, record);
	}
	return record;
};

/**
 * Записать событие цикла
 * @param {string} accountId - ID аккаунта
 * @param {string} stage - lock | precheck | schedule | cycle | active_profile | other_profiles | catchup | chat | activity_center
 * @param {string} event - имя события (locked_skip, count_check, chat_result, sent, ...)
 * @param {Object} details - произвольные поля (reason, chatId, manName, profileName, durationSec, ...)
 */
const logEvent = (accountId, stage, event, details = {}) => {
	const entry = {
		seq: ++seq,
		ts: utils.getKyivISO(), // киевское время с offset (+02:00/+03:00)
		accountId: accountId || null,
		stage,
		event,
		...details,
	};

	events.push(entry);
	if (events.length > MAX_GLOBAL_EVENTS) {
		events.splice(0, events.length - MAX_GLOBAL_EVENTS);
	}

	if (accountId) {
		let list = byAccount.get(accountId);
		if (!list) {
			list = [];
			byAccount.set(accountId, list);
		}
		list.push(entry);
		if (list.length > MAX_ACCOUNT_EVENTS) {
			list.splice(0, list.length - MAX_ACCOUNT_EVENTS);
		}

		// Обновляем сводку
		const record = getSummaryRecord(accountId);
		record.total += 1;
		record.byStage[stage] = (record.byStage[stage] || 0) + 1;
		record.lastEventAt = entry.ts;

		if (stage === 'catchup' && event === 'count_check') {
			record.lastCatchUp = {
				count: details.count ?? null,
				lastCount: details.lastCount ?? null,
				shouldCheck: details.shouldCheck ?? null,
				skipReason: details.skipReason || null,
				at: entry.ts,
			};
		}
		if (details.sent === true || event === 'sent') {
			record.lastSent = {
				at: entry.ts,
				stage,
				event,
				chatId: details.chatId || null,
				manName: details.manName || null,
				profileName: details.profileName || details.profile || null,
				reason: details.reason || event,
			};
		}
		if (
			details.sent === false ||
			event === 'generation_failed' ||
			event === 'send_failed' ||
			event === 'history_failed' ||
			event === 'nav_failed' ||
			event === 'exception' ||
			event === 'failed'
		) {
			record.lastFail = {
				at: entry.ts,
				stage,
				event,
				chatId: details.chatId || null,
				manName: details.manName || null,
				profileName: details.profileName || details.profile || null,
				reason: details.reason || event,
			};
		}
		if (event === 'locked_skip' || event === 'resting_skip' || event === 'skipped') {
			record.lastSkip = {
				at: entry.ts,
				stage,
				event,
				reason: details.reason || details.skipReason || details.currentState || event,
			};
		}
	}

	return entry;
};

/**
 * Прочитать события (новые в конце)
 * @param {Object} filters - { accountId, stage, event, limit }
 */
const getEvents = ({ accountId, stage, event, limit = 200 } = {}) => {
	const safeLimit = Math.min(Math.max(parseInt(limit) || 200, 1), 1000);
	const source = accountId ? byAccount.get(accountId) || [] : events;
	const filtered = source.filter(
		e =>
			(!stage || e.stage === stage) &&
			(!event || e.event === event),
	);
	return {
		total: filtered.length,
		returned: Math.min(filtered.length, safeLimit),
		events: filtered.slice(-safeLimit),
	};
};

/**
 * Сводка по аккаунту для диагностики "висит / не отвечает"
 */
const getSummary = accountId => {
	if (accountId) {
		return summaries.get(accountId) || null;
	}
	return [...summaries.values()];
};

export default {
	logEvent,
	getEvents,
	getSummary,
};
