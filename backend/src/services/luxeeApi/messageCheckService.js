// Сервис для проверки сообщений на всех аккаунтах Luxee
import LuxeeAccountModel from '../../models/LuxeeAccountModel.js';
import browserService from '../browser/browserService.js';
import pageHelpers from '../browser/pageHelpers.js';
import profileParserService from './profileParserService.js';

const messageCheckService = {
	// Проверить сообщения на всех аккаунтах пользователя
	checkAllMessages: async ({ userId }) => {
		try {
			console.log(`[Message Check] Checking messages for user ${userId}`);

			// Получаем все активные аккаунты пользователя
			const accounts = await LuxeeAccountModel.find({
				user: userId,
				isActive: true,
			});

			if (accounts.length === 0) {
				console.log('[Message Check] No active accounts found');
				return {
					accounts: [],
					totalUnread: 0,
					totalProfiles: 0,
				};
			}

			console.log(`[Message Check] Found ${accounts.length} active accounts`);

			// Проверяем каждый аккаунт
			const results = [];
			let totalUnread = 0;
			let totalProfiles = 0;

			for (const account of accounts) {
				try {
					console.log(`[Message Check] Checking account ${account._id} (${account.luxeeEmail})`);

					// Получаем контекст аккаунта
					const context = browserService.getContext(account._id.toString());
					
					if (!context) {
						console.log(`[Message Check] No context for account ${account._id}, skipping`);
						results.push({
							accountId: account._id,
							accountEmail: account.luxeeEmail,
							error: 'Context not found',
							profiles: [],
							totalUnread: 0,
							profilesCount: 0,
						});
						continue;
					}

					// Получаем страницу
					const page = await pageHelpers.getOrCreatePage(context);

					// Получаем ВСЕ профили для проверки newMessages
					const { profiles, totalUnread: accountUnread, profilesCount } = 
						await profileParserService.getProfiles({ page });

					// Получаем активный профиль для проверки unansweredMessages
					const { profile: activeProfile } = await profileParserService.getActiveProfile({ page });

					// Добавляем unansweredMessages только для активного профиля
					const profilesWithUnanswered = profiles.map(profile => {
						// Если это активный профиль - добавляем unansweredMessages
						if (activeProfile && profile.uid === activeProfile.uid) {
							return {
								...profile,
								unansweredMessages: 0, // Будет обновлено ниже
								isActive: true,
							};
						}
						return {
							...profile,
							unansweredMessages: 0,
							isActive: false,
						};
					});

					// Считаем unansweredMessages только для активного профиля
					if (activeProfile) {
						try {
							const unansweredMessages = await profileParserService.getProfileUnansweredCount({
								page,
								profileUid: activeProfile.uid,
							});
							
							// Обновляем unansweredMessages для активного профиля
							const activeProfileIndex = profilesWithUnanswered.findIndex(p => p.uid === activeProfile.uid);
							if (activeProfileIndex !== -1) {
								profilesWithUnanswered[activeProfileIndex].unansweredMessages = unansweredMessages;
							}
							
							console.log(`[Message Check] Active profile ${activeProfile.username}: ${unansweredMessages} unanswered`);
						} catch (error) {
							console.error(`[Message Check] Error counting unanswered:`, error.message);
						}
					}

					totalUnread += accountUnread;
					totalProfiles += profilesCount;

					results.push({
						accountId: account._id,
						accountEmail: account.luxeeEmail,
						profiles: profilesWithUnanswered,
						totalUnread: accountUnread,
						profilesCount,
					});

					console.log(`[Message Check] Account ${account.luxeeEmail}: ${profilesCount} profiles, ${accountUnread} unread`);
				} catch (error) {
					console.error(`[Message Check] Error checking account ${account._id}:`, error.message);
					results.push({
						accountId: account._id,
						accountEmail: account.luxeeEmail,
						error: error.message,
						profiles: [],
						totalUnread: 0,
						profilesCount: 0,
					});
				}
			}

			console.log(`[Message Check] Total: ${totalProfiles} profiles, ${totalUnread} unread messages`);

			return {
				accounts: results,
				totalUnread,
				totalProfiles,
			};
		} catch (error) {
			console.error('[Message Check] Error:', error);
			throw error;
		}
	},

	// Проверить сообщения на конкретном аккаунте
	checkAccountMessages: async ({ userId, accountId }) => {
		try {
			console.log(`[Message Check] Checking messages for account ${accountId}`);

			// Проверяем что аккаунт принадлежит пользователю
			const account = await LuxeeAccountModel.findOne({
				_id: accountId,
				user: userId,
			});

			if (!account) {
				throw new Error('Account not found');
			}

			// Получаем контекст
			const context = browserService.getContext(accountId);
			
			if (!context) {
				throw new Error('Context not found. Please login first.');
			}

			// Получаем страницу
			const page = await pageHelpers.getOrCreatePage(context);

			// Получаем ВСЕ профили для проверки newMessages
			const { profiles, totalUnread, profilesCount } = 
				await profileParserService.getProfiles({ page });

			// Получаем активный профиль для проверки unansweredMessages
			const { profile: activeProfile } = await profileParserService.getActiveProfile({ page });

			// Добавляем unansweredMessages только для активного профиля
			const profilesWithUnanswered = profiles.map(profile => {
				// Если это активный профиль - добавляем unansweredMessages
				if (activeProfile && profile.uid === activeProfile.uid) {
					return {
						...profile,
						unansweredMessages: 0, // Будет обновлено ниже
						isActive: true,
					};
				}
				return {
					...profile,
					unansweredMessages: 0,
					isActive: false,
				};
			});

			// Считаем unansweredMessages только для активного профиля
			if (activeProfile) {
				try {
					const unansweredMessages = await profileParserService.getProfileUnansweredCount({
						page,
						profileUid: activeProfile.uid,
					});
					
					// Обновляем unansweredMessages для активного профиля
					const activeProfileIndex = profilesWithUnanswered.findIndex(p => p.uid === activeProfile.uid);
					if (activeProfileIndex !== -1) {
						profilesWithUnanswered[activeProfileIndex].unansweredMessages = unansweredMessages;
					}
					
					console.log(`[Message Check] Active profile ${activeProfile.username}: ${unansweredMessages} unanswered`);
				} catch (error) {
					console.error(`[Message Check] Error counting unanswered:`, error.message);
				}
			}

			console.log(`[Message Check] Account ${account.luxeeEmail}: ${profilesCount} profiles, ${totalUnread} unread`);

			return {
				accountId: account._id,
				accountEmail: account.luxeeEmail,
				profiles: profilesWithUnanswered,
				totalUnread,
				profilesCount,
			};
		} catch (error) {
			console.error('[Message Check] Error:', error);
			throw error;
		}
	},

	// Получить только аккаунты с непрочитанными или неотвеченными сообщениями
	checkUnreadMessages: async ({ userId }) => {
		try {
			const result = await messageCheckService.checkAllMessages({ userId });
			
			// Фильтруем только аккаунты где есть новые или неотвеченные
			const accountsWithUnread = result.accounts
				.map(account => ({
					...account,
					profiles: account.profiles.filter(p => p.newMessages > 0 || p.unansweredMessages > 0),
				}))
				.filter(account => account.profiles.length > 0);

			return {
				accounts: accountsWithUnread,
				totalUnread: result.totalUnread,
			};
		} catch (error) {
			console.error('[Message Check] Error checking unread:', error);
			throw error;
		}
	},
};

export default messageCheckService;
