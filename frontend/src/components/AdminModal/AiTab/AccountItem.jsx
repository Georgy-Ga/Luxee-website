import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useSocket } from '../../../contexts/SocketContext';
import useAiStateStore from '../../../stores/aiStateStore';
import AccountAIToggleButton from './AccountAIToggleButton';
import AccountSectionsToggle from './AccountSectionsToggle';

/**
 * Отдельный Luxee аккаунт с кнопкой управления AI и разделами
 * + синий индикатор Relogin (about:blank / modelsChat 6 fails)
 */
const AccountItem = ({ account }) => {
  const { socket, isConnected } = useSocket();
  const setReloginStatus = useAiStateStore(s => s.setReloginStatus);
  const reloginMap = useAiStateStore(s => s.reloginStatuses);
  const relogin = reloginMap.get(account._id);
  const isRelogin = relogin && relogin.status === 'relogin_started';

  useEffect(() => {
    if (!socket || !isConnected) return;
    const handler = data => {
      if (!data || data.accountId !== account._id) return;
      setReloginStatus(data);
    };
    socket.on('ai:relogin:status', handler);
    return () => socket.off('ai:relogin:status', handler);
  }, [socket, isConnected, account._id, setReloginStatus]);

  return (
    <div className={`border rounded p-2 flex items-start justify-between gap-2 ${isRelogin ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface'}`}>
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
          {account.luxeeEmail}
          {isRelogin && <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white animate-pulse">Relogin…</span>}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>AI: {account.aiEnabled ? '🟢 Вкл' : '⚪ Выкл'}</span>
          <span className="mx-2">|</span>
          <span>Админ: {account.aiEnabledByAdmin ? '✅ Да' : '❌ Нет'}</span>
          {isRelogin && <span className="ml-2 text-blue-600 dark:text-blue-300">ИИ на паузе — пересоздаём контексты</span>}
        </div>
      </div>

      <div className={`flex flex-col items-end gap-1 ${isRelogin ? 'opacity-60 pointer-events-none' : ''}`} title={isRelogin ? 'Идёт перелогин — кнопки заблокированы до завершения' : undefined}>
        <AccountAIToggleButton accountId={account._id} />
        <AccountSectionsToggle accountId={account._id} />
      </div>
    </div>
  );
};

AccountItem.propTypes = {
  account: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    luxeeEmail: PropTypes.string.isRequired,
    aiEnabled: PropTypes.bool,
    aiEnabledByAdmin: PropTypes.bool,
  }).isRequired,
};

export default AccountItem;
