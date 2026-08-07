import { useState } from 'react';
import useAuthStore from '../../stores/authStore';
import UsersTab from './UsersTab';
import LuxeeTab from './LuxeeTab';
import AiTab from './AiTab';
import BlacklistTab from './BlacklistTab';

const AdminModal = ({ onClose }) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState('luxee');

  const tabs = [
    { 
      id: 'luxee', 
      label: '🌐 Luxee аккаунты',
      shortLabel: 'Luxee',
      component: LuxeeTab 
    },
    ...(isAdmin ? [{ 
      id: 'users', 
      label: '👥 Пользователи',
      shortLabel: 'Юзеры',
      component: UsersTab 
    }] : []),
    ...(isAdmin ? [{ 
      id: 'ai', 
      label: 'AI Управление',
      shortLabel: 'AI',
      component: AiTab 
    }] : []),
    ...(isAdmin ? [{ 
      id: 'blacklist', 
      label: '🚫 Черные списки',
      shortLabel: 'ЧС',
      component: BlacklistTab 
    }] : []),
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || LuxeeTab;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-2 lg:p-4">
      <div className="bg-light-bg dark:bg-dark-bg rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] lg:max-h-[90vh] overflow-hidden flex flex-col border-0 sm:border border-light-border dark:border-dark-border">
        {/* Header - фиксированный */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface flex-shrink-0">
          <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-purple dark:text-accent-light">
            Панель управления
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-purple dark:text-gray-300 dark:hover:text-accent-light text-3xl sm:text-2xl lg:text-3xl transition-colors leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            type="button"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Tabs - фиксированные с горизонтальным скроллом */}
        <div className="flex border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-x-auto tabs-container flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`flex-shrink-0 px-3 sm:px-4 lg:px-5 py-2.5 sm:py-2 lg:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] sm:min-h-[40px] ${
                activeTab === tab.id
                  ? 'text-purple dark:text-accent-light border-b-2 border-purple dark:border-accent bg-purple-50 dark:bg-purple-900/10'
                  : 'text-gray-600 dark:text-gray-300 hover:text-purple dark:hover:text-accent-light hover:bg-light-hover dark:hover:bg-dark-hover'
              }`}
            >
              {/* Короткие названия на мобильных, полные на планшетах+ */}
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content - скроллящийся контент */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 custom-scrollbar">
          <div className="animate-fade-in">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
