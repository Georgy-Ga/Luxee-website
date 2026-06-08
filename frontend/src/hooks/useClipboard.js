import { useState } from 'react';

/**
 * Hook для копирования в буфер обмена с визуальной обратной связью
 */
export const useClipboard = (resetDelay = 2000) => {
  const [copiedId, setCopiedId] = useState(null);

  const copy = async (text, id = null) => {
    try {
      await navigator.clipboard.writeText(text.toString());
      setCopiedId(id || text);
      
      setTimeout(() => {
        setCopiedId(null);
      }, resetDelay);

      return true;
    } catch (err) {
      console.error('Ошибка копирования:', err);
      return false;
    }
  };

  return { copy, copiedId, isCopied: (id) => copiedId === id };
};

export default useClipboard;
