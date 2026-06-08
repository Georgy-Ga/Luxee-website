import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { luxeeApi } from '../../api/luxeeApi';
import ChatItem from './ChatItem';
import { Spinner } from '../ui';

/**
 * Элемент профиля с чатами
 */
const ProfileItem = ({ 
  account, 
  profile, 
  isExpanded, 
  isSelected, 
  onProfileClick, 
  onChatClick, 
  selectedChatId, 
  copiedId, 
  onCopy 
}) => {
  const [chats, setChats] = useState(profile.chats || []);
  const [isLoading, setIsLoading] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(profile.unansweredMessages || 0);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const hasNewMessages = profile.newMessages > 0;
  const hasChats = chats.length > 0;

  // Загружаем чаты при раскрытии профиля с newMessages
  useEffect(() => {
    const loadChats = async () => {
      if (isExpanded && hasNewMessages && !hasLoaded) {
        setIsLoading(true);
        try {
          const result = await luxeeApi.loadProfileChats(account.accountId, profile.uid);
          setChats(result.chats || []);
          setUnansweredCount(result.unansweredCount || 0);
          setHasLoaded(true);
        } catch (error) {
          console.error('[ProfileItem] Error loading profile chats:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadChats();
  }, [isExpanded, hasNewMessages, account.accountId, profile.uid, hasLoaded]);

  // Обновляем чаты если profile.chats изменился (для активного профиля)
  useEffect(() => {
    if (profile.chats && profile.chats.length > 0) {
      setChats(profile.chats);
      setUnansweredCount(profile.unansweredMessages || 0);
    }
  }, [profile.chats, profile.unansweredMessages]);

  return (
    <div className="ml-4 mt-2">
      <div
        onClick={() => onProfileClick(account, profile)}
        className={`p-2 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-purple dark:bg-accent text-white'
            : 'bg-light-surface dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover'
        }`}
      >
        <div className="flex items-center gap-2">
          {profile.avatar && (
            <img src={profile.avatar} alt={profile.username} className="w-8 h-8 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm truncate ${
              isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
            }`}>
              {profile.username} {profile.isActive && '⭐'}
            </p>
            <p className={`text-xs truncate ${
              isSelected ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
            }`}>
              UID: {profile.uid} • {profile.newMessages} новых • {unansweredCount} неотв.
            </p>
          </div>
        </div>
      </div>

      {/* Чаты профиля */}
      {isExpanded && (
        <div className="ml-4 mt-2">
          {isLoading ? (
            <div className="p-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              <Spinner size="sm" text="Загрузка чатов..." />
            </div>
          ) : hasChats ? (
            <div className="space-y-1">
              {chats.map((chat) => (
                <ChatItem
                  key={chat.chatId}
                  chat={chat}
                  isSelected={selectedChatId === chat.chatId}
                  onClick={() => onChatClick(account, profile, chat)}
                  copiedId={copiedId}
                  onCopy={onCopy}
                />
              ))}
            </div>
          ) : (
            <div className="p-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              Нет новых сообщений
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ProfileItem.propTypes = {
  account: PropTypes.shape({
    accountId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    accountEmail: PropTypes.string.isRequired,
  }).isRequired,
  profile: PropTypes.shape({
    uid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    username: PropTypes.string.isRequired,
    avatar: PropTypes.string,
    isActive: PropTypes.bool,
    newMessages: PropTypes.number,
    unansweredMessages: PropTypes.number,
    chats: PropTypes.array,
  }).isRequired,
  isExpanded: PropTypes.bool,
  isSelected: PropTypes.bool,
  onProfileClick: PropTypes.func.isRequired,
  onChatClick: PropTypes.func.isRequired,
  selectedChatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  copiedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCopy: PropTypes.func.isRequired,
};

export default ProfileItem;
