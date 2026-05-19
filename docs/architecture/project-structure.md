# PROJECT STRUCTURE & FILE USAGE

> **Последнее обновление:** 04.05.2026  
> **Цель:** Документация всех файлов проекта, их назначения и взаимосвязей

---

## 📁 BACKEND STRUCTURE

### 🔧 Core Files

#### `backend/index.js`
**Назначение:** Главный файл сервера  
**Функции:**
- Инициализация Express сервера
- Подключение к MongoDB
- Настройка middleware (CORS, cookie-parser)
- Восстановление контекстов при старте (`contextRecoveryService.restoreAllContexts()`)
- Запуск сервера на порту 5000

**Используется:** Точка входа приложения  
**Импортирует:** routes, errorMiddleware, contextRecoveryService

---

### 📡 Controllers

#### `backend/src/controllers/userController.js`
**Назначение:** Контроллер для управления пользователями  
**Функции:**
- `registration` - регистрация нового пользователя (только admin)
- `login` - авторизация пользователя
- `logout` - выход из системы
- `refresh` - обновление токенов
- `getUsers` - получение списка пользователей (только admin)
- `deleteUser` - удаление пользователя (только admin)

**Используется:** `routes/index.js`  
**Импортирует:** userService, validationResult

#### `backend/src/controllers/luxeeController.js`
**Назначение:** Контроллер для работы с Luxee  
**Функции:**
- `login` - авторизация в Luxee аккаунте
- `getAccounts` - получение списка Luxee аккаунтов
- `deleteAccount` - удаление Luxee аккаунта
- `restoreSession` - восстановление сессии
- `getProfiles` - получение профилей (анкет)
- `getPageContent` - получение содержимого страницы
- `checkAllMessages` - проверка сообщений на всех аккаунтах
- `checkAccountMessages` - проверка сообщений на конкретном аккаунте
- `sendMessage` - отправка сообщения

**Используется:** `routes/index.js`  
**Импортирует:** luxeeAuthService, luxeeScraperService, messageCheckService, messageSendService

---

### 🛣️ Routes

#### `backend/src/routes/index.js`
**Назначение:** Маршрутизация API  
**Эндпоинты:**

**Пользователи:**
- `POST /api/registration` - регистрация (admin)
- `POST /api/login` - вход
- `POST /api/logout` - выход
- `GET /api/refresh` - обновление токенов
- `GET /api/users` - список пользователей (admin)
- `DELETE /api/users/:userId` - удаление пользователя (admin)

**Luxee:**
- `POST /api/luxee/login` - логин в Luxee
- `GET /api/luxee/accounts` - список аккаунтов
- `DELETE /api/luxee/accounts/:accountId` - удалить аккаунт
- `POST /api/luxee/accounts/:accountId/restore` - восстановить сессию
- `GET /api/luxee/profiles` - получить профили
- `GET /api/luxee/page-content` - контент страницы

**Сообщения:**
- `GET /api/luxee/messages/check-all` - проверить все сообщения
- `GET /api/luxee/messages/check-account` - проверить аккаунт
- `POST /api/luxee/messages/send` - отправить сообщение

**Используется:** `index.js`  
**Импортирует:** UserController, LuxeeController, middleware

---

### 🗄️ Models

#### `backend/src/models/UserModel.js`
**Назначение:** Модель пользователя системы  
**Поля:**
- `email` - email пользователя (unique)
- `password` - хешированный пароль
- `role` - роль (user/admin)
- `isActivated` - активирован ли аккаунт
- `activationLink` - ссылка активации

**Используется:** userService, authMiddleware

#### `backend/src/models/TokenModel.js`
**Назначение:** Модель refresh токенов  
**Поля:**
- `user` - ссылка на пользователя
- `refreshToken` - токен обновления

**Используется:** tokenService

#### `backend/src/models/LuxeeAccountModel.js`
**Назначение:** Модель Luxee аккаунта  
**Поля:**
- `user` - ссылка на пользователя
- `luxeeEmail` - email в Luxee
- `luxeePassword` - пароль в Luxee
- `sessionData` - сохраненная сессия (cookies, localStorage)
- `isActive` - активен ли аккаунт
- `lastActivity` - последняя активность

**Используется:** luxeeAuthService, messageCheckService

---

### 🔐 Services - Core

#### `backend/src/services/userService.js`
**Назначение:** Бизнес-логика пользователей  
**Функции:**
- `registration` - создание пользователя
- `login` - авторизация
- `logout` - выход
- `refresh` - обновление токенов
- `getAllUsers` - получение всех пользователей
- `deleteUser` - удаление пользователя

**Используется:** UserController  
**Импортирует:** UserModel, TokenModel, tokenService, bcrypt, uuid

#### `backend/src/services/tokenService.js`
**Назначение:** Управление JWT токенами  
**Функции:**
- `generateTokens` - генерация access/refresh токенов
- `validateAccessToken` - проверка access токена
- `validateRefreshToken` - проверка refresh токена
- `saveToken` - сохранение refresh токена
- `removeToken` - удаление токена
- `findToken` - поиск токена

**Используется:** userService, authMiddleware  
**Импортирует:** jsonwebtoken, TokenModel

---

### 🌐 Services - Browser

#### `backend/src/services/browser/browserService.js`
**Назначение:** Управление Playwright браузером и контекстами  
**Функции:**
- `initialize()` - запуск браузера
- `createContext({ accountId, sessionData })` - создание контекста
- `getContext(accountId)` - получение контекста
- `closeContext(accountId)` - закрытие контекста
- `updateContextKey(oldId, newId)` - обновление ключа
- `saveSessionState({ accountId, context })` - сохранение сессии
- `closeAll()` - закрытие всех контекстов

**Используется:** luxeeAuthService, messageCheckService, contextRecoveryService  
**Импортирует:** playwright, browserConfig

#### `backend/src/services/browser/pageHelpers.js`
**Назначение:** Вспомогательные функции для работы со страницами  
**Функции:**
- `getOrCreatePage(context)` - получить или создать страницу
- `navigateTo({ page, url })` - навигация на URL
- `getCurrentUrl(page)` - получить текущий URL
- `waitForSelector({ page, selector, timeout })` - ожидание элемента
- `clickElement({ page, selector })` - клик по элементу
- `typeText({ page, selector, text })` - ввод текста

**Используется:** luxeeAuthService, luxeeScraperService, messageCheckService  
**Импортирует:** нет

#### `backend/src/services/browser/requestQueueService.js`
**Назначение:** Очередь запросов для последовательной обработки  
**Функции:**
- `addRequest({ accountId, profileUid, action })` - добавить запрос
- `processQueue()` - обработка очереди
- `getQueueStatus(accountId)` - статус очереди

**⚠️ ВАЖНО:** Используется ТОЛЬКО для отправки сообщений (требует переключения профилей)

**Используется:** messageSendService  
**Импортирует:** browserService, pageHelpers

#### `backend/src/services/browser/contextRecoveryService.js`
**Назначение:** Восстановление контекстов при перезапуске сервера  
**Функции:**
- `restoreAllContexts()` - восстановить все контексты
- `restoreUserContexts(userId)` - восстановить контексты пользователя

**Используется:** index.js (при старте сервера)  
**Импортирует:** LuxeeAccountModel, luxeeAuthService

---

### 💬 Services - Luxee API

#### `backend/src/services/luxeeApi/luxeeAuthService.js`
**Назначение:** Авторизация и управление Luxee аккаунтами  
**Функции:**
- `login({ userId, luxeeEmail, luxeePassword })` - вход в Luxee
- `getLuxeeAccounts({ userId })` - список аккаунтов
- `deleteLuxeeAccount({ userId, accountId })` - удаление аккаунта
- `restoreSession({ userId, accountId })` - восстановление сессии
- `restoreAllSessions({ userId })` - восстановление всех сессий

**Особенности:**
- При логине запускает `keepAliveService` и `messageCheckIntervalService`
- При удалении останавливает оба сервиса
- Использует API авторизацию (POST /luxee-api/login/)

**Используется:** LuxeeController, contextRecoveryService  
**Импортирует:** LuxeeAccountModel, browserService, pageHelpers, chatNavigationService, keepAliveService, messageCheckIntervalService

#### `backend/src/services/luxeeApi/keepAliveService.js`
**Назначение:** Поддержание активности сессии  
**Функции:**
- `start({ accountId, context })` - запуск keep-alive
- `stop(accountId)` - остановка keep-alive

**Механизм:** Каждые 5 минут обновляет страницу для поддержания сессии

**Используется:** luxeeAuthService  
**Импортирует:** pageHelpers

#### `backend/src/services/luxeeApi/messageCheckIntervalService.js`
**Назначение:** Автоматическая проверка сообщений каждые 8 секунд  
**Функции:**
- `start({ userId })` - запуск проверки
- `stop(userId)` - остановка проверки
- `getLastResult(userId)` - последний результат

**Механизм:**
- Интервал 8 секунд
- Вызывает `messageCheckService.checkAllMessages()`
- Логирует только при наличии новых сообщений
- Хранит последний результат в памяти

**Используется:** luxeeAuthService  
**Импортирует:** messageCheckService

#### `backend/src/services/luxeeApi/messageCheckService.js`
**Назначение:** Проверка сообщений БЕЗ переключения профилей  
**Функции:**
- `checkAllMessages({ userId })` - проверить все аккаунты
- `checkAccountMessages({ userId, accountId })` - проверить один аккаунт

**Механизм:**
1. Читает `modelsChat.getProfile.data` → все профили + newMessages + outer UIDs
2. Читает `modelsChat.getChats.list` → все чаты (всех профилей)
3. Парсит `chatId` (формат: `profileUid_memberUid`) чтобы определить профиль
4. Считает `unAnswered` для ВСЕХ UID профиля (inner + outer)
5. Возвращает структурированные данные

**⚠️ ВАЖНАЯ ЛОГИКА:**
- Один профиль может иметь несколько UID (inner + outer)
- `chatId` формат: `"1389492_1602773"` где первая часть - profileUid
- При подсчете `unAnswered` проверяем ВСЕ UID профиля
- Пример: профиль с inner.uid=1420 и outer.uid=1389492 получит unAnswered из чатов обоих UID

**Возвращает:**
```javascript
{
  accounts: [
    {
      accountId, accountEmail,
      profiles: [
        {
          uid, username, avatar,
          newMessages: 5,           // Новые непрочитанные
          unansweredMessages: 2,    // Неотвеченные (из ВСЕХ UID профиля)
          isActive: true
        }
      ],
      totalUnread, profilesCount
    }
  ],
  totalUnread, totalProfiles
}
```

**⚠️ НЕ ИСПОЛЬЗУЕТ ОЧЕРЕДЬ** - просто читает API

**Используется:** LuxeeController, messageCheckIntervalService  
**Импортирует:** LuxeeAccountModel, browserService, pageHelpers

#### `backend/src/services/luxeeApi/messageSendService.js`
**Назначение:** Отправка сообщений ЧЕРЕЗ ОЧЕРЕДЬ  
**Функции:**
- `sendMessage({ userId, accountId, profileUid, memberUid, text, chatIdentity })`

**Механизм:**
1. Добавляет запрос в `requestQueueService`
2. Очередь переключает профиль если нужно
3. Отправляет сообщение через API
4. Обновляет состояние

**⚠️ ИСПОЛЬЗУЕТ ОЧЕРЕДЬ** - требует переключения профилей

**Используется:** LuxeeController  
**Импортирует:** LuxeeAccountModel, browserService, requestQueueService, pageHelpers

#### `backend/src/services/luxeeApi/chatNavigationService.js`
**Назначение:** Навигация в раздел чатов  
**Функции:**
- `navigateToChats({ page })` - переход на /chats/

**Используется:** luxeeAuthService  
**Импортирует:** pageHelpers

#### `backend/src/services/luxeeApi/luxeeScraperService.js`
**Назначение:** Скрапинг данных со страниц Luxee  
**Функции:**
- `getProfiles({ userId, accountId })` - получить профили
- `getPageContent({ userId, accountId, url })` - получить контент страницы

**Используется:** LuxeeController  
**Импортирует:** LuxeeAccountModel, browserService, pageHelpers, profileParserService

#### `backend/src/services/luxeeApi/profileParserService.js`
**Назначение:** Парсинг HTML профилей  
**Функции:**
- `parseProfiles(html)` - парсинг списка профилей

**Используется:** luxeeScraperService  
**Импортирует:** cheerio

---

### 🔒 Middleware

#### `backend/src/middleware/authMiddleware.js`
**Назначение:** Проверка авторизации  
**Функция:** Проверяет access токен в заголовке Authorization

**Используется:** routes/index.js  
**Импортирует:** tokenService, ApiError

#### `backend/src/middleware/roleMiddleware.js`
**Назначение:** Проверка роли пользователя  
**Функция:** Проверяет что у пользователя есть нужная роль

**Используется:** routes/index.js  
**Импортирует:** ApiError

#### `backend/src/middleware/errorMiddleware.js`
**Назначение:** Обработка ошибок  
**Функция:** Централизованная обработка всех ошибок

**Используется:** index.js  
**Импортирует:** ApiError

---

### ⚙️ Config

#### `backend/src/config/browserConfig.js`
**Назначение:** Конфигурация Playwright браузера  
**Настройки:**
- headless: false (видимый браузер)
- viewport: 1920x1080
- userAgent
- locale: ru-RU

**Используется:** browserService

---

### 📦 DTOs & Exceptions

#### `backend/src/dtos/UserDto.js`
**Назначение:** Data Transfer Object для пользователя  
**Используется:** userService

#### `backend/src/exceptions/apiError.js`
**Назначение:** Кастомные ошибки API  
**Используется:** все контроллеры и сервисы

---

## 📁 FRONTEND STRUCTURE

### 🎨 Components

#### `frontend/src/components/Header.jsx`
**Назначение:** Шапка приложения  
**Функции:**
- Отображение email пользователя
- Кнопка выхода
- Переключатель темы

**Используется:** App.jsx  
**Импортирует:** authStore, themeStore

#### `frontend/src/components/Sidebar.jsx`
**Назначение:** Боковая панель с аккаунтами и профилями  
**Функции:**
- Список Luxee аккаунтов
- Список профилей выбранного аккаунта
- Добавление/удаление аккаунтов

**Используется:** Dashboard.jsx  
**Импортирует:** luxeeApi, chatStore

#### `frontend/src/components/ChatWindow.jsx`
**Назначение:** Окно чата  
**Функции:**
- Отображение сообщений
- Отправка сообщений
- Переключение AI

**Используется:** Dashboard.jsx  
**Импортирует:** luxeeApi, chatStore

#### `frontend/src/components/AdminModal.jsx`
**Назначение:** Модальное окно для админа  
**Функции:**
- Регистрация новых пользователей
- Управление пользователями

**Используется:** Dashboard.jsx  
**Импортирует:** authApi, authStore

---

### 📄 Pages

#### `frontend/src/pages/Login.jsx`
**Назначение:** Страница входа  
**Используется:** App.jsx  
**Импортирует:** authApi, authStore

#### `frontend/src/pages/Dashboard.jsx`
**Назначение:** Главная страница приложения  
**Используется:** App.jsx  
**Импортирует:** Sidebar, ChatWindow, AdminModal

---

### 🗃️ Stores (Zustand)

#### `frontend/src/stores/authStore.js`
**Назначение:** Состояние авторизации  
**Состояние:**
- `user` - текущий пользователь
- `isAuth` - авторизован ли
- `isLoading` - загрузка

**Используется:** Login, Dashboard, Header, AdminModal

#### `frontend/src/stores/chatStore.js`
**Назначение:** Состояние чатов  
**Состояние:**
- `selectedAccount` - выбранный Luxee аккаунт
- `selectedProfile` - выбранный профиль
- `selectedChat` - выбранный чат
- `aiEnabled` - включен ли AI
- `aiEnabledByAccount` - AI по аккаунтам

**Используется:** Sidebar, ChatWindow

#### `frontend/src/stores/themeStore.js`
**Назначение:** Состояние темы  
**Состояние:**
- `theme` - текущая тема (light/dark)

**Используется:** Header, App.jsx

---

### 🌐 API

#### `frontend/src/api/axios.js`
**Назначение:** Настроенный axios instance  
**Функции:**
- Автоматическое добавление токенов
- Обновление токенов при 401
- Базовый URL: http://localhost:5000/api

**Используется:** authApi, luxeeApi

#### `frontend/src/api/authApi.js`
**Назначение:** API для авторизации  
**Функции:**
- `login(email, password)`
- `logout()`
- `refresh()`
- `register(email, password)` (admin)
- `getUsers()` (admin)
- `deleteUser(userId)` (admin)

**Используется:** authStore, Login, AdminModal

#### `frontend/src/api/luxeeApi.js`
**Назначение:** API для работы с Luxee  
**Функции:**
- `loginLuxee(email, password)`
- `getAccounts()`
- `deleteAccount(accountId)`
- `restoreSession(accountId)`
- `getProfiles(accountId)`
- `getPageContent(accountId, url)`
- `checkAllMessages()`
- `checkAccountMessages(accountId)`
- `sendMessage(accountId, profileUid, memberUid, text, chatIdentity)`

**Используется:** Sidebar, ChatWindow

---

## 🗑️ УДАЛЕННЫЕ ФАЙЛЫ

### ❌ backend/src/services/luxeeApi/messageCheckerTab.js
**Причина удаления:** Отдельная вкладка на каждый аккаунт больше не нужна  
**Заменено на:** Прямое чтение API в messageCheckService

### ❌ backend/src/services/luxeeApi/messageCheckerManager.js
**Причина удаления:** Управление вкладками больше не нужно  
**Заменено на:** messageCheckIntervalService

---

## 📊 АРХИТЕКТУРА СИСТЕМЫ

### Проверка сообщений (БЕЗ очереди):
```
messageCheckIntervalService (каждые 8 сек)
  ↓
messageCheckService.checkAllMessages()
  ↓
Читает modelsChat.getProfile.data (все профили)
Читает modelsChat.getChats.list (чаты активного профиля)
  ↓
Возвращает: newMessages + unAnswered
```

### Отправка сообщений (В очереди):
```
messageSendService.sendMessage()
  ↓
requestQueueService.addRequest()
  ↓
Очередь обрабатывает последовательно:
  1. Переключает профиль (если нужно)
  2. Отправляет сообщение
  3. Обновляет состояние
```

### Восстановление при старте:
```
index.js запускается
  ↓
contextRecoveryService.restoreAllContexts()
  ↓
Для каждого аккаунта:
  luxeeAuthService.restoreSession()
    ↓
  keepAliveService.start()
  messageCheckIntervalService.start()
```

---

## 🔍 ПОИСК НЕИСПОЛЬЗУЕМОГО КОДА

### ✅ Все файлы используются
После анализа: **все файлы в проекте активно используются**, неиспользуемого кода не обнаружено.

### Исключения (не проверяем):
- `backend/docs/` - справочные файлы
- `docs/` - документация
- `frontend/public/` - статические файлы
- `node_modules/` - зависимости

---

## 📝 ПРИМЕЧАНИЯ

1. **AI функционал** - в разработке, не удаляем
2. **Одна вкладка на аккаунт** - используется для всего
3. **Проверка не блокирует отправку** - разные механизмы
4. **Автовосстановление** - при перезапуске все восстанавливается

---

**Документ актуален на:** 04.05.2026  
**Версия:** 1.0
