/**
 * DistributionWebhookController - webhook endpoints для Python Service
 * Принимает обновления прогресса и завершения рассылок
 */

import Distribution from '../models/Distribution.js';
import spambotService from '../services/SpambotService.js';

/**
 * Обновление прогресса рассылки
 * POST /api/distributions/webhook/progress
 */
export const updateProgress = async (req, res) => {
    try {
        const { distribution_id, progress } = req.body;

        if (!distribution_id || !progress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: distribution_id, progress'
            });
        }

        console.log(`[DistributionWebhook] Progress update for ${distribution_id}:`, progress);

        // Обновляем прогресс в MongoDB
        await spambotService.updateProgress(distribution_id, progress);

        // Получаем обновлённую рассылку
        const distribution = await Distribution.findById(distribution_id);
        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        // Отправляем обновление через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${distribution.user.toString()}`).emit('distribution:progress', {
                distributionId: distribution_id,
                progress: distribution.progress
            });
        }

        res.json({
            success: true,
            message: 'Progress updated'
        });

    } catch (error) {
        console.error('[DistributionWebhook] Error updating progress:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Обработка завершения рассылки
 * POST /api/distributions/webhook/complete
 */
export const handleCompletion = async (req, res) => {
    try {
        const { distribution_id, status, error } = req.body;

        if (!distribution_id || !status) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: distribution_id, status'
            });
        }

        console.log(`[DistributionWebhook] Completion for ${distribution_id}: status=${status}`);

        // Обновляем статус в MongoDB
        await spambotService.handleCompletion(distribution_id, status, error);

        // Получаем обновлённую рассылку
        const distribution = await Distribution.findById(distribution_id);
        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: 'Distribution not found'
            });
        }

        // Отправляем обновление через WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${distribution.user.toString()}`).emit('distribution:completed', {
                distributionId: distribution_id,
                status: distribution.status,
                progress: distribution.progress,
                error: distribution.error
            });
        }

        res.json({
            success: true,
            message: 'Completion handled'
        });

    } catch (error) {
        console.error('[DistributionWebhook] Error handling completion:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    updateProgress,
    handleCompletion
};
