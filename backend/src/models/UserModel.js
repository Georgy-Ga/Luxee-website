import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const UserSchema = new Schema({
	email: {type: String, required: true, unique: true},
	password: {type: String, required: true},
	role: {type: String, enum: ['user', 'admin'], default: 'user'},
})

export default model('User', UserSchema);


