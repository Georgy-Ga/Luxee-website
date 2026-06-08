import PropTypes from 'prop-types';

/**
 * Универсальный компонент Textarea с label и обработкой ошибок
 */
const Textarea = ({
  label,
  value,
  onChange,
  placeholder = '',
  error = '',
  disabled = false,
  required = false,
  rows = 3,
  className = '',
  id,
  ...props
}) => {
  const textareaId = id || `textarea-${label?.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white transition-colors resize-none
          ${error 
            ? 'border-red-500 dark:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 dark:border-gray-600 focus:ring-purple dark:focus:ring-accent'
          }
          focus:outline-none focus:ring-2
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

Textarea.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  rows: PropTypes.number,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default Textarea;
