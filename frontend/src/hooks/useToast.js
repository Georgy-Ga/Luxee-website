import { useState, useCallback, useEffect } from 'react';

/**
 * Hook для управления toast-уведомлениями
 * Использование:
 * const { toast, showToast, ToastContainer } = useToast();
 * showToast('Успешно!', 'success');
 * return <><ToastContainer />{...}</>
 */
export const useToast = () => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastContainer = useCallback(() => {
    if (!toast) return null;

    return (
      <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
        <div className={`${getTypeStyles(toast.type)} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
          <span className="text-xl">{getIcon(toast.type)}</span>
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            onClick={hideToast}
            className="text-white hover:text-gray-200 transition-colors ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }, [toast, hideToast]);

  // Auto-hide toast using useEffect
  useEffect(() => {
    if (toast && toast.duration > 0) {
      const timer = setTimeout(hideToast, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  return { toast, showToast, hideToast, ToastContainer };
};

const getTypeStyles = (type) => {
  const styles = {
    success: 'bg-green-500 dark:bg-green-600',
    error: 'bg-red-500 dark:bg-red-600',
    info: 'bg-blue-500 dark:bg-blue-600',
    warning: 'bg-yellow-500 dark:bg-yellow-600'
  };
  return styles[type] || styles.info;
};

const getIcon = (type) => {
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };
  return icons[type] || icons.info;
};
