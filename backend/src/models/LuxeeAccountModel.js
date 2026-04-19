import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const LuxeeAccountSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	luxeeEmail: { type: String, required: true },
	luxeePassword: { type: String, required: true },
	sessionData: { type: String }, // Сохранённая сессия браузера
	isActive: { type: Boolean, default: false },
	lastActivity: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
});

export default model('LuxeeAccount', LuxeeAccountSchema);
