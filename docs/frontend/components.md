# FRONTEND COMPONENTS

> **React компоненты приложения**  
> **Обновлено:** 10.05.2026

---

## 📦 ОСНОВНЫЕ КОМПОНЕНТЫ

### Header.jsx
**Путь:** `frontend/src/components/Header.jsx`  
**Назначение:** Шапка приложения

**Функции:**
- Отображение email пользователя
- Кнопка выхода
- Переключатель темы (light/dark)
- Кнопка "🤖 AI Test" (переход на /ai-test)

**Используемые stores:**
- `authStore` - данные пользователя
- `themeStore` - тема приложения

---

### Sidebar.jsx
**Путь:** `frontend/src/components/Sidebar.jsx`  
**Назначение:** Боковая панель с аккаунтами и профилями

**Функции:**
- Список Luxee аккаунтов пользователя
- Список профилей выбранного аккаунта
- Добавление нового Luxee аккаунта (модальное окно)
- Удаление аккаунта
- Отображение количества новых сообщений
- Список чатов профиля (при клике на профиль)

**Используемые stores:**
- `chatStore` - выбранный аккаунт, профиль, чат
- `authStore` - данные пользователя

**API вызовы:**
- `luxeeApi.getAccounts()` - получить аккаунты
- `luxeeApi.loginLuxee()` - добавить аккаунт
- `luxeeApi.deleteAccount()` - удалить аккаунт
- `luxeeApi.checkAllMessages()` - проверить сообщения

---

### ChatWindow.jsx
**Путь:** `frontend/src/components/ChatWindow.jsx`  
**Назначение:** Окно чата с сообщениями

**Функции:**
- Отображение сообщений чата
- Отправка сообщений
- Переключатель AI (включить/выключить автоответы)
- Кнопка "AI ответ" (генерация ответа через AI)
- Автопрокрутка к последнему сообщению

**Используемые stores:**
- `chatStore` - выбранный чат, AI статус

**API вызовы:**
- `luxeeApi.sendMessage()` - отправить сообщение
- `luxeeApi.openChat()` - открыть чат и получить сообщения
- `aiApi.generateResponse()` - получить AI ответ

---

### AdminModal.jsx
**Путь:** `frontend/src/components/AdminModal.jsx`  
**Назначение:** Модальное окно для админа

**Функции:**
- Регистрация новых пользователей
- Список всех пользователей
- Удаление пользователей
- Управление AI доступом пользователей

**Используемые stores:**
- `authStore` - проверка роли admin

**API вызовы:**
- `authApi.register()` - регистрация пользователя
- `authApi.getUsers()` - список пользователей
- `authApi.deleteUser()` - удаление пользователя

---

## 📄 СТРАНИЦЫ

### Login.jsx
**Путь:** `frontend/src/pages/Login.jsx`  
**Назначение:** Страница входа в систему

**Функции:**
- Форма входа (email, password)
- Авторизация пользователя
- Редирект на Dashboard после входа

**Используемые stores:**
- `authStore` - авторизация

**API вызовы:**
- `authApi.login()` - вход в систему

---

### Dashboard.jsx
**Путь:** `frontend/src/pages/Dashboard.jsx`  
**Назначение:** Главная страница приложения

**Компоненты:**
- `Sidebar` - боковая панель
- `ChatWindow` - окно чата
- `AdminModal` - модальное окно админа (если admin)

**Функции:**
- Проверка авторизации
- Автоматическая проверка сообщений (каждые 10 сек)
- Открытие админ-панели (для admin)

---

### AiTest.jsx
**Путь:** `frontend/src/pages/AiTest.jsx`  
**Назначение:** Тестовая среда для AI

**Функции:**
- Настройка профиля девушки
- Отправка тестовых сообщений
- Получение AI ответов
- История переписки
- Просмотр AI правил
- Тестовые сценарии (быстрые кнопки)

**API вызовы:**
- `aiApi.testResponse()` - тестирование AI
- `aiApi.getSystemPrompt()` - получить промпт

---

## 🎨 СТИЛИЗАЦИЯ

### TailwindCSS
Все компоненты используют TailwindCSS для стилизации.

**Основные классы:**
- `bg-white dark:bg-gray-800` - фон с поддержкой темной темы
- `text-gray-900 dark:text-white` - текст с поддержкой темной темы
- `border border-gray-300 dark:border-gray-600` - границы

### Темная тема
Переключение темы через `themeStore`:
```javascript
const { theme, toggleTheme } = themeStore();
```

---

## 📊 СТРУКТУРА ДАННЫХ

### chatStore
```javascript
{
  selectedAccount: { id, email },
  selectedProfile: { uid, username, avatar },
  selectedChat: { chatId, memberUid, memberUsername, memberAvatar },
  aiEnabled: boolean,
  aiEnabledByAccount: { [accountId]: boolean }
}
```

### authStore
```javascript
{
  user: { id, email, role },
  isAuth: boolean,
  isLoading: boolean
}
```

### themeStore
```javascript
{
  theme: 'light' | 'dark'
}
```

---

**Последнее обновление:** 10.05.2026  
**Версия:** 1.0
