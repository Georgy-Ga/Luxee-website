import aiScheduleService from '../services/aiScheduleService.js';

/**
 * Controller для управления AI Schedule (интервалы работы/отдыха ИИ)
 */
class AiScheduleController {
	/**
	 * Получить расписание пользователя
	 * GET /api/ai/schedule/:userId
	 */
	async getSchedule(req, res) {
		try {
			const { userId } = req.params;
			
			const schedule = await aiScheduleService.getScheduleStatus(userId);
			
			res.json({
				success: true,
				schedule
			});
		} catch (error) {
			console.error('[AI Schedule Controller] Get schedule error:', error);
			res.status(500).json({
				success: false,
				error: error.message
			});
		}
	}
	
	/**
	 * Обновить настройки расписания
	 * POST /api/ai/schedule/:userId
	 */
	async updateSchedule(req, res) {
		try {
			const { userId } = req.params;
			const { enabled, workMinutes, restMinutes } = req.body;
			
			// DEBUG: Логируем что пришло
			console.log('[AI Schedule Controller] Update request:', {
				userId,
				enabled,
				workMinutes,
				restMinutes,
				types: {
					enabled: typeof enabled,
					workMinutes: typeof workMinutes,
					restMinutes: typeof restMinutes
				}
			});
			
		// Валидация
		if (enabled === undefined) {
			return res.status(400).json({
				success: false,
				error: 'enabled is required'
			});
		}
		
		if (enabled && (workMinutes === undefined || workMinutes === null || restMinutes === undefined || restMinutes === null)) {
			return res.status(400).json({
				success: false,
				error: 'workMinutes and restMinutes are required when enabling schedule'
			});
		}
		
		if (enabled && (workMinutes <= 0 || restMinutes <= 0)) {
			return res.status(400).json({
				success: false,
				error: 'workMinutes and restMinutes must be greater than 0'
			});
		}
			
		const schedule = await aiScheduleService.updateScheduleSettings(userId, {
			enabled,
			workMinutes: workMinutes !== undefined ? parseFloat(workMinutes) : undefined,
			restMinutes: restMinutes !== undefined ? parseFloat(restMinutes) : undefined
		});
			
			res.json({
				success: true,
				schedule
			});
		} catch (error) {
			console.error('[AI Schedule Controller] Update schedule error:', error);
			res.status(500).json({
				success: false,
				error: error.message
			});
		}
	}
	
	/**
	 * Сбросить расписание (при выключении ИИ)
	 * DELETE /api/ai/schedule/:userId
	 */
	async resetSchedule(req, res) {
		try {
			const { userId } = req.params;
			
			await aiScheduleService.resetSchedule(userId);
			
			res.json({
				success: true,
				message: 'Schedule reset successfully'
			});
		} catch (error) {
			console.error('[AI Schedule Controller] Reset schedule error:', error);
			res.status(500).json({
				success: false,
				error: error.message
			});
		}
	}
	
	/**
	 * Получить своё расписание (для пользователя)
	 * GET /api/ai/schedule/me
	 */
	async getMySchedule(req, res) {
		try {
			const userId = req.userId; // Из authMiddleware
			
			const schedule = await aiScheduleService.getScheduleStatus(userId);
			
			res.json({
				success: true,
				schedule
			});
		} catch (error) {
			console.error('[AI Schedule Controller] Get my schedule error:', error);
			res.status(500).json({
				success: false,
				error: error.message
			});
		}
	}
}

export default new AiScheduleController();
