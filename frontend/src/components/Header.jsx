import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';
import useChatStore from '../stores/chatStore';
import AdminModal from './AdminModal';

const Header = () => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const navigate = useNavigate();
  
  const { user, logout: logoutStore } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { aiEnabled, toggleAI } = useChatStore();

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
      <header className="h-16 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Model Chat Manager
          </h1>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user?.email}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Test Button */}
          <button
            onClick={() => navigate('/ai-test')}
            className="px-4 py-2 rounded-lg font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
          >
            AI Test
          </button>

          {/* Dashboard Button (when on AI Test page) */}
          {window.location.pathname === '/ai-test' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              📊 Dashboard
            </button>
          )}

          {/* AI Toggle */}
          <button
            onClick={toggleAI}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              aiEnabled
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            AI: {aiEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowAdminModal(true)}
            className="btn-secondary"
          >
            ⚙️ Настройки
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn-secondary"
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn-secondary"
          >
            Выход
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
