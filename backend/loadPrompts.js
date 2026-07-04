/**
 * Скрипт для загрузки промптов профилей из JSON файла в базу данных
 * Использование:
 *   node loadPrompts.js
 * или через Docker:
 *   docker exec -it luxee-backend node loadPrompts.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { loadPromptsFromJson } from './src/services/profilePromptService.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Для ES modules нужно получить __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxee';

/**
 * Основная функция
 */
async function main() {
	console.log('');
	console.log('🚀 ===== PROFILE PROMPTS LOADER =====');
	console.log('');

	try {
		// Подключаемся к MongoDB
		console.log('📦 Connecting to MongoDB...');
		console.log('   URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Скрываем пароль

		await mongoose.connect(MONGODB_URI);
		console.log('✅ Connected to MongoDB');
		console.log('');

		// Загружаем промпты из JSON
		const jsonPath = path.join(__dirname, 'prompts', 'profiles.json');
		console.log('📂 Loading prompts from:', jsonPath);
		console.log('');

		const stats = await loadPromptsFromJson(jsonPath);

		// Выводим результаты
		console.log('');
		console.log('📊 ===== LOADING RESULTS =====');
		console.log('   Total profiles in JSON:', stats.total);
		console.log('   ✅ Successfully loaded:', stats.loaded);
		console.log('   ⚠️  Skipped:', stats.skipped);
		console.log('   ❌ Errors:', stats.errors);
		console.log('');

		if (stats.loaded > 0) {
			console.log('🎉 Success! Profile prompts have been loaded into database.');
		} else if (stats.total === 0) {
			console.log('⚠️  No profiles found in JSON file.');
		} else {
			console.log('⚠️  No profiles were loaded. Check errors above.');
		}
	} catch (error) {
		console.error('');
		console.error('❌ ===== ERROR =====');
		console.error('   Message:', error.message);
		console.error('   Stack:', error.stack);
		console.error('');
		process.exit(1);
	} finally {
		// Закрываем подключение к БД
		await mongoose.connection.close();
		console.log('');
		console.log('👋 Disconnected from MongoDB');
		console.log('═'.repeat(80));
		console.log('');
	}
}

// Запускаем скрипт
main();
