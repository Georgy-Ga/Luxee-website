# Адаптивный дизайн сайта

## Обзор

Сайт полностью адаптирован для работы на разных размерах экранов, включая маленькие ноутбуки (от 640px).

## Breakpoints

Используются стандартные Tailwind CSS breakpoints:

- **sm**: 640px - маленькие ноутбуки
- **md**: 768px - планшеты/средние ноутбуки  
- **lg**: 1024px - стандартные ноутбуки
- **xl**: 1280px - большие экраны

## Адаптивные компоненты

### 1. Header (`frontend/src/components/Header.jsx`)

**Изменения:**
- Высота: `h-14` на малых экранах → `lg:h-16` на больших
- Отступы: `px-3` → `lg:px-6`
- Кнопка гамбургер-меню: видна только на `lg:hidden` (< 1024px)
- Текст кнопок: скрыт на малых экранах, показаны только иконки
- Email пользователя: скрыт на `md:hidden` (< 768px)

**Особенности:**
```jsx
{/* Мобильная кнопка меню */}
<button className="lg:hidden ...">☰</button>

{/* Адаптивный текст кнопок */}
<span className="hidden sm:inline">AI: ON</span>
<span className="sm:hidden">🤖</span>
```

### 2. Dashboard (`frontend/src/pages/Dashboard.jsx`)

**Изменения:**
- Sidebar: фиксированный overlay на малых экранах, относительный на больших
- Ширина sidebar: `w-64 sm:w-72 lg:w-80`
- Overlay с затемнением для мобильных устройств
- Анимация slide-in/out для sidebar

**Особенности:**
```jsx
{/* Overlay для закрытия sidebar */}
{sidebarOpen && (
  <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20" 
       onClick={closeSidebar} />
)}

{/* Sidebar с анимацией */}
<div className={`
  fixed lg:relative
  transform transition-transform duration-300
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
`}>
```

### 3. Sidebar (`frontend/src/components/Sidebar.jsx`)

**Изменения:**
- Отступы: `p-3 lg:p-4`
- Размеры шрифтов: `text-xs lg:text-sm`, `text-[10px] lg:text-xs`
- Кнопка AI: `px-1.5 lg:px-2`, `text-[10px] lg:text-xs`
- Автоматическое закрытие при выборе чата на мобильных

**Особенности:**
```jsx
const handleChatClick = (account, profile, chat) => {
  setSelectedChat({...});
  closeSidebar(); // Закрываем sidebar на мобильных
};
```

### 4. ChatWindow

#### ProfileInfo (`frontend/src/components/ChatWindow/ProfileInfo.jsx`)

**Изменения:**
- Отступы: `p-3 lg:p-4`
- Размер аватара: `w-10 h-10 lg:w-12 lg:h-12`
- Размеры шрифтов: `text-sm lg:text-base`, `text-xs lg:text-sm`
- Статус "Онлайн/Оффлайн": скрыт на `sm:hidden` (< 640px)

#### MessageList (`frontend/src/components/ChatWindow/MessageList.jsx`)

**Изменения:**
- Отступы: `p-2 lg:p-4`
- Максимальная ширина сообщений: `max-w-[85%] sm:max-w-[70%]`
- Размеры шрифтов: `text-[10px] lg:text-xs`, `text-sm lg:text-base`
- Отступы между сообщениями: `space-y-3 lg:space-y-4`

### 5. AdminModal (`frontend/src/components/AdminModal/index.jsx`)

**Изменения:**
- Отступы контейнера: `p-2 lg:p-4`
- Высота модального окна: `max-h-[95vh] lg:max-h-[90vh]`
- Заголовок: `text-lg lg:text-2xl`
- Отступы внутри: `p-3 lg:p-6`
- Табы: `text-xs lg:text-sm`, `px-3 lg:px-4`
- Горизонтальная прокрутка табов на малых экранах

## Состояние Sidebar

Добавлено в `chatStore.js`:

```javascript
{
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}
```

## Поведение на разных экранах

### Маленькие экраны (< 1024px)

1. **Sidebar скрыт по умолчанию**
   - Открывается кнопкой ☰ в Header
   - Появляется как overlay поверх контента
   - Закрывается при клике вне sidebar или выборе чата

2. **Компактный Header**
   - Иконки вместо текста на кнопках
   - Скрыт email пользователя
   - Уменьшены отступы

3. **Адаптивные размеры**
   - Меньшие шрифты
   - Уменьшенные отступы
   - Более широкие сообщения (85% вместо 70%)

### Большие экраны (≥ 1024px)

1. **Sidebar всегда виден**
   - Фиксированная ширина 320px
   - Не скрывается

2. **Полноразмерный Header**
   - Текст на всех кнопках
   - Виден email пользователя
   - Стандартные отступы

3. **Комфортные размеры**
   - Стандартные шрифты
   - Нормальные отступы
   - Оптимальная ширина сообщений

## Тестирование

Протестировано на следующих разрешениях:

- ✅ 640px (маленькие ноутбуки)
- ✅ 768px (планшеты)
- ✅ 1024px (стандартные ноутбуки)
- ✅ 1280px (большие экраны)
- ✅ 1920px (Full HD)

## Сохранённый функционал

Все функции работают на всех размерах экранов:

- ✅ Выбор аккаунтов и профилей
- ✅ Просмотр и отправка сообщений
- ✅ AI управление
- ✅ Админ панель
- ✅ Темная/светлая тема
- ✅ Копирование ID
- ✅ Все модальные окна

## Рекомендации

1. **Минимальная ширина**: 640px
2. **Оптимальная ширина**: 1024px+
3. **Для мобильных телефонов**: требуется дополнительная адаптация (< 640px)

## Будущие улучшения

- [ ] Адаптация для мобильных телефонов (< 640px)
- [ ] Touch-жесты для sidebar (swipe)
- [ ] Адаптивные таблицы в админ панели
- [ ] Оптимизация для планшетов в landscape режиме
