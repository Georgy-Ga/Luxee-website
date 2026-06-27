# 📚 Luxee API Documentation

Документация по проверенным API методам Luxee.io для работы с чатами.

---

## ✅ Проверенные API

### 1. **`modelsChat.getChats.active`** - Активный чат

**Описание:** Текущий открытый чат (загружается после навигации).

**Структура:**
```javascript
{
    identity: "2400232_2797375",  // chatId (формат: profileUidOuter_manUid)
    unAnswered: true,              // true = нужен ответ, false = уже ответили
    members: [
        { uid: 2400232, username: "Mary", gender: 2, ... },      // Profile (gender=2)
        { uid: 2797375, username: "Bigdockdaddy", gender: 1, ... } // Man (gender=1)
    ],
    message: [...]  // Массив сообщений
}
```

**Использование:**
```javascript
// Проверка unAnswered статуса активного чата
const isUnAnswered = window.modelsChat?.getChats?.active?.unAnswered;

if (isUnAnswered === false) {
    console.log('Already replied!');
}
```

**⚠️ Важно:**
- `active` обновляется ТОЛЬКО после навигации к чату
- Содержит ТОЛЬКО текущий открытый чат
- `unAnswered: false` = последнее сообщение от профиля

---

### 2. **`modelsChat.getChat.list[chatId]`** - История сообщений

**Описание:** Массив сообщений конкретного чата (загружается после навигации).

**Структура:**
```javascript
modelsChat.getChat.list["2400232_2797375"] = [
    {
        body: "Quick check 😄 Do you like pizza?",
        author: {
            uid: 2400232,
            username: "Mary",
            first_name: "Mary",
            gender: 2  // 2 = female/profile
        },
        created: "1782495785142",
        media: [],
        type: 1
    },
    {
        body: "I love pussy",
        author: {
            uid: 2797375,
            username: "Bigdockdaddy",
            first_name: "Bigdockdaddy",
            gender: 1  // 1 = male/man
        },
        created: "1782496662729",
        media: [],
        type: 1
    }
]
```

**Использование:**
```javascript
// Получить историю активного чата
const chatId = window.modelsChat?.getChats?.active?.identity;
const messages = window.modelsChat?.getChat?.list?.[chatId];

if (messages && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    console.log('Last from:', lastMessage.author.first_name);
    console.log('Gender:', lastMessage.author.gender); // 1=man, 2=profile
}
```

**⚠️ Важно:**
- Загружается ТОЛЬКО для активного чата после навигации
- `author.gender`: **1 = male (man), 2 = female (profile)**
- Используйте `gender` для определения автора, НЕ `uType`

---

### 3. **`modelsChat.getChats.list[chatId]`** - Полные объекты чатов

**Описание:** Полная информация о чате с сообщениями (после навигации).

**Структура:**
```javascript
modelsChat.getChats.list["2400232_2797375"] = {
    identity: "2400232_2797375",
    unAnswered: true,
    members: [
        { uid: 2400232, username: "Mary", gender: 2, ... },
        { uid: 2797375, username: "Bigdockdaddy", gender: 1, ... }
    ],
    message: [
        { body: "...", uType: 1, uid: 2797375, ... },
        { body: "...", uType: 2, uid: 2400232, ... }
    ]
}
```

**⚠️ Важно:**
- `message[].uType`: **1 = profile sent, 2 = man sent** (кто ОТПРАВИЛ)
- **НЕ путать с `author.gender`** который показывает пол автора!

---

### 4. **`modelsChat.getChats.data[profileInnerUid]`** - Данные чатов профиля

**Описание:** Хранит информацию о чатах конкретного профиля (по inner UID).

**Структура:**
```javascript
modelsChat.getChats.data[608895]["2400232_2797375"] = {
    lastActivity: "1782496662732",
    unAnswered: true,
    memberProfile: { uid: 2797375, username: "Bigdockdaddy", ... },
    modelProfile: { uid: 2400232, username: "Mary", ... }
}
```

**⚠️ Важно:**
- Работает ТОЛЬКО для **загруженных профилей**
- Ключ = `profileInnerUid` (например, `608895` для Mary)
- НЕ для всех профилей сразу - только активные/загруженные

**Лучше использовать:**
```javascript
// После навигации - проверяем через active
const unAnswered = window.modelsChat?.getChats?.active?.unAnswered;
```

---

## 🔧 Правильный URL для навигации

### Формат URL:
```
https://luxee.io/chats/?ownerUid={INNER_UID}&profileUid={OUTER_UID}&userUid={MAN_UID}
```

### Параметры:

**1. `ownerUid`** - Inner UID профиля (из DB)
- Пример: `608895` для Mary
- Получаем из: `profile.innerUid` или `profile.uid` (inner)

**2. `profileUid`** - Outer UID профиля (из chatId)
- Пример: `2400232` для Mary
- Получаем из: первая часть `chatId.split('_')[0]`

**3. `userUid`** - UID мужчины
- Пример: `2797375` для Bigdockdaddy
- Получаем из: вторая часть `chatId.split('_')[1]`

### Пример:

**chatId:** `"2400232_2797375"`

```javascript
const [profileUidOuter, userUid] = chatId.split('_');
// profileUidOuter = "2400232"
// userUid = "2797375"

// Получить innerUid из DB
const profile = await getProfile(userId, profileUid);
const ownerUid = profile.innerUid; // 608895

// Построить URL
const url = `https://luxee.io/chats/?ownerUid=${ownerUid}&profileUid=${profileUidOuter}&userUid=${userUid}`;
// Результат: https://luxee.io/chats/?ownerUid=608895&profileUid=2400232&userUid=2797375
```

---

## 📊 Члены чата (members)

### Структура `members`:
```javascript
members: [
    {
        uid: 2400232,           // Profile outer UID
        username: "Mary",
        first_name: "Mary",
        gender: 2,              // 2 = female (profile)
        avatar: {...}
    },
    {
        uid: 2797375,           // Man UID
        username: "Bigdockdaddy",
        first_name: "Bigdockdaddy",
        gender: 1,              // 1 = male (man)
        avatar: {...}
    }
]
```

### Как отличить профиль от мужчины:

```javascript
// ✅ ПРАВИЛЬНО: По gender
const profile = members.find(m => m.gender === 2); // Female/Profile
const man = members.find(m => m.gender === 1);     // Male/Man

// ❌ НЕПРАВИЛЬНО: type === 2 или type === 10 НЕ СУЩЕСТВУЕТ!
const profile = members.find(m => m.type === 2);   // undefined!
const man = members.find(m => m.type === 10);      // undefined!
```

---

## 🔍 Определение автора последнего сообщения

### Метод 1: Через `author.gender` (из getChat.list)

```javascript
const chatId = window.modelsChat?.getChats?.active?.identity;
const messages = window.modelsChat?.getChat?.list?.[chatId];
const lastMessage = messages[messages.length - 1];

// gender: 1 = man, 2 = profile
if (lastMessage.author.gender === 1) {
    console.log('Last message from MAN - need to reply');
} else if (lastMessage.author.gender === 2) {
    console.log('Last message from PROFILE - already replied');
}
```

### Метод 2: Через `unAnswered` (самый надёжный)

```javascript
// ПОСЛЕ навигации к чату
const isUnAnswered = window.modelsChat?.getChats?.active?.unAnswered;

if (isUnAnswered === true) {
    console.log('Need to reply!');
} else if (isUnAnswered === false) {
    console.log('Already replied - skip');
}
```

**⚠️ Рекомендация:** Используйте `unAnswered` как основную проверку!

---

## ⚙️ Workflow: Правильная последовательность

### 1. Навигация к чату
```javascript
// Построить URL
const [profileUidOuter, userUid] = chatId.split('_');
const profile = await getProfile(userId, profileUid);
const url = `https://luxee.io/chats/?ownerUid=${profile.innerUid}&profileUid=${profileUidOuter}&userUid=${userUid}`;

// Перейти
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
await page.waitForTimeout(2000); // Ждём загрузки
```

### 2. Проверка unAnswered
```javascript
const unAnswered = await page.evaluate(() => {
    return window.modelsChat?.getChats?.active?.unAnswered;
});

if (unAnswered === false) {
    console.log('Already replied - skip');
    return;
}
```

### 3. Получение истории
```javascript
const messages = await page.evaluate(() => {
    const chatId = window.modelsChat?.getChats?.active?.identity;
    return window.modelsChat?.getChat?.list?.[chatId] || [];
});
```

### 4. Проверка последнего сообщения
```javascript
const lastMessage = messages[messages.length - 1];

if (lastMessage.author.gender === 2) {
    console.log('Last from profile - skip');
    return;
}

if (lastMessage.author.gender === 1) {
    console.log('Last from man - proceed');
    // Генерировать ответ...
}
```

---

## 🚫 Частые ошибки

### ❌ Ошибка 1: Чтение до навигации
```javascript
// НЕПРАВИЛЬНО
const messages = window.modelsChat?.getChat?.list?.[chatId]; // undefined!
await page.goto(url);
```

### ✅ Правильно: Навигация → Чтение
```javascript
// ПРАВИЛЬНО
await page.goto(url);
await page.waitForTimeout(2000);
const messages = await page.evaluate(() => {
    const chatId = window.modelsChat?.getChats?.active?.identity;
    return window.modelsChat?.getChat?.list?.[chatId];
});
```

---

### ❌ Ошибка 2: Использование `type` вместо `gender`
```javascript
// НЕПРАВИЛЬНО
const profile = members.find(m => m.type === 2); // undefined!
```

### ✅ Правильно: Использовать `gender`
```javascript
// ПРАВИЛЬНО
const profile = members.find(m => m.gender === 2); // Female/Profile
const man = members.find(m => m.gender === 1);     // Male/Man
```

---

### ❌ Ошибка 3: Неправильный порядок URL параметров
```javascript
// НЕПРАВИЛЬНО
const [ownerUid, userUid] = chatId.split('_'); // ownerUid = outer UID ❌
const url = `...?ownerUid=${ownerUid}&profileUid=${profileUid}...`; // ПЕРЕПУТАНО
```

### ✅ Правильно: Правильный порядок
```javascript
// ПРАВИЛЬНО
const [profileUidOuter, userUid] = chatId.split('_');
const ownerUid = profile.innerUid; // Из DB!
const url = `...?ownerUid=${ownerUid}&profileUid=${profileUidOuter}...`;
```

---

### ❌ Ошибка 4: Путаница между `uType` и `gender`
```javascript
// uType в message[] - КТО ОТПРАВИЛ (1=profile sent, 2=man sent)
message.uType === 1  // Profile sent this message
message.uType === 2  // Man sent this message

// gender в author - ПОЛ АВТОРА (1=male, 2=female)
author.gender === 1  // Male (man)
author.gender === 2  // Female (profile)
```

**Используйте `author.gender` для определения автора!**

---

## 📝 Резюме: Ключевые моменты

1. ✅ **Навигация обязательна** - чаты загружаются только при переходе
2. ✅ **URL формат**: `ownerUid=innerUid&profileUid=outerUid&userUid=manUid`
3. ✅ **Проверка unAnswered** - через `modelsChat.getChats.active.unAnswered`
4. ✅ **История сообщений** - через `modelsChat.getChat.list[chatId]`
5. ✅ **Определение автора** - через `author.gender` (1=man, 2=profile)
6. ✅ **members** - различать через `gender`, НЕ через `type`
7. ✅ **unAnswered**: `true` = нужен ответ, `false` = уже ответили

---

## 🎯 Последовательность для Pending Response

```javascript
// 1. Навигация к чату
const [profileUidOuter, userUid] = chatId.split('_');
const url = `https://luxee.io/chats/?ownerUid=${profileInnerUid}&profileUid=${profileUidOuter}&userUid=${userUid}`;
await page.goto(url);
await page.waitForTimeout(2000);

// 2. Проверка unAnswered (ПЕРВАЯ проверка)
const unAnswered = await page.evaluate(() => window.modelsChat?.getChats?.active?.unAnswered);
if (!unAnswered) return; // Skip

// 3. Получение истории
const messages = await page.evaluate(() => {
    const chatId = window.modelsChat?.getChats?.active?.identity;
    return window.modelsChat?.getChat?.list?.[chatId];
});

// 4. Проверка последнего сообщения (ВТОРАЯ проверка)
const lastMessage = messages[messages.length - 1];
if (lastMessage.author.gender === 2) return; // Already replied

// 5. Генерация и отправка ответа
// ...
```

---

**Дата создания:** 27.06.2026  
**Версия:** 1.0  
**Статус:** ✅ Проверено на реальных данных
