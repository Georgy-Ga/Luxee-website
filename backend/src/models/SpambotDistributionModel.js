import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Модель для хранения рассылок Spambot
 * 
 * Каждая рассылка привязана к:
 * - user (владелец)
 * - luxeeAccount (аккаунт Luxee для рассылки)
 * - distributionId (ID в Python Service)
 */
const SpambotDistributionSchema = new Schema({
	// Связи
	user: { 
		type: Schema.Types.ObjectId, 
		ref: 'User', 
		required: true,
		index: true 
	},
	luxeeAccount: { 
		type: Schema.Types.ObjectId, 
		ref: 'LuxeeAccount', 
		required: true,
		index: true 
	},
	
	// Account Email (денормализация для надежного хранения)
	accountEmail: {
		type: String,
		required: false, // false для совместимости со старыми записями
		index: true
	},
	
	// Python Service ID
	distributionId: {
		type: String, 
		required: true, 
		unique: true,
		index: true 
	},
	
	// Конфигурация рассылки
	config: {
		// Profile info
		profileUid: { type: String, required: true },
		profileName: { type: String, required: true },
		
		// Type
		distributionType: { 
			type: String, 
			enum: ['chat', 'mail'], 
			required: true 
		},
		
		// Filters
		purchased: { type: Boolean, default: true },
		free: { type: Boolean, default: true },
		onlyEmptyChat: { type: Boolean, default: false },
		onlyNotEmptyChat: { type: Boolean, default: false },
		
		// Messages (for chat type)
		messages: [{
			text: { type: String, required: true },
			interval: { type: Number, default: 0 }
		}],
		
		// Mail message (for mail type)
		mailMessage: {
			title: String,
			text: String,
			picturesNumber: [Number]
		},
		
		// Limits
		excludeIds: [Number],
		specificUsers: [Number],
		limit: { type: Number, required: true },
		filterUpdateLimit: { type: Number, required: true },
		maxTimeMinutes: { type: Number, default: 180 }
	},
	
	// Status tracking
	status: { 
		type: String, 
		enum: ['queued', 'running', 'completed', 'error', 'stopped'],
		default: 'queued',
		index: true 
	},
	
	// Queue management
	queuedAt: { type: Date, default: Date.now },
	
	// Progress
	sentMessagesCount: { type: Number, default: 0 },
	skippedClientsCount: { type: Number, default: 0 },
	currentClient: { type: String },
	
	// Error handling
	errorMessage: { type: String },
	
	// Timestamps
	startedAt: { type: Date },
	completedAt: { type: Date },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now }
});

// Индексы для быстрого поиска
SpambotDistributionSchema.index({ user: 1, createdAt: -1 });
SpambotDistributionSchema.index({ luxeeAccount: 1, status: 1 });
SpambotDistributionSchema.index({ status: 1, createdAt: -1 });

// Middleware для обновления updatedAt
SpambotDistributionSchema.pre('save', function() {
	this.updatedAt = new Date();
});

// Методы
SpambotDistributionSchema.methods.updateStatus = function(statusData) {
	this.status = statusData.status || this.status;
	this.sentMessagesCount = statusData.sent_messages_count ?? this.sentMessagesCount;
	this.skippedClientsCount = statusData.skipped_clients ?? this.skippedClientsCount;
	this.currentClient = statusData.current_client || this.currentClient;
	this.errorMessage = statusData.error_message || this.errorMessage;
	
	if (statusData.status === 'running' && !this.startedAt) {
		this.startedAt = new Date();
	}
	
	if (['completed', 'error', 'stopped'].includes(statusData.status) && !this.completedAt) {
		this.completedAt = new Date();
	}
	
	this.updatedAt = new Date();
	return this.save();
};

// Статические методы
SpambotDistributionSchema.statics.getActiveDistributions = function(userId) {
	return this.find({
		user: userId,
		status: { $in: ['queued', 'running'] }
	}).populate('luxeeAccount', 'luxeeEmail');
};

SpambotDistributionSchema.statics.getAccountActiveDistributions = function(accountId) {
	return this.find({
		luxeeAccount: accountId,
		status: { $in: ['queued', 'running'] }
	});
};

export default model('SpambotDistribution', SpambotDistributionSchema);
