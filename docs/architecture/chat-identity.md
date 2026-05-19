# 🔑 Система идентификации чатов

## ⚠️ КРИТИЧЕСКИ ВАЖНО!

### Проблема дублирования чатов

**НЕПРАВИЛЬНО:** Использовать только `memberUid` как `chatId`
```javascript
chatId: 1602773  // ❌ ПЛОХО - один мужчина будет дублироваться на всех профилях!
```

**ПРАВИЛЬНО:** Использовать полный `identity` как `chatId`
```javascript
chatId: "1389492_1602773"  // ✅ ХОРОШО - уникальный для каждой пары профиль+мужчина
```

---

## 📊 Структура данных

### Формат identity в Luxee API

```
identity = "profileUid_memberUid"
```

**Пример из реальных данных:**
```json
{
  "1389492_1602773": {
    "sid": "63d837d09a3e167ead0dd9bb",
    "identity": "1389492_1602773",
    "members": [
      {
        "uid": 1602773,
        "username": "Jimmy",
        "type": 10,
        "avatar": {
          "thumbnail": null,
          "src": null,
          "empty": true
        }
      },
      {
        "uid": 1389492,
        "username": "Maria",
        "type": 2,
        "avatar": {
          "thumbnail": "/thumb/1677244322_jPchvBlTOOCBdBETFPYY24rwtm.jpg",
          "src": "/src/1677244322_jPchvBlTOOCBdBETFPYY24rwtm.jpg"
        }
      }
    ]
  }
}
```

### Расшифровка:
- **`identity`**: `"1389492_1602773"` - уникальный ключ чата
- **`1389492`** - UID профиля Maria (type: 2)
- **`1602773`** - UID мужчины Jimmy (type: 10)

---

## 🎯 Почему это важно

### Сценарий 1: Один мужчина пишет двум профилям

```
Мужчина Jimmy (uid: 1602773) пишет:
├─ Профилю Maria (uid: 1389492)
│  └─ chatId: "1389492_1602773" ✅
└─ Профилю Anna (uid: 1234567)
   └─ chatId: "1234567_1602773" ✅

Это ДВА РАЗНЫХ чата!
```

**Если использовать только memberUid:**
```
chatId: 1602773  // ❌ Оба чата будут иметь одинаковый ID!
                 // Сообщения перемешаются!
```

---

## 💻 Правильная реализация

### Backend: profileParserService.js

```javascript
// ✅ ПРАВИЛЬНО - используем identity как chatId
for (const chatId in chats) {
  const chat = chats[chatId];
  
  result.push({
    chatId: chatId,  // "1389492_1602773" - полный identity!
    memberUid: memberData?.uid,  // 1602773
    profileUid: profileData?.uid,  // 1389492
    // ...
  });
}
```

### Frontend: Sidebar.jsx

```javascript
// ✅ ПРАВИЛЬНО - передаем полный chatId
onClick={() => selectChat({
  accountId: account.id,
  accountEmail: account.email,
  profileUid: profile.uid,
  profileUsername: profile.username,
  profileAvatar: profile.avatar,
  chatId: chat.chatId,  // "1389492_1602773" - полный identity!
  memberUid: chat.memberUid,
  memberUsername: chat.memberUsername,
  memberAvatar: chat.memberAvatar,
})}
```

### API запросы

```javascript
// ✅ ПРАВИЛЬНО
GET /api/luxee/chats/:accountId/:profileUid/:chatId/messages
// chatId = "1389492_1602773"

// ❌ НЕПРАВИЛЬНО
GET /api/luxee/chats/:accountId/:profileUid/:memberUid/messages
// memberUid = "1602773" - недостаточно информации!
```

---

## 🔍 Извлечение аватарок

### Структура avatar в данных

```javascript
{
  "avatar": {
    "uid": 712145,
    "type": 1,
    "placeholder": "/9j/4AAQSkZJRg...",  // base64 preview
    "thumbnail": "/thumb/1686157297_xz_PnLvEvbnrxDbZCiu_guK.jpg",
    "preview": "/preview/1686157297_xz_PnLvEvbnrxDbZCiu_guK.jpg",
    "src": "/src/1686157297_xz_PnLvEvbnrxDbZCiu_guK.jpg",
    "empty": false,
    "webp": true
  }
}
```

### Правильное извлечение

```javascript
// ✅ Приоритет: thumbnail > src > null
memberAvatar: memberData?.avatar?.thumbnail || 
              memberData?.avatar?.src || 
              null

// Проверка на пустую аватарку
if (memberData?.avatar?.empty === true) {
  memberAvatar = null;  // Показать градиент
}
```

---

## 🧪 Тестирование

### Проверка правильности chatId

```javascript
// Правильный формат
console.assert(
  chatId.includes('_'),
  'chatId должен содержать _ (формат: profileUid_memberUid)'
);

const [profileUid, memberUid] = chatId.split('_');
console.assert(
  profileUid && memberUid,
  'chatId должен содержать оба UID'
);
```

### Проверка уникальности

```javascript
// Каждая комбинация профиль+мужчина должна быть уникальной
const chatIds = new Set();

chats.forEach(chat => {
  if (chatIds.has(chat.chatId)) {
    console.error('❌ Дубликат chatId:', chat.chatId);
  }
  chatIds.add(chat.chatId);
});
```

---

## 📝 Чеклист для разработчиков

При работе с чатами ВСЕГДА проверяйте:

- [ ] `chatId` использует полный `identity` (формат: `profileUid_memberUid`)
- [ ] Не используется только `memberUid` как идентификатор
- [ ] Аватарки извлекаются из `members[].avatar.thumbnail` или `.src`
- [ ] Проверяется флаг `avatar.empty` перед использованием
- [ ] API эндпоинты принимают полный `chatId`, а не `memberUid`
- [ ] Frontend передает полный `chatId` в запросах
- [ ] Нет дублирования чатов между профилями

---

## 🐛 Частые ошибки

### ❌ Ошибка 1: Использование memberUid вместо identity
```javascript
// ПЛОХО
const chatId = chat.memberUid;  // 1602773

// ХОРОШО
const chatId = chat.identity;  // "1389492_1602773"
```

### ❌ Ошибка 2: Неправильное извлечение из members
```javascript
// ПЛОХО - берем первого
const member = chat.members[0];

// ХОРОШО - ищем по type
const member = chat.members.find(m => m.type === 2);   // Мужчина
const profile = chat.members.find(m => m.type === 10); // Профиль
```

### ❌ Ошибка 3: Игнорирование avatar.empty
```javascript
// ПЛОХО
const avatar = member.avatar.thumbnail;

// ХОРОШО
const avatar = member.avatar?.empty === true 
  ? null 
  : (member.avatar?.thumbnail || member.avatar?.src || null);
```

---

## 📚 Связанные документы

- [MESSAGE_SENDING.md](../backend/MESSAGE_SENDING.md) - Отправка сообщений
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Общий обзор проекта
- [COMPONENTS.md](../frontend/COMPONENTS.md) - Frontend компоненты

---

**Последнее обновление:** 03.05.2026  
**Статус:** ✅ Реализовано и работает корректно
