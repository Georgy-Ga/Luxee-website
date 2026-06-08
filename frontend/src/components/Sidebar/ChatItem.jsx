import PropTypes from 'prop-types';
import { decodeHtmlEntities } from './utils';

/**
 * Элемент чата в списке
 */
const ChatItem = ({ 
  chat, 
  isSelected, 
  onClick, 
  copiedId, 
  onCopy 
}) => {
  const decodedUsername = decodeHtmlEntities(chat.memberUsername);

  return (
    <div
      className={`p-2 rounded cursor-pointer transition-colors text-xs ${
        isSelected
          ? 'bg-purple/20 dark:bg-accent/20 border-l-2 border-purple dark:border-accent'
          : 'bg-light-bg dark:bg-dark-bg hover:bg-light-hover dark:hover:bg-dark-hover'
      }`}
    >
      <div 
        className="flex items-center justify-between gap-2"
        onClick={onClick}
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
};

ChatItem.propTypes = {
  chat: PropTypes.shape({
    chatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    memberUsername: PropTypes.string,
    memberUid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    newMessages: PropTypes.number,
    unAnswered: PropTypes.bool,
  }).isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  copiedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCopy: PropTypes.func.isRequired,
};

export default ChatItem;
