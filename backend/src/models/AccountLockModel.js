import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Атомарный лок на аккаунт для AI-цикла.
 * Один аккаунт — одна account-bound задача. TTL 90с защищает от зависшего лока.
 */
const AccountLockSchema = new Schema({
	accountId: { type: String, required: true, unique: true, index: true },
	isLocked: { type: Boolean, default: false },
	lockedAt: { type: Date, default: null },
	expiresAt: { type: Date, default: null },
	lockedBy: { type: String, default: null },
});

AccountLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('AccountLock', AccountLockSchema);
