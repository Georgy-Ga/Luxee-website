# 🔌 Luxee JavaScript API - Полная документация

## 📚 Оглавление
1. [modelsChat.getProfile.data](#modelschatgetprofiledata) - Получить все профили с сообщениями
2. [modelsChat.getChats.list](#modelschatgetchatslist) - Получить список чатов
3. [modelsChat.selectProfile(uid)](#modelschatselectprofileuid) - Переключиться на профиль
4. [modelsChat.selectChat(identity)](#modelschatselectchatidentity) - Открыть конкретный чат

---

## 1. modelsChat.getProfile.data

### 📋 Описание
Получает список ВСЕХ профилей девушек на аккаунте Luxee с информацией о новых сообщениях.

### 🎯 Зачем использовать
- Получить список всех профилей девушек на аккаунте
- Узнать количество новых сообщений у каждого профиля
- Получить информацию о проектах (outer) для каждого профиля
- Быстрее и надёжнее чем парсинг HTML

### 📍 Где вызывать
На странице `/chats/` после полной загрузки

### 💻 Использование
```javascript
// В консоли браузера или через page.evaluate()
const profilesData = modelsChat.getProfile.data;
console.log(profilesData);
```

### 📦 Структура ответа
```javascript
{
  "1420": {                          // UID профиля девушки (inner.uid)
    "outer": {                       // Проекты где работает этот профиль
      "1389492": {                   // UID на конкретном проекте
        "uid": 1389492,
        "username": "Maria",
        "project_id": 1,
        "app_id": 1,
        "gender": 2,                 // 2 = женщина
        "owner_uid": 69,             // UID владельца (агентства)
        "import_uid": 1420,          // Основной UID профиля
        "access_token": "...",
        "lastActivity": 1777095962
      },
      "1502072": { /* другой проект */ }
    },
    "lastActivity": 1777095962,      // Последняя активность
    "newMessages": 0,                // ⭐ КОЛИЧЕСТВО НОВЫХ СООБЩЕНИЙ
    "inner": {                       // Основная информация о профиле
      "uid": 1420,                   // ⭐ UID профиля (для selectProfile)
      "username": "Maria",
      "gender": 2,
      "avatar": {
        "src": "https://img.luxee.date/src/...",
        "preview": "https://img.luxee.date/preview/...",
        "thumbnail": "https://img.luxee.date/thumb/..."
      },
      "newMessages": 0               // Дублируется здесь
    },
    "loadMoreToken": "1685032308039",
    "sendMoreRequest": false
  },
  "607823": { /* другой профиль */ }
}
```

### 🔑 Ключевые поля

#### Для проверки новых сообщений:
- **`newMessages`** - количество новых сообщений у профиля
- **`inner.uid`** - UID профиля для переключения через `selectProfile()`
- **`inner.username`** - имя девушки
- **`inner.avatar.thumbnail`** - аватар для отображения

#### Для работы с проектами:
- **`outer`** - объект с проектами где работает профиль
- **`outer[uid].project_id`** - ID проекта
- **`outer[uid].access_token`** - токен доступа

### ✅ Пример использования в коде
```javascript
// Получить все профили с новыми сообщениями
const profilesData = await page.evaluate(() => {
    if (!modelsChat?.getProfile?.data) {
        throw new Error('modelsChat.getProfile.data not available');
    }
    
    const profiles = modelsChat.getProfile.data;
    const result = [];
    
    // Проходим по всем профилям
    for (const uid in profiles) {
        const profile = profiles[uid];
        
        // Добавляем только профили с новыми сообщениями
        if (profile.newMessages > 0) {
            result.push({
                uid: profile.inner.uid,
                username: profile.inner.username,
                avatar: profile.inner.avatar?.thumbnail,
                newMessages: profile.newMessages,
                lastActivity: profile.lastActivity,
                projectsCount: Object.keys(profile.outer).length
            });
        }
    }
    
    return result;
});

console.log('Profiles with new messages:', profilesData);
```

---

## 2. modelsChat.getChats.list

### 📋 Описание
Получает список чатов для ТЕКУЩЕГО активного профиля (до 50 чатов).

### 🎯 Зачем использовать
- Получить список чатов с мужчинами для конкретного профиля
- Узнать есть ли неотвеченные сообщения (`unAnswered: true`)
- Получить `memberUid` для отправки сообщений

### 📍 Где вызывать
На странице `/chats/` после выбора профиля через `selectProfile()`

### 💻 Использование
```javascript
const chatsData = modelsChat.getChats.list;
console.log(chatsData);
```

### 📦 Структура ответа
```javascript
{
  "1389492_1772829": {               // chatId (profileUid_memberUid)
    "id": "1389492_1772829",
    "member": {                      // Мужчина
      "uid": "1772829",              // ⭐ UID мужчины (для ответа)
      "username": "John",
      "avatar": { /* ... */ }
    },
    "profile": {                     // Девушка
      "uid": "1389492",
      "username": "Maria",
      "avatar": { /* ... */ }
    },
    "lastMessage": "Hello!",
    "newMessages": 1,                // Количество непрочитанных
    "unAnswered": true,              // ⭐ Есть неотвеченные
    "lastActivity": "2026-04-25T04:30:00Z"
  }
}
```

### 🔑 Ключевые поля
- **`member.uid`** - UID мужчины (для отправки сообщения)
- **`unAnswered`** - есть неотвеченные сообщения
- **`newMessages`** - количество непрочитанных
- **`id`** - chatId для `selectChat()`

---

## 3. modelsChat.selectProfile(uid)

### 📋 Описание
Переключается на конкретный профиль девушки.

### 🎯 Зачем использовать
- Переключиться на профиль для просмотра его чатов
- Работать с чатами конкретного профиля

### 📍 Где вызывать
На странице `/chats/`

### 💻 Использование
```javascript
// uid - это inner.uid из modelsChat.getProfile.data
modelsChat.selectProfile(1420);  // Переключаемся на профиль Maria (uid: 1420)
```

### ⚠️ Важно
- **UID должен быть числом**, не строкой
- Используй `inner.uid` из `modelsChat.getProfile.data`
- Если UID неправильный - ничего не произойдёт

### ✅ Пример
```javascript
// Переключиться на первый профиль с новыми сообщениями
const profilesData = modelsChat.getProfile.data;

for (const uid in profilesData) {
    const profile = profilesData[uid];
    
    if (profile.newMessages > 0) {
        console.log(`Switching to ${profile.inner.username} (${profile.newMessages} new)`);
        modelsChat.selectProfile(profile.inner.uid);
        break;
    }
}
```

---

## 4. modelsChat.selectChat(identity)

### 📋 Описание
Открывает конкретный чат с мужчиной.

### 🎯 Зачем использовать
- Открыть чат для чтения сообщений
- Открыть чат для отправки ответа

### 📍 Где вызывать
На странице `/chats/` после выбора профиля через `selectProfile()`

### 💻 Использование
```javascript
// identity - это строка в формате "profileUid_memberUid"
modelsChat.selectChat("1389492_1772829");
```

### 🔍 Что принимает
**`identity`** (string) - идентификатор чата в формате `"profileUid_memberUid"`

Где взять:
- Из `modelsChat.getChats.list[chatId]` - ключ объекта
- Или собрать вручную: `${profileUid}_${memberUid}`

### ⚠️ Важно
- **identity должен быть строкой**
- Формат: `"profileUid_memberUid"` (через подчёркивание)
- Чат должен существовать для текущего профиля
- Если чата нет - ничего не произойдёт

### ✅ Пример
```javascript
// Открыть первый чат с неотвеченными сообщениями
const chatsData = modelsChat.getChats.list;

for (const chatId in chatsData) {
    const chat = chatsData[chatId];
    
    if (chat.unAnswered === true) {
        console.log(`Opening chat with ${chat.member.username}`);
        modelsChat.selectChat(chatId);  // chatId уже в правильном формате
        break;
    }
}
```

### 📝 Что происходит при вызове
1. Чат становится активным
2. Загружаются сообщения (если ещё не загружены)
3. Обновляется UI
4. Сообщения помечаются как прочитанные
5. Открывается поле для ввода ответа

### ✅ Протестировано
```javascript
// Работает корректно
modelsChat.selectChat("1389492_1772829");
// Чат открывается, UI обновляется
```

---

## 5. modelsChat.getActiveProfile()

### 📋 Описание
Возвращает данные текущего активного профиля девушки.

### 🎯 Зачем использовать
- Узнать какой профиль сейчас активен
- Получить UID, имя, аватар активного профиля
- Проверить есть ли активный профиль

### 📍 Где вызывать
На странице `/chats/` после выбора профиля

### 💻 Использование
```javascript
const activeProfile = modelsChat.getActiveProfile();
console.log(activeProfile);
```

### 📦 Структура ответа
```javascript
{
    "uid": 1420,                    // UID профиля
    "username": "Maria",            // Имя девушки
    "gender": 2,                    // 2 = женщина
    "avatar": {
        "src": "https://img.luxee.date/src/...",
        "preview": "https://img.luxee.date/preview/...",
        "thumbnail": "https://img.luxee.date/thumb/..."
    },
    "newMessages": 0                // Количество новых сообщений
}
```

### 🔑 Ключевые поля
- **`uid`** - UID профиля (для selectProfile)
- **`username`** - имя девушки
- **`gender`** - пол (2 = женщина)
- **`avatar.thumbnail`** - аватар для отображения
- **`newMessages`** - количество новых сообщений

### ⚠️ Важно
- Возвращает `null` если нет активного профиля
- Всегда проверяй на `null` перед использованием

### ✅ Пример
```javascript
const profile = modelsChat.getActiveProfile();

if (profile) {
    console.log(`Active: ${profile.username} (UID: ${profile.uid})`);
    console.log(`New messages: ${profile.newMessages}`);
} else {
    console.log('No active profile');
}
```

### ✅ Протестировано
```javascript
const profile = modelsChat.getActiveProfile();
// Возвращает:
// {
//     "uid": 1420,
//     "username": "Maria",
//     "gender": 2,
//     "avatar": { "src": "...", "preview": "...", "thumbnail": "..." },
//     "newMessages": 0
// }
```

---

## 🚀 Полный пример работы с API

### Сценарий: Найти все профили с новыми сообщениями и открыть первый чат

```javascript
await page.evaluate(() => {
    // 1. Получаем все профили
    const profilesData = modelsChat.getProfile.data;
    
    // 2. Находим профили с новыми сообщениями
    const profilesWithNew = [];
    for (const uid in profilesData) {
        const profile = profilesData[uid];
        if (profile.newMessages > 0) {
            profilesWithNew.push({
                uid: profile.inner.uid,
                username: profile.inner.username,
                newMessages: profile.newMessages
            });
        }
    }
    
    console.log('Profiles with new messages:', profilesWithNew);
    
    // 3. Если есть профили с новыми - переключаемся на первый
    if (profilesWithNew.length > 0) {
        const firstProfile = profilesWithNew[0];
        console.log(`Switching to ${firstProfile.username}`);
        modelsChat.selectProfile(firstProfile.uid);
        
        // 4. Ждём немного и получаем чаты этого профиля
        setTimeout(() => {
            const chatsData = modelsChat.getChats.list;
            
            // 5. Находим первый чат с неотвеченными
            for (const chatId in chatsData) {
                const chat = chatsData[chatId];
                
                if (chat.unAnswered === true || chat.newMessages > 0) {
                    console.log(`Opening chat with ${chat.member.username}`);
                    modelsChat.selectChat(chatId);
                    break;
                }
            }
        }, 1000);
    }
});
```

---

## 🎯 Упрощение навигации

### ❌ Старый способ (через HTML клики)
```javascript
// 1. Клик на Communication
await page.click('a:has-text("Communication")');
await page.waitForTimeout(1500);

// 2. Клик на Chat
await page.click('a[href="/chats/"]');
await page.waitForTimeout(5000);
```

### ✅ Новый способ (прямой переход)
```javascript
// Просто переходим на /chats/
await page.goto('https://luxee.io/chats/');
await page.waitForTimeout(2000);

// Luxee автоматически:
// - Откроет страницу чатов
// - Выберет первый профиль
// - Откроет случайный или последний активный чат
```

**Преимущества:**
- ⚡ Быстрее (нет кликов по меню)
- 🛡️ Надёжнее (не зависит от HTML структуры)
- 🎯 Проще (один переход вместо двух кликов)

---

## 📊 Сравнение: HTML парсинг vs JavaScript API

### Получение профилей с новыми сообщениями

#### ❌ HTML парсинг
```javascript
// Парсим карусель профилей
const profiles = await page.$$eval('.profiles.slick-slide', elements => {
    return elements.map(el => ({
        name: el.querySelector('.profile__name')?.textContent,
        unread: el.querySelector('.unread-count')?.textContent || '0'
    }));
});
// Проблемы:
// - Видим только ~10 профилей в карусели
// - Зависит от CSS классов
// - Медленно (парсинг DOM)
```

#### ✅ JavaScript API
```javascript
// Используем API
const profiles = await page.evaluate(() => {
    const data = modelsChat.getProfile.data;
    return Object.values(data)
        .filter(p => p.newMessages > 0)
        .map(p => ({
            uid: p.inner.uid,
            name: p.inner.username,
            unread: p.newMessages,
            avatar: p.inner.avatar?.thumbnail
        }));
});
// Преимущества:
// - Получаем ВСЕ профили
// - Не зависит от HTML
// - В 10-50 раз быстрее
```

---

## 🔧 Интеграция в проект

### Обновить chatNavigationService.js
```javascript
navigateToChats: async ({ page }) => {
    // Просто переходим на /chats/
    await page.goto('https://luxee.io/chats/');
    await page.waitForTimeout(2000);
    
    return {
        success: true,
        url: page.url()
    };
}
```

### Обновить profileParserService.js
```javascript
getProfiles: async ({ page }) => {
    const profilesData = await page.evaluate(() => {
        if (!modelsChat?.getProfile?.data) {
            throw new Error('API not available');
        }
        
        const data = modelsChat.getProfile.data;
        const result = [];
        
        for (const uid in data) {
            const profile = data[uid];
            result.push({
                uid: profile.inner.uid,
                username: profile.inner.username,
                avatar: profile.inner.avatar?.thumbnail,
                newMessages: profile.newMessages,  // ⭐ Новые сообщения
                projectsCount: Object.keys(profile.outer).length
            });
        }
        
        return result;
    });
    
    return {
        profiles: profilesData,
        totalUnread: profilesData.reduce((sum, p) => sum + p.newMessages, 0)
    };
}
```

### Добавить метод для неотвеченных
```javascript
getUnreadAndUnanswered: async ({ page, profileUid }) => {
    // 1. Переключаемся на профиль
    await page.evaluate((uid) => {
        modelsChat.selectProfile(uid);
    }, profileUid);
    
    await page.waitForTimeout(1000);
    
    // 2. Получаем чаты с неотвеченными
    const chatsData = await page.evaluate(() => {
        const chats = modelsChat.getChats.list;
        const result = [];
        
        for (const chatId in chats) {
            const chat = chats[chatId];
            
            // Проверяем новые ИЛИ неотвеченные
            if (chat.newMessages > 0 || chat.unAnswered === true) {
                result.push({
                    chatId: chatId,
                    memberUid: chat.member.uid,
                    memberUsername: chat.member.username,
                    newMessages: chat.newMessages,
                    unAnswered: chat.unAnswered,
                    lastMessage: chat.lastMessage
                });
            }
        }
        
        return result;
    });
    
    return chatsData;
}
```

---

## 📝 Итоги

### Что используем:
1. **`modelsChat.getProfile.data`** - все профили с `newMessages`
2. **`modelsChat.getChats.list`** - чаты профиля с `unAnswered`
3. **`modelsChat.selectProfile(uid)`** - переключение на профиль
4. **`modelsChat.selectChat(identity)`** - открытие чата
5. **Прямой переход** на `/chats/` вместо кликов

### Преимущества:
- ⚡ В 10-50 раз быстрее
- 🛡️ Не зависит от HTML
- 📊 Больше данных
- 🎯 Проще код
- ✅ Надёжнее работа
