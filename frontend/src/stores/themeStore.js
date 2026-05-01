import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set) => ({
      isDark: true, // По умолчанию тёмная тема

      toggleTheme: () => set((state) => {
        const newIsDark = !state.isDark;
        // Обновляем класс на html элементе
        if (newIsDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { isDark: newIsDark };
      }),

      setTheme: (isDark) => set(() => {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { isDark };
      }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

export default useThemeStore;
