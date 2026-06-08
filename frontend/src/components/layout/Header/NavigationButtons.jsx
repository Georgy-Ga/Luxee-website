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

  return (
    <>
      {/* AI Test Button - показываем когда НЕ на странице AI Test */}
      {!isAiTestPage && (
        <button
          onClick={() => navigate('/ai-test')}
          className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
        >
          AI Test
        </button>
      )}

      {/* Dashboard Button - показываем когда НЕ на Dashboard */}
      {!isDashboardPage && (
        <button
          onClick={() => navigate('/dashboard')}
          className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          📊 Dashboard
        </button>
      )}
    </>
  );
};

export default NavigationButtons;
