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

export default router;
