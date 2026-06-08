import { useState } from 'react';
import useAuthStore from '../../../stores/authStore';
import AdminModal from '../../AdminModal';
import MobileMenuButton from './MobileMenuButton';
import NavigationButtons from './NavigationButtons';
import AIToggleButton from './AIToggleButton';
import UserMenu from './UserMenu';

/**
 * Главный хедер приложения
 * Содержит навигацию, кнопки управления и меню пользователя
 */
const Header = () => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { user } = useAuthStore();

  return (
    <>
      <header className="h-14 lg:h-16 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-3 lg:px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-2 lg:gap-4">
          <MobileMenuButton />
          
          <h1 className="text-base lg:text-xl font-bold text-gray-900 dark:text-white truncate">
            Model Chat Manager
          </h1>
          
          <span className="hidden md:inline text-xs lg:text-sm text-gray-600 dark:text-gray-400 truncate">
            {user?.email}
          </span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 lg:gap-3">
          <NavigationButtons />
          <AIToggleButton />
          <UserMenu onOpenSettings={() => setShowAdminModal(true)} />
        </div>
      </header>

      {/* Settings Modal */}
      {showAdminModal && (
        <AdminModal onClose={() => setShowAdminModal(false)} />
      )}
    </>
  );
};

export default Header;
