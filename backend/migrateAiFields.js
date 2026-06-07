// Migration script: Add missing aiEnabled field to existing users
// Запускать: node migrateAiFields.js

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UserModel from './src/models/UserModel.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin@localhost:27017/luxee?authSource=admin';

async function migrateAiFields() {
	try {
		console.log('🔄 Connecting to MongoDB...');
		await mongoose.connect(MONGODB_URI);
		console.log('✅ Connected to MongoDB\n');

		// Находим всех пользователей без поля aiEnabled
		const usersWithoutAiEnabled = await UserModel.find({
			aiEnabled: { $exists: false }
		}).select('_id email aiEnabledByAdmin');

		console.log(`📊 Found ${usersWithoutAiEnabled.length} users without aiEnabled field\n`);

		if (usersWithoutAiEnabled.length === 0) {
			console.log('✅ All users already have aiEnabled field. Nothing to migrate.');
			process.exit(0);
		}

		// Обновляем каждого пользователя
		let updated = 0;
		for (const user of usersWithoutAiEnabled) {
			// Если aiEnabledByAdmin = true, устанавливаем aiEnabled = true
			// Иначе устанавливаем aiEnabled = false (default)
			const aiEnabledValue = user.aiEnabledByAdmin === true;
			
			await UserModel.updateOne(
				{ _id: user._id },
				{ 
					$set: { 
						aiEnabled: aiEnabledValue,
						// Если aiEnabledByAdmin не установлен, тоже устанавливаем в false
						...(user.aiEnabledByAdmin === undefined && { aiEnabledByAdmin: false })
					}
				}
			);

			console.log(`✅ Updated user ${user.email}: aiEnabled=${aiEnabledValue}, aiEnabledByAdmin=${user.aiEnabledByAdmin ?? false}`);
			updated++;
		}

		console.log(`\n✅ Migration completed! Updated ${updated} users.`);
		
		// Проверяем результат
		const usersStillMissing = await UserModel.find({
			$or: [
				{ aiEnabled: { $exists: false } },
				{ aiEnabledByAdmin: { $exists: false } }
			]
		}).countDocuments();

		if (usersStillMissing > 0) {
			console.log(`⚠️ Warning: ${usersStillMissing} users still have missing fields!`);
		} else {
			console.log('✅ All users now have both aiEnabled and aiEnabledByAdmin fields.');
		}

	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await mongoose.disconnect();
		console.log('\n🔌 Disconnected from MongoDB');
		process.exit(0);
	}
}

// Запускаем миграцию
migrateAiFields();
