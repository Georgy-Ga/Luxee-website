import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/authApi';

/**
 * Панель «Активные сессии» (мультивход).
 * Показывает все браузеры/устройства на текущем userId.
 * Закрытие одной сессии НЕ останавливает AI/браузеры коллег.
 * Использование (opt-in, ничего существующего не меняет):
 *   import SessionsPanel from '../components/auth/SessionsPanel';
 *   <SessionsPanel />
 */
export default function SessionsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: authApi.getSessions,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const revoke = useMutation({
    mutationFn: (sessionId) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => setError(e?.response?.data?.message || e.message),
  });

  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      window.location.href = '/login';
    },
    onError: (e) => setError(e?.response?.data?.message || e.message),
  });

  useEffect(() => {
    const onChanged = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
    window.addEventListener('sessions:changed', onChanged);
    window.addEventListener('audit:new', onChanged);
    return () => {
      window.removeEventListener('sessions:changed', onChanged);
      window.removeEventListener('audit:new', onChanged);
    };
  }, [queryClient]);

  if (isLoading) return <div>Загрузка сессий...</div>;

  return (
    <div>
      <h3>Активные сессии ({sessions.length})</h3>
      <p>Несколько человек могут работать под одним аккаунтом одновременно.</p>
      {error && <div role="alert">{error}</div>}
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            <span>
              {s.deviceName || s.deviceId || 'Устройство'}
              {s.isCurrent ? ' (это вы)' : ''} — {s.ip || 'IP?'} —{' '}
              {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : '—'}
            </span>{' '}
            <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>
              Закрыть
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
        Выйти везде
      </button>
    </div>
  );
}
