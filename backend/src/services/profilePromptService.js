import ProfilePrompt from '../models/ProfilePrompt.js';
import { SYSTEM_PROMPT } from './aiService/config.js';
import fs from 'fs';
import path from 'path';

/**
 * Сервис для работы с кастомными промптами профилей
 * Промпты привязаны к profileUid и не зависят от аккаунта
 */

/**
 * Получить промпт для профиля по UID
 * @param {number} profileUid - UID профиля (profile.inner.uid)
 * @returns {Promise<string>} - Промпт для AI (кастомный или дефолтный)
 */
export const getProfilePrompt = async (profileUid) => {
	try {
		if (!profileUid) {
			console.log('[Profile Prompt] No profileUid provided, using default prompt');
			return SYSTEM_PROMPT;
		}

		const profilePrompt = await ProfilePrompt.findOne({
			profileUid,
			isActive: true,
		});

		if (profilePrompt && profilePrompt.customPrompt) {
			console.log(
				`[Profile Prompt] ✅ Using CUSTOM prompt for profile ${profileUid} (${profilePrompt.profileName})`
			);
			return profilePrompt.customPrompt;
		}

		console.log(
			`[Profile Prompt] ℹ️  No custom prompt found for profile ${profileUid}, using DEFAULT`
		);
		return SYSTEM_PROMPT;
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error getting prompt:', error);
		// В случае ошибки возвращаем дефолтный промпт
		return SYSTEM_PROMPT;
	}
};

/**
 * Сохранить/обновить промпт для профиля
 * @param {Object} data - Данные промпта
 * @param {number} data.profileUid - UID профиля
 * @param {string} data.profileName - Имя профиля
 * @param {string} data.customPrompt - Кастомный промпт
 * @param {Object} [data.metadata] - Дополнительные метаданные
 * @returns {Promise<Object>} - Сохранённый промпт
 */
export const saveProfilePrompt = async ({
	profileUid,
	profileName,
	customPrompt,
	metadata = {},
}) => {
	try {
		const updated = await ProfilePrompt.findOneAndUpdate(
			{ profileUid },
			{
				profileName,
				customPrompt,
				metadata,
				updatedAt: Date.now(),
				isActive: true,
			},
			{
				upsert: true, // Создать если не существует
				new: true, // Вернуть обновлённый документ
				runValidators: true,
			}
		);

		console.log(
			`[Profile Prompt] ✅ Saved prompt for profile ${profileUid} (${profileName})`
		);
		return updated;
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error saving prompt:', error);
		throw error;
	}
};

/**
 * Получить все активные промпты
 * @returns {Promise<Array>} - Список всех промптов
 */
export const getAllPrompts = async () => {
	try {
		const prompts = await ProfilePrompt.find({
			isActive: true,
		}).sort({ profileName: 1 });

		return prompts;
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error getting all prompts:', error);
		return [];
	}
};

/**
 * Удалить промпт (мягкое удаление)
 * @param {number} profileUid - UID профиля
 */
export const deleteProfilePrompt = async (profileUid) => {
	try {
		await ProfilePrompt.findOneAndUpdate(
			{ profileUid },
			{ isActive: false, updatedAt: Date.now() }
		);

		console.log(`[Profile Prompt] ✅ Deleted prompt for profile ${profileUid}`);
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error deleting prompt:', error);
		throw error;
	}
};

/**
 * Загрузить промпты из JSON файла
 * @param {string} filePath - Путь к JSON файлу
 * @returns {Promise<Object>} - Статистика загрузки
 */
export const loadPromptsFromJson = async (
	filePath = path.join(process.cwd(), 'prompts', 'profiles.json')
) => {
	const stats = {
		total: 0,
		loaded: 0,
		errors: 0,
		skipped: 0,
	};

	try {
		console.log('[Profile Prompt] 📂 Loading prompts from:', filePath);

		// Проверяем существование файла
		if (!fs.existsSync(filePath)) {
			console.log('[Profile Prompt] ⚠️  JSON file not found, skipping');
			return stats;
		}

		// Читаем файл
		const fileContent = fs.readFileSync(filePath, 'utf8');
		const data = JSON.parse(fileContent);

		if (!data.profiles || !Array.isArray(data.profiles)) {
			console.error(
				'[Profile Prompt] ❌ Invalid JSON format: missing "profiles" array'
			);
			return stats;
		}

		stats.total = data.profiles.length;
		console.log(`[Profile Prompt] 📋 Found ${stats.total} profile(s) in JSON`);

		// Загружаем каждый профиль
		for (const profile of data.profiles) {
			try {
				// Валидация
				if (!profile.profileUid || !profile.profileName || !profile.customPrompt) {
					console.log(
						`[Profile Prompt] ⚠️  Skipping profile: missing required fields`,
						profile
					);
					stats.skipped++;
					continue;
				}

				// Сохраняем промпт
				await saveProfilePrompt({
					profileUid: profile.profileUid,
					profileName: profile.profileName,
					customPrompt: profile.customPrompt,
					metadata: profile.metadata || {},
				});

				stats.loaded++;
			} catch (error) {
				console.error(
					`[Profile Prompt] ❌ Error loading profile ${profile.profileName}:`,
					error.message
				);
				stats.errors++;
			}
		}

		console.log('[Profile Prompt] ✅ Load complete:', stats);
		return stats;
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error loading prompts from JSON:', error);
		stats.errors++;
		return stats;
	}
};

/**
 * Проверить существование промпта для профиля
 * @param {number} profileUid - UID профиля
 * @returns {Promise<boolean>} - true если промпт существует
 */
export const hasCustomPrompt = async (profileUid) => {
	try {
		const count = await ProfilePrompt.countDocuments({
			profileUid,
			isActive: true,
		});
		return count > 0;
	} catch (error) {
		console.error('[Profile Prompt] ❌ Error checking prompt:', error);
		return false;
	}
};
