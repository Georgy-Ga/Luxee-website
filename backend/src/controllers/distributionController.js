/**
 * DistributionController - контроллер для управления рассылками
 * Обрабатывает HTTP запросы от фронтенда
 */

import Distribution from '../models/Distribution.js';
import LuxeeAccount from '../models/LuxeeAccountModel.js';
import spambotService from '../services/SpambotService.js';
import browserService from '../services/browser/browserService.js';

/**
 * Создание новой рассылки
 * POST /api/distributions
 */
export const createDistribution = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            luxeeAccountId,
            profile,
            purchased,
            free,
            only_empty_chat,
            only_not_empty_chat,
            exclude,
            specific_users,
            limit,
            filter_update_limit,
            max_time_minutes,
            messages,
            mail_message
        } = req.body;

        // Валидация
        if (!luxeeAccountId || !profile) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: luxeeAccountId, profile'
            });
        }

        if (!messages && !mail_message) {
            return res.status(400).json({
                success: false,
                error: 'Either messages or mail_message must be provided'
            });
        }

        if (messages && mail_message) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send both messages and mail in one distribution'
            });
        }

        // Проверка что Luxee аккаунт принадлежит пользователю
        const luxeeAccount = await LuxeeAccount.findOne({
            _id: luxeeAccountId,
            user: userId
        });

        if (!luxeeAccount) {
            return res.status(404).json({
                success: false,
                error: 'Luxee account not found'
            });
        }

        // Проверка что нет активной рассылки для этого аккаунта
        const activeDistribution = await Distribution.findActiveForAccount(luxeeAccountId);
        if (activeDistribution) {
            return res.status(400).json({
                success: false,
                error: 'This Luxee account already has an active distribution'
            });
        }

        // Создание рассылки
        const distribution = new Distribution({
            user: userId,
            luxeeAccount: luxeeAccountId,
            profile,
            purchased,
            free,
            only_empty_chat,
            only_not_empty_chat,
            exclude: exclude || [],
            specific_users: specific_users || [],
            limit: limit || 9999,
            filter_update_limit: filter_update_limit || 100,
            max_time_minutes: max_time_minutes || 99999,
            messages,
            mail_message,
            status: 'pending'
        });

        await distribution.save();

        console.log(`[DistributionController] Distribution created: ${distribution._id}`);

        res.json({
            success: true,
            distribution: distribution.toObject()
        });

    } catch (error) {
        console.error('[DistributionController] Error creating distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Запуск рассылки
 * POST /api/distributions/:id/start
 */
export const startDistribution = async (req, res) => {
    try {
        const userId = req.user.id;
        const distributionId = req.params.id;

        console.log('[DistributionController] 🚀 START request:', { userId, distributionId });

        const distribution = await Distribution.findOne({
            _id: distributionId,
            user: userId
        }).populate('luxeeAccount');

        if (!distribution) {
            console.log('[DistributionController] ❌ Distribution not found:', distributionId);
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        if (distribution.status !== 'pending') {
            console.log('[DistributionController] ❌ Invalid status:', distribution.status);
            return res.status(400).json({
                success: false,
                error: `Cannot start distribution with status: ${distribution.status}`
            });
        }

        // Проверка что Luxee аккаунт не занят другой рассылкой
        const activeDistribution = await Distribution.findActiveForAccount(distribution.luxeeAccount._id);
        if (activeDistribution && activeDistribution._id.toString() !== distributionId) {
            return res.status(400).json({
                success: false,
                error: 'This Luxee account already has an active distribution'
            });
        }

        // Получение cookies из Playwright контекста
        const context = browserService.getContext(distribution.luxeeAccount._id.toString());
        console.log('[DistributionController] 🍪 Context found:', !!context);
        if (!context) {
            console.log('[DistributionController] ❌ No context for account:', distribution.luxeeAccount._id);
            return res.status(400).json({
                success: false,
                error: 'Luxee account context not found. Please login first.'
            });
        }

        const cookies = await context.cookies();
        const cookiesDict = {};
        for (const cookie of cookies) {
            cookiesDict[cookie.name] = cookie.value;
        }

        // Запуск рассылки через SpambotService
        // Передаём username и password из LuxeeAccount автоматически
        console.log('[DistributionController] 📤 Sending to spambot:', {
            distributionId: distribution._id,
            account: distribution.luxeeAccount.email,
            profilesCount: distribution.profiles?.length
        });
        const result = await spambotService.startDistribution(
            distribution,
            distribution.luxeeAccount,
            cookiesDict
        );
        console.log('[DistributionController] ✅ Spambot response:', result);

        // Отправка обновления через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${userId}`).emit('distribution:started', {
                distributionId: distribution._id.toString(),
                status: 'running'
            });
        }

        res.json({
            success: true,
            distribution: distribution.toObject()
        });

    } catch (error) {
        console.error('[DistributionController] Error starting distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Синхронизация статуса рассылки
 * POST /api/distributions/:id/sync
 */
export const syncDistributionStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const distributionId = req.params.id;

        console.log('[DistributionController] 🔄 Syncing distribution status:', distributionId);

        const distribution = await Distribution.findOne({
            _id: distributionId,
            user: userId
        });

        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        // Синхронизация через SpambotService
        const result = await spambotService.syncDistributionStatus(distributionId);

        // Отправка обновления через WebSocket если статус исправлен
        if (result.fixed) {
            const io = req.app.get('io');
            if (io) {
                io.to(`user:${userId}`).emit('distribution:updated', {
                    distributionId: distributionId,
                    status: result.new_status
                });
            }
        }

        res.json(result);

    } catch (error) {
        console.error('[DistributionController] Error syncing distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Остановка рассылки
 * POST /api/distributions/:id/stop
 */
export const stopDistribution = async (req, res) => {
    try {
        const userId = req.user.id;
        const distributionId = req.params.id;

        const distribution = await Distribution.findOne({
            _id: distributionId,
            user: userId
        });

        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        if (distribution.status !== 'running') {
            return res.status(400).json({
                success: false,
                error: `Cannot stop distribution with status: ${distribution.status}`
            });
        }

        // Остановка через SpambotService
        await spambotService.stopDistribution(distributionId);

        // Отправка обновления через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${userId}`).emit('distribution:stopped', {
                distributionId: distributionId
            });
        }

        res.json({
            success: true,
            message: 'Distribution stop requested'
        });

    } catch (error) {
        console.error('[DistributionController] Error stopping distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Получение списка рассылок пользователя
 * GET /api/distributions
 */
export const getDistributions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, luxeeAccountId, limit = 50, skip = 0 } = req.query;

        const query = { user: userId };
        
        if (status) {
            query.status = status;
        }
        
        if (luxeeAccountId) {
            query.luxeeAccount = luxeeAccountId;
        }

        const distributions = await Distribution.find(query)
            .populate('luxeeAccount', 'login')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Distribution.countDocuments(query);

        res.json({
            success: true,
            distributions,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });

    } catch (error) {
        console.error('[DistributionController] Error getting distributions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Получение детальной информации о рассылке
 * GET /api/distributions/:id
 */
export const getDistribution = async (req, res) => {
    try {
        const userId = req.user.id;
        const distributionId = req.params.id;

        const distribution = await Distribution.findOne({
            _id: distributionId,
            user: userId
        }).populate('luxeeAccount', 'login');

        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        res.json({
            success: true,
            distribution: distribution.toObject()
        });

    } catch (error) {
        console.error('[DistributionController] Error getting distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Удаление рассылки
 * DELETE /api/distributions/:id
 */
export const deleteDistribution = async (req, res) => {
    try {
        const userId = req.user.id;
        const distributionId = req.params.id;

        const distribution = await Distribution.findOne({
            _id: distributionId,
            user: userId
        });

        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        // Нельзя удалить активную рассылку
        if (distribution.status === 'running') {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete running distribution. Stop it first.'
            });
        }

        await distribution.deleteOne();

        console.log(`[DistributionController] Distribution deleted: ${distributionId}`);

        res.json({
            success: true,
            message: 'Distribution deleted'
        });

    } catch (error) {
        console.error('[DistributionController] Error deleting distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Авторизация Luxee аккаунта в spambot service
 * POST /api/distributions/authenticate/:accountId
 */
export const authenticateAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { accountId } = req.params;

        console.log(`[DistributionController] Authenticating account ${accountId} for user ${userId}`);

        // Проверка что Luxee аккаунт принадлежит пользователю
        const luxeeAccount = await LuxeeAccount.findOne({
            _id: accountId,
            user: userId
        });

        if (!luxeeAccount) {
            return res.status(404).json({
                success: false,
                error: 'Luxee account not found'
            });
        }

        // Вызываем spambot API для авторизации
        const authResult = await spambotService.authenticateAccount({
            luxee_account_id: accountId,
            username: luxeeAccount.luxeeEmail,
            password: luxeeAccount.luxeePassword
        });

        if (!authResult.success) {
            return res.status(500).json({
                success: false,
                error: authResult.error || 'Failed to authenticate account in spambot'
            });
        }

        // Обновляем статус в MongoDB
        luxeeAccount.spambotAuthenticated = true;
        luxeeAccount.lastActivity = new Date();
        await luxeeAccount.save();

        console.log(`[DistributionController] Account ${accountId} authenticated successfully. Profiles count: ${authResult.profiles_count}`);

        res.json({
            success: true,
            luxee_account_id: accountId,
            status: 'authenticated',
            profiles_count: authResult.profiles_count
        });

    } catch (error) {
        console.error('[DistributionController] Error authenticating account:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Получение профилей из spambot для авторизованного аккаунта
 * GET /api/distributions/profiles/:accountId
 */
export const getAccountProfiles = async (req, res) => {
    try {
        const userId = req.user.id;
        const { accountId } = req.params;

        console.log(`[DistributionController] Getting profiles for account ${accountId}`);

        // Проверка что Luxee аккаунт принадлежит пользователю
        const luxeeAccount = await LuxeeAccount.findOne({
            _id: accountId,
            user: userId
        });

        if (!luxeeAccount) {
            return res.status(404).json({
                success: false,
                error: 'Luxee account not found'
            });
        }

        // Проверяем, авторизован ли аккаунт в spambot
        if (!luxeeAccount.spambotAuthenticated) {
            return res.status(400).json({
                success: false,
                error: 'Account is not authenticated in spambot. Please authenticate first.',
                needsAuthentication: true
            });
        }

        // Получаем профили из spambot
        const profilesResult = await spambotService.getAccountProfiles(accountId);

        if (!profilesResult.success) {
            // Если ошибка - возможно контекст закрыт, сбрасываем флаг
            if (profilesResult.error && profilesResult.error.includes('not authenticated')) {
                luxeeAccount.spambotAuthenticated = false;
                await luxeeAccount.save();
                
                return res.status(400).json({
                    success: false,
                    error: 'Session expired. Please authenticate again.',
                    needsAuthentication: true
                });
            }

            return res.status(500).json({
                success: false,
                error: profilesResult.error || 'Failed to get profiles from spambot'
            });
        }

        console.log(`[DistributionController] Found ${profilesResult.profiles.length} profiles for account ${accountId}`);

        res.json({
            success: true,
            luxee_account_id: accountId,
            profiles: profilesResult.profiles
        });

    } catch (error) {
        console.error('[DistributionController] Error getting profiles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    createDistribution,
    startDistribution,
    syncDistributionStatus,
    stopDistribution,
    getDistributions,
    getDistribution,
    deleteDistribution,
    authenticateAccount,
    getAccountProfiles
};
