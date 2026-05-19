import mongoose from 'mongoose';

const AiRuleSchema = new mongoose.Schema(
	{
		rule: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		order: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	},
);

export default mongoose.model('AiRule', AiRuleSchema);
