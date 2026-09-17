// Контроллер управления AI для пользователей

import aiManagementService from '../../services/aiManagementService/index.js';
import User from '../../models/UserModel.js';
import { sanitizeExcludedList } from '../../services/aiAuto/excludedProfilesService.js';

export const getUserAiStatus = async (req, res) => {
	try {
		const { userId } = req.params;
		const status = await aiManagementService.getUserAiStatus(userId);
		res.json({ success: true, ...status });
	} catch (error) {
		console.error('[AI Management Controller] Error getting user AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const enableUserAi = async (req, res) => {
	try {
		const { userId } = req.params;
		await aiManagementService.enableUserAi(userId, req.user.id);
		res.json({ success: true, message: 'AI enabled for user' });
	} catch (error) {
		console.error('[AI Management Controller] Error enabling user AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const disableUserAi = async (req, res) => {
	try {
		const { userId } = req.params;
		await aiManagementService.disableUserAi(userId, req.user.id);
		res.json({ success: true, message: 'AI disabled for user' });
	} catch (error) {
		console.error('[AI Management Controller] Error disabling user AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getAllUsersAiStatus = async (req, res) => {
	try {
		const users = await aiManagementService.getAllUsersAiStatus();
		const accounts = await aiManagementService.getAllAccountsAiStatus();
		
		// Группируем аккаунты по пользователям
		const usersWithAccounts = users.map(user => {
			const userAccounts = accounts.filter(acc => 
				acc.user && acc.user._id.toString() === user._id.toString()
			);
			
			return {
				_id: user._id,
				email: user.email,
				role: user.role,
				aiEnabled: user.aiEnabled,
				aiEnabledByAdmin: user.aiEnabledByAdmin,
				excludedProfilesCount: Array.isArray(user.aiExcludedProfileUids)
					? user.aiExcludedProfileUids.length
					: 0,
				accounts: userAccounts.map(acc => ({
					_id: acc._id,
					luxeeEmail: acc.luxeeEmail,
					aiEnabled: acc.aiEnabled,
					aiEnabledByAdmin: acc.aiEnabledByAdmin
				}))
			};
		});
		
		res.json({ success: true, users: usersWithAccounts });
	} catch (error) {
		console.error('[AI Management Controller] Error getting all users AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getMyAiStatus = async (req, res) => {
	try {
		const status = await aiManagementService.getUserAiStatus(req.user.id);
		res.json({ success: true, ...status });
	} catch (error) {
		console.error('[AI Management Controller] Error getting my AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const toggleMyAi = async (req, res) => {
	try {
		const { enabled } = req.body;
		
		// Если передан параметр enabled - используем его, иначе toggle
		const result = enabled !== undefined 
			? await aiManagementService.setUserAiState(req.user.id, enabled)
			: await aiManagementService.toggleUserAi(req.user.id);
			
		res.json({ success: true, aiEnabled: result.aiEnabled, aiEnabledByAdmin: result.aiEnabledByAdmin });
	} catch (error) {
		console.error('[AI Management Controller] Error toggling my AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const setUserAiByAdmin = async (req, res) => {
	try {
		const { userId } = req.params;
		const { aiEnabledByAdmin } = req.body;
		await aiManagementService.setUserAiByAdmin(userId, aiEnabledByAdmin, req.user.id);
		res.json({ success: true, message: 'User AI status updated by admin' });
	} catch (error) {
		console.error('[AI Management Controller] Error setting user AI by admin:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const setAllUserAccountsAiByAdmin = async (req, res) => {
	try {
		const { userId } = req.params;
		const { aiEnabledByAdmin } = req.body;
		await aiManagementService.setAllUserAccountsAiByAdmin(userId, aiEnabledByAdmin, req.user.id);
		res.json({ success: true, message: 'All user accounts AI status updated by admin' });
	} catch (error) {
		console.error('[AI Management Controller] Error setting all user accounts AI by admin:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

// ===== Исключённые анкеты (aiExcludedProfileUids) =====

// Получить список исключённых анкет пользователя (только админ)
export const getExcludedProfiles = async (req, res) => {
	try {
		const { userId } = req.params;
		const user = await User.findById(userId).select('aiExcludedProfileUids').lean();
		if (!user) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}
		res.json({
			success: true,
			excludedProfileUids: Array.isArray(user.aiExcludedProfileUids)
				? user.aiExcludedProfileUids
				: [],
		});
	} catch (error) {
		console.error('[AI Management Controller] Error getting excluded profiles:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

// Обновить список исключённых анкет пользователя (только админ).
// Применяется "на горячую": AI читает список свежим из БД каждый цикл,
// перезапуск ИИ не требуется. Удаление Luxee-аккаунта безопасно —
// сироты в списке просто ни с чем не матчатся и чистятся из UI.
export const updateExcludedProfiles = async (req, res) => {
	try {
		const { userId } = req.params;
		const excludedProfileUids = sanitizeExcludedList(req.body?.excludedProfileUids);
		const user = await User.findByIdAndUpdate(
			userId,
			{ $set: { aiExcludedProfileUids: excludedProfileUids } },
			{ new: true, runValidators: true },
		).select('aiExcludedProfileUids').lean();
		if (!user) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}
		res.json({
			success: true,
			message: 'Excluded profiles updated (applies live, no AI restart needed)',
			excludedProfileUids: user.aiExcludedProfileUids || [],
		});
	} catch (error) {
		console.error('[AI Management Controller] Error updating excluded profiles:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};
