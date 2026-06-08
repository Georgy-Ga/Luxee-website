import PropTypes from 'prop-types';

/**
 * Компонент для отображения сообщений (успех, ошибка, предупреждение, информация)
 */
const Alert = ({ 
  type = 'info',
  message,
  onClose,
  className = '',
  ...props 
}) => {
  const typeStyles = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-200',
      icon: '✅',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: '❌',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: '⚠️',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      icon: 'ℹ️',
    },
  };

  const style = typeStyles[type];

  return (
    <div
      className={`p-3 rounded-lg border ${style.bg} ${className}`}
      {...props}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{style.icon}</span>
        <div className="flex-1">
          <p className={`text-sm ${style.text}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`${style.text} hover:opacity-70 transition-opacity flex-shrink-0`}
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

Alert.propTypes = {
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

export default Alert;
