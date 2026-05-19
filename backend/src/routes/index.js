import { Router } from 'express';
import { body } from 'express-validator';
import UserController from '../controllers/userController.js';
import LuxeeController from '../controllers/luxeeController.js';
import AiController from '../controllers/aiController.js';
import AiManagementController from '../controllers/aiManagementController/index.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
const router = new Router();

router.post(
	'/registration',
	body('password').isLength({ min: 3, max: 32 }),
	authMiddleware,
	roleMiddleware('admin'),
	UserController.registration,
);
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);
router.get('/refresh', UserController.refresh);
router.get(
	'/users',
	authMiddleware,
	roleMiddleware('admin'),
	UserController.getUsers,
);
router.delete(
	'/users/:userId',
	authMiddleware,
	roleMiddleware('admin'),
	UserController.deleteUser,
);

// Luxee routes
router.post('/luxee/login', authMiddleware, LuxeeController.login);
router.get('/luxee/accounts', authMiddleware, LuxeeController.getAccounts);
router.delete('/luxee/accounts/:accountId', authMiddleware, LuxeeController.deleteAccount);
router.post('/luxee/accounts/:accountId/restore', authMiddleware, LuxeeController.restoreSession);
router.get('/luxee/profiles', authMiddleware, LuxeeController.getProfiles);
router.get('/luxee/page-content', authMiddleware, LuxeeController.getPageContent);

// Message checking routes
router.get('/luxee/messages/check-all', authMiddleware, LuxeeController.checkAllMessages);
router.get('/luxee/messages/check-account', authMiddleware, LuxeeController.checkAccountMessages);
router.post('/luxee/messages/send', authMiddleware, LuxeeController.sendMessage);

// Profile chats loading route
router.get('/luxee/profile-chats', authMiddleware, LuxeeController.loadProfileChats);

// Chat opening route
router.get('/luxee/chat/open', authMiddleware, LuxeeController.openChat);

// AI testing routes
router.post('/ai/test', authMiddleware, AiController.testAiResponse);
router.get('/ai/prompt', authMiddleware, AiController.getSystemPrompt);

// AI Management routes - Rules
router.get('/ai/rules', authMiddleware, AiManagementController.getRules);
router.post('/ai/rules', authMiddleware, roleMiddleware('admin'), AiManagementController.createRule);
router.put('/ai/rules/:ruleId', authMiddleware, roleMiddleware('admin'), AiManagementController.updateRule);
router.delete('/ai/rules/:ruleId', authMiddleware, roleMiddleware('admin'), AiManagementController.deleteRule);
router.post('/ai/rules/:ruleId/toggle', authMiddleware, roleMiddleware('admin'), AiManagementController.toggleRuleActive);

// AI Management routes - Users
router.get('/ai/users', authMiddleware, roleMiddleware('admin'), AiManagementController.getAllUsersAiStatus);
router.get('/ai/my-status', authMiddleware, AiManagementController.getMyAiStatus);
router.post('/ai/my-toggle', authMiddleware, AiManagementController.toggleMyAi);
router.post('/ai/users/:userId/set', authMiddleware, roleMiddleware('admin'), AiManagementController.setUserAiByAdmin);

// AI Management routes - Accounts
router.get('/ai/accounts', authMiddleware, roleMiddleware('admin'), AiManagementController.getAllAccountsAiStatus);
router.get('/ai/my-accounts', authMiddleware, AiManagementController.getMyAccountsAiStatus);
router.post('/ai/accounts/:accountId/set', authMiddleware, roleMiddleware('admin'), AiManagementController.setAccountAiByAdmin);
router.post('/ai/my-accounts/:accountId/toggle', authMiddleware, AiManagementController.toggleMyAccountAi);

export default router;
