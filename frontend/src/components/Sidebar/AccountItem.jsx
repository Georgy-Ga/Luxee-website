import PropTypes from 'prop-types';
import AccountAIButton from './AccountAIButton';
import ProfileItem from './ProfileItem';
import AiScheduleStatus from './AiScheduleStatus';

/**
 * Элемент аккаунта с профилями
 */
const AccountItem = ({ 
  account, 
  isExpanded,
  onToggle,
  selectedProfile,
  selectedChat,
  onProfileClick,
  onChatClick,
  copiedId,
  onCopy,
}) => {
  return (
    <div className="mb-3 lg:mb-4">
      {/* Заголовок аккаунта */}
      <div className="flex items-center justify-between p-2 lg:p-3 rounded-lg bg-light-bg dark:bg-dark-bg hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer transition-colors">
        <div className="flex-1 min-w-0" onClick={onToggle}>
          <p className="font-medium text-gray-900 dark:text-white text-xs lg:text-sm truncate">
            {account.accountEmail}
          </p>
          <p className="text-[10px] lg:text-xs text-gray-600 dark:text-gray-400">
            {account.profiles?.length || 0} профилей • {account.totalUnread || 0} новых
          </p>
          {/* Статус расписания AI */}
          <AiScheduleStatus accountId={account.accountId} />
        </div>
        
        {/* AI Toggle для аккаунта */}
        <AccountAIButton accountId={account.accountId} />
      </div>

      {/* Список профилей */}
      {isExpanded && account.profiles?.map((profile) => (
        <ProfileItem
          key={profile.uid}
          account={account}
          profile={profile}
          isExpanded={selectedProfile?.uid === profile.uid}
          isSelected={selectedProfile?.uid === profile.uid}
          onProfileClick={onProfileClick}
          onChatClick={onChatClick}
          selectedChatId={selectedChat?.chatId}
          copiedId={copiedId}
          onCopy={onCopy}
        />
      ))}

      {/* Сообщение если нет профилей */}
      {isExpanded && (!account.profiles || account.profiles.length === 0) && (
        <div className="ml-3 lg:ml-4 mt-2 p-2 text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 text-center">
          Нет анкет на этом аккаунте
        </div>
      )}
    </div>
  );
};

AccountItem.propTypes = {
  account: PropTypes.shape({
    accountId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    accountEmail: PropTypes.string.isRequired,
    profiles: PropTypes.array,
    totalUnread: PropTypes.number,
  }).isRequired,
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  selectedProfile: PropTypes.object,
  selectedChat: PropTypes.object,
  onProfileClick: PropTypes.func.isRequired,
  onChatClick: PropTypes.func.isRequired,
  copiedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCopy: PropTypes.func.isRequired,
};

export default AccountItem;
