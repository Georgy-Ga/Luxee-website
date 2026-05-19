// Главный модуль AI Management Controller
// Объединяет контроллеры управления правилами, пользователями и аккаунтами

import * as rulesController from './rulesController.js';
import * as userAiController from './userAiController.js';
import * as accountAiController from './accountAiController.js';

const aiManagementController = {
	// Управление правилами
	getRules: rulesController.getRules,
	createRule: rulesController.createRule,
	updateRule: rulesController.updateRule,
	deleteRule: rulesController.deleteRule,
	reorderRules: rulesController.reorderRules,
	toggleRuleActive: rulesController.toggleRuleActive,

	// Управление AI для пользователей
	getUserAiStatus: userAiController.getUserAiStatus,
	enableUserAi: userAiController.enableUserAi,
	disableUserAi: userAiController.disableUserAi,
	getAllUsersAiStatus: userAiController.getAllUsersAiStatus,
	getMyAiStatus: userAiController.getMyAiStatus,
	toggleMyAi: userAiController.toggleMyAi,
	setUserAiByAdmin: userAiController.setUserAiByAdmin,

	// Управление AI для аккаунтов
	getAccountAiStatus: accountAiController.getAccountAiStatus,
	enableAccountAi: accountAiController.enableAccountAi,
	disableAccountAi: accountAiController.disableAccountAi,
	getUserAccountsAiStatus: accountAiController.getUserAccountsAiStatus,
	getAllAccountsAiStatus: accountAiController.getAllAccountsAiStatus,
	getMyAccountsAiStatus: accountAiController.getMyAccountsAiStatus,
	setAccountAiByAdmin: accountAiController.setAccountAiByAdmin,
	toggleMyAccountAi: accountAiController.toggleMyAccountAi,
};

export default aiManagementController;
