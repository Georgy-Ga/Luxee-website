# План реализации черного списка для AI

## ✅ Согласованные решения

### 1. Подход к предотвращению зацикливания
**Вариант 2 (надежный):** Комбинированный подход
- Запоминаем `{ profileUid, userUid, messageCount, timestamp }`
- При проверке: если совпадают все параметры → skip
- Каждые 5 минут: обнуляем кеш → проверяем снова

### 2. UI размещение
**Новая вкладка "🚫 Черные списки"** в AdminModal (рядом с "AI Управление")

### 3. Категории
- **"Новые сообщения"** = newMessages + unanswered (объединены)
- **"Catch Up"** = отдельная категория
- **"Activity Center"** = отдельная категория

### 4. ID мужчин
Использовать `userUid` из chatId (второе число, например `608434_2814785` → `2814785`)

---

## 📋 Этапы реализации

### ЭТАП 1: Backend - Модель данных

**Файл:** `backend/src/models/LuxeeAccountModel.js`

Добавить в схему:
```javascript
blacklist: {
  enabled: { type: Boolean, default: false },
  userIds: [{ type: String }], // ID мужчин
  categories: {
    newMessages: { type: Boolean, default: false },
    catchUp: { type: Boolean, default: false },
    activityCenter: { type: Boolean, default: false }
  }
}
```

---

### ЭТАП 2: Backend - API endpoints

**Файл:** `backend/src/routes/luxeeRoutes.js`

Новые эндпоинты:
```javascript
// Получить черный список аккаунта
GET /api/luxee/accounts/:accountId/blacklist

// Обновить черный список
PUT /api/luxee/accounts/:accountId/blacklist
{
  enabled: true,
  userIds: ['2814785', '1234567'],
  categories: { newMessages: true, catchUp: false, activityCenter: true }
}

// Добавить ID в черный список
POST /api/luxee/accounts/:accountId/blacklist/add
{ userIds: ['2814785'] }

// Удалить ID из черного списка
POST /api/luxee/accounts/:accountId/blacklist/remove
{ userIds: ['2814785'] }
```

---

### ЭТАП 3: Backend - Логика проверки

**Файл:** `backend/src/services/aiAuto/blacklistService.js` (НОВЫЙ)

```javascript
// Глобальный кеш для предотвращения зацикливания
const blacklistCache = new Map();
// Формат: accountId → Map<chatId, { count, timestamp }>

/**
 * Проверить находится ли мужчина в черном списке
 */
export const isUserBlacklisted = async (accountId, userUid, category) => {
  const account = await LuxeeAccount.findById(accountId);
  
  if (!account?.blacklist?.enabled) return false;
  if (!account.blacklist.userIds.includes(userUid)) return false;
  
  // Проверяем категорию
  return account.blacklist.categories[category] === true;
};

/**
 * Проверить нужно ли пропустить из-за зацикливания
 */
export const shouldSkipDueToLoop = (accountId, profileUid, userUid, messageCount) => {
  const chatId = `${profileUid}_${userUid}`;
  
  if (!blacklistCache.has(accountId)) {
    blacklistCache.set(accountId, new Map());
  }
  
  const accountCache = blacklistCache.get(accountId);
  const cached = accountCache.get(chatId);
  
  if (!cached) {
    // Первый раз видим этот чат - сохраняем
    accountCache.set(chatId, { count: messageCount, timestamp: Date.now() });
    return false;
  }
  
  // Проверяем: счетчик не изменился?
  if (cached.count === messageCount) {
    const elapsed = Date.now() - cached.timestamp;
    
    // Прошло меньше 5 минут → skip
    if (elapsed < 5 * 60 * 1000) {
      return true;
    }
    
    // Прошло 5+ минут → обнуляем и проверяем снова
    accountCache.set(chatId, { count: messageCount, timestamp: Date.now() });
    return false;
  }
  
  // Счетчик изменился → обновляем кеш
  accountCache.set(chatId, { count: messageCount, timestamp: Date.now() });
  return false;
};

/**
 * Очистить кеш для аккаунта
 */
export const clearBlacklistCache = (accountId) => {
  blacklistCache.delete(accountId);
};
```

---

### ЭТАП 4: Backend - Интеграция в AI Auto

**Файл:** `backend/src/services/aiAuto/index.js`

Добавить проверки в **3 места:**

#### 4.1 New Messages (строка ~110)
```javascript
// После получения chats с newMessage
for (const chat of chatsWithNewMessages) {
  const userUid = chat.chatId.split('_')[1];
  
  // Проверка черного списка
  if (await isUserBlacklisted(accountId, userUid, 'newMessages')) {
    // Проверка зацикливания
    if (shouldSkipDueToLoop(accountId, chat.profileUid, userUid, chat.messageCount)) {
      utils.log('AI Auto', `⏭️  Skipping ${chat.chatId} (blacklist loop protection)`);
      continue;
    }
    
    utils.log('AI Auto', `🚫 Skipping ${chat.chatId} (blacklisted user)`);
    continue;
  }
  
  // Обычная обработка...
}
```

#### 4.2 Catch Up (строка ~250)
```javascript
// После получения catchUpChats
for (const chat of catchUpChats) {
  const userUid = chat.chatId.split('_')[1];
  
  if (await isUserBlacklisted(accountId, userUid, 'catchUp')) {
    if (shouldSkipDueToLoop(accountId, chat.profileUid, userUid, chat.messageCount)) {
      utils.log('AI Auto', `⏭️  Skipping Catch Up ${chat.chatId} (loop)`);
      continue;
    }
    
    utils.log('AI Auto', `🚫 Skipping Catch Up ${chat.chatId} (blacklist)`);
    continue;
  }
  
  // Обработка...
}
```

#### 4.3 Activity Center (строка ~350)
```javascript
// После получения notifications
for (const notification of notifications) {
  const userUid = notification.userUid;
  
  if (await isUserBlacklisted(accountId, userUid, 'activityCenter')) {
    utils.log('AI Auto', `🚫 Skipping Activity Center ${userUid} (blacklist)`);
    continue;
  }
  
  // Обработка...
}
```

---

### ЭТАП 5: Frontend - Новая вкладка

**Файл:** `frontend/src/components/AdminModal/index.jsx`

Добавить вкладку:
```javascript
const tabs = [
  { id: 'luxee', label: '🌐 Luxee аккаунты', component: LuxeeTab },
  ...(isAdmin ? [{ id: 'users', label: '👥 Пользователи', component: UsersTab }] : []),
  ...(isAdmin ? [{ id: 'ai', label: 'AI Управление', component: AiTab }] : []),
  ...(isAdmin ? [{ id: 'blacklist', label: '🚫 Черные списки', component: BlacklistTab }] : []),
];
```

---

### ЭТАП 6: Frontend - BlacklistTab компонент

**Файл:** `frontend/src/components/AdminModal/BlacklistTab/index.jsx` (НОВЫЙ)

**Структура UI:**

```
┌─────────────────────────────────────────┐
│ 🚫 Черные списки AI                     │
├─────────────────────────────────────────┤
│ Выберите аккаунты и категории для      │
│ блокировки мужчин из списка             │
├─────────────────────────────────────────┤
│                                          │
│ 📧 user1@example.com (3 аккаунта)       │
│   ☐ Account1 (Margarita, #608434)      │
│   ☑ Account2 (Valeria, #607823)  ◀─── │
│   ☐ Account3 (Tatiana, #609123)        │
│                                          │
│ 📧 user2@example.com (2 аккаунта)       │
│   ☑ Account4 (Anna, #610456)     ◀─── │
│   ☐ Account5 (Elena, #611789)          │
│                                          │
├─────────────────────────────────────────┤
│ Настройки для выбранных: 2 аккаунта     │
├─────────────────────────────────────────┤
│ Категории для блокировки:               │
│   ☑ Новые сообщения (newMessages+unans) │
│   ☐ Catch Up                            │
│   ☑ Activity Center                     │
│                                          │
│ Черный список ID мужчин:                │
│ ┌─────────────────────────────────────┐ │
│ │ 2814785                             │ │
│ │ 1234567                             │ │
│ │ 9876543                             │ │
│ └─────────────────────────────────────┘ │
│ Формат: один ID на строку               │
│                                          │
│ Текущий список (3 ID):                  │
│ • 2814785 [Удалить]                     │
│ • 1234567 [Удалить]                     │
│ • 9876543 [Удалить]                     │
│                                          │
│ [Сохранить изменения] [Очистить всё]   │
└─────────────────────────────────────────┘
```

**Адаптивность:**
- Mobile: список аккаунтов скроллится, кнопки меньше
- Tablet: 2 колонки
- Desktop: комфортное расположение

---

### ЭТАП 7: Frontend - API функции

**Файл:** `frontend/src/api/blacklistApi.js` (НОВЫЙ)

```javascript
export const blacklistApi = {
  getBlacklist: async (accountId) => {...},
  updateBlacklist: async (accountId, data) => {...},
  addUserIds: async (accountId, userIds) => {...},
  removeUserId: async (accountId, userId) => {...}
};
```

---

## 🎯 Порядок выполнения

1. ✅ Backend модель (5 мин)
2. ✅ Backend API endpoints (15 мин)
3. ✅ Backend blacklistService (20 мин)
4. ✅ Backend интеграция в AI Auto (30 мин)
5. ✅ Тестирование backend (10 мин)
6. ✅ Frontend BlacklistTab UI (40 мин)
7. ✅ Frontend API + логика (20 мин)
8. ✅ Адаптивность (20 мин)
9. ✅ Финальное тестирование (20 мин)

**Итого:** ~3 часа

---

## 🧪 Тестирование

### Сценарий 1: Добавление в черный список
1. Открыть админку → Черные списки
2. Выбрать аккаунт
3. Выбрать категории (Новые сообщения, Activity Center)
4. Добавить ID мужчины: `2814785`
5. Сохранить
6. Проверить что сообщения от него игнорируются

### Сценарий 2: Защита от зацикливания
1. Добавить ID в черный список
2. Мужчина отправляет сообщение
3. AI видит newMessage → проверяет unanswered → видит черный список → skip
4. Через 5 секунд: снова проверка → skip (защита!)
5. Через 5 минут: проверка → все равно skip если счетчик не изменился

### Сценарий 3: Удаление из черного списка
1. Нажать [Удалить] рядом с ID
2. Сохранить
3. Проверить что AI снова отвечает этому мужчине

---

## ⚠️ Важные моменты

1. **ID мужчины = userUid** (второе число в chatId)
2. **Кеш зацикливания** хранится в памяти (сбросится при перезапуске)
3. **Категории** проверяются независимо
4. **Admin only** - только админ видит вкладку
5. **WebSocket sync** - изменения применяются сразу

---

**Статус:** Готов к реализации  
**Дата:** 03.08.2026  
**Автор:** Kiro AI
