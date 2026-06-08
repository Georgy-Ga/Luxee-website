import { useQueryClient } from '@tanstack/react-query';
import useChatStore from '../../stores/chatStore';
import { useToast } from '../../hooks/useToast';
import { useClipboard } from '../../hooks/useClipboard';
import { useAccordion } from '../../hooks/useAccordion';
import SidebarHeader from './SidebarHeader';
import AccountItem from './AccountItem';

/**
 * Главный компонент Sidebar
 * Отображает список Luxee аккаунтов с профилями и чатами
 */
const Sidebar = ({ messagesData, refetch }) => {
  const { showToast, ToastContainer } = useToast();
  const { copy, copiedId } = useClipboard();
  const { expanded: expandedAccounts, toggle: toggleAccount } = useAccordion({});
  
  const { 
    selectedProfile, 
    selectedChat, 
    setSelectedProfile, 
    setSelectedChat, 
    aiEnabledByAccount, 
    toggleAIForAccount, 
    closeSidebar 
  } = useChatStore();
  
  const queryClient = useQueryClient();

  const handleProfileClick = (account, profile) => {
    queryClient.invalidateQueries({ queryKey: ['profileChats'] });
    setSelectedProfile({ ...profile, accountId: account.accountId, accountEmail: account.accountEmail });
    toggleAccount(profile.uid);
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
    <>
      <ToastContainer />
      <div className="h-full w-full border-r border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-y-auto custom-scrollbar">
        <div className="p-3 lg:p-4">
          <SidebarHeader
            onAISuccess={async () => {
              showToast('AI переключен на всех аккаунтах', 'success');
              await refetch();
            }}
            onAIError={(message) => showToast(message, 'error')}
          />

          {messagesData.accounts.map((account) => (
            <AccountItem
              key={account.accountId}
              account={account}
              isExpanded={expandedAccounts[account.accountId]}
              onToggle={() => toggleAccount(account.accountId)}
              aiEnabled={aiEnabledByAccount[account.accountId] === true}
              onAIToggle={toggleAIForAccount}
              onAIError={(message) => showToast(message, 'error')}
              selectedProfile={selectedProfile}
              selectedChat={selectedChat}
              onProfileClick={handleProfileClick}
              onChatClick={handleChatClick}
              copiedId={copiedId}
              onCopy={copy}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
