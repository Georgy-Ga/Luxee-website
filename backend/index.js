import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { getSocketConfig } from './src/config/socket.js';
import errorMiddleware from './src/middleware/errorMiddleware.js';
import socketAuthMiddleware from './src/middleware/socketAuth.js';
import router from './src/routes/index.js';
import browserService from './src/services/browser/browserService.js';
import contextRecoveryService from './src/services/browser/contextRecoveryService.js';
import socketService from './src/services/socketService.js';
import aiAutoResponseService from './src/services/aiAutoResponseService.js';
import LuxeeAccountModel from './src/models/LuxeeAccountModel.js';
import { loadPromptsFromJson } from './src/services/profilePromptService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Настройка Socket.io
const io = new Server(httpServer, getSocketConfig());

// Middleware для аутентификации Socket.io
io.use(socketAuthMiddleware);

// Инициализация Socket Service
socketService.initialize(io);

console.log('[Server] ✓ Socket.io initialized');

app.use(express.json());
app.use(cookieParser());
// Настройка CORS для работы в Docker и локально
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',')
	: [
			'http://localhost:5173',
			'http://localhost:5174',
			'http://localhost:80',
			'http://localhost',
			'http://192.168.0.41:5173',
		];

app.use(
	cors({
		origin: (origin, callback) => {
			// Разрешаем запросы без origin (например, мобильные приложения или Postman)
			if (!origin) return callback(null, true);

			// Проверяем явно разрешенные origins
			if (
				allowedOrigins.indexOf(origin) !== -1 ||
				allowedOrigins.includes('*')
			) {
				return callback(null, true);
			}

			// Разрешаем локальную сеть (192.168.*.*, 10.*.*.*, 172.16-31.*.*)
			if (
				origin.startsWith('http://192.168.') ||
				origin.startsWith('http://10.') ||
				origin.startsWith('http://172.') ||
				origin.startsWith('http://localhost')
			) {
				return callback(null, true);
			}

			callback(new Error('Not allowed by CORS'));
		},
		credentials: true, // Разрешаем отправку cookies
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	}),
);
app.use('/api', router);
app.use(errorMiddleware);

const start = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URL);
		console.log('[Server] ✓ MongoDB connected');

		// 🆕 Автозагрузка промптов профилей из JSON
		try {
			console.log('[Server] Loading profile prompts from JSON...');
			const stats = await loadPromptsFromJson();
			if (stats.total > 0) {
				console.log(`[Server] ✓ Profile prompts loaded: ${stats.loaded}/${stats.total} (${stats.errors} errors, ${stats.skipped} skipped)`);
			} else {
				console.log('[Server] ℹ️  No profile prompts JSON file found (this is OK)');
			}
		} catch (error) {
			console.error('[Server] ⚠️  Error loading profile prompts:', error.message);
			console.log('[Server] ℹ️  Server will continue with default prompts');
		}

		httpServer.listen(PORT, '0.0.0.0', () => {
			console.log(`[Server] ✓ HTTP Server running on port ${PORT}`);
			console.log(`[Server] ✓ Listening on 0.0.0.0 (accessible from network)`);
			console.log(`[Server] ✓ WebSocket Server ready`);
		});

		// Автовосстановление контекстов после запуска сервера
		setTimeout(async () => {
			try {
				console.log('\n[Server] Starting context auto-recovery...');
				const result = await contextRecoveryService.recoverAllContexts();
				console.log(
					`[Server] Context recovery complete: ${result.recovered} recovered, ${result.failed} failed\n`,
				);

				// Запустить автоматическую очистку неактивных контекстов
				browserService.startAutoCleanup();
			} catch (error) {
				console.error('[Server] Error during context recovery:', error.message);
			}
		}, 3000); // Задержка 3 секунды после старта сервера

		// Автовосстановление AI контекстов и автоответов
		setTimeout(async () => {
			try {
				console.log('\n[Server] Starting AI auto-recovery...');
				
				// Находим все аккаунты с включённым AI
				const aiAccounts = await LuxeeAccountModel.find({
					isActive: true,
					aiEnabled: true,
					aiEnabledByAdmin: true
				}).select('_id luxeeEmail user');

				if (aiAccounts.length === 0) {
					console.log('[Server] No accounts with AI enabled found');
					console.log('[Server] AI recovery complete: 0 accounts\n');
					return;
				}

				console.log(`[Server] Found ${aiAccounts.length} accounts with AI enabled`);

				let recovered = 0;
				let failed = 0;

				// Запускаем AI автоответы для каждого аккаунта
				for (const account of aiAccounts) {
					try {
						const accountId = account._id.toString();
						await aiAutoResponseService.start(accountId);
						console.log(`[Server] ✓ AI auto-response started for ${account.luxeeEmail}`);
						recovered++;
					} catch (error) {
						console.error(`[Server] ✗ Failed to start AI for ${account.luxeeEmail}:`, error.message);
						failed++;
					}
				}

				console.log(`[Server] AI recovery complete: ${recovered} started, ${failed} failed\n`);
			} catch (error) {
				console.error('[Server] Error during AI recovery:', error);
			}
		}, 6000); // Задержка 6 секунд (после основного recovery)
	} catch (error) {
		console.log(error);
	}
};
start();
