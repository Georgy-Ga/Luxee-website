import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { luxeeApi } from '../api/luxeeApi';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Header from '../components/layout/Header';
import useChatStore from '../stores/chatStore';
import { useAiSync } from '../hooks/useAiSync';
import { useAccountCreatedSync } from '../hooks/useAccountCreatedSync';

const Dashboard = () => {
  const selectedChat = useChatStore((state) => state.selectedChat);
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const closeSidebar = useChatStore((state) => state.closeSidebar);

  // Подключаем real-time синхронизацию AI статусов
  const { isSyncing } = useAiSync();

  // Подключаем real-time синхронизацию создания/удаления Luxee аккаунтов
  useAccountCreatedSync();

  // Получаем сообщения каждые 10 секунд
  const { data: messagesData, refetch } = useQuery({
    queryKey: ['messages'],
    queryFn: luxeeApi.checkAllMessages,
    refetchInterval: 10000,
  });

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      <Header />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Overlay для мобильных устройств */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={closeSidebar}
          />
        )}

        {/* Сайдбар */}
        <div
          className={`
            fixed lg:relative inset-y-0 left-0 z-30
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            w-64 sm:w-72 lg:w-80
          `}
        >
          <Sidebar messagesData={messagesData} refetch={refetch} />
        </div>
        
        {/* Окно чата */}
        <div className="flex-1 h-full">
          {selectedChat ? (
            <ChatWindow />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 p-4">
              <div className="text-center">
                <p className="text-lg lg:text-xl mb-2">Выберите чат</p>
                <p className="text-sm">Выберите мужчину из списка слева</p>
                <p className="text-xs mt-2 lg:hidden text-gray-400">
                  Нажмите ☰ для открытия меню
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
