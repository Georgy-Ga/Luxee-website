import express from 'express';
import spambotController from '../controllers/spambotController.js';
import spambotTemplateController from '../controllers/spambotTemplateController.js';
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
 * GET /api/spambot/admin/profile-limits?accountId=X
 *
 * ADMIN: Получить дневные лимиты рассылок по анкетам любого аккаунта
 */
router.get('/admin/profile-limits', roleMiddleware('admin'), spambotController.getAdminProfileLimits);

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
 * GET /api/spambot/profile-limits?accountId=X
 *
 * Получить дневные лимиты рассылок по анкетам аккаунта
 */
router.get('/profile-limits', spambotController.getProfileLimits);

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

/**
 * ========================================
 * TEMPLATE ROUTES
 * ========================================
 */

/**
 * GET /api/spambot/templates/counts
 *
 * Количество шаблонов по аккаунтам (для бейджей на Шаге 1).
 * user — только свои аккаунты, admin — все.
 */
router.get('/templates/counts', spambotTemplateController.getTemplateCounts);

/**
 * POST /api/spambot/templates
 *
 * Создать шаблон.
 * Body: { accountId, name, chat: {settings, profiles}, mail: {settings, profiles} }
 */
router.post('/templates', spambotTemplateController.createTemplate);

/**
 * GET /api/spambot/templates?accountId=X
 *
 * Список шаблонов аккаунта (с проверкой прав).
 */
router.get('/templates', spambotTemplateController.getTemplates);

/**
 * GET /api/spambot/templates/:id?validate=1
 *
 * Получить один шаблон. При validate=1 возвращает также removed/missing анкеты.
 */
router.get('/templates/:id', spambotTemplateController.getTemplate);

/**
 * PUT /api/spambot/templates/:id
 *
 * Обновить шаблон.
 */
router.put('/templates/:id', spambotTemplateController.updateTemplate);

/**
 * DELETE /api/spambot/templates/:id
 *
 * Удалить шаблон.
 */
router.delete('/templates/:id', spambotTemplateController.deleteTemplate);

/**
 * POST /api/spambot/templates/:id/apply
 *
 * Применить шаблон — создать пачку рассылок (по одной на заполненную анкету).
 */
router.post('/templates/:id/apply', spambotTemplateController.applyTemplate);

export default router;
