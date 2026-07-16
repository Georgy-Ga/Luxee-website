/**
 * MongoDB модель для рассылок (Distribution)
 * Хранит конфигурацию и статус рассылок в Luxee
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const MessageSchema = new Schema({
    text: {
        type: String,
        required: true,
        maxlength: 5000
    },
    interval: {
        type: Number,
        default: 10,
        min: 0,
        max: 300
    }
}, { _id: false });

const MailMessageSchema = new Schema({
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    text: {
        type: String,
        required: true,
        maxlength: 5000
    },
    pictures_number: {
        type: [Number],
        default: []
    }
}, { _id: false });

const ProfileSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    age: String,
    location: String,
    owner_uid: {
        type: Number,
        required: true
    },
    uid: Number,
    image_url: String,
    is_disabled: {
        type: Boolean,
        default: false
    },
    apps: {
        type: [String],
        default: []
    }
}, { _id: false });

const DistributionSchema = new Schema({
    // Владелец рассылки
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Luxee аккаунт для рассылки
    luxeeAccount: {
        type: Schema.Types.ObjectId,
        ref: 'LuxeeAccount',
        required: true,
        index: true
    },
    
    // Профиль для рассылки
    profile: {
        type: ProfileSchema,
        required: true
    },
    
    // Фильтры пользователей
    purchased: {
        type: Boolean,
        default: true
    },
    free: {
        type: Boolean,
        default: true
    },
    only_empty_chat: {
        type: Boolean,
        default: false
    },
    only_not_empty_chat: {
        type: Boolean,
        default: false
    },
    
    // Исключения и конкретные пользователи
    exclude: {
        type: [Number],
        default: []
    },
    specific_users: {
        type: [Number],
        default: []
    },
    
    // Лимиты
    limit: {
        type: Number,
        default: 9999,
        min: 1,
        max: 10000
    },
    filter_update_limit: {
        type: Number,
        default: 100,
        min: 1,
        max: 500
    },
    max_time_minutes: {
        type: Number,
        default: 99999,
        min: 0
    },
    
    // Сообщения (либо messages, либо mail_message)
    messages: {
        type: [MessageSchema],
        default: undefined
    },
    mail_message: {
        type: MailMessageSchema,
        default: undefined
    },
    
    // Статус рассылки
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'stopped', 'error'],
        default: 'pending',
        index: true
    },
    
    // Прогресс
    progress: {
        sent_count: {
            type: Number,
            default: 0
        },
        skipped_count: {
            type: Number,
            default: 0
        },
        total_processed: {
            type: Number,
            default: 0
        },
        current_profile: String,
        processed_clients: {
            type: [Number],
            default: []
        }
    },
    
    // Ошибки
    error: String,
    
    // Временные метки
    started_at: Date,
    completed_at: Date

}, {
    timestamps: true
});

// Индексы
DistributionSchema.index({ user: 1, status: 1 });
DistributionSchema.index({ luxeeAccount: 1, status: 1 });
DistributionSchema.index({ createdAt: -1 });

// Виртуальные поля
DistributionSchema.virtual('is_running').get(function() {
    return this.status === 'running';
});

DistributionSchema.virtual('is_completed').get(function() {
    return this.status === 'completed' || this.status === 'stopped' || this.status === 'error';
});

// Методы
DistributionSchema.methods.toSpambotConfig = function(luxeeAccount) {
    /**
     * Конвертирует Distribution в формат для Python Spambot Service
     * @param {Object} luxeeAccount - Populated LuxeeAccount с login и password
     */
    return {
        distribution_id: this._id.toString(),
        luxee_account_id: this.luxeeAccount.toString(),
        user_id: this.user.toString(),
        profile: this.profile,
        username: luxeeAccount.luxeeEmail,
        password: luxeeAccount.luxeePassword,
        purchased: this.purchased,
        free: this.free,
        only_empty_chat: this.only_empty_chat,
        only_not_empty_chat: this.only_not_empty_chat,
        exclude: this.exclude,
        specific_users: this.specific_users,
        limit: this.limit,
        filter_update_limit: this.filter_update_limit,
        max_time_minutes: this.max_time_minutes,
        messages: this.messages,
        mail_message: this.mail_message,
        cookies: {} // Будет заполнено из Playwright контекста
    };
};

DistributionSchema.methods.updateProgress = function(progressData) {
    /**
     * Обновляет прогресс рассылки
     */
    if (progressData.sent_count !== undefined) {
        this.progress.sent_count = progressData.sent_count;
    }
    if (progressData.skipped_count !== undefined) {
        this.progress.skipped_count = progressData.skipped_count;
    }
    if (progressData.total_processed !== undefined) {
        this.progress.total_processed = progressData.total_processed;
    }
    if (progressData.current_profile) {
        this.progress.current_profile = progressData.current_profile;
    }
    if (progressData.processed_clients) {
        this.progress.processed_clients = progressData.processed_clients;
    }
};

DistributionSchema.methods.markAsRunning = function() {
    this.status = 'running';
    this.started_at = new Date();
};

DistributionSchema.methods.markAsCompleted = function() {
    this.status = 'completed';
    this.completed_at = new Date();
};

DistributionSchema.methods.markAsStopped = function() {
    this.status = 'stopped';
    this.completed_at = new Date();
};

DistributionSchema.methods.markAsError = function(error) {
    this.status = 'error';
    this.error = error;
    this.completed_at = new Date();
};

// Статические методы
DistributionSchema.statics.findActiveForAccount = function(luxeeAccountId) {
    return this.findOne({
        luxeeAccount: luxeeAccountId,
        status: 'running'
    });
};

DistributionSchema.statics.findPendingForUser = function(userId) {
    return this.find({
        user: userId,
        status: 'pending'
    }).sort({ createdAt: 1 });
};

const Distribution = mongoose.model('Distribution', DistributionSchema);
export default Distribution;
