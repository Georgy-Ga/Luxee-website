import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const UserSchema = new Schema({
	email: {type: String, required: true, unique: true},
	password: {type: String, required: true},
	role: {type: String, enum: ['user', 'admin'], default: 'user'},
	aiEnabled: {type: Boolean, default: true}, // Может ли пользователь использовать AI (сам выключает)
	aiEnabledByAdmin: {type: Boolean, default: true}, // Разрешил ли админ использовать AI
})

export default model('User', UserSchema);


