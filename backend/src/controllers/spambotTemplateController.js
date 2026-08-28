import spambotTemplateService from '../services/spambotTemplateService.js';

/**
 * Spambot Template Controller
 *
 * Обрабатывает HTTP запросы для шаблонов рассылок.
 */

class SpambotTemplateController {
	/**
	 * POST /api/spambot/templates
	 * Создать шаблон.
	 */
	async createTemplate(req, res) {
		try {
			const { accountId, name, chat, mail } = req.body;
			const userId = req.user.id;
			const userRole = req.user.role;

			if (!accountId) {
				return res.status(400).json({
					success: false,
					message: 'accountId is required',
				});
			}

			const template = await spambotTemplateService.createTemplate({
				accountId,
				userId,
				userRole,
				name,
				chat,
				mail,
			});

			res.status(201).json({ success: true, template });
		} catch (error) {
			console.error('[Spambot Template Controller] Error creating template:', error);
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * GET /api/spambot/templates?accountId=X
	 * Список шаблонов аккаунта.
	 */
	async getTemplates(req, res) {
		try {
			const { accountId } = req.query;
			const userId = req.user.id;
			const userRole = req.user.role;

			if (!accountId) {
				return res.status(400).json({
					success: false,
					message: 'accountId is required',
				});
			}

			const templates = await spambotTemplateService.getAccountTemplates(
				accountId,
				userId,
				userRole,
			);

			res.json({ success: true, templates });
		} catch (error) {
			console.error('[Spambot Template Controller] Error getting templates:', error);
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * GET /api/spambot/templates/counts
	 * Количество шаблонов по аккаунтам (для бейджей).
	 */
	async getTemplateCounts(req, res) {
		try {
			const counts = await spambotTemplateService.getTemplateCounts(
				req.user.id,
				req.user.role,
			);
			res.json({ success: true, counts });
		} catch (error) {
			console.error('[Spambot Template Controller] Error getting counts:', error);
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * GET /api/spambot/templates/:id?validate=1
	 * Получить один шаблон (с валидацией анкет при validate=1).
	 */
	async getTemplate(req, res) {
		try {
			const { id } = req.params;
			const { validate } = req.query;
			const userId = req.user.id;
			const userRole = req.user.role;

			const result = await spambotTemplateService.getTemplateById(
				id,
				userId,
				userRole,
				{ validate: validate === '1' || validate === 'true' },
			);

			res.json({ success: true, ...result });
		} catch (error) {
			console.error('[Spambot Template Controller] Error getting template:', error);
			if (error.message.includes('not found')) {
				return res.status(404).json({ success: false, message: error.message });
			}
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * PUT /api/spambot/templates/:id
	 * Обновить шаблон.
	 */
	async updateTemplate(req, res) {
		try {
			const { id } = req.params;
			const { name, chat, mail } = req.body;
			const userId = req.user.id;
			const userRole = req.user.role;

			const template = await spambotTemplateService.updateTemplate(
				id,
				{ name, chat, mail },
				userId,
				userRole,
			);

			res.json({ success: true, template });
		} catch (error) {
			console.error('[Spambot Template Controller] Error updating template:', error);
			if (error.message.includes('not found')) {
				return res.status(404).json({ success: false, message: error.message });
			}
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * DELETE /api/spambot/templates/:id
	 * Удалить шаблон.
	 */
	async deleteTemplate(req, res) {
		try {
			const { id } = req.params;
			const userId = req.user.id;
			const userRole = req.user.role;

			const result = await spambotTemplateService.deleteTemplate(
				id,
				userId,
				userRole,
			);

			res.json({ success: true, ...result });
		} catch (error) {
			console.error('[Spambot Template Controller] Error deleting template:', error);
			if (error.message.includes('not found')) {
				return res.status(404).json({ success: false, message: error.message });
			}
			res.status(500).json({ success: false, message: error.message });
		}
	}

	/**
	 * POST /api/spambot/templates/:id/apply
	 * Применить шаблон — создать пачку рассылок.
	 */
	async applyTemplate(req, res) {
		try {
			const { id } = req.params;
			const { chat, mail } = req.body || {};
			const userId = req.user.id;
			const userRole = req.user.role;

			const result = await spambotTemplateService.applyTemplate(
				id,
				userId,
				userRole,
				{ chat, mail },
			);

			res.json({ success: true, ...result });
		} catch (error) {
			console.error('[Spambot Template Controller] Error applying template:', error);
			if (error.message.includes('not found')) {
				return res.status(404).json({ success: false, message: error.message });
			}
			res.status(500).json({ success: false, message: error.message });
		}
	}
}

export default new SpambotTemplateController();
