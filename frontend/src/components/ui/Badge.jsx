import PropTypes from 'prop-types';

/**
 * Компонент Badge для отображения статусов и меток
 */
const Badge = ({ 
  children, 
  variant = 'default',
  size = 'md',
  className = '',
  ...props 
}) => {
  const variantStyles = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    primary: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    success: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    danger: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    info: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs lg:text-sm',
    lg: 'px-3 py-1 text-sm lg:text-base',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'danger', 'warning', 'info']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

export default Badge;
