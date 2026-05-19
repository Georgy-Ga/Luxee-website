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
    { id: 'ai', label: '🤖 AI Управление', component: AiTab },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || LuxeeTab;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Панель управления
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
