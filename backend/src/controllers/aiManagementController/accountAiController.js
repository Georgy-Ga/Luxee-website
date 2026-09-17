// Контроллер управления AI для аккаунтов

import aiManagementService from '../../services/aiManagementService/index.js';

export const getAccountAiStatus = async (req, res) => {
	try {
		const { userId, accountId } = req.params;
		const status = await aiManagementService.getAccountAiStatus(userId, accountId);
		res.json({ success: true, ...status });
	} catch (error) {
		console.error('[AI Management Controller] Error getting account AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const enableAccountAi = async (req, res) => {
	try {
		const { userId, accountId } = req.params;
		await aiManagementService.enableAccountAi(userId, accountId, req.user.id);
		res.json({ success: true, message: 'AI enabled for account' });
	} catch (error) {
		console.error('[AI Management Controller] Error enabling account AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const disableAccountAi = async (req, res) => {
	try {
		const { userId, accountId } = req.params;
		await aiManagementService.disableAccountAi(userId, accountId, req.user.id);
		res.json({ success: true, message: 'AI disabled for account' });
	} catch (error) {
		console.error('[AI Management Controller] Error disabling account AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getUserAccountsAiStatus = async (req, res) => {
	try {
		const { userId } = req.params;
		const accounts = await aiManagementService.getUserAccountsAiStatus(userId);
		res.json({ success: true, accounts });
	} catch (error) {
		console.error('[AI Management Controller] Error getting user accounts AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getAllAccountsAiStatus = async (req, res) => {
	try {
		const accounts = await aiManagementService.getAllAccountsAiStatus();
		res.json({ success: true, accounts });
	} catch (error) {
		console.error('[AI Management Controller] Error getting all accounts AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const getMyAccountsAiStatus = async (req, res) => {
	try {
		const accounts = await aiManagementService.getUserAccountsAiStatus(req.user.id);
		res.json({ success: true, accounts });
	} catch (error) {
		console.error('[AI Management Controller] Error getting my accounts AI status:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const setAccountAiByAdmin = async (req, res) => {
	try {
		const { accountId } = req.params;
		const { aiEnabledByAdmin } = req.body;
		await aiManagementService.setAccountAiByAdmin(accountId, aiEnabledByAdmin, req.user.id);
		res.json({ success: true, message: 'Account AI status updated by admin' });
	} catch (error) {
		console.error('[AI Management Controller] Error setting account AI by admin:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const toggleMyAccountAi = async (req, res) => {
	try {
		const { accountId } = req.params;
		const result = await aiManagementService.toggleAccountAi(req.user.id, accountId);
		res.json({ success: true, ...result });
	} catch (error) {
		console.error('[AI Management Controller] Error toggling my account AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const toggleAllMyAccountsAi = async (req, res) => {
	try {
		const result = await aiManagementService.toggleAllMyAccountsAi(req.user.id);
		res.json({ success: true, ...result });
	} catch (error) {
		console.error('[AI Management Controller] Error toggling all my accounts AI:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

const DEFAULT_SECTIONS = {
	newMessages: true,
	catchUp: true,
	activityCenter: true,
};

const readSections = account => ({
	...DEFAULT_SECTIONS,
	...(account.aiSections?.toObject?.() || account.aiSections || {}),
});

export const getAccountSections = async (req, res) => {
	try {
		const { accountId } = req.params;
		const LuxeeAccount = (await import('../../models/LuxeeAccountModel.js')).default;
		const account = await LuxeeAccount.findById(accountId);
		if (!account) {
			return res.status(404).json({ success: false, error: 'Account not found' });
		}
		res.json({ success: true, sections: readSections(account) });
	} catch (error) {
		console.error('[AI Management Controller] Error getting account sections:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

export const updateAccountSections = async (req, res) => {
	try {
		const { accountId } = req.params;
		const { sections } = req.body;
		const LuxeeAccount = (await import('../../models/LuxeeAccountModel.js')).default;
		const account = await LuxeeAccount.findById(accountId);
		if (!account) {
			return res.status(404).json({ success: false, error: 'Account not found' });
		}
		const current = readSections(account);
		account.aiSections = {
			newMessages:
				sections?.newMessages !== undefined
					? !!sections.newMessages
					: current.newMessages,
			catchUp:
				sections?.catchUp !== undefined ? !!sections.catchUp : current.catchUp,
			activityCenter:
				sections?.activityCenter !== undefined
					? !!sections.activityCenter
					: current.activityCenter,
		};
		await account.save();
		console.log(`[AI Management Controller] ✅ Sections updated for account ${accountId}:`, account.aiSections.toObject?.() || account.aiSections);
		res.json({ success: true, sections: readSections(account) });
	} catch (error) {
		console.error('[AI Management Controller] Error updating account sections:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};
