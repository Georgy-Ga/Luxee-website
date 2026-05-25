import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { luxeeApi } from '../api/luxeeApi';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Header from '../components/Header';
import useChatStore from '../stores/chatStore';

const Dashboard = () => {
  const selectedChat = useChatStore((state) => state.selectedChat);

  // Получаем сообщения каждые 10 секунд
  const { data: messagesData, refetch } = useQuery({
    queryKey: ['messages'],
    queryFn: luxeeApi.checkAllMessages, // Используем checkAllMessages вместо checkUnreadMessages
    refetchInterval: 10000, // 10 секунд
  });

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Сайдбар слева */}
        <Sidebar messagesData={messagesData} refetch={refetch} />
        
        {/* Окно чата справа */}
        <div className="flex-1 h-full">
          {selectedChat ? (
            <ChatWindow />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <p className="text-xl mb-2">Выберите чат</p>
                <p className="text-sm">Выберите мужчину из списка слева</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
