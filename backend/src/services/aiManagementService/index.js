// Главный модуль AI Management Service
// Объединяет управление AI для пользователей и аккаунтов

import * as userAiService from './userAiService.js';
import * as accountAiService from './accountAiService.js';

const aiManagementService = {
	// Управление AI для пользователей
	getAllUsersAiStatus: userAiService.getAllUsersAiStatus,
	getUserAiStatus: userAiService.getUserAiStatus,
	setUserAiByAdmin: userAiService.setUserAiByAdmin,
	toggleUserAi: userAiService.toggleUserAi,
	setUserAiState: userAiService.setUserAiState,
	canUserUseAi: userAiService.canUserUseAi,
	enableUserAi: userAiService.enableUserAi,
	disableUserAi: userAiService.disableUserAi,
	setAllUserAccountsAiByAdmin: userAiService.setAllUserAccountsAiByAdmin,

	// Управление AI для аккаунтов
	getAllAccountsAiStatus: accountAiService.getAllAccountsAiStatus,
	getUserAccountsAiStatus: accountAiService.getUserAccountsAiStatus,
	getAccountAiStatus: accountAiService.getAccountAiStatus,
	setAccountAiByAdmin: accountAiService.setAccountAiByAdmin,
	// toggleAccountAi УДАЛЕНО - только админ контролирует AI
	canAccountUseAi: accountAiService.canAccountUseAi,
	enableAccountAi: accountAiService.enableAccountAi,
	disableAccountAi: accountAiService.disableAccountAi,
};

export default aiManagementService;
