import { create } from 'zustand';

/**
 * Distribution Store
 * Управление рассылками, очередью и прогрессом
 */
const useDistributionStore = create((set, get) => ({
  // Очередь рассылок (до отправки на сервер)
  queue: [],

  // Активные рассылки (с сервера)
  distributions: [],

  // Прогресс по ID рассылки
  progress: {},

  // Выбранный профиль для создания рассылки
  selectedProfile: null,

  // Загрузка
  loading: false,

  /**
   * Добавить рассылку в очередь (локально)
   */
  addToQueue: (distribution) => {
    set((state) => ({
      queue: [...state.queue, { ...distribution, id: Date.now() }],
    }));
  },

  /**
   * Удалить из очереди
   */
  removeFromQueue: (id) => {
    set((state) => ({
      queue: state.queue.filter((d) => d.id !== id),
    }));
  },

  /**
   * Очистить очередь
   */
  clearQueue: () => {
    set({ queue: [] });
  },

  /**
   * Установить список рассылок с сервера
   */
  setDistributions: (distributions) => {
    set({ distributions });
  },

  /**
   * Добавить рассылку с сервера
   */
  addDistribution: (distribution) => {
    set((state) => ({
      distributions: [distribution, ...state.distributions],
    }));
  },

  /**
   * Обновить статус рассылки
   */
  updateDistributionStatus: (distributionId, status) => {
    set((state) => ({
      distributions: state.distributions.map((d) =>
        d._id === distributionId ? { ...d, status } : d
      ),
    }));
  },

  /**
   * Обновить прогресс рассылки (из WebSocket)
   */
  updateProgress: (distributionId, progress) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [distributionId]: progress,
      },
      distributions: state.distributions.map((d) =>
        d._id === distributionId ? { ...d, progress } : d
      ),
    }));
  },

  /**
   * Обновить рассылку целиком
   */
  updateDistribution: (distributionId, updates) => {
    set((state) => ({
      distributions: state.distributions.map((d) =>
        d._id === distributionId ? { ...d, ...updates } : d
      ),
    }));
  },

  /**
   * Удалить рассылку
   */
  removeDistribution: (distributionId) => {
    set((state) => ({
      distributions: state.distributions.filter((d) => d._id !== distributionId),
      progress: Object.fromEntries(
        Object.entries(state.progress).filter(([id]) => id !== distributionId)
      ),
    }));
  },

  /**
   * Установить выбранный профиль
   */
  setSelectedProfile: (profile) => {
    set({ selectedProfile: profile });
  },

  /**
   * Установить загрузку
   */
  setLoading: (loading) => {
    set({ loading });
  },

  /**
   * Получить текущую активную рассылку (running)
   */
  getActiveDistribution: () => {
    const { distributions } = get();
    return distributions.find((d) => d.status === 'running');
  },

  /**
   * Проверить, есть ли активная рассылка
   */
  hasActiveDistribution: () => {
    return !!get().getActiveDistribution();
  },
}));

export default useDistributionStore;
