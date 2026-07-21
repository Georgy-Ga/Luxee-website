import express from 'express';
import spambotController from '../controllers/spambotController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * Все routes требуют авторизации
 */
router.use(authMiddleware);

/**
 * ========================================
 * ADMIN ROUTES
 * ========================================
 */

/**
 * GET /api/spambot/admin/accounts
 * 
 * ADMIN: Получить все Luxee аккаунты, сгруппированные по пользователям
 * 
 * Response: {
 *   success: boolean,
 *   accounts: [{
 *     user: { _id, email, role },
 *     accounts: [{ _id, luxeeEmail, isActive, lastActivity, createdAt }]
 *   }]
 * }
 */
router.get('/admin/accounts', roleMiddleware('admin'), spambotController.getAdminAccounts);

/**
 * GET /api/spambot/admin/distributions
 * 
 * ADMIN: Получить все рассылки всех пользователей
 * 
 * Query params:
 * - status?: string
 * - userId?: string
 * - limit?: number
 * 
 * Response: {
 *   success: boolean,
 *   distributions: [{
 *     id, distributionId, status, accountEmail, userEmail, userId,
 *     profileName, distributionType, sentMessagesCount, skippedClientsCount,
 *     limit, startedAt, completedAt, createdAt
 *   }]
 * }
 */
router.get('/admin/distributions', roleMiddleware('admin'), spambotController.getAdminDistributions);

/**
 * GET /api/spambot/admin/profiles?accountId=X
 * 
 * ADMIN: Получить профили для любого аккаунта (без проверки владельца)
 * 
 * Query params:
 * - accountId: string (required)
 * 
 * Response: {
 *   success: boolean,
 *   profiles: [{
 *     uid, owner_uid, name, age, location, image_url
 *   }]
 * }
 */
router.get('/admin/profiles', roleMiddleware('admin'), spambotController.getAdminProfiles);

/**
 * ========================================
 * USER ROUTES
 * ========================================
 */

/**
 * GET /api/spambot/profiles?accountId=X
 * 
 * Получить список профилей для Luxee аккаунта
 * 
 * Query params:
 * - accountId: string (required) - ID Luxee аккаунта
 * 
 * Response: {
 *   success: boolean,
 *   profiles: [{
 *     uid: string,
 *     owner_uid: string,
 *     name: string,
 *     age: number,
 *     location: string,
 *     image_url: string
 *   }]
 * }
 */
router.get('/profiles', spambotController.getProfiles);

/**
 * GET /api/spambot/accounts/:accountId/availability
 * 
 * Проверить доступность аккаунта для новой рассылки
 * 
 * Response: {
 *   success: boolean,
 *   available: boolean,
 *   reason?: string,
 *   activeDistributions?: Array
 * }
 */
router.get('/accounts/:accountId/availability', spambotController.checkAccountAvailability);

/**
 * POST /api/spambot/distributions
 * 
 * Создать и запустить новую рассылку
 * 
 * Body: {
 *   accountId: string,
 *   config: {
 *     profileUid: string,
 *     profileName: string,
 *     distributionType: 'chat' | 'mail',
 *     
 *     // For chat type
 *     messages?: [{
 *       text: string,
 *       interval: number
 *     }],
 *     
 *     // For mail type
 *     mailMessage?: {
 *       title: string,
 *       text: string,
 *       picturesNumber?: number[]
 *     },
 *     
 *     // Filters
 *     purchased?: boolean,
 *     free?: boolean,
 *     onlyEmptyChat?: boolean,
 *     onlyNotEmptyChat?: boolean,
 *     
 *     // Limits
 *     excludeIds?: number[],
 *     specificUsers?: number[],
 *     limit: number,
 *     filterUpdateLimit: number,
 *     maxTimeMinutes?: number
 *   }
 * }
 * 
 * Response: {
 *   success: boolean,
 *   distribution: {
 *     id: string,
 *     distributionId: string,
 *     status: string,
 *     accountEmail: string
 *   }
 * }
 */
router.post('/distributions', spambotController.createDistribution);

/**
 * GET /api/spambot/distributions
 * 
 * Получить список рассылок пользователя
 * 
 * Query params:
 * - accountId?: string - фильтр по аккаунту
 * - status?: string - фильтр по статусу
 * - limit?: number - количество (default: 50)
 * 
 * Response: {
 *   success: boolean,
 *   distributions: [{
 *     id: string,
 *     distributionId: string,
 *     status: string,
 *     accountEmail: string,
 *     profileName: string,
 *     distributionType: string,
 *     sentMessagesCount: number,
 *     skippedClientsCount: number,
 *     limit: number,
 *     startedAt: Date,
 *     completedAt: Date,
 *     createdAt: Date
 *   }]
 * }
 */
router.get('/distributions', spambotController.getDistributions);

/**
 * GET /api/spambot/distributions/:id/status
 * 
 * Получить текущий статус рассылки
 * 
 * Response: {
 *   success: boolean,
 *   id: string,
 *   distributionId: string,
 *   status: string,
 *   sentMessagesCount: number,
 *   skippedClientsCount: number,
 *   currentClient?: string,
 *   errorMessage?: string,
 *   accountEmail: string,
 *   startedAt: Date,
 *   completedAt?: Date
 * }
 */
router.get('/distributions/:id/status', spambotController.getDistributionStatus);

/**
 * POST /api/spambot/distributions/:id/stop
 * 
 * Остановить активную рассылку
 * 
 * Response: {
 *   success: boolean,
 *   id: string,
 *   status: string,
 *   message: string
 * }
 */
router.post('/distributions/:id/stop', spambotController.stopDistribution);

/**
 * DELETE /api/spambot/distributions/:id
 * 
 * Удалить рассылку из очереди (только для queued статуса)
 * 
 * Response: {
 *   success: boolean,
 *   message: string
 * }
 */
router.delete('/distributions/:id', spambotController.deleteDistribution);

export default router;
