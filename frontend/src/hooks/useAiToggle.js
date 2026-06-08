import { useState } from 'react';
import { aiApi } from '../api/aiApi';
import useChatStore from '../stores/chatStore';
import useAuthStore from '../stores/authStore';

/**
 * Hook для управления переключением AI
 */
export const useAiToggle = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { aiEnabled, aiEnabledByAdmin, setAIStatus } = useChatStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const toggleMyAi = async () => {
    // Проверка прав
    if (!aiEnabled && !aiEnabledByAdmin && !isAdmin) {
      setError('AI отключен администратором');
      return false;
    }
    
    if (!aiEnabled && !isAdmin) {
      setError('Только администратор может включить AI');
      return false;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const newState = !aiEnabled;
      const result = await aiApi.toggleMyAi(newState);
      setAIStatus(result.aiEnabled, result.aiEnabledByAdmin);
      return true;
    } catch (err) {
      console.error('Error toggling AI:', err);
      setError('Ошибка при переключении AI');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    aiEnabled,
    aiEnabledByAdmin,
    isAdmin,
    isLoading,
    error,
    toggleMyAi,
  };
};

export default useAiToggle;
