/**
 * Переиспользуемый компонент кнопки
 */
const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false, 
  loading = false,
  onClick, 
  type = 'button',
  className = '',
  ...props 
}) => {
  const baseStyles = 'font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-purple hover:bg-purple-600 dark:bg-accent-light dark:hover:bg-accent-light/80 text-white',
    secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border-2 border-purple dark:border-accent text-purple dark:text-accent hover:bg-purple/10 dark:hover:bg-accent/10'
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <span className="animate-spin">⏳</span>}
      {children}
    </button>
  );
};

export default Button;
