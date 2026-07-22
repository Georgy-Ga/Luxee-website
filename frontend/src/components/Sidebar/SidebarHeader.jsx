import PropTypes from 'prop-types';
import GlobalAIButton from './GlobalAIButton';
import { useLuxeeOnlineStatus } from '../../hooks/useLuxeeOnlineStatus';

/**
 * Заголовок Sidebar с кнопкой глобального AI и онлайн статусом
 */
const SidebarHeader = ({ onAISuccess, onAIError }) => {
  const { isOnline, loading } = useLuxeeOnlineStatus();

  return (
    <div className="flex items-center justify-between mb-3 lg:mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white">
          Luxee Аккаунты
        </h2>
        
        {/* Онлайн статус */}
        {!loading && (
          <div className="flex items-center gap-1.5" title={isOnline ? 'Аккаунты онлайн' : 'Аккаунты оффлайн'}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </div>
      
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
