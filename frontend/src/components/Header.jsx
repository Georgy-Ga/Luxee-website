import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { aiApi } from '../api/aiApi';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';
import useChatStore from '../stores/chatStore';
import AdminModal from './AdminModal';

const Header = () => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const navigate = useNavigate();
  
  const { user, logout: logoutStore } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { aiEnabled, aiEnabledByAdmin, setAIStatus, sidebarOpen, toggleSidebar } = useChatStore();
  
  const isAdmin = user?.role === 'admin';
  
  const handleAIToggle = async () => {
    // Пользователь не может включить AI если админ не разрешил
    if (!aiEnabled && !aiEnabledByAdmin && !isAdmin) {
      alert('AI отключен администратором. Обратитесь к администратору для включения.');
      return;
    }
    
    // Обычный пользователь может только выключить AI
    if (!aiEnabled && !isAdmin) {
      alert('Только администратор может включить AI');
      return;
    }
    
    try {
      const newState = !aiEnabled;
      
      // Сохраняем на сервере
      const result = await aiApi.toggleMyAi(newState);
      
      // Обновляем локально используя РЕАЛЬНЫЕ данные от backend
      setAIStatus(result.aiEnabled, result.aiEnabledByAdmin);
    } catch (error) {
      console.error('Error toggling AI:', error);
      alert('Ошибка при переключении AI');
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logoutStore();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      <header className="h-14 lg:h-16 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-3 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-base lg:text-xl font-bold text-gray-900 dark:text-white truncate">
            Model Chat Manager
          </h1>
          <span className="hidden md:inline text-xs lg:text-sm text-gray-600 dark:text-gray-400 truncate">
            {user?.email}
          </span>
        </div>

        <div className="flex items-center gap-1.5 lg:gap-3">
          {/* AI Test Button */}
          <button
            onClick={() => navigate('/ai-test')}
            className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
          >
            AI Test
          </button>

          {/* Dashboard Button (when on AI Test page) */}
          {window.location.pathname === '/ai-test' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden sm:block px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              📊 Dashboard
            </button>
          )}

          {/* AI Toggle */}
          <button
            onClick={handleAIToggle}
            className={`px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-lg font-medium transition-colors ${
              aiEnabled
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={`AI: ${aiEnabled ? 'ON' : 'OFF'}${!isAdmin && !aiEnabledByAdmin ? ' (Only admin can enable)' : ''}`}
          >
            <span className="hidden sm:inline">AI: {aiEnabled ? 'ON' : 'OFF'}</span>
            <span className="sm:hidden">{aiEnabled ? '🤖' : '🚫'}</span>
          </button>

          {/* Settings Button - For all users */}
          <button
            onClick={() => setShowAdminModal(true)}
            className="btn-secondary text-xs lg:text-sm px-2 lg:px-3 py-1.5 lg:py-2"
            title="Настройки"
          >
            <span className="hidden sm:inline">⚙️ Настройки</span>
            <span className="sm:hidden">⚙️</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn-secondary text-xs lg:text-sm px-2 lg:px-3 py-1.5 lg:py-2"
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn-secondary text-xs lg:text-sm px-2 lg:px-3 py-1.5 lg:py-2"
            title="Выход"
          >
            <span className="hidden sm:inline">Выход</span>
            <span className="sm:hidden">🚪</span>
          </button>
        </div>
      </header>

      {showAdminModal && (
        <AdminModal onClose={() => setShowAdminModal(false)} />
      )}
    </>
  );
};

export default Header;
