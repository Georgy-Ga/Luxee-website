// Модуль для управления сессиями Luxee
import ApiError from '../../../exceptions/apiError.js';
import LuxeeAccountModel from '../../../models/LuxeeAccountModel.js';
import browserService from '../../browser/browserService.js';
import pageHelpers from '../../browser/pageHelpers.js';
import keepAliveService from '../keepAliveService.js';
import messageCheckIntervalService from '../messageCheckIntervalService.js';
import profileActivationService from '../profileActivationService.js';
import { login as luxeeLogin } from './loginService.js';
import socketService from '../../socketService.js';

const AUTH_MAX_ATTEMPTS = 3;

/**
 * Реальная проверка живости сессии на странице (а не "контекст создался").
 * Протухшая сессия (смена пароля на сайте) выглядит как успешный restore,
 * а дальше всё downstream падает вечно — проверяем ДО пометки isActive.
 */
export const verifySessionOnPage = async page => {
	try {
		if (!page || page.isClosed()) return false;
		const url = page.url();
		if (!url || !url.includes('luxee.io')) return false;
		if (/\/login\/?(\?|$)/.test(url)) return false;
		const alive = await page
			.evaluate(() => {
				try {
					return !!(
						window.modelsChat?.getProfile?.active?.inner?.uid ||
						window.modelsChat?.getChats?.list
					);
				} catch (e) {
					return false;
				}
			})
			.catch(() => false);
		return alive === true;
	} catch (e) {
		return false;
	}
};

const resetAuthHealth = async accountId => {
	try {
		await LuxeeAccountModel.findByIdAndUpdate(accountId, {
			$set: {
				'authStatus.state': 'ok',
				'authStatus.failCount': 0,
				'authStatus.lastError': '',
				'authStatus.lastCheckAt': new Date(),
			},
		});
	} catch (e) {}
};

/**
 * Учёт провала авторизации: +1 к счётчику, после AUTH_MAX_ATTEMPTS подряд —
 * метка auth_failed + isActive=false + aiEnabled=false + стоп AI-циклов.
 * НЕ удаляем: обратимо, админ видит в панели (сокет + поле в getLuxeeAccounts).
 * Пароли в логи не пишем никогда.
 */
export const recordAuthFailure = async (accountId, err) => {
	try {
		const account = await LuxeeAccountModel.findById(accountId);
		if (!account) return false;
		const failCount = (account.authStatus?.failCount || 0) + 1;
		const lastError = String(err?.message || err || 'unknown').slice(0, 300);
		if (failCount >= AUTH_MAX_ATTEMPTS) {
			account.authStatus = {
				state: 'auth_failed',
				failCount,
				lastError,
				lastCheckAt: new Date(),
			};
			account.isActive = false;
			account.aiEnabled = false;
			await account.save();
			console.error(
				`[Luxee Auth] ❌ Account ${account.luxeeEmail} marked auth_failed after ${failCount} fails (${lastError}) — needs recreation`,
			);
			try {
				socketService.emitAccountAuthFailed(
					account.user.toString(),
					accountId,
					{ failCount, lastError },
				);
			} catch (e) {}
			// Останавливаем AI-циклы/кипер (динамический импорт — без циклов)
			try {
				const { default: aiAutoResponseService } = await import(
					'../../aiAutoResponseService.js'
				);
				await aiAutoResponseService.stop(accountId).catch(() => {});
			} catch (e) {}
			try {
				const { default: onlineKeeperService } = await import(
					'../../onlineKeeperService.js'
				);
				onlineKeeperService.stop(accountId);
			} catch (e) {}
			return true;
		}
		account.authStatus = {
			state: account.authStatus?.state || 'ok',
			failCount,
			lastError,
			lastCheckAt: new Date(),
		};
		await account.save();
		console.log(
			`[Luxee Auth] ⚠️  Auth failure ${failCount}/${AUTH_MAX_ATTEMPTS} for ${account.luxeeEmail}`,
		);
		return false;
	} catch (e) {
		return false;
	}
};

/**
 * Гарантия живой сессии: verify → свежий login по stored creds (до 3 попыток)
 * → verify. Возвращает true/false. Используется restoreSession и relogin.
 */
export const ensureSessionHealthy = async ({ userId, accountId, page = null }) => {
	try {
		if (page) {
			if (await verifySessionOnPage(page)) {
				await resetAuthHealth(accountId);
				return true;
			}
			console.log(`[Luxee Auth] ⚠️  Session verify failed for ${accountId}, trying fresh login...`);
		}
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});
		if (!account || !account.luxeeEmail || !account.luxeePassword) {
			await recordAuthFailure(accountId, new Error('no stored credentials'));
			return false;
		}
		for (let attempt = 1; attempt <= AUTH_MAX_ATTEMPTS; attempt++) {
			try {
				console.log(
					`[Luxee Auth] 🔑 Fresh login attempt ${attempt}/${AUTH_MAX_ATTEMPTS} for ${account.luxeeEmail}`,
				);
				await luxeeLogin({
					userId,
					luxeeEmail: account.luxeeEmail,
					luxeePassword: account.luxeePassword,
				});
				await resetAuthHealth(accountId);
				console.log(`[Luxee Auth] ✅ Fresh login succeeded for ${account.luxeeEmail}`);
				return true;
			} catch (loginError) {
				console.error(
					`[Luxee Auth] ❌ Fresh login attempt ${attempt} failed:`,
					loginError.message,
				);
				if (attempt < AUTH_MAX_ATTEMPTS) {
					await new Promise(resolve => setTimeout(resolve, 3000));
				}
			}
		}
		await recordAuthFailure(accountId, new Error('fresh login failed 3x'));
		return false;
	} catch (e) {
		await recordAuthFailure(accountId, e).catch(() => {});
		return false;
	}
};

/**
 * Восстановить сессию Luxee аккаунта
 */
export const restoreSession = async ({ userId, accountId }) => {
	try {
		const account = await LuxeeAccountModel.findOne({
			_id: accountId,
			user: userId,
		});

		if (!account) {
			throw ApiError.BadRequest('Аккаунт не найден');
		}

		if (!account.sessionData) {
			throw ApiError.BadRequest('Нет сохранённой сессии');
		}

		// Создаём контекст с сохранённой сессией
		const context = await browserService.createContext({
			accountId,
			sessionData: account.sessionData,
		});

		const page = await pageHelpers.getOrCreatePage(context);
		await pageHelpers.navigateTo({ page, url: 'https://luxee.io/chats/' });

		const currentUrl = pageHelpers.getCurrentUrl(page);
		console.log('[Luxee Auth] Session restored, URL:', currentUrl);

		// ✅ Активируем первый профиль
		console.log('[Luxee Auth] Activating first profile');
		await profileActivationService.activateFirstProfile({ page });

		// ✅ Проверяем что сессия РЕАЛЬНО жива (протухшая раньше молча
		// помечалась isActive=true и ломала всё downstream вечно).
		// При смерти — свежий логин по stored creds (до 3 попыток), иначе метка.
		const healthy = await ensureSessionHealthy({ userId, accountId, page });
		if (!healthy) {
			throw ApiError.BadRequest(
				'Сессия Luxee мертва, перелогин не удался — аккаунт помечен auth_failed',
			);
		}

		// Запускаем keep-alive
		await keepAliveService.start({ accountId, context });

		// Запускаем автоматическую проверку сообщений
		messageCheckIntervalService.start({ userId });

		// Обновляем активность
		account.isActive = true;
		account.lastActivity = new Date();
		await account.save();

		return {
			success: true,
			message: 'Сессия восстановлена',
			currentUrl,
		};
	} catch (error) {
		console.error('[Luxee Auth] Error restoring session:', error);
		throw error;
	}
};

/**
 * Восстановить все сессии пользователя (параллельно)
 */
export const restoreAllSessions = async ({ userId }) => {
	try {
		console.log(`[Luxee Auth] Restoring all sessions for user ${userId}`);
		
		const accounts = await LuxeeAccountModel.find({
			user: userId,
			sessionData: { $exists: true, $ne: null },
		});

		console.log(`[Luxee Auth] Found ${accounts.length} accounts with saved sessions`);

		// Восстанавливаем все сессии ПАРАЛЛЕЛЬНО
		const restorePromises = accounts.map(async (account) => {
			try {
				const accountId = account._id.toString();
				
				// Проверяем, может контекст уже существует
				const existingContext = browserService.getContext(accountId);
				if (existingContext) {
					console.log(`[Luxee Auth] Context already exists for ${account.luxeeEmail}`);
					return {
						accountId,
						luxeeEmail: account.luxeeEmail,
						status: 'already_active',
					};
				}

				// Восстанавливаем сессию
				await restoreSession({ userId, accountId });
				
				console.log(`[Luxee Auth] Restored session for ${account.luxeeEmail}`);
				return {
					accountId,
					luxeeEmail: account.luxeeEmail,
					status: 'restored',
				};
			} catch (error) {
				console.error(`[Luxee Auth] Failed to restore ${account.luxeeEmail}:`, error.message);
				return {
					accountId: account._id.toString(),
					luxeeEmail: account.luxeeEmail,
					status: 'failed',
					error: error.message,
				};
			}
		});

		// Ждём завершения всех восстановлений
		const results = await Promise.all(restorePromises);

		const restoredCount = results.filter(r => r.status === 'restored').length;
		console.log(`[Luxee Auth] Restored ${restoredCount}/${accounts.length} sessions (parallel)`);

		return {
			success: true,
			restored: restoredCount,
			total: accounts.length,
			results,
		};
	} catch (error) {
		console.error('[Luxee Auth] Error restoring all sessions:', error);
		throw error;
	}
};
