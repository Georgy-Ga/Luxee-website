import PropTypes from 'prop-types';

/**
 * Универсальная кнопка с различными вариантами стилей
 * @param {string} variant - Вариант стиля: 'primary', 'secondary', 'danger', 'success', 'ghost'
 * @param {string} size - Размер: 'sm', 'md', 'lg'
 * @param {boolean} disabled - Отключена ли кнопка
 * @param {boolean} loading - Показывать индикатор загрузки
 * @param {boolean} fullWidth - Кнопка на всю ширину
 * @param {string} className - Дополнительные CSS классы
 * @param {function} onClick - Обработчик клика
 * @param {node} children - Содержимое кнопки
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  onClick,
  type = 'button',
  children,
  ...props
}) => {
  const baseStyles = 'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  const variantStyles = {
    primary: 'bg-purple hover:bg-purple-600 dark:bg-accent dark:hover:bg-accent-light text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    ghost: 'bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover text-gray-900 dark:text-white',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs lg:text-sm',
    md: 'px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base',
    lg: 'px-4 lg:px-6 py-2 lg:py-3 text-base lg:text-lg',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  type: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default Button;
