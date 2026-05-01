# ⚡ Тесты для Thunder Client

> Все запросы готовы для копирования в Thunder Client  
> Порт сервера: `http://localhost:5000`

---

## 📋 Порядок тестирования

1. ✅ Добавить админа в MongoDB
2. 🔐 Авторизоваться (получить токен)
3. ➕ Добавить аккаунт Luxee #1
4. ➕ Добавить аккаунт Luxee #2
5. 📊 Проверить список аккаунтов
6. 📬 Проверить сообщения на всех аккаунтах
7. 📬 Проверить сообщения на конкретном аккаунте
8. 📬 Проверить только непрочитанные
9. 🔄 Восстановить сессию (если нужно)
10. ❌ Удалить аккаунт (опционально)

---

## 1️⃣ Добавить админа в MongoDB Compass

### Подключение:
```
mongodb://localhost:27017
```

### База данных:
```
model-site
```

### Коллекция:
```
users
```

### JSON для вставки:
```json
{
  "email": "admin",
  "password": "$2b$04$yUL3sn6k9j16khvQQ872LuGlQHmIwdQuSXWj2ti3vhd1N2KlaIgOG",
  "role": "admin"
}
```

**Данные для входа:**
- Email: `admin`
- Пароль: `admin`

---

## 2️⃣ Авторизация (Получить токен)

### Thunder Client:
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/login`
- **Headers:** `Content-Type: application/json`

### Body (JSON):
```json
{
  "email": "admin",
  "password": "admin"
}
```

### Ожидаемый ответ:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "admin",
    "id": "507f1f77bcf86cd799439011",
    "role": "admin"
  }
}
```

**⚠️ ВАЖНО:** Скопируй `accessToken` - он понадобится для всех следующих запросов!

---

## 3️⃣ Добавить аккаунт Luxee #1

### Thunder Client:
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/luxee/login`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

### Body (JSON):
```json
{
  "luxeeEmail": "translator40@gmail.com",
  "luxeePassword": "111111"
}
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "message": "Успешная авторизация на Luxee",
  "accountId": "507f1f77bcf86cd799439011",
  "luxeeEmail": "translator40@gmail.com",
  "currentUrl": "https://luxee.io/chats/"
}
```

**⚠️ Сохрани `accountId` - понадобится для тестов!**

---

## 4️⃣ Добавить аккаунт Luxee #2

### Thunder Client:
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/luxee/login`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

### Body (JSON):
```json
{
  "luxeeEmail": "ВТОРОЙ_EMAIL@gmail.com",
  "luxeePassword": "ВТОРОЙ_ПАРОЛЬ"
}
```

**⚠️ Замени на данные твоего второго аккаунта!**

### Ожидаемый ответ:
```json
{
  "success": true,
  "message": "Успешная авторизация на Luxee",
  "accountId": "507f1f77bcf86cd799439012",
  "luxeeEmail": "ВТОРОЙ_EMAIL@gmail.com",
  "currentUrl": "https://luxee.io/chats/"
}
```

**⚠️ Сохрани `accountId` второго аккаунта!**

---

## 5️⃣ Проверить список аккаунтов

### Thunder Client:
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/luxee/accounts`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

### Body:
```
Нет (GET запрос)
```

### Ожидаемый ответ:
```json
{
  "accounts": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "luxeeEmail": "translator40@gmail.com",
      "isActive": true,
      "lastLogin": "2026-04-26T08:00:00.000Z",
      "createdAt": "2026-04-26T08:00:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "luxeeEmail": "ВТОРОЙ_EMAIL@gmail.com",
      "isActive": true,
      "lastLogin": "2026-04-26T08:01:00.000Z",
      "createdAt": "2026-04-26T08:01:00.000Z"
    }
  ]
}
```

**✅ Должно быть 2 аккаунта!**

---

## 6️⃣ Проверить сообщения на ВСЕХ аккаунтах

### Thunder Client:
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/luxee/check-messages`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

### Body:
```
Нет (GET запрос)
```

### Ожидаемый ответ:
```json
{
  "accounts": [
    {
      "accountId": "507f1f77bcf86cd799439011",
      "accountEmail": "translator40@gmail.com",
      "profiles": [
        {
          "uid": 1420,
          "username": "Maria",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 5,
          "lastActivity": 1777095962,
          "projectsCount": 5
        },
        {
          "uid": 608078,
          "username": "Julia",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 0,
          "lastActivity": 1774265102,
          "projectsCount": 5
        }
      ],
      "totalUnread": 5,
      "profilesCount": 2
    },
    {
      "accountId": "507f1f77bcf86cd799439012",
      "accountEmail": "ВТОРОЙ_EMAIL@gmail.com",
      "profiles": [
        {
          "uid": 2530,
          "username": "Anna",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 3,
          "lastActivity": 1777095962,
          "projectsCount": 4
        }
      ],
      "totalUnread": 3,
      "profilesCount": 1
    }
  ],
  "totalUnread": 8,
  "totalProfiles": 3
}
```

**✅ Проверь:**
- Есть данные по обоим аккаунтам
- Видны профили с `newMessages`
- Правильный `totalUnread`

---

## 7️⃣ Проверить сообщения на КОНКРЕТНОМ аккаунте

### Thunder Client:
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/luxee/check-messages/account?accountId=507f1f77bcf86cd799439011`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

**⚠️ Замени `507f1f77bcf86cd799439011` на реальный accountId из шага 3!**

### Body:
```
Нет (GET запрос)
```

### Ожидаемый ответ:
```json
{
  "accountId": "507f1f77bcf86cd799439011",
  "accountEmail": "translator40@gmail.com",
  "profiles": [
    {
      "uid": 1420,
      "username": "Maria",
      "avatar": "https://img.luxee.date/thumb/...",
      "newMessages": 5,
      "lastActivity": 1777095962,
      "projectsCount": 5
    },
    {
      "uid": 608078,
      "username": "Julia",
      "avatar": "https://img.luxee.date/thumb/...",
      "newMessages": 0,
      "lastActivity": 1774265102,
      "projectsCount": 5
    }
  ],
  "totalUnread": 5,
  "profilesCount": 2
}
```

**✅ Проверь:**
- Данные только по одному аккаунту
- Все профили этого аккаунта

---

## 8️⃣ Проверить только НЕПРОЧИТАННЫЕ сообщения

### Thunder Client:
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/luxee/check-messages/unread`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

### Body:
```
Нет (GET запрос)
```

### Ожидаемый ответ:
```json
{
  "accounts": [
    {
      "accountId": "507f1f77bcf86cd799439011",
      "accountEmail": "translator40@gmail.com",
      "profiles": [
        {
          "uid": 1420,
          "username": "Maria",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 5,
          "lastActivity": 1777095962,
          "projectsCount": 5
        }
      ],
      "totalUnread": 5,
      "profilesCount": 1
    },
    {
      "accountId": "507f1f77bcf86cd799439012",
      "accountEmail": "ВТОРОЙ_EMAIL@gmail.com",
      "profiles": [
        {
          "uid": 2530,
          "username": "Anna",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 3,
          "lastActivity": 1777095962,
          "projectsCount": 4
        }
      ],
      "totalUnread": 3,
      "profilesCount": 1
    }
  ],
  "totalUnread": 8
}
```

**✅ Проверь:**
- Только профили с `newMessages > 0`
- Профили с `newMessages: 0` не показываются

---

## 9️⃣ Восстановить сессию (если контекст потерян)

### Thunder Client:
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/luxee/accounts/507f1f77bcf86cd799439011/restore`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

**⚠️ Замени `507f1f77bcf86cd799439011` на реальный accountId!**

### Body:
```
Нет (POST без body)
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "message": "Сессия восстановлена",
  "accountId": "507f1f77bcf86cd799439011",
  "currentUrl": "https://luxee.io/chats/"
}
```

**Когда использовать:**
- Если получаешь ошибку "Context not found"
- После перезапуска сервера
- Если аккаунт ушёл в оффлайн

---

## 🔟 Удалить аккаунт (опционально)

### Thunder Client:
- **Method:** `DELETE`
- **URL:** `http://localhost:5000/api/luxee/accounts/507f1f77bcf86cd799439011`
- **Headers:**
  - `Authorization: Bearer ВАШ_ТОКЕН_СЮДА`

**⚠️ Замени `507f1f77bcf86cd799439011` на реальный accountId!**

### Body:
```
Нет (DELETE запрос)
```

### Ожидаемый ответ:
```json
{
  "success": true,
  "message": "Аккаунт успешно удалён"
}
```

**⚠️ ВНИМАНИЕ:** Это удалит аккаунт из БД и закроет браузерный контекст!

---

## 🎯 Быстрая шпаргалка

### 1. Логин
```
POST http://localhost:5000/api/login
Body: {"email":"admin","password":"admin"}
```

### 2. Добавить аккаунт
```
POST http://localhost:5000/api/luxee/login
Header: Authorization: Bearer ТОКЕН
Body: {"luxeeEmail":"translator40@gmail.com","luxeePassword":"111111"}
```

### 3. Список аккаунтов
```
GET http://localhost:5000/api/luxee/accounts
Header: Authorization: Bearer ТОКЕН
```

### 4. Проверить сообщения
```
GET http://localhost:5000/api/luxee/check-messages
Header: Authorization: Bearer ТОКЕН
```

---

## 📝 Чеклист тестирования

- [ ] Админ добавлен в MongoDB
- [ ] Авторизация работает (получен токен)
- [ ] Аккаунт 1 добавлен успешно
- [ ] Аккаунт 2 добавлен успешно
- [ ] Список аккаунтов показывает 2 аккаунта
- [ ] Проверка всех сообщений работает
- [ ] Проверка конкретного аккаунта работает
- [ ] Проверка непрочитанных работает
- [ ] Keep-Alive работает (логи каждые 45 сек)
- [ ] Восстановление сессии работает (если тестировали)
- [ ] Удаление аккаунта работает (если тестировали)

---

## 🐛 Возможные ошибки

### "Unauthorized"
**Причина:** Неправильный или истёкший токен  
**Решение:** Получи новый токен через `/api/login`

### "Context not found"
**Причина:** Браузерный контекст закрыт  
**Решение:** Используй `/api/luxee/accounts/:id/restore`

### "Account not found"
**Причина:** Неправильный accountId  
**Решение:** Проверь список через `/api/luxee/accounts`

### "Invalid credentials"
**Причина:** Неправильный email/пароль Luxee  
**Решение:** Проверь данные аккаунта

---

## 💡 Советы для Thunder Client

1. **Сохрани токен в переменную:**
   - После логина скопируй `accessToken`
   - Создай Environment переменную `token`
   - Используй `{{token}}` в Headers

2. **Создай коллекцию:**
   - Сохрани все запросы в одну коллекцию
   - Назови "Luxee API Tests"
   - Запускай по порядку

3. **Проверяй логи сервера:**
   - Смотри консоль где запущен `npm start`
   - Ищи `[Keep-Alive]` каждые 45 сек
   - Проверяй ошибки

---

## 🎉 Готово!

Все запросы готовы для копирования в Thunder Client!  
Просто копируй JSON и вставляй в Body 🚀
