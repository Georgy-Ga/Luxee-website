# BACKEND SERVICES

> **Краткое описание всех сервисов**  
> **Обновлено:** 04.05.2026

---

## 🔐 CORE SERVICES

### userService.js
**Путь:** `backend/src/services/userService.js`  
**Назначение:** Управление пользователями системы  
**Методы:** registration, login, logout, refresh, getAllUsers, deleteUser

### tokenService.js
**Путь:** `backend/src/services/tokenService.js`  
**Назначение:** JWT токены (access/refresh)  
**Методы:** generateTokens, validateAccessToken, validateRefreshToken, saveToken, removeToken, findToken

---

## 🌐 BROWSER SERVICES

### browserService.js
**Путь:** `backend/src/services/browser/browserService.js`  
**Назначение:** Управление Playwright браузером и контекстами  
**Методы:** initialize, createContext, getContext, closeContext, saveSessionState, closeAll  
**Важно:** Один контекст = один Luxee аккаунт

### pageHelpers.js
**Путь:** `backend/src/services/browser/pageHelpers.js`  
**Назначение:** Вспомогательные функции для работы со страницами  
**Методы:** getOrCreatePage, navigateTo, getCurrentUrl, waitForSelector, clickElement, typeText

### requestQueueService.js
**Путь:** `backend/src/services/browser/requestQueueService.js`  
**Назначение:** Очередь для отправки сообщений  
**Методы:** addRequest, processQueue, getQueueStatus  
**⚠️ Используется ТОЛЬКО для отправки (требует переключения профилей)**

### contextRecoveryService.js
**Путь:** `backend/src/services/browser/contextRecoveryService.js`  
**Назначение:** Восстановление контекстов при перезапуске  
**Методы:** restoreAllContexts, restoreUserContexts  
**Запуск:** Автоматически при старте сервера (index.js)

---

## 💬 LUXEE API SERVICES

### luxeeAuthService.js
**Путь:** `backend/src/services/luxeeApi/luxeeAuthService.js`  
**Назначение:** Авторизация в Luxee  
**Методы:** login, getLuxeeAccounts, deleteLuxeeAccount, restoreSession, restoreAllSessions  
**Важно:** При логине запускает keepAliveService и messageCheckIntervalService

### keepAliveService.js
**Путь:** `backend/src/services/luxeeApi/keepAliveService.js`  
**Назначение:** Поддержание активности сессии  
**Методы:** start, stop  
**Механизм:** Обновляет страницу каждые 5 минут

### messageCheckIntervalService.js
**Путь:** `backend/src/services/luxeeApi/messageCheckIntervalService.js`  
**Назначение:** Автоматическая проверка сообщений  
**Методы:** start, stop, getLastResult  
**Механизм:** Вызывает messageCheckService каждые 8 секунд

### messageCheckService.js
**Путь:** `backend/src/services/luxeeApi/messageCheckService.js`  
**Назначение:** Проверка сообщений БЕЗ переключения профилей  
**Методы:** checkAllMessages, checkAccountMessages  
**Механизм:**
1. Читает `modelsChat.getProfile.data` → профили + newMessages
2. Читает `modelsChat.getChats.list` → чаты
3. Парсит `chatId` (формат: `profileUid_memberUid`)
4. Считает `unAnswered` для всех UID профиля (inner + outer)

**⚠️ НЕ использует очередь, НЕ переключает профили**

### messageSendService.js
**Путь:** `backend/src/services/luxeeApi/messageSendService.js`  
**Назначение:** Отправка сообщений ЧЕРЕЗ очередь  
**Методы:** sendMessage  
**Механизм:**
1. Добавляет в requestQueueService
2. Очередь переключает профиль
3. Отправляет через API

**⚠️ Использует очередь, переключает профили**

### luxeeScraperService.js
**Путь:** `backend/src/services/luxeeApi/luxeeScraperService.js`  
**Назначение:** Скрапинг данных со страниц  
**Методы:** getProfiles, getPageContent

### profileParserService.js
**Путь:** `backend/src/services/luxeeApi/profileParserService.js`  
**Назначение:** Парсинг HTML профилей  
**Методы:** parseProfiles  
**Использует:** cheerio

### chatNavigationService.js
**Путь:** `backend/src/services/luxeeApi/chatNavigationService.js`  
**Назначение:** Навигация в раздел чатов  
**Методы:** navigateToChats

---

## 🔑 КЛЮЧЕВЫЕ СВЯЗИ

### При логине в Luxee:
```
luxeeAuthService.login()
  ↓
browserService.createContext()
  ↓
keepAliveService.start()
messageCheckIntervalService.start()
```

### При проверке сообщений:
```
messageCheckIntervalService (каждые 8 сек)
  ↓
messageCheckService.checkAllMessages()
  ↓
Читает modelsChat API напрямую
```

### При отправке сообщения:
```
messageSendService.sendMessage()
  ↓
requestQueueService.addRequest()
  ↓
Очередь обрабатывает последовательно
```

### При перезапуске сервера:
```
index.js
  ↓
contextRecoveryService.restoreAllContexts()
  ↓
Для каждого аккаунта:
  luxeeAuthService.restoreSession()
  keepAliveService.start()
  messageCheckIntervalService.start()
```

---

**Связанные документы:**
- `../architecture/message-flow.md` - как работают сервисы
- `../architecture/project-structure.md` - полная структура
- `../api/luxee-api.md` - Luxee API
