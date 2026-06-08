import { useState, useEffect, useCallback } from 'react';
import { aiApi } from '../../../api/aiApi';
import useChatStore from '../../../stores/chatStore';

/**
 * Hook для управления AI статусом пользователей и аккаунтов
 * Содержит всю бизнес-логику управления AI
 */
export const useAiManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Используем lazy initialization для Set объектов
  const [processingUsers, setProcessingUsers] = useState(() => new Set());
  const [processingAccounts, setProcessingAccounts] = useState(() => new Set());
  
  const { setAIForAccount } = useChatStore();

  // Загрузка данных
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await aiApi.getAllUsersAiStatus();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load AI status:', error);
      setError('Не удалось загрузить данные AI. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Определяем состояние всех аккаунтов пользователя
  const getAccountsStatus = useCallback((accounts) => {
    if (!accounts || accounts.length === 0) return 'none';
    
    const enabledCount = accounts.filter(acc => acc.aiEnabledByAdmin).length;
    
    if (enabledCount === accounts.length) return 'all';
    if (enabledCount === 0) return 'none';
    return 'partial';
  }, []);

  // Переключение AI для всех аккаунтов пользователя
  const toggleAllAccounts = useCallback(async (userId, accounts) => {
    if (processingUsers.has(userId)) return false;
    
    try {
      setProcessingUsers(prev => new Set(prev).add(userId));
      setError(null);
      
      const status = getAccountsStatus(accounts);
      const newStatus = status === 'all' ? false : true;
      
      await aiApi.setAllUserAccountsAiByAdmin(userId, newStatus);
      await loadData();
      
      // Синхронизация с chatStore
      accounts.forEach(account => {
        setAIForAccount(account._id, newStatus);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to toggle all accounts AI:', error);
      const action = getAccountsStatus(accounts) === 'all' ? 'выключить' : 'включить';
      setError(`Не удалось ${action} AI для всех аккаунтов. ${error.response?.data?.error || error.message}`);
      return false;
    } finally {
      setProcessingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [processingUsers, getAccountsStatus, loadData, setAIForAccount]);

  // Переключение AI для одного аккаунта
  const toggleAccountAi = useCallback(async (accountId, currentStatus) => {
    if (processingAccounts.has(accountId)) return false;
    
    try {
      setProcessingAccounts(prev => new Set(prev).add(accountId));
      setError(null);
      
      const newStatus = !currentStatus;
      await aiApi.setAccountAiByAdmin(accountId, newStatus);
      await loadData();
      
      // Синхронизация с chatStore
      setAIForAccount(accountId, newStatus);
      
      return true;
    } catch (error) {
      console.error('Failed to toggle account AI:', error);
      const action = currentStatus ? 'выключить' : 'включить';
      setError(`Не удалось ${action} AI для аккаунта. ${error.response?.data?.error || error.message}`);
      return false;
    } finally {
      setProcessingAccounts(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  }, [processingAccounts, loadData, setAIForAccount]);

  const clearError = useCallback(() => setError(null), []);

  return {
    users,
    loading,
    error,
    processingUsers,
    processingAccounts,
    loadData,
    getAccountsStatus,
    toggleAllAccounts,
    toggleAccountAi,
    clearError,
  };
};

export default useAiManagement;
