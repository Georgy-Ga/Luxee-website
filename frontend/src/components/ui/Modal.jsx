import PropTypes from 'prop-types';
import { useEffect } from 'react';

/**
 * Базовое модальное окно
 */
const Modal = ({ 
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  showCloseButton = true,
  ...props 
}) => {
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 lg:p-4"
      onClick={onClose}
      {...props}
    >
      <div
        className={`bg-light-bg dark:bg-dark-bg rounded-lg shadow-xl w-full ${sizeStyles[size]} max-h-[95vh] lg:max-h-[90vh] overflow-hidden flex flex-col border border-light-border dark:border-dark-border ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-3 lg:p-6 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
            {title && (
              <h2 className="text-lg lg:text-2xl font-bold text-purple dark:text-accent-light">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-purple dark:text-gray-300 dark:hover:text-accent-light text-2xl lg:text-3xl transition-colors leading-none ml-auto"
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  className: PropTypes.string,
  showCloseButton: PropTypes.bool,
};

export default Modal;
