# Анализ реализации проекта Luxee

## Оглавление
1. [Обзор проекта](#обзор-проекта)
2. [Backend (Node.js + Express)](#backend)
3. [Frontend (React + Vite)](#frontend)
4. [Spambot (Python + Tkinter)](#spambot)
5. [Инфраструктура](#инфраструктура)
6. [Основные функции](#основные-функции)

---

## Обзор проекта

**Luxee** - это полнофункциональная платформа для управления аккаунтами на сайте знакомств с интеграцией AI для автоматических ответов.

### Технологический стек
- **Backend**: Node.js 24+, Express 5, MongoDB, Playwright
- **Frontend**: React 19, Vite 8, TailwindCSS, Zustand, React Query
- **Spambot**: Python, Tkinter, RPA Framework
- **Инфраструктура**: Docker, Docker Compose, MongoDB 7

---

## Backend

### Архитектура

Модульная архитектура с разделением на слои:
- **Controllers** - обработка HTTP запросов
- **Services** - бизнес-логика
- **Models** - схемы данных MongoDB
- **Middleware** - аутентификация, авторизация, обработка ошибок
- **Routes** - маршрутизация API

### Модели данных

#### 1. UserModel
```javascript
{
  email: String (unique),
  password: String (hashed),
  role: 'user' | 'admin',
  aiEnabled: Boolean,
  aiEnabledByAdmin: Boolean
}
```

#### 2. LuxeeAccountModel
```javascript
{
  user: ObjectId (ref: User),
  luxeeEmail: String,
  luxeePassword: String,
  sessionData: String (JSON),
  isActive: Boolean,
  lastActivity: Date,
  aiEnabled: Boolean,
  aiEnabledByAdmin: Boolean,
  aiContext: String (browser context ID)
}
```

#### 3. AiRule
```javascript
{
  rule: String,
  description: String,
  isActive: Boolean,
  createdBy: ObjectId (ref: User),
  order: Number,
  timestamps: true
}
```

#### 4. AnsweredChat
```javascript
{
  accountId: ObjectId,
  profileUid: Number,
  chats: [{
    chatId: String,
    memberUid: Number,
    memberUsername: String,
    lastManMessage: Object,
    lastWomanMessage: Object,
    lastActivity: String,
    savedAt: Date
  }]
}
```

### Основные сервисы

#### 1. Browser Service (`browserService.js`)
**Назначение**: Управление единым экземпляром браузера Playwright для всех пользователей

**Ключевые функции**:
- `launchBrowser()` - запуск Chromium с настройками для Docker
- `createContext()` - создание изолированных контекстов для каждого аккаунта
- `saveSessionState()` - сохранение cookies и localStorage
- `handleBrowserCrash()` - автоматическое восстановление после краша
- `getStats()` - статистика активных контекстов

**Особенности**:
- Один браузер на все приложение
- Map для хранения контекстов: `accountId -> context`
- Автоматическое восстановление контекстов при крашах
- Поддержка headless режима

#### 2. AI Browser Context Service (`aiBrowserContextService.js`)
**Назначение**: Управление отдельными AI контекстами для параллельной работы

**Ключевые функции**:
- `getOrCreateAiContext()` - получение/создание AI контекста
- `closeAiContext()` - закрытие AI контекста
- `getAiContext()` - получение существующего контекста

**Особенности**:
- Отдельные контексты для AI (не мешают основной работе)
- Сохранение ID контекста в `LuxeeAccountModel.aiContext`
- Автоматическая авторизация в AI контексте

#### 3. AI Service (`aiService/`)
**Назначение**: Генерация AI ответов через Omniroute API

**Модули**:
- `config.js` - конфигурация API (URL, ключ, модель)
- `apiClient.js` - HTTP клиент для AI API
- `promptBuilder.js` - построение промптов
- `responseGenerator.js` - генерация ответов
- `responseValidator.js` - валидация ответов
- `testService.js` - тестирование AI

**Особенности**:
- Использует Gemini 2.5 Flash через Omniroute
- Динамические промпты с правилами из БД
- Валидация длины и содержания ответов

#### 4. AI Auto Response Service (`aiAutoResponseService.js`)
**Назначение**: Автоматические ответы на новые сообщения

**Ключевые функции**:
- `start(accountId)` - запуск автоответов для аккаунта
- `stop(accountId)` - остановка автоответов
- `processAccountMessages()` - обработка неотвеченных сообщений
- `startForUser()` - запуск для всех аккаунтов пользователя
- `getStatus()` - статус активных автоответов

**Особенности**:
- Интервал проверки: 10 секунд
- Работает через AI контексты
- Сохраняет отвеченные чаты в MongoDB
- Задержки между ответами (3 сек)
- Автоматическая остановка при отключении AI

#### 5. AI Management Service (`aiManagementService/`)
**Назначение**: Управление доступом к AI функциям

**Модули**:
- `userAiService.js` - управление AI для пользователей
- `accountAiService.js` - управление AI для аккаунтов
- `index.js` - объединенный интерфейс

**Ключевые функции**:
- `canUserUseAi()` - проверка доступа пользователя
- `canAccountUseAi()` - проверка доступа аккаунта
- `toggleUserAi()` - переключение AI для пользователя
- `toggleAccountAi()` - переключение AI для аккаунта
- `setUserAiByAdmin()` - управление админом

**Особенности**:
- Двухуровневая система: пользователь + аккаунт
- Админ может отключить AI любому пользователю
- Пользователь может отключить AI себе или своим аккаунтам

#### 6. Luxee API Services (`luxeeApi/`)
**Назначение**: Взаимодействие с сайтом Luxee через Playwright

**Сервисы**:
- `luxeeAuthService/` - авторизация на Luxee
- `luxeeScraperService.js` - получение профилей
- `messageCheckService/` - проверка новых сообщений
- `messageSendService.js` - отправка сообщений
- `profileChatsLoadService.js` - загрузка чатов профиля
- `chatOpenService.js` - открытие чата
- `chatNavigationService.js` - навигация по чатам
- `keepAliveService.js` - поддержание сессии
- `profileActivationService.js` - активация профилей

**Особенности**:
- Работа через `page.evaluate()` с `modelsChat` API
- Сохранение сессий в MongoDB
- Автоматическое восстановление сессий

#### 7. User Service (`userService.js`)
**Назначение**: Управление пользователями

**Функции**:
- `registration()` - регистрация (только админ)
- `login()` - авторизация
- `logout()` - выход (закрывает AI контексты)
- `refresh()` - обновление токенов
- `deleteUser()` - удаление пользователя

**Особенности**:
- JWT токены (access + refresh)
- Bcrypt для паролей
- При logout закрываются все AI контексты

#### 8. AI Rule Service (`aiRuleService.js`)
**Назначение**: Управление правилами для AI

**Функции**:
- `getAllRules()` - получение всех правил
- `getActiveRules()` - получение активных правил
- `createRule()` - создание правила
- `updateRule()` - обновление правила
- `deleteRule()` - удаление правила
- `toggleRuleActive()` - переключение активности

**Особенности**:
- Правила используются в промптах AI
- Сортировка по полю `order`
- Только админы могут управлять

### Controllers

#### 1. UserController
- Регистрация, логин, logout, refresh
- Получение списка пользователей
- Удаление пользователей

#### 2. LuxeeController
- Авторизация на Luxee
- Управление аккаунтами
- Получение профилей и чатов
- Проверка сообщений
- Отправка сообщений

#### 3. AiController
- Тестирование AI ответов
- Получение системного промпта

#### 4. AiManagementController
- Управление правилами AI
- Управление доступом пользователей к AI
- Управление доступом аккаунтов к AI

#### 5. AiAutoResponseController
- Запуск/остановка автоответов
- Получение статуса автоответов

### Middleware

#### 1. authMiddleware
- Проверка JWT токена
- Добавление `req.user`

#### 2. roleMiddleware
- Проверка роли пользователя
- Ограничение доступа для админов

#### 3. errorMiddleware
- Централизованная обработка ошибок
- Логирование ошибок

### API Routes

**Аутентификация**:
- `POST /api/registration` - регистрация (admin)
- `POST /api/login` - вход
- `POST /api/logout` - выход
- `GET /api/refresh` - обновление токена
- `GET /api/users` - список пользователей (admin)
- `DELETE /api/users/:userId` - удаление (admin)

**Luxee аккаунты**:
- `POST /api/luxee/login` - авторизация на Luxee
- `GET /api/luxee/accounts` - список аккаунтов
- `DELETE /api/luxee/accounts/:accountId` - удаление
- `POST /api/luxee/accounts/:accountId/restore` - восстановление сессии
- `GET /api/luxee/profiles` - получение профилей
- `GET /api/luxee/page-content` - контент страницы

**Сообщения**:
- `GET /api/luxee/messages/check-all` - проверка всех
- `GET /api/luxee/messages/check-account` - проверка аккаунта
- `POST /api/luxee/messages/send` - отправка
- `GET /api/luxee/profile-chats` - чаты профиля
- `GET /api/luxee/chat/open` - открыть чат

**AI тестирование**:
- `POST /api/ai/test` - тест AI
- `GET /api/ai/prompt` - системный промпт

**AI правила**:
- `GET /api/ai/rules` - список правил
- `POST /api/ai/rules` - создание (admin)
- `PUT /api/ai/rules/:ruleId` - обновление (admin)
- `DELETE /api/ai/rules/:ruleId` - удаление (admin)
- `POST /api/ai/rules/:ruleId/toggle` - переключение (admin)

**AI управление пользователями**:
- `GET /api/ai/users` - статус всех (admin)
- `GET /api/ai/my-status` - мой статус
- `POST /api/ai/my-toggle` - переключить мой AI
- `POST /api/ai/users/:userId/set` - установить (admin)
- `POST /api/ai/users/:userId/set-all-accounts` - для всех аккаунтов (admin)

**AI управление аккаунтами**:
- `GET /api/ai/accounts` - статус всех (admin)
- `GET /api/ai/my-accounts` - мои аккаунты
- `POST /api/ai/accounts/:accountId/set` - установить (admin)
- `POST /api/ai/my-accounts/:accountId/toggle` - переключить

**AI автоответы**:
- `POST /api/ai/auto-response/accounts/:accountId/start` - запуск
- `POST /api/ai/auto-response/accounts/:accountId/stop` - остановка
- `POST /api/ai/auto-response/start-all` - запуск всех
- `POST /api/ai/auto-response/stop-all` - остановка всех
- `GET /api/ai/auto-response/status` - статус
- `GET /api/ai/auto-response/accounts/:accountId/is-running` - проверка

---

## Frontend

### Архитектура

**Стек**:
- React 19.2.5
- Vite 8.0.10
- TailwindCSS 3.4.0
- React Router DOM 7.1.3
- Zustand 5.0.2 (state management)
- TanStack React Query 5.62.11
- Axios 1.7.9

### Структура

```
frontend/src/
├── api/              # API клиенты
│   ├── axios.js      # Настройка axios
│   ├── authApi.js    # API аутентификации
│   ├── luxeeApi.js   # API Luxee
│   └── aiApi.js      # API AI
├── components/       # Компоненты
│   ├── Header.jsx
│   ├── Sidebar.jsx
│   ├── ChatWindow/
│   └── AdminModal/
├── pages/           # Страницы
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   └── AiTest.jsx
├── stores/          # Zustand stores
│   ├── authStore.js
│   ├── chatStore.js
│   └── themeStore.js
├── App.jsx
└── main.jsx
```

### Основные компоненты

#### 1. Login (`pages/Login.jsx`)
- Форма входа
- Валидация
- Редирект после входа

#### 2. Dashboard (`pages/Dashboard.jsx`)
- Главная страница
- Sidebar с аккаунтами и чатами
- ChatWindow для переписки
- Автообновление сообщений (10 сек)

#### 3. AiTest (`pages/AiTest.jsx`)
- Тестирование AI ответов
- Управление правилами AI
- Просмотр системного промпта

#### 4. Header (`components/Header.jsx`)
- Навигация
- Переключатель темы
- Кнопка выхода
- Админ панель (для админов)

#### 5. Sidebar (`components/Sidebar.jsx`)
- Список аккаунтов Luxee
- Список профилей
- Список чатов с неотвеченными сообщениями
- Добавление аккаунтов
- Responsive дизайн

#### 6. ChatWindow (`components/ChatWindow/`)
- Отображение сообщений
- Отправка сообщений
- Информация о профиле
- AI кнопка для генерации ответа

#### 7. AdminModal (`components/AdminModal/`)
**Вкладки**:
- **Users** - управление пользователями
- **Luxee** - все аккаунты Luxee
- **AI** - управление AI (правила, доступ)

### State Management

#### authStore (Zustand)
```javascript
{
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => {},
  logout: () => {},
  setLoading: (loading) => {}
}
```

#### chatStore (Zustand)
```javascript
{
  selectedChat: null,
  sidebarOpen: false,
  setSelectedChat: (chat) => {},
  toggleSidebar: () => {},
  openSidebar: () => {},
  closeSidebar: () => {}
}
```

#### themeStore (Zustand)
```javascript
{
  isDark: false,
  setTheme: (isDark) => {}
}
```

### API клиенты

#### authApi
- `login()` - вход
- `logout()` - выход
- `getCurrentUser()` - текущий пользователь
- `getUsers()` - список пользователей
- `registerUser()` - регистрация
- `deleteUser()` - удаление

#### luxeeApi
- `loginToLuxee()` - авторизация на Luxee
- `getAccounts()` - аккаунты
- `deleteAccount()` - удаление
- `restoreSession()` - восстановление
- `checkAllMessages()` - проверка сообщений
- `sendMessage()` - отправка
- `loadProfileChats()` - чаты профиля
- `openChat()` - открыть чат

#### aiApi
- `testAi()` - тест AI
- `getSystemPrompt()` - промпт
- `getRules()` - правила
- `createRule()` - создание
- `updateRule()` - обновление
- `deleteRule()` - удаление
- `toggleRule()` - переключение
- `getMyAiStatus()` - мой статус
- `toggleMyAi()` - переключить
- `getMyAccountsAiStatus()` - статус аккаунтов
- `toggleMyAccountAi()` - переключить аккаунт
- `startAutoResponse()` - запуск автоответов
- `stopAutoResponse()` - остановка
- `getAutoResponseStatus()` - статус

### Особенности Frontend

1. **Responsive дизайн** - адаптация под мобильные устройства
2. **Темная тема** - переключение light/dark
3. **React Query** - кэширование и автообновление данных
4. **Protected routes** - защита страниц
5. **Axios interceptors** - автоматическое обновление токенов
6. **TailwindCSS** - utility-first CSS

---

## Spambot

### Назначение
Десктопное приложение на Python для массовой рассылки сообщений через Luxee.

### Технологии
- **Python 3**
- **Tkinter** - GUI
- **RPA Framework 30.0.2** - автоматизация браузера
- **PyInstaller** - сборка в .exe

### Структура

```
spambot/
├── main.py                    # Точка входа
├── config.py                  # Конфигурация
├── requirements.txt
├── build_exe.py              # Скрипт сборки
├── LuxeeBot.spec             # Спецификация PyInstaller
├── src/
│   ├── application/          # GUI приложение
│   │   ├── app.py           # Главное окно
│   │   ├── login_window.py  # Окно входа
│   │   ├── main_window.py   # Главное окно
│   │   ├── profile_frame.py # Фрейм профилей
│   │   ├── message_frame.py # Фрейм сообщений
│   │   ├── distribution_list_frame.py
│   │   └── distribution_settings_frame.py
│   ├── luxee_site/          # Работа с Luxee
│   │   ├── luxee_browser.py # Браузер
│   │   └── luxee_requests.py # Запросы
│   ├── credentials_manager.py # Управление учетками
│   ├── logger.py            # Логирование
│   ├── models.py            # Модели данных
│   ├── process.py           # Процессы рассылки
│   ├── requests_class.py    # HTTP клиент
│   └── utils.py             # Утилиты
└── lexee_errors/            # Обработка ошибок
```

### Основные функции

1. **Авторизация** - вход в аккаунт Luxee
2. **Управление профилями** - выбор профилей для рассылки
3. **Создание сообщений** - шаблоны сообщений
4. **Списки рассылки** - управление получателями
5. **Настройки рассылки** - интервалы, лимиты
6. **Автоматическая рассылка** - массовая отправка
7. **Логирование** - отслеживание действий

### Особенности

- **Многопоточность** - параллельная рассылка
- **Защита от блокировки** - задержки между сообщениями
- **Сохранение сессий** - не нужно входить каждый раз
- **Русская раскладка** - поддержка Ctrl+C/V в русской раскладке
- **Сборка в .exe** - готовое приложение для Windows

---

## Инфраструктура

### Docker Compose

**Сервисы**:

1. **mongodb** - MongoDB 7
   - Порт: 27017
   - Volumes: mongodb_data, mongodb_config
   - Healthcheck: mongosh ping

2. **backend** - Node.js приложение
   - Порт: 5000
   - Зависит от: mongodb
   - Volumes: playwright_data, browser_contexts
   - Healthcheck: wget localhost:5000/api/health

3. **frontend** - Nginx с React
   - Порт: 80
   - Зависит от: backend
   - Healthcheck: wget localhost:80

### Volumes

- `mongodb_data` - данные MongoDB
- `mongodb_config` - конфигурация MongoDB
- `playwright_data` - кэш Playwright
- `browser_contexts` - сохраненные контексты браузера

### Network

- `luxee-network` - bridge сеть для всех сервисов

### Environment Variables

**Backend**:
```env
NODE_ENV=production
PORT=5000
MONGO_URL=mongodb://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
AI_API_URL=http://host.docker.internal:20128/v1
AI_API_KEY=...
AI_MODEL=gemini-cli/gemini-2.5-flash
ALLOWED_ORIGINS=...
```

**Frontend**:
```env
VITE_API_URL=http://localhost:5000/api
```

### Dockerfile

**Backend**:
- Base: node:24-alpine
- Установка Chromium для Playwright
- npm ci --only=production
- Expose 5000

**Frontend**:
- Multi-stage build
- Stage 1: node:24-alpine (build)
- Stage 2: nginx:alpine (serve)
- Expose 80

---

## Основные функции

### 1. Управление пользователями
- ✅ Регистрация (только админ)
- ✅ Авторизация (JWT)
- ✅ Обновление токенов
- ✅ Роли (user, admin)
- ✅ Удаление пользователей

### 2. Управление Luxee аккаунтами
- ✅ Авторизация на Luxee
- ✅ Сохранение сессий
- ✅ Восстановление сессий
- ✅ Множественные аккаунты на пользователя
- ✅ Удаление аккаунтов
- ✅ Автоматическое восстановление после краша браузера

### 3. Работа с сообщениями
- ✅ Проверка новых сообщений
- ✅ Отправка сообщений
- ✅ Загрузка чатов профиля
- ✅ Открытие чата
- ✅ История переписки
- ✅ Автообновление (10 сек)

### 4. AI интеграция
- ✅ Генерация ответов через Gemini 2.5 Flash
- ✅ Настраиваемые правила для AI
- ✅ Тестирование AI
- ✅ Валидация ответов
- ✅ Контекст профиля в промптах

### 5. AI автоответы
- ✅ Автоматические ответы на новые сообщения
- ✅ Отдельные браузерные контексты для AI
- ✅ Интервал проверки 10 секунд
- ✅ Сохранение отвеченных чатов
- ✅ Запуск/остановка для аккаунта
- ✅ Запуск/остановка для всех аккаунтов пользователя
- ✅ Статус автоответов

### 6. AI управление доступом
- ✅ Двухуровневая система (пользователь + аккаунт)
- ✅ Админ может управлять доступом
- ✅ Пользователь может отключить AI себе
- ✅ Пользователь может отключить AI своим аккаунтам
- ✅ Автоматическое отключение AI при logout

### 7. Браузерная автоматизация
- ✅ Playwright для управления браузером
- ✅ Один браузер на все приложение
- ✅ Изолированные контексты для каждого аккаунта
- ✅ Отдельные AI контексты для параллельной работы
- ✅ Автоматическое восстановление после краша
- ✅ Сохранение и восстановление сессий

### 8. Админ панель
- ✅ Управление пользователями
- ✅ Просмотр всех аккаунтов Luxee
- ✅ Управление правилами AI
- ✅ Управление доступом к AI
- ✅ Регистрация новых пользователей
- ✅ Удаление пользователей

### 9. UI/UX
- ✅ Responsive дизайн
- ✅ Темная/светлая тема
- ✅ Адаптация под мобильные
- ✅ Sidebar с аккаунтами и чатами
- ✅ Окно чата с историей
- ✅ AI кнопка для генерации ответа
- ✅ Админ модал

### 10. Безопасность
- ✅ JWT токены (access + refresh)
- ✅ Bcrypt для паролей
- ✅ CORS настройки
- ✅ Middleware для аутентификации
- ✅ Middleware для авторизации (роли)
- ✅ Валидация входных данных

### 11. Мониторинг и логирование
- ✅ Логирование всех операций
- ✅ Healthcheck endpoints
- ✅ Статус браузера
- ✅ Статус автоответов
- ✅ Обработка ошибок

### 12. Deployment
- ✅ Docker Compose
- ✅ Multi-stage builds
- ✅ Healthchecks
- ✅ Volumes для данных
- ✅ Environment variables
- ✅ Production ready

---

## Технические особенности

### 1. Архитектурные решения

**Единый браузер с множественными контекстами**:
- Экономия ресурсов
- Изоляция сессий
- Автоматическое восстановление

**Отдельные AI контексты**:
- Параллельная работа AI и пользователя
- Не мешают друг другу
- Независимое управление

**Модульная структура сервисов**:
- Разделение ответственности
- Легкая поддержка
- Возможность расширения

### 2. Оптимизации

**Frontend**:
- React Query для кэширования
- Zustand для легкого state management
- Lazy loading компонентов
- Debounce для поиска

**Backend**:
- Переиспользование браузерных контекстов
- Сохранение сессий в MongoDB
- Batch операции для AI
- Индексы в MongoDB

### 3. Масштабируемость

**Горизонтальное масштабирование**:
- Stateless backend (JWT)
- Shared MongoDB
- Load balancer ready

**Вертикальное масштабирование**:
- Оптимизация памяти браузера
- Ограничение количества контекстов
- Очистка неактивных сессий

### 4. Надежность

**Автоматическое восстановление**:
- Краш браузера → перезапуск + восстановление контекстов
- Потеря сессии → повторная авторизация
- Ошибка AI → логирование + продолжение

**Graceful degradation**:
- AI недоступен → ручной режим
- Браузер недоступен → очередь запросов
- MongoDB недоступен → ошибка с retry

---

## Выводы

### Что реализовано

Проект **Luxee** представляет собой полнофункциональную платформу для автоматизации работы с сайтом знакомств с интеграцией AI. Реализованы все ключевые функции:

1. ✅ **Полноценный Backend** на Node.js с Express
2. ✅ **Современный Frontend** на React 19
3. ✅ **AI интеграция** через Gemini 2.5 Flash
4. ✅ **Автоматические ответы** с отдельными контекстами
5. ✅ **Управление доступом** к AI (двухуровневое)
6. ✅ **Браузерная автоматизация** через Playwright
7. ✅ **Админ панель** для управления
8. ✅ **Spambot** для массовой рассылки
9. ✅ **Docker deployment** с healthchecks
10. ✅ **Безопасность** (JWT, bcrypt, CORS)

### Архитектурные преимущества

1. **Модульность** - легко добавлять новые функции
2. **Масштабируемость** - готов к росту нагрузки
3. **Надежность** - автоматическое восстановление
4. **Безопасность** - многоуровневая защита
5. **Производительность** - оптимизация ресурсов

### Технологическая зрелость

Проект использует современные технологии и best practices:
- Node.js 24+ (последняя LTS)
- React 19 (latest)
- MongoDB 7
- Docker Compose
- JWT аутентификация
- Playwright для автоматизации
- AI интеграция

---

**Дата анализа**: 31.05.2026  
**Версия**: 1.0.0  
**Анализ выполнен**: Автоматически
