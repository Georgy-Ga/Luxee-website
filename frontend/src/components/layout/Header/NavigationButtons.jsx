import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Кнопки навигации (AI Test, Dashboard)
 */
const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAiTestPage = location.pathname === '/ai-test';
  const isDashboardPage = location.pathname === '/dashboard';
  const isDistributionsPage = location.pathname === '/distributions';

  console.log('[NavigationButtons] 📍 Current path:', location.pathname);
  console.log('[NavigationButtons] 📍 isDistributionsPage:', isDistributionsPage);

  return (
    <>
      {/* AI Test Button */}
      {!isAiTestPage && (
        <button
          onClick={() => navigate('/ai-test')}
          className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
        >
          AI Test
        </button>
      )}

      {/* Dashboard Button */}
      {!isDashboardPage && (
        <button
          onClick={() => navigate('/dashboard')}
          className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          📊 Dashboard
        </button>
      )}

      {/* Distributions Button - ВСЕГДА показываем, но с разными стилями */}
      <button
        onClick={() => navigate('/distributions')}
        className={`hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium transition-colors ${
          isDistributionsPage
            ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white ring-2 ring-green-300 dark:ring-green-700'
            : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white'
        }`}
      >
        📢 Рассылки
      </button>
    </>
  );
};

export default NavigationButtons;
