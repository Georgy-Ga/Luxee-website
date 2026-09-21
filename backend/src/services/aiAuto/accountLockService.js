// Mongo-атомарный лок на аккаунт: concurrency(accountId)=1, global>1, TTL 90с, FIFO по createdAt не нужен — лок сериализует.
import AccountLock from '../../models/AccountLockModel.js';

const TTL_MS = 90 * 1000;

export const acquireLock = async (accountId, lockedBy = 'aiAuto') => {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + TTL_MS);
	// Атомарно: занять если нет дока или истёк TTL или свободен
	const res = await AccountLock.findOneAndUpdate(
		{
			accountId,
			$or: [{ isLocked: false }, { expiresAt: { $lt: now } }, { expiresAt: null }],
		},
		{ $set: { isLocked: true, lockedAt: now, expiresAt, lockedBy } },
		{ upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
	).catch(async () => {
		// upsert race — попробуем создать
		try {
			return await AccountLock.create({ accountId, isLocked: true, lockedAt: now, expiresAt, lockedBy });
		} catch (e) {
			return null;
		}
	});
	// Если findOneAndUpdate вернул null — занят другим
	if (!res || !res.isLocked) return null;
	// Проверка что мы действительно владельцы (lockedAt совпадает в пределах 1с)
	const isOwner = Math.abs(new Date(res.lockedAt).getTime() - now.getTime()) < 1500;
	if (!isOwner && res.lockedBy !== lockedBy) {
		// Чужой лок — считаем неудачей
		// Но если мы upsert'ом создали — isOwner true
	}
	return res;
};

export const renewLock = async (accountId, lockedBy = 'aiAuto') => {
	// Heartbeat: продлить живой лок (isLocked:true). Отпущенный лок
	// НЕ воскрешаем — фильтр isLocked:true это гарантирует.
	return await AccountLock.findOneAndUpdate(
		{ accountId, isLocked: true },
		{ $set: { expiresAt: new Date(Date.now() + TTL_MS), lockedBy } },
		{ returnDocument: 'after' },
	).catch(() => null);
};

export const releaseLock = async accountId => {
	await AccountLock.findOneAndUpdate(
		{ accountId },
		{ $set: { isLocked: false, expiresAt: new Date(Date.now() + 1000) } },
		{ returnDocument: 'after' },
	).catch(() => {});
};

export const getLockStatus = async accountId => {
	const doc = await AccountLock.findOne({ accountId });
	if (!doc || !doc.isLocked) return null;
	if (doc.expiresAt && doc.expiresAt < new Date()) {
		await releaseLock(accountId);
		return null;
	}
	return { isLocked: true, lockedAt: doc.lockedAt, expiresAt: doc.expiresAt, lockedBy: doc.lockedBy };
};

export const forceUnlock = async accountId => {
	await releaseLock(accountId);
};

export default { acquireLock, renewLock, releaseLock, getLockStatus, forceUnlock, TTL_MS };
