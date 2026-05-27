import { useState } from 'react';
import useAuthStore from '../../stores/authStore';
import UsersTab from './UsersTab';
import LuxeeTab from './LuxeeTab';
import AiTab from './AiTab';

const AdminModal = ({ onClose }) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [activeTab, setActiveTab] = useState('luxee');

  const tabs = [
    { id: 'luxee', label: '🌐 Luxee аккаунты', component: LuxeeTab },
    ...(isAdmin ? [{ id: 'users', label: '👥 Пользователи', component: UsersTab }] : []),
    { id: 'ai', label: 'AI Управление', component: AiTab },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || LuxeeTab;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-light-bg dark:bg-dark-bg rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] lg:max-h-[90vh] overflow-hidden flex flex-col border border-light-border dark:border-dark-border">
        <div className="flex items-center justify-between p-3 lg:p-6 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
          <h2 className="text-lg lg:text-2xl font-bold text-purple dark:text-accent-light">
            Панель управления
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-purple dark:text-gray-300 dark:hover:text-accent-light text-2xl lg:text-3xl transition-colors leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-purple dark:text-accent-light border-b-2 border-purple dark:border-accent'
                  : 'text-gray-600 dark:text-gray-300 hover:text-purple dark:hover:text-accent-light'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-6 custom-scrollbar">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
