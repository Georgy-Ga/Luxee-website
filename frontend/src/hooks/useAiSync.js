/**
 * Hook для синхронизации AI статусов через WebSocket
 * Слушает события от сервера и обновляет локальное состояние
 */

import { useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import useChatStore from '../stores/chatStore';

/**
 * Hook для синхронизации AI статусов в реальном времени
 * Автоматически подписывается на события при подключении Socket
 */
export const useAiSync = () => {
	const { socket, isConnected } = useSocket();
	const { updateAccountAIStatus, setAIStatus } = useChatStore();

	/**
	 * Обработчик события изменения AI статуса
	 */
	const handleAiStatusChanged = useCallback((data) => {
		console.log('[AI Sync] Received AI status change:', data);

		const { type, accountId, userId, aiEnabled, aiEnabledByAdmin, accounts, changedBy } = data;

		if (type === 'bulk') {
			// Массовое изменение - обновляем все аккаунты
			if (Array.isArray(accounts)) {
				accounts.forEach(account => {
					updateAccountAIStatus(
						account.accountId,
						account.aiEnabled,
						account.aiEnabledByAdmin
					);
				});
				console.log(`[AI Sync] ✓ Updated ${accounts.length} accounts (bulk change by ${changedBy})`);
			}
		} else if (type === 'account' && accountId) {
			// Изменение одного аккаунта
			updateAccountAIStatus(accountId, aiEnabled, aiEnabledByAdmin);
			console.log(`[AI Sync] ✓ Updated account ${accountId} (changed by ${changedBy})`);
		} else if (type === 'user' && userId) {
			// Изменение на уровне пользователя (глобальный AI)
			setAIStatus(aiEnabled, aiEnabledByAdmin);
			console.log(`[AI Sync] ✓ Updated user AI status (changed by ${changedBy})`);
		}
	}, [updateAccountAIStatus, setAIStatus]);

	/**
	 * Подписка на Socket события
	 */
	useEffect(() => {
		if (!socket || !isConnected) {
			console.log('[AI Sync] Socket not connected, skipping event subscription');
			return;
		}

		console.log('[AI Sync] ✓ Subscribing to AI status events');

		// Подписываемся на событие изменения AI статуса
		socket.on('ai:status:changed', handleAiStatusChanged);

		// Cleanup при размонтировании
		return () => {
			console.log('[AI Sync] Unsubscribing from AI status events');
			socket.off('ai:status:changed', handleAiStatusChanged);
		};
	}, [socket, isConnected, handleAiStatusChanged]);

	return {
		isConnected,
		isSyncing: isConnected,
	};
};

export default useAiSync;
