 import { useState } from 'react';
import useChatStore from '../stores/chatStore';

const Sidebar = ({ messagesData, refetch }) => {
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [expandedProfiles, setExpandedProfiles] = useState({});
  
  const { selectedProfile, selectedChat, setSelectedProfile, setSelectedChat, aiEnabledByAccount, toggleAIForAccount } = useChatStore();

  const toggleAccount = (accountId) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const toggleProfile = (profileUid) => {
    setExpandedProfiles(prev => ({ ...prev, [profileUid]: !prev[profileUid] }));
  };

  const handleProfileClick = (account, profile) => {
    setSelectedProfile({ ...profile, accountId: account.accountId, accountEmail: account.accountEmail });
    toggleProfile(profile.uid);
  };

  const handleChatClick = (account, profile, chat) => {
    setSelectedChat({
      ...chat,
      profileUid: profile.uid,
      profileUsername: profile.username,
      accountId: account.accountId,
      accountEmail: account.accountEmail,
    });
  };

  if (!messagesData?.accounts?.length) {
    return (
      <div className="w-80 border-r border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
        <p className="text-gray-500 dark:text-gray-400 text-center">Нет аккаунтов</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-y-auto custom-scrollbar">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          Luxee Аккаунты
        </h2>

        {messagesData.accounts.map((account) => (
          <div key={account.accountId} className="mb-4">
            {/* Аккаунт */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-light-bg dark:bg-dark-bg hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer transition-colors">
              <div className="flex-1" onClick={() => toggleAccount(account.accountId)}>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {account.accountEmail}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {account.profiles?.length || 0} профилей • {account.totalUnread || 0} новых
                </p>
              </div>
              
              {/* AI Toggle для аккаунта */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAIForAccount(account.accountId);
                }}
                className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  aiEnabledByAccount[account.accountId] !== false
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                AI
              </button>
            </div>

            {/* Профили */}
            {expandedAccounts[account.accountId] && account.profiles?.map((profile) => (
              <div key={profile.uid} className="ml-4 mt-2">
                <div
                  onClick={() => handleProfileClick(account, profile)}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedProfile?.uid === profile.uid
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
                        selectedProfile?.uid === profile.uid ? 'text-white' : 'text-gray-900 dark:text-white'
                      }`}>
                        {profile.username} {profile.isActive && '⭐'}
                      </p>
                      <p className={`text-xs truncate ${
                        selectedProfile?.uid === profile.uid ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        UID: {profile.uid} • {profile.newMessages} новых • {profile.unansweredMessages} неотв.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Чаты с мужчинами (пока заглушка, т.к. нет API для получения списка чатов) */}
                {expandedProfiles[profile.uid] && profile.newMessages > 0 && (
                  <div className="ml-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <p>Список чатов будет добавлен после реализации API</p>
                  </div>
                )}
              </div>
            ))}

            {/* Сообщение если нет профилей */}
            {expandedAccounts[account.accountId] && (!account.profiles || account.profiles.length === 0) && (
              <div className="ml-4 mt-2 p-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                Нет анкет на этом аккаунте
              </div>
            )}

            {/* Сообщение если нет новых сообщений */}
            {expandedAccounts[account.accountId] && account.profiles && account.profiles.length > 0 && account.totalUnread === 0 && (
              <div className="ml-4 mt-2 p-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                Нет новых сообщений ни на одной анкете
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
