// Online recovery на отдельном контексте — не трогает chats AI-ответов.
// Set online/offline (All): /profile/ → select → проверка результата.
// Периодический онлайн держит onlineKeeperService (каждые ~5 мин на аккаунт).
// Триггер релогина — failsCounter >=6 по modelsChat/about:blank (не AI-генерация).
import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';

const failsCounter = new Map(); // accountId -> {siteFails, lastAt}
const THRESHOLD = 6;
const socketServiceCache = { svc: null };

const getSocketService = async () => {
	if (socketServiceCache.svc) return socketServiceCache.svc;
	try {
		const m = await import('../socketService.js');
		socketServiceCache.svc = m.default || m;
		return socketServiceCache.svc;
	} catch (e) {
		return null;
	}
};

const emitReloginStatus = async (accountId, status, detail = {}) => {
	try {
		const svc = await getSocketService();
		if (!svc || !svc.io) return;
		// Шлём админам и владельцу — фронт покажет «Идёт перелогин...»
		svc.io.emit('ai:relogin:status', { accountId, status, ...detail, ts: new Date().toISOString() });
	} catch (e) {}
};

export const bumpSiteFail = (accountId, reason) => {
	const rec = failsCounter.get(accountId) || { siteFails: 0, lastAt: 0 };
	// AI-генерация не считается — только сайт
	if (['ai_generation_failed','ai_empty_response','ai_content_filter'].includes(reason)) return rec.siteFails;
	rec.siteFails += 1;
	rec.lastAt = Date.now();
	failsCounter.set(accountId, rec);
	return rec.siteFails;
};

export const resetFails = accountId => {
	failsCounter.delete(accountId);
};

export const shouldRelogin = accountId => {
	const rec = failsCounter.get(accountId);
	return rec && rec.siteFails >= THRESHOLD;
};

// about:blank — всегда релогин всех контекстов аккаунта
export const handleAboutBlank = async (accountId, page) => {
	const url = page ? page.url() : '';
	if (url === 'about:blank' || !url.includes('luxee.io')) {
		bumpSiteFail(accountId, 'about_blank');
		if (shouldRelogin(accountId)) {
			await reloginAllContexts(accountId);
			return true;
		}
	}
	return false;
};

// Значения select.profile-make-online (см. /profile/):
// 3 = Set online (All profiles), 4 = Set offline (All profiles)
const ONLINE_ALL_VALUE = '3';
const OFFLINE_ALL_VALUE = '4';

// Общий движок: отдельный временный контекст → /profile/ → select → проверка.
// С проверками на каждом шаге: страница загрузилась, select и плитки на месте,
// после makeOnline количество .profile-online-wrap соответствует ожиданию.
// Временный контекст всегда закрывается (finally), chats не трогаем.
const setOnlineModeViaNewContext = async (accountId, mode) => {
	const wantOnline = mode === ONLINE_ALL_VALUE;
	const modeName = wantOnline ? 'online-ALL' : 'offline-ALL';
	let LuxeeAccount;
	try {
		LuxeeAccount = (await import('../../models/LuxeeAccountModel.js')).default;
	} catch (e) {
		return { ok: false, error: 'model_import_failed' };
	}
	const account = await LuxeeAccount.findById(accountId).catch(() => null);
	if (!account || !account.sessionData) {
		return { ok: false, error: 'no_account_or_session' };
	}

	let browser;
	try {
		browser = await browserService.getBrowser();
	} catch (e) {
		return { ok: false, error: `browser_unavailable: ${e.message}` };
	}

	let tmpCtx = null;
	try {
		const storageState =
			typeof account.sessionData === 'string'
				? JSON.parse(account.sessionData)
				: account.sessionData;
		tmpCtx = await browser.newContext({
			storageState,
			viewport: { width: 1920, height: 1080 },
		});
		const p = await tmpCtx.newPage();

		// 1. Страница загрузилась
		await p.goto('https://luxee.io/profile/', {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});

		// 2. Нужные элементы на месте (select + плитки профилей)
		await p.waitForSelector('select.profile-make-online', { timeout: 15000 });
		await p.waitForSelector('.profile-tile-wrap-outside', { timeout: 20000 });

		const total = await p
			.evaluate(() => document.querySelectorAll('.profile-tile-wrap-outside').length)
			.catch(() => 0);
		if (total === 0) {
			return { ok: false, error: 'no_profile_tiles' };
		}

		// 3. Выставляем режим через select + change + makeOnline
		const applied = await p
			.evaluate(value => {
				const sel = document.querySelector('select.profile-make-online');
				if (!sel) return false;
				if (!sel.querySelector(`option[value="${value}"]`)) return false;
				sel.value = value;
				sel.dispatchEvent(new Event('change', { bubbles: true }));
				if (typeof makeOnline === 'function') {
					try {
						makeOnline(sel);
					} catch (e) {}
				}
				return true;
			}, mode)
			.catch(() => false);
		if (!applied) {
			return { ok: false, error: 'select_apply_failed' };
		}

		// 4. Даём сайту применить (pjax/AJAX) и проверяем результат
		await p.waitForTimeout(4000);
		const onlineCount = await p
			.evaluate(() => document.querySelectorAll('.profile-online-wrap').length)
			.catch(() => -1);

		const ok = wantOnline
			? onlineCount >= total && total > 0
			: onlineCount === 0;
		console.log(
			`[Online Recovery] Set ${modeName} via new context for ${accountId}: ${onlineCount}/${total} online tiles`,
		);
		if (!ok) {
			return { ok: false, error: 'verify_failed', onlineCount, total };
		}
		return { ok: true, onlineCount, total };
	} catch (e) {
		console.error(`[Online Recovery] set ${modeName} failed for ${accountId}:`, e.message);
		return { ok: false, error: e.message };
	} finally {
		if (tmpCtx) await tmpCtx.close().catch(() => {});
	}
};

// Отдельный контекст для /profile/ — не трогает chats.
// До 2 попыток: сайт иногда тупит на первой загрузке.
export const setAllOnlineViaNewContext = async accountId => {
	for (let attempt = 1; attempt <= 2; attempt++) {
		const res = await setOnlineModeViaNewContext(accountId, ONLINE_ALL_VALUE);
		if (res.ok) return true;
		console.log(
			`[Online Recovery] setAllOnline attempt ${attempt}/2 failed for ${accountId}: ${res.error}`,
		);
		await new Promise(resolve => setTimeout(resolve, 3000));
	}
	return false;
};

// Тот же URL/механика, но Set offline (All profiles) — value 4.
// Используется ПОСЛЕ выключения ИИ (сначала стоп ИИ, потом анкеты в оффлайн).
export const setAllOfflineViaNewContext = async accountId => {
	for (let attempt = 1; attempt <= 2; attempt++) {
		const res = await setOnlineModeViaNewContext(accountId, OFFLINE_ALL_VALUE);
		if (res.ok) return true;
		console.log(
			`[Online Recovery] setAllOffline attempt ${attempt}/2 failed for ${accountId}: ${res.error}`,
		);
		await new Promise(resolve => setTimeout(resolve, 3000));
	}
	return false;
};

// Релогин всех контекстов аккаунта: пересоздать из sessionData + reload
export const reloginAllContexts = async accountId => {
	console.log(`[Online Recovery] 🔄 Relogin all contexts for ${accountId} (threshold ${THRESHOLD})`);
	await emitReloginStatus(accountId, 'relogin_started', { reason: 'site_fails_threshold' });

	let LuxeeAccount;
	try {
		LuxeeAccount = (await import('../../models/LuxeeAccountModel.js')).default;
	} catch (e) {
		await emitReloginStatus(accountId, 'relogin_failed', { error: e.message });
		return false;
	}
	const account = await LuxeeAccount.findById(accountId);
	if (!account || !account.sessionData) {
		await emitReloginStatus(accountId, 'relogin_failed', { error: 'no sessionData' });
		return false;
	}

	// 1) Релогин НЕ трогает онлайн: site-fails — это проблема, а по проблемам
	// онлайн не выставляем (его держит onlineKeeper каждые ~5 мин).
	// Пересоздаём только контексты из sessionData.

	// Пересоздать основные контексты аккаунта (их может быть 1-2: обычный + _ai)
	const contexts = [];
	try {
		// browserService хранит Map accountId -> context
		const ctx = browserService.getContext(accountId);
		if (ctx) contexts.push({ id: accountId, ctx });
		const aiCtx = browserService.getContext(`${accountId}_ai`);
		if (aiCtx) contexts.push({ id: `${accountId}_ai`, ctx: aiCtx });
	} catch (e) {}

	for (const { id, ctx } of contexts) {
		try {
			await browserService.closeContext(id);
		} catch (e) {}
		try {
			await browserService.createContext({ accountId: id, sessionData: account.sessionData });
			const newCtx = browserService.getContext(id);
			if (newCtx) {
				const p = await pageHelpers.getOrCreatePage(newCtx);
				await p.goto('https://luxee.io/chats/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
				await p.waitForTimeout(3000);
			}
		} catch (e) {
			console.error(`[Online Recovery] relogin context ${id} failed:`, e.message);
		}
	}

	resetFails(accountId);
	// Проверяем что после релогина сессия реально жива. Если мертва —
	// свежий логин по stored creds (до 3 попыток), иначе метка auth_failed.
	// Иначе битые контексты крутятся в relogin-лупе вечно (как было: тысячи/сутки).
	let reloginHealthy = true;
	try {
		const { ensureSessionHealthy } = await import(
			'./luxeeAuthService/sessionService.js'
		);
		const mainCtx = browserService.getContext(accountId);
		const mainPage = mainCtx ? await pageHelpers.getOrCreatePage(mainCtx) : null;
		const acc = await LuxeeAccount.findById(accountId);
		reloginHealthy = await ensureSessionHealthy({
			userId: acc ? acc.user.toString() : null,
			accountId,
			page: mainPage,
		});
	} catch (e) {
		reloginHealthy = false;
	}
	await emitReloginStatus(accountId, 'relogin_done', {
		contexts: contexts.length,
		healthy: reloginHealthy,
	});
	console.log(`[Online Recovery] ✅ Relogin done for ${accountId}, fails reset, healthy=${reloginHealthy}`);
	return reloginHealthy;
};

// После успешного AI-ответа онлайн НЕ выставляем: это делает onlineKeeper
// каждые ~5 мин на аккаунт. Здесь только сбрасываем счётчик fails и
// обновляем флаг ручной активности (нужен keep-alive кликам "I am online").
export const touchOnlineAfterReply = async accountId => {
	try {
		const { default: onlineSvc } = await import('../luxeeAccountOnlineService.js');
		const LuxeeAccount = (await import('../../models/LuxeeAccountModel.js')).default;
		const acc = await LuxeeAccount.findById(accountId);
		if (acc) {
			await onlineSvc.trackManualActivity(acc.user, accountId).catch(() => {});
		}
	} catch (e) {}
	resetFails(accountId);
};

export default { bumpSiteFail, resetFails, shouldRelogin, handleAboutBlank, setAllOnlineViaNewContext, setAllOfflineViaNewContext, reloginAllContexts, touchOnlineAfterReply, THRESHOLD };
