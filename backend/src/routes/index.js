import { Router } from 'express';
import { body } from 'express-validator';
import UserController from '../controllers/userController.js';
import LuxeeController from '../controllers/luxeeController.js';
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

// Luxee routes
router.post('/luxee/login', authMiddleware, LuxeeController.login);
router.get('/luxee/accounts', authMiddleware, LuxeeController.getAccounts);
router.delete('/luxee/accounts/:accountId', authMiddleware, LuxeeController.deleteAccount);
router.post('/luxee/accounts/:accountId/restore', authMiddleware, LuxeeController.restoreSession);
router.get('/luxee/profiles', authMiddleware, LuxeeController.getProfiles);
router.get('/luxee/page-content', authMiddleware, LuxeeController.getPageContent);

// Message checking routes
router.get('/luxee/check-messages', authMiddleware, LuxeeController.checkAllMessages);
router.get('/luxee/check-messages/account', authMiddleware, LuxeeController.checkAccountMessages);
router.get('/luxee/check-messages/unread', authMiddleware, LuxeeController.checkUnreadMessages);

export default router;
