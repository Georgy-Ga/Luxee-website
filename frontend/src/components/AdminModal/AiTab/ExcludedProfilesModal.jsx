import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiApi } from '../../../api/aiApi';
import { luxeeApi } from '../../../api/luxeeApi';
import Modal from '../../ui/Modal';

/**
 * Модалка исключения женских анкет из обработки ИИ.
 *
 * Уровень: обычный пользователь — один список UID действует на все его
 * Luxee-аккаунты и все категории (newMessages/unanswered, Catch Up,
 * Activity Center). Применяется "на горячую", перезапуск ИИ не нужен.
 *
 * Устойчивость:
 * - профили грузятся через Promise.allSettled — упавший аккаунт
 *   (нет сессии) не ломает остальные;
 * - UID, которых уже нет ни в одном аккаунте (удалённый аккаунт/анкета),
 *   показываются отдельно как "сироты" — их можно удалить;
 * - ручной ввод ID покрывает случай офлайн-аккаунтов.
 */
const ExcludedProfilesModal = ({
  userId,
  userEmail,
  accounts = [],
  initialCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [manualId, setManualId] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Черновик выбора (строки UID) и последнее сохранённое состояние
  const [excluded, setExcluded] = useState([]);
  const [savedExcluded, setSavedExcluded] = useState([]);
  const [groups, setGroups] = useState([]); // [{ accountId, luxeeEmail, profiles, error }]

  // Счётчик для бейджа кнопки. Стартует с серверного значения,
  // дальше синхронизируется при каждом открытии (loadData) и сейве —
  // отдельного effect не нужно.
  const [liveCount, setLiveCount] = useState(initialCount);

  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const isDirty = useMemo(() => {
    if (excluded.length !== savedExcluded.length) return true;
    const saved = new Set(savedExcluded);
    return excluded.some((uid) => !saved.has(uid));
  }, [excluded, savedExcluded]);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      // 1. Сохранённый список исключений
      let saved = [];
      try {
        const savedRes = await aiApi.getExcludedProfiles(userId);
        saved = (savedRes.excludedProfileUids || []).map(String);
      } catch (err) {
        console.error('[ExcludedProfiles] Failed to load saved list:', err);
        showMessage('error', 'Не удалось загрузить сохранённый список');
      }
      setExcluded(saved);
      setSavedExcluded(saved);
      setLiveCount(saved.length);

      // 2. Анкеты со всех Luxee-аккаунтов пользователя (устойчиво к падениям)
      const results = await Promise.allSettled(
        (accounts || []).map((acc) => luxeeApi.getProfiles(acc._id)),
      );
      setGroups(
        (accounts || []).map((acc, i) => {
          const res = results[i];
          if (res.status === 'fulfilled') {
            const profiles = res.value?.data?.profiles || res.value?.profiles || [];
            return {
              accountId: acc._id,
              luxeeEmail: acc.luxeeEmail,
              profiles: profiles.map((p) => ({
                uid: String(p.uid),
                username: p.username || `#${p.uid}`,
                age: p.age ?? null,
                isDisabled: !!p.isDisabled,
              })),
              error: '',
            };
          }
          return {
            accountId: acc._id,
            luxeeEmail: acc.luxeeEmail,
            profiles: [],
            error:
              res.reason?.response?.data?.message ||
              'Не удалось загрузить анкеты (нет сессии?)',
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [userId, accounts, showMessage]);

  const handleOpen = () => {
    setIsOpen(true);
    setSearch('');
    setManualId('');
    loadData();
  };

  const toggleUid = useCallback((uid) => {
    setExcluded((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }, []);

  const handleAddManualId = (e) => {
    e.preventDefault();
    const ids = manualId
      .trim()
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
    if (ids.length === 0) {
      showMessage('error', 'Введите числовой ID анкеты');
      return;
    }
    setExcluded((prev) => [...new Set([...prev, ...ids])]);
    setManualId('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await aiApi.updateExcludedProfiles(userId, excluded);
      const saved = (res.excludedProfileUids || []).map(String);
      setExcluded(saved);
      setSavedExcluded(saved);
      setLiveCount(saved.length);
      showMessage(
        'success',
        `✅ Сохранено (${saved.length}). Применяется сразу, перезапуск ИИ не нужен.`,
      );
    } catch (err) {
      console.error('[ExcludedProfiles] Save failed:', err);
      showMessage(
        'error',
        `❌ ${err.response?.data?.error || err.response?.data?.message || 'Ошибка сохранения'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (excluded.length === 0) return;
    setSaving(true);
    try {
      await aiApi.updateExcludedProfiles(userId, []);
      setExcluded([]);
      setSavedExcluded([]);
      setLiveCount(0);
      showMessage('success', '✅ Список очищен, ИИ снова видит все анкеты');
    } catch {
      showMessage('error', '❌ Не удалось очистить список');
    } finally {
      setSaving(false);
    }
  };

  // Фильтр по поиску + UID-сироты (сохранены, но не найдены ни в одном аккаунте)
  const { visibleGroups, orphans } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allUids = new Set();
    groups.forEach((g) => g.profiles.forEach((p) => allUids.add(p.uid)));

    const match = (p) =>
      !q ||
      p.username.toLowerCase().includes(q) ||
      p.uid.includes(q);

    return {
      visibleGroups: groups.map((g) => ({
        ...g,
        profiles: g.profiles.filter(match),
      })),
      orphans: savedExcluded.filter((uid) => !allUids.has(uid)),
    };
  }, [groups, search, savedExcluded]);

  const totalProfiles = useMemo(
    () => groups.reduce((sum, g) => sum + g.profiles.length, 0),
    [groups],
  );

  return (
    <>
      <button
        onClick={handleOpen}
        type="button"
        title="Исключить анкеты из обработки ИИ"
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          liveCount > 0
            ? 'border-2 border-red-500 bg-red-500/10 text-white hover:bg-red-500/20'
            : 'border-gray-600 text-white hover:border-purple hover:bg-gray-700/30'
        }`}
      >
        🚫 Анкеты{liveCount > 0 ? ` (${liveCount})` : ''}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`🚫 Исключённые анкеты`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">{userEmail}</p>
            <p className="text-xs text-gray-500 mt-1">
              ИИ полностью игнорирует выбранные анкеты: новые сообщения,
              unanswered, Catch Up и Activity Center. Изменения применяются
              сразу, без перезапуска ИИ.
            </p>
          </div>

          {message.text && (
            <div
              className={`p-3 rounded-lg text-sm border ${
                message.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Поиск */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Поиск по имени или ID..."
            className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-purple text-sm"
          />

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Загрузка анкет...
            </p>
          ) : (
            <>
              {accounts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  У пользователя нет Luxee-аккаунтов
                </p>
              )}

              {visibleGroups.map((group) => (
                <div
                  key={group.accountId}
                  className="rounded-lg border border-gray-700 overflow-hidden"
                >
                  <div className="px-3 py-2 bg-gray-800/60 text-sm font-medium text-white flex items-center justify-between">
                    <span className="truncate">{group.luxeeEmail}</span>
                    <span className="text-xs text-gray-400 ml-2 shrink-0">
                      {group.profiles.filter((p) => excludedSet.has(p.uid)).length}
                      /{group.profiles.length} исключено
                    </span>
                  </div>

                  {group.error ? (
                    <p className="px-3 py-2 text-xs text-yellow-400">
                      ⚠️ {group.error} — ID можно добавить вручную ниже.
                    </p>
                  ) : group.profiles.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">
                      {search ? 'Ничего не найдено' : 'Нет анкет'}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {group.profiles.map((profile) => {
                        const checked = excludedSet.has(profile.uid);
                        return (
                          <label
                            key={profile.uid}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
                              checked
                                ? 'bg-red-500/10 text-red-200'
                                : 'text-gray-200 hover:bg-gray-700/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUid(profile.uid)}
                              className="w-4 h-4 accent-red-500 shrink-0"
                            />
                            <span className="flex-1 truncate">
                              {profile.username}
                              {profile.age ? `, ${profile.age}` : ''}
                              {profile.isDisabled && (
                                <span className="text-gray-500"> (disabled)</span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 font-mono shrink-0">
                              #{profile.uid}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Сироты: сохранены, но анкета/аккаунт больше не найдены */}
              {orphans.length > 0 && (
                <div className="rounded-lg border border-yellow-600/40 bg-yellow-500/5 p-3">
                  <p className="text-xs text-yellow-400 mb-2">
                    ⚠️ Сохранённые ID, которых нет ни в одном аккаунте
                    (аккаунт удалён или анкета пропала) — на работу ИИ не влияют:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orphans.map((uid) => (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs text-gray-300 font-mono"
                      >
                        #{uid}
                        <button
                          onClick={() => toggleUid(uid)}
                          type="button"
                          title="Убрать из списка"
                          className="text-red-400 hover:text-red-300 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ручной ввод ID */}
              <form onSubmit={handleAddManualId} className="flex gap-2">
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Добавить ID вручную (напр. 608434 607823)"
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-purple text-sm font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-gray-600 text-white text-sm hover:border-purple transition-colors"
                >
                  Добавить
                </button>
              </form>

              {/* Действия */}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  type="button"
                  className="btn-primary flex-1 min-w-[160px] py-2.5 font-semibold disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : `💾 Сохранить (${excluded.length})`}
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={saving || excluded.length === 0}
                  type="button"
                  className="px-4 py-2.5 rounded-lg border border-gray-600 text-white text-sm hover:border-red-500 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Очистить всё
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Всего анкет: {totalProfiles} • Исключено: {excluded.length}
                {isDirty ? ' • есть несохранённые изменения' : ''}
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

ExcludedProfilesModal.propTypes = {
  userId: PropTypes.string.isRequired,
  userEmail: PropTypes.string.isRequired,
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      luxeeEmail: PropTypes.string,
    }),
  ),
  initialCount: PropTypes.number,
};

export default ExcludedProfilesModal;
