import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Кнопки навигации (Dashboard, AI Test, Spambot)
 * Без эмодзи, с подчеркиванием активной страницы
 */
const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;

  // Базовые стили для кнопок
  const baseButtonClass = "hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-medium transition-all duration-200";
  
  // Стили для неактивной кнопки
  const inactiveClass = "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600";
  
  // Стили для активной кнопки (подчеркнутая)
  const activeClass = "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 font-semibold";

  return (
    <div className="flex items-center gap-1 lg:gap-2">
      {/* Dashboard Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className={`${baseButtonClass} ${isActive('/dashboard') ? activeClass : inactiveClass}`}
      >
        Dashboard
      </button>

      {/* AI Test Button */}
      <button
        onClick={() => navigate('/ai-test')}
        className={`${baseButtonClass} ${isActive('/ai-test') ? activeClass : inactiveClass}`}
      >
        AI Test
      </button>

      {/* Spambot Button */}
      <button
        onClick={() => navigate('/spambot')}
        className={`${baseButtonClass} ${isActive('/spambot') ? activeClass : inactiveClass}`}
      >
        Spambot
      </button>
    </div>
  );
};

export default NavigationButtons;
