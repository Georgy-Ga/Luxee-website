# Services - Детальное описание

## Обзор сервисов

Backend содержит 25+ сервисов, разделённых на 5 категорий:

1. **User Services** - Управление пользователями и токенами
2. **Browser Services** - Автоматизация браузера через Playwright
3. **Luxee API Services** - Интеграция с Luxee.io
4. **AI Services** - Генерация ответов через OpenRouter
5. **Data Services** - Работа с MongoDB

---

## 1. User Services

### 1.1 userService.js
**Назначение**: CRUD операции с пользователями

**Основные функции**:
```javascript
registration(email, password) // Создание пользователя
login(email, password)         // Авторизация
getAllUsers()                  // Список всех пользователей (admin)
deleteUser(userId)             // Удаление пользователя (admin)
```

**Особенности**:
- Хеширование паролей через bcrypt (salt=3)
- Проверка уникальности email
- Генерация JWT токенов
- Нельзя удалять админов и себя

### 1.2 tokenService.js
**Назначение**: Генерация и валидация JWT токенов

**Основные функции**:
```javascript
generateTokens(payload)        // Access (300m) + Refresh (30d)
validateAccessToken(token)     // Проверка access token
validateRefreshToken(token)    // Проверка refresh token
saveToken(userId, refreshToken) // Сохранение в MongoDB
removeToken(refreshToken)      // Удаление при logout
findToken(refreshToken)        // Поиск токена
```

**Токены**:
- **Access**: 300 минут (5 часов) ⚠️ Слишком долго
- **Refresh**: 30 дней
- Хранятся в MongoDB (коллекция Token)

### 1.3 aiRuleService.js
**Назначение**: Управление кастомными AI правилами

**Основные функции**:
```javascript
getAllRules()                  // Все правила
getActiveRules()               // Только активные
createRule(data)               // Создание (admin)
updateRule(id, data)           // Обновление (admin)
deleteRule(id)                 // Удаление (admin)
toggleRule(id)                 // Вкл/выкл (admin)
```

---

## 2. Browser Services

### 2.1 browserService.js
**Назначение**: Управление Playwright браузером и контекстами

**Singleton паттерн**: Один браузер на всё приложение

**Основные функции**:
```javascript
getBrowser()                   // Получить/создать браузер
getOrCreateContext(accountId)  // Получить/создать контекст
closeContext(accountId)        // Закрыть контекст
closeAllContexts()             // Закрыть все контексты
```

**Структура**:
```javascript
{
  browser: ChromiumBrowser,
  contexts: Map<accountId, {
    context: BrowserContext,
    page: Page,
    accountId: string
  }>
}
```

**Проблемы**:
- ❌ Нет обработки краша браузера
- ❌ Контексты не очищаются автоматически
- ❌ Утечка памяти при большом количестве контекстов

### 2.2 pageHelpers.js
**Назначение**: Вспомогательные функции для работы со страницами

**Основные функции**:
```javascript
waitForPageLoad(page)          // Ждать загрузки страницы
getCurrentUrl(page)            // Получить текущий URL
isOnChatsPage(page)            // Проверка что на странице чатов
```

**Проблемы**:
- ❌ Нет таймаутов
- ❌ Фиксированные задержки (setTimeout)

### 2.3 requestQueueService.js
**Назначение**: Очередь запросов для предотвращения конфликтов

**Singleton паттерн**: Одна очередь на всё приложение

**Основные функции**:
```javascript
addToQueue(task)               // Добавить задачу в очередь
```

**Логика**:
```javascript
1. Добавить задачу в очередь
2. Если не обрабатывается → начать обработку
3. Выполнить задачу
4. Взять следующую задачу
5. Повторить
```

**Проблемы**:
- ❌ Race condition при быстрых запросах
- ❌ Нет приоритетов
- ❌ Нет таймаутов для задач

### 2.4 contextRecoveryService.js
**Назначение**: Восстановление контекстов после перезапуска

**Основные функции**:
```javascript
recoverAllContexts()           // Восстановить все контексты
recoverContext(accountId)      // Восстановить один контекст
```

**Логика**:
```javascript
1. Найти все активные аккаунты в MongoDB
2. Для каждого аккаунта:
   - Создать контекст из sessionData
   - Запустить keep-alive
   - Запустить message check
```

**Вызывается**: Через 3 секунды после запуска сервера

### 2.5 aiBrowserContextService.js
**Назначение**: Управление отдельными AI контекстами

**Основные функции**:
```javascript
getOrCreateAiContext(accountId) // Получить/создать AI контекст
closeAiContext(accountId)       // Закрыть AI контекст
```

**Зачем нужно**: AI и пользователь работают параллельно без конфликтов

**Проблемы**:
- ❌ Двойное потребление памяти (~200MB на аккаунт)

---

## 3. Luxee API Services

### 3.1 luxeeAuthService (Авторизация)

#### 3.1.1 index.js
**Назначение**: Главный сервис авторизации

**Основные функции**:
```javascript
login({ userId, luxeeEmail, luxeePassword })
logout(accountId)
```

**Полный цикл login**:
```javascript
1. Создать/получить браузерный контекст
2. loginService.performLogin() → авторизация на Luxee
3. sessionService.saveSession() → сохранить в MongoDB
4. profileActivationService.activateFirstProfile()
5. keepAliveService.start() → каждые 45 сек
6. messageCheckIntervalService.start() → каждые 8 сек
```

#### 3.1.2 loginService.js
**Назначение**: Выполнение авторизации на Luxee.io

**Логика**:
```javascript
1. Открыть luxee.io/login
2. page.evaluate(() => {
     modelsChat.login(email, password)
   })
3. Ждать редиректа на /chats/
4. Вернуть успех
```

#### 3.1.3 sessionService.js
**Назначение**: Сохранение/восстановление сессии

**Основные функции**:
```javascript
saveSession(context, accountId)    // Сохранить cookies + localStorage
restoreSession(context, sessionData) // Восстановить сессию
```

**Формат sessionData**:
```json
{
  "cookies": [...],
  "localStorage": {...}
}
```

#### 3.1.4 accountService.js
**Назначение**: CRUD операции с Luxee аккаунтами

**Основные функции**:
```javascript
createAccount(userId, luxeeEmail, luxeePassword)
getAccountsByUser(userId)
deleteAccount(accountId)
updateLastActivity(accountId)
```

### 3.2 messageCheckService (Проверка сообщений)

#### 3.2.1 index.js
**Назначение**: Главный сервис проверки сообщений

**Основные функции**:
```javascript
checkMessages(accountId)       // Проверить сообщения аккаунта
```

#### 3.2.2 checkAllMessages.js
**Назначение**: Проверка всех аккаунтов пользователя

**Основные функции**:
```javascript
checkAllUserMessages(userId)   // Проверить все аккаунты
```

**Логика**:
```javascript
1. Получить все активные аккаунты пользователя
2. Для каждого аккаунта:
   - checkAccountMessages()
   - Если AI включен → aiResponseService.generateAndSend()
```

#### 3.2.3 checkAccountMessages.js
**Назначение**: Проверка сообщений одного аккаунта

**Логика**:
```javascript
1. profileParserService.getProfiles()
2. Для активного профиля:
   - chatExtractor.getProfileChatsWithUnanswered()
   - Для каждого неотвеченного чата:
     - Если AI включен → генерировать ответ
```

#### 3.2.4 profileDataExtractor.js
**Назначение**: Извлечение данных профиля для AI

**Основные функции**:
```javascript
extractProfileData(page, profileUid) // Имя, возраст, страна и т.д.
```

### 3.3 messageCheckIntervalService.js
**Назначение**: Автоматическая проверка каждые 8 секунд

**Основные функции**:
```javascript
start(accountId)               // Запустить интервал
stop(accountId)                // Остановить интервал
```

**Проблемы**:
- ❌ Утечка памяти (интервалы не очищаются)
- ❌ Нет проверки что аккаунт активен
- ❌ Может запускаться параллельно

### 3.4 profileParserService (Парсинг данных)

#### 3.4.1 profileExtractor.js
**Назначение**: Извлечение списка профилей

**Основные функции**:
```javascript
getProfiles(page)              // Получить все профили
```

**Логика**:
```javascript
page.evaluate(() => {
  return modelsChat.getProfiles();
})
```

#### 3.4.2 chatExtractor.js
**Назначение**: Извлечение чатов профиля

**Основные функции**:
```javascript
getProfileChatsWithUnanswered(page, profileUid)
```

**Логика**:
```javascript
1. page.evaluate(() => modelsChat.selectProfile(uid))
2. Ждать 1 секунду
3. page.evaluate(() => modelsChat.getChats())
4. Фильтровать неотвеченные (unAnswered === true)
```

#### 3.4.3 messageExtractor.js
**Назначение**: Извлечение сообщений чата

**Основные функции**:
```javascript
getChatMessages(page, chatId)  // Получить сообщения
```

### 3.5 messageSendService.js
**Назначение**: Отправка сообщений

**Основные функции**:
```javascript
sendMessage({ accountId, profileUid, memberUid, text, chatIdentity })
```

**Логика**:
```javascript
1. Добавить в requestQueueService
2. page.evaluate(() => modelsChat.selectProfile(profileUid))
3. page.evaluate(() => modelsChat.selectChat(memberUid))
4. page.evaluate(() => modelsChat.sendMessage(text))
5. Ждать 2 секунды
6. Проверить unAnswered статус
7. Если false → answeredChatService.saveAnsweredChat()
```

### 3.6 chatOpenService.js
**Назначение**: Открытие чата и получение сообщений

**Основные функции**:
```javascript
openChat({ accountId, profileUid, chatId })
```

**Возвращает**:
```javascript
{
  chatId, sid, unAnswered, lastActivity,
  man: { uid, username, avatar, age, country, city },
  woman: { uid, username, avatar },
  messages: [...],
  lastMessage, lastMessageFrom
}
```

### 3.7 profileChatsLoadService.js
**Назначение**: Загрузка чатов при клике на профиль

**Основные функции**:
```javascript
loadProfileChats({ accountId, profileUid })
```

**Логика**:
```javascript
1. Получить неотвеченные чаты (все)
2. Получить отвеченные чаты из MongoDB (до 5)
3. Удалить из MongoDB чаты которые стали неотвеченными
4. Вернуть объединённый список
```

### 3.8 profileActivationService.js
**Назначение**: Активация профилей

**Основные функции**:
```javascript
activateFirstProfile(page)     // Активировать первый профиль
activateProfile(page, uid)     // Активировать конкретный профиль
```

### 3.9 keepAliveService.js
**Назначение**: Поддержание активности (закрытие popup)

**Основные функции**:
```javascript
start(accountId)               // Запустить keep-alive
stop(accountId)                // Остановить keep-alive
```

**Логика**:
```javascript
setInterval(() => {
  page.evaluate(() => {
    const popup = document.querySelector('.inactive-popup');
    if (popup) popup.remove();
  });
}, 45000); // Каждые 45 секунд
```

---

## 4. AI Services

### 4.1 aiService (Генерация ответов)

#### 4.1.1 config.js
**Конфигурация**:
```javascript
{
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.9,
  maxTokens: 500
}
```

#### 4.1.2 promptBuilder.js
**Назначение**: Построение промпта для AI

**Основные функции**:
```javascript
buildSystemPrompt(profile, customRules)
buildUserPrompt(manMessage, conversationHistory)
```

#### 4.1.3 apiClient.js
**Назначение**: HTTP клиент для OpenRouter

**Основные функции**:
```javascript
sendRequest(systemPrompt, userPrompt)
```

#### 4.1.4 responseGenerator.js
**Назначение**: Главная логика генерации

**Основные функции**:
```javascript
generateResponse({ profile, manMessage, conversationHistory })
```

#### 4.1.5 responseValidator.js
**Назначение**: Валидация ответа AI

**Проверки**:
- Не пустой
- Длина < 500 символов
- Нет запрещённых слов

#### 4.1.6 testService.js
**Назначение**: Тестирование AI без отправки

### 4.2 aiResponseService.js
**Назначение**: Полный цикл генерации + отправки

**Основные функции**:
```javascript
generateAndSend({ accountId, profileUid, chatId, manMessage, conversationHistory })
```

**Логика**:
```javascript
1. Проверка прав (canUserUseAi, canAccountUseAi)
2. aiService.generateResponse()
3. Повторная проверка прав
4. Отправка через AI контекст
5. answeredChatService.saveAnsweredChat()
```

### 4.3 aiManagementService (Управление правами)

#### 4.3.1 userAiService.js
**Назначение**: Управление AI для пользователей

**Основные функции**:
```javascript
canUserUseAi(userId)
toggleUserAi(userId)
setUserAi(userId, enabled)     // Admin only
```

#### 4.3.2 accountAiService.js
**Назначение**: Управление AI для аккаунтов

**Основные функции**:
```javascript
canAccountUseAi(userId, accountId)
toggleAccountAi(userId, accountId)
setAccountAi(accountId, enabled) // Admin only
```

---

## 5. Data Services

### 5.1 answeredChatService.js
**Назначение**: Работа с отвеченными чатами

**Основные функции**:
```javascript
saveAnsweredChat(accountId, profileUid, chatData)
removeAnsweredChat(accountId, profileUid, chatId)
getAnsweredChats(accountId, profileUid)
```

**Логика сохранения**:
```javascript
1. Найти документ по accountId + profileUid
2. Если чат есть → обновить
3. Если нет → добавить в начало
4. Сортировать по savedAt
5. Ограничить до 5 чатов
```

---

## Зависимости между сервисами

```
browserService
    ├── contextRecoveryService
    ├── aiBrowserContextService
    └── requestQueueService
         └── messageSendService
         └── chatOpenService
         └── profileChatsLoadService

luxeeAuthService
    ├── loginService
    ├── sessionService
    ├── accountService
    └── profileActivationService

messageCheckService
    ├── checkAllMessages
    ├── checkAccountMessages
    ├── profileDataExtractor
    └── profileParserService
         ├── profileExtractor
         ├── chatExtractor
         └── messageExtractor

aiService
    ├── config
    ├── promptBuilder
    ├── apiClient
    ├── responseGenerator
    ├── responseValidator
    └── testService

aiResponseService
    ├── aiService
    ├── aiManagementService
    └── aiBrowserContextService

aiManagementService
    ├── userAiService
    └── accountAiService
```

---

## Заключение

Сервисы хорошо структурированы, но есть проблемы:
1. ❌ Нет обработки ошибок браузера
2. ❌ Race conditions в очереди
3. ❌ Утечки памяти в интервалах
4. ❌ Нет таймаутов
5. ❌ Фиксированные задержки

См. [Problems & Solutions](./06-problems-solutions.md) для деталей.
