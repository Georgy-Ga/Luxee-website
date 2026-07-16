/**
 * Routes для Distribution API
 * Управление рассылками
 */

import { Router } from 'express';
import distributionController from '../controllers/distributionController.js';
import distributionWebhookController from '../controllers/distributionWebhookController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Webhook endpoints (БЕЗ авторизации - для Python Service)
router.post('/webhook/progress', distributionWebhookController.updateProgress);
router.post('/webhook/complete', distributionWebhookController.handleCompletion);

// Все остальные роуты требуют аутентификации
router.use(authMiddleware);

/**
 * ВАЖНО: Специфичные роуты ДОЛЖНЫ быть ПЕРЕД параметризованными /:id
 * Иначе Express попытается обработать /authenticate/123 как /:id где id='authenticate'
 */

/**
 * @route   POST /api/distributions/authenticate/:accountId
 * @desc    Авторизация Luxee аккаунта в spambot service
 * @access  Private
 */
router.post('/authenticate/:accountId', distributionController.authenticateAccount);

/**
 * @route   GET /api/distributions/profiles/:accountId
 * @desc    Получение профилей для авторизованного аккаунта из spambot
 * @access  Private
 */
router.get('/profiles/:accountId', distributionController.getAccountProfiles);

/**
 * @route   POST /api/distributions
 * @desc    Создание новой рассылки
 * @access  Private
 */
router.post('/', distributionController.createDistribution);

/**
 * @route   GET /api/distributions
 * @desc    Получение списка рассылок пользователя
 * @access  Private
 * @query   status - фильтр по статусу (pending, running, completed, stopped, error)
 * @query   luxeeAccountId - фильтр по Luxee аккаунту
 * @query   limit - лимит записей (default: 50)
 * @query   skip - пропустить записей (default: 0)
 */
router.get('/', distributionController.getDistributions);

/**
 * @route   POST /api/distributions/:id/start
 * @desc    Запуск рассылки
 * @access  Private
 */
router.post('/:id/start', distributionController.startDistribution);

/**
 * @route   POST /api/distributions/:id/stop
 * @desc    Остановка рассылки
 * @access  Private
 */
router.post('/:id/stop', distributionController.stopDistribution);

/**
 * @route   POST /api/distributions/:id/sync
 * @desc    Синхронизация статуса рассылки между MongoDB и Python
 * @access  Private
 */
router.post('/:id/sync', distributionController.syncDistributionStatus);

/**
 * @route   GET /api/distributions/:id
 * @desc    Получение детальной информации о рассылке
 * @access  Private
 */
router.get('/:id', distributionController.getDistribution);

/**
 * @route   DELETE /api/distributions/:id
 * @desc    Удаление рассылки
 * @access  Private
 */
router.delete('/:id', distributionController.deleteDistribution);

export default router;
