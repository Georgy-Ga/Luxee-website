import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import router from './src/routes/index.js';
import errorMiddleware from './src/middleware/errorMiddleware.js';
import contextRecoveryService from './src/services/browser/contextRecoveryService.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
	origin: ['http://localhost:5173', 'http://localhost:5174'], // Vite может использовать разные порты
	credentials: true, // Разрешаем отправку cookies
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use('/api', router);
app.use(errorMiddleware);

const start = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URL);
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
		
		// Автовосстановление контекстов после запуска сервера
		setTimeout(async () => {
			try {
				console.log('\n[Server] Starting context auto-recovery...');
				const result = await contextRecoveryService.recoverAllContexts();
				console.log(`[Server] Context recovery complete: ${result.recovered} recovered, ${result.failed} failed\n`);
			} catch (error) {
				console.error('[Server] Error during context recovery:', error.message);
			}
		}, 3000); // Задержка 3 секунды после старта сервера
	} catch (error) {
		console.log(error);
	}
};
start();
