import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import router from './src/routes/index.js';
import errorMiddleware from './src/middleware/errorMiddleware.js';
import contextRecoveryService from './src/services/browser/contextRecoveryService.js';
import browserService from './src/services/browser/browserService.js';
import { getSocketConfig } from './src/config/socket.js';
import socketAuthMiddleware from './src/middleware/socketAuth.js';
import socketService from './src/services/socketService.js';

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
	: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:80', 'http://localhost'];

app.use(cors({
	origin: (origin, callback) => {
		// Разрешаем запросы без origin (например, мобильные приложения или Postman)
		if (!origin) return callback(null, true);
		
		if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true, // Разрешаем отправку cookies
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use('/api', router);
app.use(errorMiddleware);

const start = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URL);
		console.log('[Server] ✓ MongoDB connected');
		
		httpServer.listen(PORT, () => {
			console.log(`[Server] ✓ HTTP Server running on port ${PORT}`);
			console.log(`[Server] ✓ WebSocket Server ready`);
		});
		
		// Автовосстановление контекстов после запуска сервера
		setTimeout(async () => {
			try {
				console.log('\n[Server] Starting context auto-recovery...');
				const result = await contextRecoveryService.recoverAllContexts();
				console.log(`[Server] Context recovery complete: ${result.recovered} recovered, ${result.failed} failed\n`);
				
				// Запустить автоматическую очистку неактивных контекстов
				browserService.startAutoCleanup();
			} catch (error) {
				console.error('[Server] Error during context recovery:', error.message);
			}
		}, 3000); // Задержка 3 секунды после старта сервера
	} catch (error) {
		console.log(error);
	}
};
start();
