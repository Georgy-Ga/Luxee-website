import AiRule from '../models/AiRule.js';

const aiRuleService = {
	/**
	 * Получить все активные кастомные правила
	 */
	getActiveRules: async () => {
		try {
			const rules = await AiRule.find({ isActive: true })
				.sort({ order: 1, createdAt: 1 })
				.populate('createdBy', 'email');
			return rules;
		} catch (error) {
			console.error('[AI Rule Service] Error getting active rules:', error);
			throw error;
		}
	},

	/**
	 * Получить все правила (включая неактивные) - только для админа
	 */
	getAllRules: async () => {
		try {
			const rules = await AiRule.find()
				.sort({ order: 1, createdAt: 1 })
				.populate('createdBy', 'email');
			return rules;
		} catch (error) {
			console.error('[AI Rule Service] Error getting all rules:', error);
			throw error;
		}
	},

	/**
	 * Создать новое правило
	 */
	createRule: async (ruleData, userId) => {
		try {
			const rule = new AiRule({
				...ruleData,
				createdBy: userId,
			});
			await rule.save();
			await rule.populate('createdBy', 'email');
			console.log('[AI Rule Service] Rule created:', rule._id);
			return rule;
		} catch (error) {
			console.error('[AI Rule Service] Error creating rule:', error);
			throw error;
		}
	},

	/**
	 * Обновить правило
	 */
	updateRule: async (ruleId, updateData) => {
		try {
			const rule = await AiRule.findByIdAndUpdate(
				ruleId,
				{ $set: updateData },
				{ new: true, runValidators: true },
			).populate('createdBy', 'email');

			if (!rule) {
				throw new Error('Rule not found');
			}

			console.log('[AI Rule Service] Rule updated:', ruleId);
			return rule;
		} catch (error) {
			console.error('[AI Rule Service] Error updating rule:', error);
			throw error;
		}
	},

	/**
	 * Удалить правило
	 */
	deleteRule: async (ruleId) => {
		try {
			const rule = await AiRule.findByIdAndDelete(ruleId);
			if (!rule) {
				throw new Error('Rule not found');
			}
			console.log('[AI Rule Service] Rule deleted:', ruleId);
			return rule;
		} catch (error) {
			console.error('[AI Rule Service] Error deleting rule:', error);
			throw error;
		}
	},

	/**
	 * Переключить активность правила
	 */
	toggleRuleActive: async (ruleId) => {
		try {
			const rule = await AiRule.findById(ruleId);
			if (!rule) {
				throw new Error('Rule not found');
			}

			rule.isActive = !rule.isActive;
			await rule.save();
			await rule.populate('createdBy', 'email');

			console.log('[AI Rule Service] Rule toggled:', ruleId, 'Active:', rule.isActive);
			return rule;
		} catch (error) {
			console.error('[AI Rule Service] Error toggling rule:', error);
			throw error;
		}
	},

	/**
	 * Изменить порядок правил
	 */
	reorderRules: async (rulesOrder) => {
		try {
			// rulesOrder = [{id, order}, {id, order}, ...]
			const updatePromises = rulesOrder.map(({ id, order }) =>
				AiRule.findByIdAndUpdate(id, { order }),
			);

			await Promise.all(updatePromises);
			console.log('[AI Rule Service] Rules reordered');
			return true;
		} catch (error) {
			console.error('[AI Rule Service] Error reordering rules:', error);
			throw error;
		}
	},
};

export default aiRuleService;
