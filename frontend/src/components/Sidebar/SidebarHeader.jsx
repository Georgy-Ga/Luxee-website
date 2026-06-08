import PropTypes from 'prop-types';
import GlobalAIButton from './GlobalAIButton';

/**
 * Заголовок Sidebar с кнопкой глобального AI
 */
const SidebarHeader = ({ onAISuccess, onAIError }) => {
  return (
    <div className="flex items-center justify-between mb-3 lg:mb-4">
      <h2 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white">
        Luxee Аккаунты
      </h2>
      
      <GlobalAIButton
        onSuccess={onAISuccess}
        onError={onAIError}
      />
    </div>
  );
};

SidebarHeader.propTypes = {
  onAISuccess: PropTypes.func.isRequired,
  onAIError: PropTypes.func.isRequired,
};

export default SidebarHeader;
