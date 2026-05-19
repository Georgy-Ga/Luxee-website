import mongoose from 'mongoose';

const answeredChatSchema = new mongoose.Schema(
	{
		accountId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Account',
			required: true,
		},
		profileUid: {
			type: Number,
			required: true,
		},
		chats: [
			{
				chatId: {
					type: String,
					required: true,
				},
				memberUid: {
					type: Number,
					required: true,
				},
				memberUsername: String,
				memberAvatar: String,
				lastManMessage: {
					body: String,
					createdAt: String,
				},
				lastWomanMessage: {
					body: String,
					createdAt: String,
				},
				lastActivity: String,
				savedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{
		timestamps: true,
	},
);

// Индекс для быстрого поиска по accountId и profileUid
answeredChatSchema.index({ accountId: 1, profileUid: 1 }, { unique: true });

const AnsweredChat = mongoose.model('AnsweredChat', answeredChatSchema);

export default AnsweredChat;
