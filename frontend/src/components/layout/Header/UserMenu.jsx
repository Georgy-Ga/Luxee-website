import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../api/authApi';
import useAuthStore from '../../../stores/authStore';
import useThemeStore from '../../../stores/themeStore';

/**
 * Меню пользователя (Settings, Theme, Logout)
 */
const UserMenu = ({ onOpenSettings }) => {
  const navigate = useNavigate();
  const { logout: logoutStore } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

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
      {/* Settings Button */}
      <button
        onClick={onOpenSettings}
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
    </>
  );
};

UserMenu.propTypes = {
  onOpenSettings: PropTypes.func.isRequired,
};

export default UserMenu;
