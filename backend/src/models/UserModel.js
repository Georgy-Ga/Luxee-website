import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const UserSchema = new Schema({
	email: {type: String, required: true, unique: true},
	password: {type: String, required: true},
	role: {type: String, enum: ['user', 'admin'], default: 'user'},
	aiEnabled: {type: Boolean, default: false}, // Может ли пользователь использовать AI (сам выключает)
	aiEnabledByAdmin: {type: Boolean, default: false}, // Разрешил ли админ использовать AI (по умолчанию выключено)
	
	// AI Schedule - интервалы работы/отдыха на уровне пользователя
	aiSchedule: {
		enabled: { type: Boolean, default: false }, // Интервалы активны?
		workMinutes: { type: Number, default: 960 }, // Минут работы (по умолчанию 16 часов)
		restMinutes: { type: Number, default: 480 }, // Минут отдыха (по умолчанию 8 часов)
		currentState: { 
			type: String, 
			enum: ['working', 'resting', 'disabled'],
			default: 'disabled' 
		},
		lastToggleTime: { type: Date }, // Когда последний раз переключалось
		nextToggleTime: { type: Date }, // Когда следующее переключение
	}
})

export default model('User', UserSchema);


