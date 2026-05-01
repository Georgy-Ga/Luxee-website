import { useState } from 'react';
import useChatStore from '../stores/chatStore';

const ChatWindow = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const selectedChat = useChatStore((state) => state.selectedChat);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      // TODO: Реализовать отправку сообщения через API
      console.log('Sending message:', {
        accountId: selectedChat.accountId,
        profileUid: selectedChat.profileUid,
        chatId: selectedChat.chatId,
        message,
      });
      
      // Очищаем поле после отправки
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedChat) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-dark-bg">
      {/* Заголовок чата */}
      <div className="h-16 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-6 flex items-center">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">
            {selectedChat.username || 'Мужчина'} (UID: {selectedChat.uid || 'N/A'})
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Профиль: {selectedChat.profileUsername} • Аккаунт: {selectedChat.accountEmail}
          </p>
        </div>
      </div>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Заглушка - показываем что здесь будут сообщения */}
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2">💬 Окно чата</p>
            <p className="text-sm">Здесь будут отображаться только новые сообщения от мужчины</p>
            <p className="text-xs mt-4">API для получения сообщений будет добавлено позже</p>
          </div>

          {/* Пример сообщения от мужчины */}
          <div className="flex justify-start">
            <div className="max-w-[70%] p-4 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {selectedChat.username || 'Мужчина'}
              </p>
              <p className="text-gray-800 dark:text-gray-200">
                Привет! Как дела? (Пример нового сообщения)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Только что
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Поле ввода */}
      <div className="border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Напишите сообщение... (Enter для отправки)"
            className="flex-1 input-field resize-none"
            rows="3"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="btn-primary self-end"
          >
            {isSending ? '⏳' : '📤'} Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
