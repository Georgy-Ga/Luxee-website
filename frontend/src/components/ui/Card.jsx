import PropTypes from 'prop-types';

/**
 * Универсальный компонент Card для контента
 */
const Card = ({ 
  children, 
  className = '', 
  padding = 'md',
  ...props 
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-2 lg:p-3',
    md: 'p-3 lg:p-4',
    lg: 'p-4 lg:p-6',
  };

  return (
    <div
      className={`bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
};

export default Card;
