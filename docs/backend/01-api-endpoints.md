# API Endpoints

Полное описание всех API эндпоинтов backend системы.

## Базовый URL
```
http://localhost:5000/api
```

## Аутентификация

Большинство эндпоинтов требуют JWT токен в заголовке:
```
Authorization: Bearer <access_token>
```

---

## 1. User Management (Управление пользователями)

### 1.1 POST `/registration`
**Описание**: Регистрация нового пользователя (только для админов)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 1.2 POST `/login`
**Описание**: Вход в систему

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: Аналогично `/registration`

### 1.3 POST `/logout`
**Описание**: Выход из системы (удаляет refresh token, отключает AI для всех аккаунтов)

**Response**:
```json
{
  "success": true
}
```

### 1.4 GET `/refresh`
**Описание**: Обновление access token через refresh token (из cookies)

**Response**: Новые токены

### 1.5 GET `/users`
**Описание**: Получить список всех пользователей (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Response**:
```json
[
  {
    "_id": "...",
    "email": "user@example.com",
    "role": "user",
    "aiEnabled": true,
    "aiEnabledByAdmin": true
  }
]
```

### 1.6 DELETE `/users/:userId`
**Описание**: Удалить пользователя (только админ, нельзя удалять админов и себя)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Response**:
```json
{
  "success": true,
  "message": "Пользователь удалён"
}
```

---

## 2. Luxee Account Management

### 2.1 POST `/luxee/login`
**Описание**: Авторизация на Luxee.io (создаёт браузерный контекст, запускает keep-alive и message check)

**Middleware**: `authMiddleware`

**Body**:
```json
{
  "luxeeEmail": "model@luxee.io",
  "luxeePassword": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Успешная авторизация на Luxee",
  "accountId": "...",
  "luxeeEmail": "model@luxee.io",
  "currentUrl": "https://luxee.io/chats/"
}
```

**Что происходит**:
1. Создаётся браузерный контекст Playwright
2. Выполняется авторизация через API Luxee
3. Сохраняется sessionData в MongoDB
4. Активируется первый профиль
5. Запускается keep-alive (каждые 45 сек)
6. Запускается message check (каждые 8 сек)

### 2.2 GET `/luxee/accounts`
**Описание**: Получить список Luxee аккаунтов пользователя

**Middleware**: `authMiddleware`

**Response**:
```json
[
  {
    "id": "...",
    "luxeeEmail": "model@luxee.io",
    "isActive": true,
    "lastActivity": "2026-05-25T03:00:00.000Z",
    "createdAt": "2026-05-20T10:00:00.000Z"
  }
]
```

### 2.3 DELETE `/luxee/accounts/:accountId`
**Описание**: Удалить Luxee аккаунт (останавливает keep-alive, message check, закрывает контекст)

**Middleware**: `authMiddleware`

**Response**:
```json
{
  "success": true,
  "message": "Аккаунт Luxee удалён"
}
```

### 2.4 POST `/luxee/accounts/:accountId/restore`
**Описание**: Восстановить сессию Luxee аккаунта (после перезапуска сервера)

**Middleware**: `authMiddleware`

**Response**:
```json
{
  "success": true,
  "message": "Сессия восстановлена",
  "currentUrl": "https://luxee.io/chats/"
}
```

### 2.5 GET `/luxee/profiles`
**Описание**: Получить профили Luxee (scraper, устаревший метод)

**Middleware**: `authMiddleware`

**Query**: `accountId`

### 2.6 GET `/luxee/page-content`
**Описание**: Получить содержимое страницы (scraper, устаревший метод)

**Middleware**: `authMiddleware`

**Query**: `accountId`, `url`

---

## 3. Message Management

### 3.1 GET `/luxee/messages/check-all`
**Описание**: Проверить новые сообщения на всех аккаунтах пользователя

**Middleware**: `authMiddleware`

**Response**:
```json
{
  "accounts": [
    {
      "accountId": "...",
      "accountEmail": "model@luxee.io",
      "profiles": [
        {
          "uid": 12345,
          "username": "Anna",
          "avatar": "https://...",
          "newMessages": 3,
          "unansweredMessages": 2,
          "isActive": true,
          "chats": [
            {
              "chatId": "12345_67890",
              "memberUid": 67890,
              "memberUsername": "John",
              "memberAvatar": "https://...",
              "newMessages": 1,
              "unAnswered": true,
              "lastActivity": "1716600000"
            }
          ]
        }
      ],
      "totalUnread": 3,
      "profilesCount": 1
    }
  ],
  "totalUnread": 3,
  "totalProfiles": 1
}
```

**Особенности**:
- Для активного профиля показывает детальную информацию о чатах
- Для неактивных профилей показывает только количество новых сообщений
- Автоматически вызывается каждые 8 секунд через `messageCheckIntervalService`

### 3.2 GET `/luxee/messages/check-account`
**Описание**: Проверить сообщения на конкретном аккаунте

**Middleware**: `authMiddleware`

**Query**: `accountId`

**Response**: Аналогично `/check-all`, но для одного аккаунта

### 3.3 POST `/luxee/messages/send`
**Описание**: Отправить сообщение в чат

**Middleware**: `authMiddleware`

**Body**:
```json
{
  "accountId": "...",
  "profileUid": 12345,
  "memberUid": 67890,
  "text": "Hello!",
  "chatIdentity": "12345_67890"
}
```

**Response**:
```json
{
  "success": true,
  "chatId": "12345_67890",
  "profileUid": 12345,
  "memberUid": 67890,
  "message": "Hello!",
  "timestamp": 1716600000000
}
```

**Что происходит**:
1. Выполняется в очереди `requestQueueService` (предотвращает конфликты)
2. Переключается на профиль
3. Открывает чат
4. Отправляет сообщение через `modelsChat.sendMessage()`
5. Ждёт 2 секунды
6. Проверяет статус `unAnswered`
7. Если `unAnswered === false`, сохраняет чат в MongoDB как отвеченный

---

## 4. Chat Management

### 4.1 GET `/luxee/profile-chats`
**Описание**: Загрузить чаты для профиля (при клике на профиль в UI)

**Middleware**: `authMiddleware`

**Query**: `accountId`, `profileUid`

**Response**:
```json
{
  "chats": [
    {
      "chatId": "12345_67890",
      "memberUid": 67890,
      "memberUsername": "John",
      "memberAvatar": "https://...",
      "newMessages": 1,
      "unAnswered": true,
      "lastActivity": "1716600000",
      "lastManMessage": {
        "body": "Hi!",
        "createdAt": "1716600000"
      },
      "lastWomanMessage": {
        "body": "Hello!",
        "createdAt": "1716599000"
      }
    }
  ],
  "unansweredCount": 1,
  "totalChats": 5
}
```

**Логика**:
- Все неотвеченные чаты (сверху, без лимита)
- До 5 отвеченных чатов из MongoDB (снизу)
- Удаляет из MongoDB чаты которые стали неотвеченными

### 4.2 GET `/luxee/chat/open`
**Описание**: Открыть чат и получить сообщения

**Middleware**: `authMiddleware`

**Query**: `accountId`, `profileUid`, `chatId`

**Response**:
```json
{
  "chatId": "12345_67890",
  "sid": "...",
  "unAnswered": true,
  "lastActivity": "1716600000",
  "lastMessage": {
    "id": "...",
    "uid": 67890,
    "body": "Hi!",
    "createdAt": "1716600000",
    "index": 10,
    "from": "man"
  },
  "lastMessageFrom": "man",
  "man": {
    "uid": 67890,
    "username": "John",
    "avatar": "https://...",
    "age": 35,
    "country": "USA",
    "city": "New York"
  },
  "woman": {
    "uid": 12345,
    "username": "Anna",
    "avatar": "https://..."
  },
  "messages": [
    {
      "id": "...",
      "uid": 67890,
      "body": "Hi!",
      "type": 1,
      "media": [],
      "createdAt": "1716600000",
      "index": 10,
      "from": "man"
    }
  ]
}
```

**Особенности**:
- Определяет от кого последнее сообщение через `unAnswered`
- `unAnswered === true` → последнее от мужчины
- `unAnswered === false` → последнее от девушки
- Возвращает последние 10 сообщений

---

## 5. AI Management

### 5.1 POST `/ai/test`
**Описание**: Тестирование AI ответа (без отправки)

**Middleware**: `authMiddleware`

**Body**:
```json
{
  "profile": {
    "username": "Anna",
    "age": 25,
    "country": "Ukraine"
  },
  "manMessage": "Hi! How are you?",
  "conversationHistory": [
    {
      "from": "man",
      "text": "Hello",
      "timestamp": "2026-05-25T03:00:00.000Z"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "response": "Hi! I'm doing great, thanks for asking! 😊",
  "model": "anthropic/claude-3.5-sonnet",
  "tokensUsed": 150
}
```

### 5.2 GET `/ai/prompt`
**Описание**: Получить системный промпт AI

**Middleware**: `authMiddleware`

**Response**:
```json
{
  "systemPrompt": "You are Anna, a 25-year-old woman...",
  "customRules": [
    {
      "_id": "...",
      "rule": "Always be friendly",
      "description": "...",
      "isActive": true,
      "order": 0
    }
  ]
}
```

---

## 6. AI Rules Management

### 6.1 GET `/ai/rules`
**Описание**: Получить все AI правила

**Middleware**: `authMiddleware`

**Response**:
```json
[
  {
    "_id": "...",
    "rule": "Always be friendly",
    "description": "Be polite and warm",
    "isActive": true,
    "order": 0,
    "createdBy": {
      "_id": "...",
      "email": "admin@example.com"
    },
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-20T10:00:00.000Z"
  }
]
```

### 6.2 POST `/ai/rules`
**Описание**: Создать новое AI правило (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Body**:
```json
{
  "rule": "Always be friendly",
  "description": "Be polite and warm",
  "order": 0
}
```

### 6.3 PUT `/ai/rules/:ruleId`
**Описание**: Обновить AI правило (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Body**: Аналогично POST

### 6.4 DELETE `/ai/rules/:ruleId`
**Описание**: Удалить AI правило (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

### 6.5 POST `/ai/rules/:ruleId/toggle`
**Описание**: Переключить активность правила (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

---

## 7. AI User Management

### 7.1 GET `/ai/users`
**Описание**: Получить AI статус всех пользователей (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Response**:
```json
[
  {
    "_id": "...",
    "email": "user@example.com",
    "role": "user",
    "aiEnabled": true,
    "aiEnabledByAdmin": true
  }
]
```

### 7.2 GET `/ai/my-status`
**Описание**: Получить свой AI статус

**Middleware**: `authMiddleware`

**Response**:
```json
{
  "_id": "...",
  "email": "user@example.com",
  "role": "user",
  "aiEnabled": true,
  "aiEnabledByAdmin": true
}
```

### 7.3 POST `/ai/my-toggle`
**Описание**: Переключить свой AI статус (если разрешено админом)

**Middleware**: `authMiddleware`

**Response**: Обновлённый статус

### 7.4 POST `/ai/users/:userId/set`
**Описание**: Установить AI статус для пользователя (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Body**:
```json
{
  "enabled": true
}
```

---

## 8. AI Account Management

### 8.1 GET `/ai/accounts`
**Описание**: Получить AI статус всех аккаунтов (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Response**:
```json
[
  {
    "_id": "...",
    "userId": {
      "_id": "...",
      "email": "user@example.com"
    },
    "email": "model@luxee.io",
    "aiEnabled": false,
    "aiEnabledByAdmin": true
  }
]
```

### 8.2 GET `/ai/my-accounts`
**Описание**: Получить AI статус своих аккаунтов

**Middleware**: `authMiddleware`

**Response**: Аналогично `/ai/accounts`

### 8.3 POST `/ai/accounts/:accountId/set`
**Описание**: Установить AI статус для аккаунта (только админ)

**Middleware**: `authMiddleware`, `roleMiddleware('admin')`

**Body**:
```json
{
  "enabled": true
}
```

**Что происходит при `enabled: false`**:
- Закрывается AI контекст (`aiContext`)
- AI перестаёт генерировать ответы для этого аккаунта

### 8.4 POST `/ai/my-accounts/:accountId/toggle`
**Описание**: Переключить AI для своего аккаунта

**Middleware**: `authMiddleware`

**Response**: Обновлённый статус

---

## Коды ошибок

- **400** - Bad Request (неверные данные)
- **401** - Unauthorized (не авторизован)
- **403** - Forbidden (нет прав доступа)
- **500** - Internal Server Error

## Примечания

1. **Очередь запросов**: Операции с чатами (send, open, load) выполняются через `requestQueueService` для предотвращения конфликтов
2. **AI контекст**: AI работает через отдельный браузерный контекст для параллельной работы с пользователем
3. **Keep-alive**: Автоматически закрывает popup "You're inactive" каждые 45 секунд
4. **Message check**: Автоматически проверяет новые сообщения каждые 8 секунд
5. **Session recovery**: При перезапуске сервера автоматически восстанавливает все активные сессии через 3 секунды
