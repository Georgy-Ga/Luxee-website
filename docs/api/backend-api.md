# BACKEND REST API

> **REST API эндпоинты нашего backend**  
> **Обновлено:** 04.05.2026

---

## 🌐 BASE URL

```
http://localhost:5000/api
```

---

## 🔐 AUTHENTICATION

### POST /registration

**Описание:** Регистрация нового пользователя (только admin)  
**Body:** `{ email, password }`  
**Response:** `{ accessToken, refreshToken, user }`

### POST /login

**Описание:** Вход в систему  
**Body:** `{ email, password }`  
**Response:** `{ accessToken, refreshToken, user }`

### POST /logout

**Описание:** Выход из системы  
**Response:** `{ message: "Logged out" }`

### GET /refresh

**Описание:** Обновление токенов  
**Cookies:** `refreshToken`  
**Response:** `{ accessToken, refreshToken, user }`

### GET /users

**Описание:** Список пользователей (только admin)  
**Response:** `[{ id, email, role }]`

### DELETE /users/:userId

**Описание:** Удаление пользователя (только admin)  
**Response:** `{ message: "User deleted" }`

---

## 💬 LUXEE ACCOUNTS

### POST /luxee/login

**Описание:** Логин в Luxee аккаунт  
**Body:** `{ luxeeEmail, luxeePassword }`  
**Response:** `{ accountId, luxeeEmail, profiles }`

### GET /luxee/accounts

**Описание:** Список Luxee аккаунтов  
**Response:** `[{ _id, luxeeEmail, isActive, lastActivity }]`

### DELETE /luxee/accounts/:accountId

**Описание:** Удалить Luxee аккаунт  
**Response:** `{ message: "Account deleted" }`

### POST /luxee/accounts/:accountId/restore

**Описание:** Восстановить сессию  
**Response:** `{ message: "Session restored" }`

### GET /luxee/profiles

**Описание:** Получить профили аккаунта  
**Query:** `accountId`  
**Response:** `[{ uid, username, avatar }]`

---

## 📨 MESSAGES

### GET /luxee/messages/check-all

**Описание:** Проверить сообщения на всех аккаунтах  
**Response:**

```javascript
{
	accounts: ([
		{
			accountId,
			accountEmail,
			profiles: [
				{
					uid,
					username,
					avatar,
					newMessages: 5,
					unansweredMessages: 2,
					isActive: true,
				},
			],
			totalUnread,
			profilesCount,
		},
	],
		totalUnread,
		totalProfiles);
}
```

### GET /luxee/messages/check-account

**Описание:** Проверить сообщения на конкретном аккаунте  
**Query:** `accountId`  
**Response:** То же что check-all, но для одного аккаунта

### POST /luxee/messages/send

**Описание:** Отправить сообщение  
**Body:**

```javascript
{
  accountId: "...",
  profileUid: 1420,
  memberUid: 1602773,
  text: "Hello!",
  chatIdentity: "1420_1602773"  // ⚠️ ВАЖНО: полный chatId!
}
```

**Response:** `{ success: true, message: "Message sent" }`

### GET /luxee/profile-chats

**Описание:** Загрузить чаты профиля (при клике на профиль)  
**Query:** `accountId`, `profileUid`  
**Response:**

```javascript
{
  chats: [
    {
      chatId: "1420_1602773",
      memberUid: 1602773,
      memberUsername: "Jimmy",
      memberAvatar: "https://...",
      newMessages: 5,
      unAnswered: true,
      lastActivity: "1763422754156",
      lastManMessage: { body: "Hi", createdAt: "..." },
      lastWomanMessage: { body: "Hello", createdAt: "..." }
    }
  ],
  unansweredCount: 2,
  totalChats: 5
}
```

### GET /luxee/chat/open

**Описание:** Открыть чат и получить последнее сообщение  
**Query:** `accountId`, `profileUid`, `chatId`  
**Response:**

```javascript
{
  chatId: "1420_1602773",
  sid: "63d837d09a3e167ead0dd9bb",
  unAnswered: false,
  lastActivity: "1763422754156",
  lastMessage: {
    id: "...",
    uid: 1602773,
    body: "Hello!",
    createdAt: "...",
    from: "man"
  },
  lastMessageFrom: "man",
  man: {
    uid: 1602773,
    username: "Jimmy",
    avatar: "https://...",
    age: 45,
    country: "United States",
    city: "Oceanside"
  },
  woman: {
    uid: 1420,
    username: "Maria",
    avatar: "https://..."
  },
  messages: [ /* последние 10 сообщений */ ]
}
```

---

## 🤖 AI TESTING

### POST /ai/test

**Описание:** Тестирование AI ответа  
**Body:**

```javascript
{
  profile: {
    username: "Maria",
    age: 25,
    country: "Ukraine",
    city: "Kyiv",
    bio: "I love traveling"
  },
  message: "Hi! How are you?",
  history: [
    { from: "man", body: "Hello" },
    { from: "woman", body: "Hi there!" }
  ]
}
```

**Response:**

```javascript
{
  success: true,
  response: "Hi dear! I'm doing great, thank you! 😊",
  profile: { username: "Maria", age: 25, country: "Ukraine", city: "Kyiv" }
}
```

### GET /ai/prompt

**Описание:** Получить системный промпт AI  
**Response:**

```javascript
{
  success: true,
  rules: [ /* массив правил */ ],
  style: [ /* стиль общения */ ]
}
```

---

## 🎛️ AI MANAGEMENT

### GET /ai/rules

**Описание:** Получить все AI правила  
**Response:** `[{ _id, rule, description, isActive, order }]`

### POST /ai/rules

**Описание:** Создать новое правило (только admin)  
**Body:** `{ rule, description, order }`  
**Response:** `{ _id, rule, description, isActive, order }`

### PUT /ai/rules/:ruleId

**Описание:** Обновить правило (только admin)  
**Body:** `{ rule, description, order }`  
**Response:** `{ _id, rule, description, isActive, order }`

### DELETE /ai/rules/:ruleId

**Описание:** Удалить правило (только admin)  
**Response:** `{ message: "Rule deleted" }`

### POST /ai/rules/:ruleId/toggle

**Описание:** Включить/выключить правило (только admin)  
**Response:** `{ _id, rule, isActive }`

### GET /ai/users

**Описание:** Получить AI статус всех пользователей (только admin)  
**Response:** `[{ _id, email, role, aiEnabled, aiEnabledByAdmin }]`

### GET /ai/my-status

**Описание:** Получить свой AI статус  
**Response:** `{ email, role, aiEnabled, aiEnabledByAdmin }`

### POST /ai/my-toggle

**Описание:** Включить/выключить AI для себя  
**Response:** `{ email, role, aiEnabled, aiEnabledByAdmin }`

### POST /ai/users/:userId/set

**Описание:** Админ включает/выключает AI для пользователя (только admin)  
**Body:** `{ enabled: true/false }`  
**Response:** `{ email, role, aiEnabled, aiEnabledByAdmin }`

---

## 🔑 ВАЖНЫЕ МОМЕНТЫ

### Авторизация:

- Все эндпоинты (кроме /login, /registration, /refresh) требуют `Authorization: Bearer <accessToken>`
- Admin эндпоинты требуют роль `admin`

### chatIdentity:

- **ВСЕГДА** используй полный формат: `"profileUid_memberUid"`
- **НЕ** используй только `memberUid`
- Подробнее: `../architecture/chat-identity.md`

### Проверка сообщений:

- Работает БЕЗ переключения профилей
- Возвращает `newMessages` и `unansweredMessages`
- `unansweredMessages` учитывает ВСЕ UID профиля (inner + outer)

---

**Связанные документы:**

- `luxee-api.md` - Luxee JavaScript API
- `../architecture/message-flow.md` - как работает проверка/отправка
- `../backend/services.md` - backend сервисы
