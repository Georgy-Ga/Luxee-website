// Online Keeper: держит ВСЕ анкеты Luxee-аккаунта в онлайне.
// Механика: отдельный временный контекст → /profile/ → select Set online (All) →
// проверка → контекст закрывается. Chats и AI-контексты не трогаем.
//
// Расписание: каждые ~15 мин на аккаунт. Стартовый сдвиг случайный (0–5 мин),
// чтобы N аккаунтов после рестарта не били по сайту одновременно.
// Работает и в Docker, и под npm run dev: отдельный запуск браузера НЕ нужен,
// используется общий browserService (он уже знает про DOCKER executablePath).
//
// Кто запускает:
// - aiAutoResponseService.start() — оператор включил ИИ кнопкой;
// - server auto-recovery (index.js) — рестарт при уже включённом ИИ;
// Кто останавливает:
// - aiAutoResponseService.stop() — там же анкеты уходят в оффлайн;
// - сам кипер: аккаунт удалён/деактивирован/ИИ выключен → самостоп;
// - удаление/деактивация аккаунта, logout/deleteUser (страховочные stop).
import LuxeeAccountModel from '../models/LuxeeAccountModel.js';
import {
	setAllOnlineViaNewContext,
} from './luxeeApi/onlineRecoveryService.js';

const KEEPER_INTERVAL_MS = 15 * 60 * 1000; // ~15 мин между прогонами
const START_JITTER_MS = 5 * 60 * 1000; // случайный сдвиг старта 0–5 мин

const timers = new Map(); // accountId -> { timeoutId, intervalId }
const running = new Set(); // accountId с активным прогоном (anti-overlap)

const randomDelay = () => Math.floor(Math.random() * START_JITTER_MS);

const runOnce = async accountId => {
	if (running.has(accountId)) return;
	running.add(accountId);
	try {
		// Аккаунт удалён/выключен — кипер больше не нужен, самостоп
		const account = await LuxeeAccountModel.findById(accountId).catch(() => null);
		if (
			!account ||
			!account.isActive ||
			!account.aiEnabled ||
			account.aiEnabledByAdmin === false
		) {
			onlineKeeperService.stop(accountId);
			return;
		}
		if (!account.sessionData) return;
		const ok = await setAllOnlineViaNewContext(accountId).catch(() => false);
		if (!ok) {
			console.log(`[Online Keeper] ⚠️  keep-online failed for ${accountId}, retry in 15 min`);
		}
	} finally {
		running.delete(accountId);
	}
};

const onlineKeeperService = {
	/**
	 * Запустить кипер для аккаунта.
	 * @param {string} accountId
	 * @param {Object} opts
	 * @param {boolean} opts.immediate - сразу один прогон (кнопка ИИ / старт), иначе только по таймеру со сдвигом
	 */
	start: (accountId, opts = {}) => {
		const { immediate = true } = opts;
		if (!accountId) return;
		if (timers.has(accountId)) return; // уже запущен
		console.log(`[Online Keeper] ▶️  Started for account ${accountId} (every ~15 min)`);

		const scheduleInterval = () => {
			const existing = timers.get(accountId);
			if (!existing) return;
			existing.intervalId = setInterval(() => {
				runOnce(accountId).catch(() => {});
			}, KEEPER_INTERVAL_MS);
			if (existing.intervalId.unref) existing.intervalId.unref();
		};

		if (immediate) {
			// Первый прогон сразу (не блокируем caller), дальше строго по интервалу
			const timeoutId = setTimeout(() => {
				runOnce(accountId).catch(() => {});
			}, Math.floor(Math.random() * 10 * 1000)); // 0–10с, не в ту же секунду пачкой
			if (timeoutId.unref) timeoutId.unref();
			timers.set(accountId, { timeoutId, intervalId: null });
			// Интервал ведём от момента старта, чтобы держать ровно ~5 мин
			const existing = timers.get(accountId);
			if (existing) {
				existing.intervalId = setInterval(() => {
					runOnce(accountId).catch(() => {});
				}, KEEPER_INTERVAL_MS);
				if (existing.intervalId.unref) existing.intervalId.unref();
			}
		} else {
			// Только по таймеру со случайным сдвигом (перезапуск с N аккаунтами)
			const timeoutId = setTimeout(() => {
				runOnce(accountId).catch(() => {});
				scheduleInterval();
			}, randomDelay());
			if (timeoutId.unref) timeoutId.unref();
			timers.set(accountId, { timeoutId, intervalId: null });
		}
	},

	/**
	 * Остановить кипер для аккаунта (удаление/выключение ИИ/logout).
	 * Идемпотентно.
	 */
	stop: accountId => {
		if (!accountId) return;
		const t = timers.get(accountId);
		if (!t) return;
		try {
			if (t.timeoutId) clearTimeout(t.timeoutId);
		} catch (e) {}
		try {
			if (t.intervalId) clearInterval(t.intervalId);
		} catch (e) {}
		timers.delete(accountId);
		console.log(`[Online Keeper] ⏹️  Stopped for account ${accountId}`);
	},

	stopAll: () => {
		for (const accountId of Array.from(timers.keys())) {
			onlineKeeperService.stop(accountId);
		}
	},

	isRunning: accountId => timers.has(accountId),

	getStats: () => ({
		accounts: Array.from(timers.keys()),
		count: timers.size,
		intervalMin: KEEPER_INTERVAL_MS / 60000,
	}),
};

export default onlineKeeperService;
