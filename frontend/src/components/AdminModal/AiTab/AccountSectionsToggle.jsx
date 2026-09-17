import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { aiApi } from '../../../api/aiApi';
import { Toggle } from '../../ui';

const SECTIONS = [
  { key: 'newMessages', label: 'Новые сообщения', hint: 'Обычные чаты всех анкет' },
  { key: 'catchUp', label: 'Catch Up', hint: 'Резервная ветка Catch Up' },
  { key: 'activityCenter', label: 'Activity Center', hint: 'Уведомления (лайки, избранное)' },
];

/**
 * Мастер-выключатели разделов AI для отдельного Luxee аккаунта (админка).
 * OFF = раздел полностью пропускается циклом. Не путать с черным списком
 * (тот фильтрует только конкретных мужчин из списка).
 */
const AccountSectionsToggle = ({ accountId }) => {
  const [sections, setSections] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await aiApi.getAccountSections(accountId);
        if (!cancelled) {
          setSections(data.sections);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.error || 'Ошибка загрузки');
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const handleToggle = async (key) => {
    if (!sections || pending) return;
    setPending(true);
    try {
      const data = await aiApi.updateAccountSections(accountId, {
        ...sections,
        [key]: !sections[key],
      });
      setSections(data.sections);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setPending(false);
    }
  };

  if (error && !sections) {
    return <div className="text-xs text-red-500 mt-1">Разделы: {error}</div>;
  }

  if (!sections) {
    return <div className="text-xs text-gray-400 mt-1">Разделы: загрузка...</div>;
  }

  return (
    <div className="mt-2 pt-2 border-t border-light-border dark:border-dark-border">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Разделы AI {error && <span className="text-red-500">({error})</span>}
      </div>
      <div className="flex flex-col gap-1">
        {SECTIONS.map(({ key, label, hint }) => (
          <label key={key} className="flex items-center justify-between gap-2" title={hint}>
            <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
            <Toggle
              enabled={!!sections[key]}
              onChange={() => handleToggle(key)}
              disabled={pending}
            />
          </label>
        ))}
      </div>
    </div>
  );
};

AccountSectionsToggle.propTypes = {
  accountId: PropTypes.string.isRequired,
};

export default AccountSectionsToggle;
