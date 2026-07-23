import SpambotDistributionModel from './src/models/SpambotDistributionModel.js';
import LuxeeAccountModel from './src/models/LuxeeAccountModel.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Миграция: Заполнить поле accountEmail для всех существующих рассылок
 * 
 * Цель: Денормализация данных для надежного хранения email аккаунта
 * 
 * До:  accountEmail отсутствует, нужен populate luxeeAccount
 * После: accountEmail есть, populate не нужен
 */

async function migrate() {
	console.log('🚀 Starting accountEmail migration...\n');
	
	try {
		// 1. Подключиться к MongoDB
		const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxee-db';
		await mongoose.connect(mongoUri);
		console.log('✅ Connected to MongoDB\n');
		
		// 2. Получить все рассылки
		console.log('📊 Fetching all distributions...');
		const distributions = await SpambotDistributionModel.find({})
			.populate('luxeeAccount', 'luxeeEmail');
		
		console.log(`📊 Found ${distributions.length} distributions\n`);
		
		if (distributions.length === 0) {
			console.log('ℹ️  No distributions found. Migration not needed.');
			await mongoose.disconnect();
			return;
		}
		
		let updated = 0;
		let alreadyHaveEmail = 0;
		let accountDeleted = 0;
		
		// 3. Обработать каждую рассылку
		console.log('🔄 Processing distributions...\n');
		
		for (const d of distributions) {
			// Если email уже есть → пропустить
			if (d.accountEmail) {
				alreadyHaveEmail++;
				console.log(`  ℹ️  ${alreadyHaveEmail}. Already has email: ${d.distributionId} → ${d.accountEmail}`);
				continue;
			}
			
			// Если аккаунт существует → сохранить email
			if (d.luxeeAccount) {
				d.accountEmail = d.luxeeAccount.luxeeEmail;
				await d.save();
				updated++;
				console.log(`  ✅ ${updated}. Set email for ${d.distributionId}: ${d.accountEmail}`);
			} else {
				// Аккаунт удален → пометить
				d.accountEmail = '❌ Account Deleted';
				await d.save();
				accountDeleted++;
				console.log(`  ⚠️  ${accountDeleted}. Marked as deleted: ${d.distributionId}`);
			}
		}
		
		// 4. Вывести итоги
		console.log('\n' + '='.repeat(60));
		console.log('📈 MIGRATION SUMMARY');
		console.log('='.repeat(60));
		console.log(`   ✅ Updated:           ${updated}`);
		console.log(`   ℹ️  Already had email: ${alreadyHaveEmail}`);
		console.log(`   ⚠️  Account deleted:   ${accountDeleted}`);
		console.log(`   📊 Total:             ${distributions.length}`);
		console.log('='.repeat(60) + '\n');
		
		// 5. Проверка результата
		console.log('🔍 Verifying migration...');
		const distributionsWithoutEmail = await SpambotDistributionModel.countDocuments({
			accountEmail: { $exists: false }
		});
		
		if (distributionsWithoutEmail === 0) {
			console.log('✅ Verification passed: All distributions have accountEmail\n');
		} else {
			console.warn(`⚠️  Warning: ${distributionsWithoutEmail} distributions still don't have accountEmail\n`);
		}
		
		// 6. Отключиться
		await mongoose.disconnect();
		console.log('✅ Migration completed successfully!');
		console.log('✅ Disconnected from MongoDB\n');
		
		process.exit(0);
		
	} catch (error) {
		console.error('\n❌ Migration failed:', error);
		console.error('Stack trace:', error.stack);
		
		try {
			await mongoose.disconnect();
			console.log('✅ Disconnected from MongoDB (after error)\n');
		} catch (disconnectError) {
			console.error('❌ Error disconnecting:', disconnectError);
		}
		
		process.exit(1);
	}
}

// Запустить миграцию
migrate();
