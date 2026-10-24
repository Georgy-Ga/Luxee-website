import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';

/**
 * Лента действий (без курсоров): «кто включил/выключил ИИ».
 * Live-обновления приходят по socket `audit:new` (см. SocketContext).
 * Использование (opt-in):
 *   import ActivityFeed from '../components/auth/ActivityFeed';
 *   <ActivityFeed accountId={optionalAccountId} />
 */
export default function ActivityFeed({ accountId = null, limit = 50 } = {}) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState([]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['audit', accountId, limit],
    queryFn: () => authApi.getAudit({ limit, accountId }),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    const onAudit = (e) => {
      const payload = e?.detail;
      if (!payload) return;
      if (accountId && payload.accountId && payload.accountId !== accountId) return;
      setLive((prev) => [payload, ...prev].slice(0, limit));
    };
    window.addEventListener('audit:new', onAudit);
    return () => window.removeEventListener('audit:new', onAudit);
  }, [accountId, limit, queryClient]);

  if (isLoading && live.length === 0) return <div>Загрузка действий...</div>;

  const merged = [...live, ...items].slice(0, limit);

  if (merged.length === 0) return <div>Действий пока нет.</div>;

  return (
    <ul>
      {merged.map((a, i) => (
        <li key={a.id || a._id || i}>
          <span>{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</span>{' '}
          <strong>{a.actorEmail || 'Кто-то'}</strong> <span>{a.action}</span>{' '}
          <span>{a.detail || ''}</span>
          {a.deviceName ? <span> ({a.deviceName.slice(0, 40)})</span> : null}
        </li>
      ))}
    </ul>
  );
}
