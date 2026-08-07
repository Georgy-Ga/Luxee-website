import PropTypes from 'prop-types';
import useChatStore from '../../../stores/chatStore';

/**
 * Кнопка мобильного меню для открытия Sidebar
 */
const MobileMenuButton = () => {
  const { toggleSidebar } = useChatStore();

  return (
    <button
      onClick={toggleSidebar}
      className="lg:hidden p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center relative z-50"
      aria-label="Toggle sidebar"
      type="button"
    >
      <svg className="w-6 h-6 text-gray-900 dark:text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
};

export default MobileMenuButton;
