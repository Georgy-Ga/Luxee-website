import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useChatStore from '../stores/chatStore';
import { luxeeApi } from '../api/luxeeApi';

// Функция для декодирования HTML entities
const decodeHtmlEntities = (text) => {
	if (!text) return text;
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
};

// Функция для копирования в буфер обмена (БЕЗ alert!)
const copyToClipboard = (text) => {
	navigator.clipboard.writeText(text).then(() => {
		console.log(`Скопировано: ${text}`);
	}).catch(err => {
		console.error('Ошибка копирования:', err);
	});
};

const Sidebar = ({ messagesData, refetch }) => {
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [expandedProfiles, setExpandedProfiles] = useState({});
  const [copiedId, setCopiedId] = useState(null); // Для визуального эффекта копирования
  
  const { selectedProfile, selectedChat, setSelectedProfile, setSelectedChat, aiEnabledByAccount, toggleAIForAccount, closeSidebar } = useChatStore();
  
  // Функция копирования с визуальным эффектом
  const handleCopy = (id) => {
    copyToClipboard(id.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000); // Сброс через 2 секунды
  };

  const toggleAccount = (accountId) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const toggleProfile = (profileUid) => {
    setExpandedProfiles(prev => ({ ...prev, [profileUid]: !prev[profileUid] }));
  };

  const queryClient = useQueryClient();

  const handleProfileClick = (account, profile) => {
    // Инвалидируем кэш чатов при переключении профиля
    queryClient.invalidateQueries({ queryKey: ['profileChats'] });
    
    setSelectedProfile({ ...profile, accountId: account.accountId, accountEmail: account.accountEmail });
    toggleProfile(profile.uid);
  };

  const handleChatClick = (account, profile, chat) => {
    setSelectedChat({
      ...chat,
      profileUid: profile.uid,
      profileUsername: profile.username,
      profileAvatar: profile.avatar,
      accountId: account.accountId,
      accountEmail: account.accountEmail,
    });
    // Закрываем sidebar на мобильных устройствах после выбора чата
    closeSidebar();
  };

  if (!messagesData?.accounts?.length) {
    return (
      <div className="h-full w-full border-r border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-3 lg:p-4">
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm">Нет аккаунтов</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full border-r border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-y-auto custom-scrollbar">
      <div className="p-3 lg:p-4">
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h2 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white">
            Luxee Аккаунты
          </h2>
          
          {/* Глобальная кнопка AI - управляет всеми аккаунтами сразу */}
          <button
            onClick={async () => {
              try {
                const { default: { aiApi } } = await import('../api/aiApi');
                await aiApi.toggleAllMyAccountsAi();
                // Перезагружаем данные
                await refetch();
              } catch (error) {
                alert(error.response?.data?.error || 'Ошибка при переключении AI на всех аккаунтах');
              }
            }}
            className="px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium bg-purple hover:bg-purple-600 dark:bg-accent-light dark:hover:bg-accent-light/80 text-white transition-colors flex items-center gap-1"
            title="Переключить AI на всех аккаунтах сразу"
          >
            🤖 AI: Все
          </button>
        </div>

        {messagesData.accounts.map((account) => (
          <div key={account.accountId} className="mb-3 lg:mb-4">
            {/* Аккаунт */}
            <div className="flex items-center justify-between p-2 lg:p-3 rounded-lg bg-light-bg dark:bg-dark-bg hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer transition-colors">
              <div className="flex-1 min-w-0" onClick={() => toggleAccount(account.accountId)}>
                <p className="font-medium text-gray-900 dark:text-white text-xs lg:text-sm truncate">
                  {account.accountEmail}
                </p>
                <p className="text-[10px] lg:text-xs text-gray-600 dark:text-gray-400">
                  {account.profiles?.length || 0} профилей • {account.totalUnread || 0} новых
                </p>
              </div>
              
              {/* AI Toggle для аккаунта (пользователь может выключить, но не может включить без разрешения админа) */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await toggleAIForAccount(account.accountId);
                  } catch (error) {
                    alert(error.response?.data?.error || 'Ошибка при переключении AI');
                  }
                }}
                className={`ml-1.5 lg:ml-2 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium flex-shrink-0 transition-colors ${
                  aiEnabledByAccount[account.accountId] === true
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                }`}
                title={
                  aiEnabledByAccount[account.accountId] === true 
                    ? 'AI включен. Нажмите чтобы выключить' 
                    : 'AI выключен. Включить может только админ'
                }
              >
                AI
              </button>
            </div>

            {/* Профили */}
            {expandedAccounts[account.accountId] && account.profiles?.map((profile) => (
              <ProfileItem
                key={profile.uid}
                account={account}
                profile={profile}
                isExpanded={expandedProfiles[profile.uid]}
                isSelected={selectedProfile?.uid === profile.uid}
                onProfileClick={handleProfileClick}
                onChatClick={handleChatClick}
                selectedChatId={selectedChat?.chatId}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            ))}

            {/* Сообщение если нет профилей */}
            {expandedAccounts[account.accountId] && (!account.profiles || account.profiles.length === 0) && (
              <div className="ml-3 lg:ml-4 mt-2 p-2 text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 text-center">
                Нет анкет на этом аккаунте
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Отдельный компонент для профиля с чатами
const ProfileItem = ({ account, profile, isExpanded, isSelected, onProfileClick, onChatClick, selectedChatId, copiedId, onCopy }) => {
  // ⭐ Для активного профиля чаты уже загружены, для неактивных - загружаем при клике
  const [chats, setChats] = useState(profile.chats || []);
  const [isLoading, setIsLoading] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(profile.unansweredMessages || 0);
  const hasNewMessages = profile.newMessages > 0;
  const hasChats = chats.length > 0;
  const [hasLoaded, setHasLoaded] = useState(false);

  // Загружаем чаты при раскрытии профиля с newMessages
  useEffect(() => {
    const loadChats = async () => {
      console.log(`[ProfileItem] useEffect triggered:`, {
        isExpanded,
        hasNewMessages,
        hasLoaded,
        profileUid: profile.uid,
        newMessages: profile.newMessages
      });

      // Загружаем только если есть newMessages и еще не загружали
      if (isExpanded && hasNewMessages && !hasLoaded) {
        setIsLoading(true);
        try {
          console.log(`[ProfileItem] Loading chats for profile ${profile.uid}...`);
          const result = await luxeeApi.loadProfileChats(account.accountId, profile.uid);
          console.log(`[ProfileItem] API response:`, result);
          setChats(result.chats || []);
          setUnansweredCount(result.unansweredCount || 0);
          setHasLoaded(true);
          console.log(`[ProfileItem] Loaded ${result.chats?.length || 0} chats, ${result.unansweredCount || 0} unanswered`);
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

      {/* Чаты профиля - всегда показываем если есть */}
      {isExpanded && (
        <div className="ml-4 mt-2">
          {isLoading ? (
            <div className="p-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              <div className="animate-pulse">⏳ Загрузка чатов...</div>
            </div>
          ) : hasChats ? (
            <div className="space-y-1">
              {chats.map((chat) => {
                const decodedUsername = decodeHtmlEntities(chat.memberUsername);
                return (
                  <div
                    key={chat.chatId}
                    className={`p-2 rounded cursor-pointer transition-colors text-xs ${
                      selectedChatId === chat.chatId
                        ? 'bg-purple/20 dark:bg-accent/20 border-l-2 border-purple dark:border-accent'
                        : 'bg-light-bg dark:bg-dark-bg hover:bg-light-hover dark:hover:bg-dark-hover'
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between gap-2"
                      onClick={() => onChatClick(account, profile, chat)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {decodedUsername || 'Мужчина'}
                          </p>
                          {chat.memberUid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopy(chat.memberUid);
                              }}
                              className={`px-1.5 py-0.5 rounded font-mono transition-all flex-shrink-0 ${
                                copiedId === chat.memberUid
                                  ? 'bg-green-500 dark:bg-green-600 text-white scale-105'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                              }`}
                              title="Нажмите чтобы скопировать ID"
                            >
                              {copiedId === chat.memberUid ? '✓' : chat.memberUid}
                            </button>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 truncate">
                          {chat.newMessages > 0 && `🔴 ${chat.newMessages} новых`}
                          {chat.unAnswered && ' • ⚠️ Неотвечен'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
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

export default Sidebar;
