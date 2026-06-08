import PropTypes from 'prop-types';

/**
 * Компонент индикатора загрузки
 */
const Spinner = ({ 
  size = 'md',
  className = '',
  text = '',
  ...props 
}) => {
  const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`} {...props}>
      <div
        className={`${sizeStyles[size]} border-purple dark:border-accent border-t-transparent rounded-full animate-spin`}
      />
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  text: PropTypes.string,
};

export default Spinner;
