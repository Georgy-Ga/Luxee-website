# LUXEE API REFERENCE

> **Документация Luxee JavaScript API (modelsChat)**  
> **Обновлено:** 04.05.2026

---

## 🌐 URL

- **Основной сайт:** `https://luxee.io`
- **Чаты:** `https://luxee.io/chats`
- **CDN изображений:** `https://img.luxee.date/`

---

## 📡 modelsChat API

### 1. modelsChat.getProfile.data

**Описание:** Получить все профили и их статус

**Структура:**
```javascript
{
  "1420": {                    // UID профиля (ключ)
    "outer": {                 // ⭐ Связанные UID на других проектах
      "1389492": {             // Тот же профиль, другой UID
        "uid": 1389492,
        "username": "Maria",
        "project_id": 1,
        "app_id": 1,
        "access_token": "...",
        "lastActivity": 1777818966
      }
    },
    "inner": {                 // Основной профиль
      "uid": 1420,
      "username": "Maria",
      "avatar": {
        "src": "https://img.luxee.date/src/...",
        "preview": "https://img.luxee.date/preview/...",
        "thumbnail": "https://img.luxee.date/thumb/..."
      },
      "newMessages": 0         // ⭐ Новые непрочитанные
    },
    "newMessages": 0,          // Дубликат для удобства
    "lastActivity": 1777818966
  }
}
```

**⚠️ ВАЖНО про outer:**
- `outer` содержит UID того же профиля на других проектах
- Один профиль = несколько UID (inner + outer)
- При подсчете `unAnswered` учитывать ВСЕ UID

**Использование:**
- Проверка новых сообщений БЕЗ переключения профилей
- НЕ требует навигации

---

### 2. modelsChat.getChats.list

**Описание:** Список чатов (всех профилей)

**Структура:**
```javascript
{
  "1389492_1602773": {         // chatId: "profileUid_memberUid"
    "sid": "63d837d09a3e167ead0dd9bb",
    "identity": "1389492_1602773",
    "index": 273,
    "favorite": 1,
    "lastActivity": "1763422754156",
    "newMessages": 5,          // ⭐ Новые непрочитанные
    "unAnswered": true,        // ⭐ Неотвеченные (мы не ответили)
    "activeConnection": true,
    "isTemporary": false,
    "members": [
      {
        "uid": 1602773,        // UID мужчины
        "type": 2,             // type: 2 = мужчина
        "username": "Jimmy",
        "first_name": "Jimmy",
        "gender": 1,
        "avatar": {
          "thumbnail": "/thumb/...",
          "src": "/src/..."
        },
        "country": "United States",
        "city": "Oceanside",
        "age": 45
      },
      {
        "uid": 1389492,        // UID профиля
        "type": 10,            // type: 10 = профиль девушки
        "username": "Maria",
        "first_name": "Maria",
        "gender": 2,
        "avatar": {
          "thumbnail": "/thumb/...",
          "src": "/src/..."
        }
      }
    ],
    "message": [               // Массив сообщений
      {
        "_id": "63d837d09a3e167ead0dd9bf",
        "uid": 1602773,
        "uType": 10,
        "body": "were you waiting for me, Jimmy?",
        "createdAt": "1763422753983",
        "index": 273,
        "type": 1,
        "lastConsumeIndex": 271
      }
    ]
  }
}
```

**⚠️ ВАЖНО про chatId:**
- Формат: `"profileUid_memberUid"`
- Парсинг: `chatId.split('_')[0]` → profileUid
- Используется для определения к какому профилю относится чат

**Использование:**
- Получение детальной информации о чатах
- `newMessages` - сколько новых
- `unAnswered` - есть ли неотвеченные

---

### 3. modelsChat.selectProfile(uid)

**Описание:** Переключиться на другой профиль

**⚠️ ВАЖНО:**
- Требует времени на загрузку (1-2 сек)
- Меняет состояние страницы
- ДОЛЖНО быть в очереди `requestQueueService`

---

## 🔄 АРХИТЕКТУРА ПРОВЕРКИ

### ✅ БЕЗ ОЧЕРЕДИ (не мешает отправке):
1. `modelsChat.getProfile.data` - читаем профили
2. `modelsChat.getChats.list` - читаем чаты

### ⚠️ В ОЧЕРЕДИ (требует переключения):
1. `modelsChat.selectProfile(uid)` - переключение
2. Навигация (`page.goto`)
3. Клики и взаимодействия

---

## 📊 АЛГОРИТМ ПОДСЧЕТА unAnswered

```javascript
// 1. Получаем все UID профиля
const allProfileUids = [profile.inner.uid];
if (profile.outer) {
  for (const outerUid in profile.outer) {
    allProfileUids.push(profile.outer[outerUid].uid);
  }
}

// 2. Считаем unAnswered из чатов
let unansweredCount = 0;
for (const chatId in chatsData) {
  const chat = chatsData[chatId];
  
  // 3. Парсим chatId
  const chatProfileUid = parseInt(chatId.split('_')[0]);
  
  // 4. Проверяем принадлежность
  if (allProfileUids.includes(chatProfileUid) && chat.unAnswered === true) {
    unansweredCount++;
  }
}
```

---

**Связанные документы:**
- `../architecture/message-flow.md` - как используется API
- `../architecture/chat-identity.md` - система chatId
