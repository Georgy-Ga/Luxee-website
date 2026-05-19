// Контроллер управления AI правилами

import aiRuleService from '../../services/aiRuleService.js';

export const getRules = async (req, res) => {
	try {
		const isAdmin = req.user.role === 'admin';
		const rules = isAdmin
			? await aiRuleService.getAllRules()
			: await aiRuleService.getActiveRules();

		res.json({ success: true, rules });
	} catch (error) {
		console.error('[AI Management Controller] Error getting rules:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const createRule = async (req, res) => {
	try {
		const { rule, description, order } = req.body;

		if (!rule) {
			return res.status(400).json({
				success: false,
				error: 'Rule text is required',
			});
		}

		const newRule = await aiRuleService.createRule(
			{ rule, description, order },
			req.user.id,
		);

		res.json({ success: true, rule: newRule });
	} catch (error) {
		console.error('[AI Management Controller] Error creating rule:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const updateRule = async (req, res) => {
	try {
		const { id } = req.params;
		const { rule, description, order, isActive } = req.body;

		const updatedRule = await aiRuleService.updateRule(
			id,
			{ rule, description, order, isActive },
			req.user.id,
		);

		res.json({ success: true, rule: updatedRule });
	} catch (error) {
		console.error('[AI Management Controller] Error updating rule:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const deleteRule = async (req, res) => {
	try {
		const { id } = req.params;
		await aiRuleService.deleteRule(id);
		res.json({ success: true, message: 'Rule deleted successfully' });
	} catch (error) {
		console.error('[AI Management Controller] Error deleting rule:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const reorderRules = async (req, res) => {
	try {
		const { rules } = req.body;

		if (!Array.isArray(rules)) {
			return res.status(400).json({
				success: false,
				error: 'Rules array is required',
			});
		}

		await aiRuleService.reorderRules(rules, req.user.id);
		res.json({ success: true, message: 'Rules reordered successfully' });
	} catch (error) {
		console.error('[AI Management Controller] Error reordering rules:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const toggleRuleActive = async (req, res) => {
	try {
		const { ruleId } = req.params;
		const rule = await aiRuleService.toggleRuleActive(ruleId, req.user.id);
		res.json({ success: true, rule });
	} catch (error) {
		console.error('[AI Management Controller] Error toggling rule:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};
