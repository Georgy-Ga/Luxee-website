import PropTypes from 'prop-types';

/**
 * Компонент переключателя (toggle switch)
 */
const Toggle = ({ 
  enabled,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className = '',
  ...props 
}) => {
  const sizeStyles = {
    sm: {
      container: 'w-8 h-5',
      circle: 'w-3 h-3',
      translate: enabled ? 'translate-x-3' : 'translate-x-1',
    },
    md: {
      container: 'w-11 h-6',
      circle: 'w-4 h-4',
      translate: enabled ? 'translate-x-5' : 'translate-x-1',
    },
    lg: {
      container: 'w-14 h-7',
      circle: 'w-5 h-5',
      translate: enabled ? 'translate-x-7' : 'translate-x-1',
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`
          relative inline-flex items-center rounded-full transition-colors
          ${currentSize.container}
          ${enabled 
            ? 'bg-green-500 dark:bg-green-600' 
            : 'bg-gray-300 dark:bg-gray-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        {...props}
      >
        <span
          className={`
            ${currentSize.circle}
            ${currentSize.translate}
            inline-block rounded-full bg-white transition-transform
          `}
        />
      </button>
      {label && (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
    </div>
  );
};

Toggle.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

export default Toggle;
