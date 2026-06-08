import PropTypes from 'prop-types';

/**
 * Кнопка с иконкой (квадратная или круглая)
 */
const IconButton = ({
  icon,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  className = '',
  title = '',
  rounded = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-purple hover:bg-purple-600 dark:bg-accent dark:hover:bg-accent-light text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover text-gray-900 dark:text-white',
  };

  const sizeStyles = {
    sm: 'p-1 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg',
  };

  const roundedStyle = rounded ? 'rounded-full' : 'rounded-lg';

  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyle} ${className}`;

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      {...props}
    >
      {icon}
    </button>
  );
};

IconButton.propTypes = {
  icon: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  title: PropTypes.string,
  rounded: PropTypes.bool,
};

export default IconButton;
