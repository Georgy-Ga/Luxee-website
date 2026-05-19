# MESSAGE FLOW

> **Как работает проверка и отправка сообщений**  
> **Обновлено:** 04.05.2026

---

## 🔄 ДВЕ СИСТЕМЫ

### ✅ Проверка сообщений (БЕЗ очереди)
**Файлы:**
- `messageCheckService.js`
- `messageCheckIntervalService.js`

**Механизм:**
1. Каждые 8 секунд
2. Читает `modelsChat.getProfile.data` → все профили + newMessages
3. Читает `modelsChat.getChats.list` → все чаты
4. Парсит `chatId` для определения профиля
5. Считает `unAnswered` для всех UID профиля

**⚠️ НЕ переключает профили, НЕ использует очередь**

---

### ⚠️ Отправка сообщений (В ОЧЕРЕДИ)
**Файлы:**
- `messageSendService.js`
- `requestQueueService.js`

**Механизм:**
1. Добавляет запрос в очередь
2. Очередь переключает профиль (если нужно)
3. Отправляет сообщение через API
4. Обновляет состояние

**⚠️ Переключает профили, использует очередь**

---

## 📊 ПРОВЕРКА СООБЩЕНИЙ

### Алгоритм:

```javascript
// 1. Получить все профили
const profilesData = await page.evaluate(() => {
  return modelsChat.getProfile.data;
});

// 2. Получить все чаты
const chatsData = await page.evaluate(() => {
  return modelsChat.getChats.list;
});

// 3. Для каждого профиля
for (const uid in profilesData) {
  const profile = profilesData[uid];
  
  // 4. Собрать все UID профиля (inner + outer)
  const allProfileUids = [profile.inner.uid];
  if (profile.outer) {
    for (const outerUid in profile.outer) {
      allProfileUids.push(profile.outer[outerUid].uid);
    }
  }
  
  // 5. Подсчитать unAnswered
  let unansweredCount = 0;
  for (const chatId in chatsData) {
    const chat = chatsData[chatId];
    const chatProfileUid = parseInt(chatId.split('_')[0]);
    
    if (allProfileUids.includes(chatProfileUid) && chat.unAnswered === true) {
      unansweredCount++;
    }
  }
  
  // 6. Вернуть результат
  return {
    uid: profile.inner.uid,
    username: profile.inner.username,
    newMessages: profile.newMessages || 0,
    unansweredMessages: unansweredCount
  };
}
```

### Возвращаемые данные:

```javascript
{
  accounts: [
    {
      accountId: "...",
      accountEmail: "test@luxee.io",
      profiles: [
        {
          uid: 1420,
          username: "Maria",
          avatar: "https://img.luxee.date/thumb/...",
          newMessages: 5,           // Новые непрочитанные
          unansweredMessages: 2,    // Неотвеченные (из всех UID)
          isActive: true
        }
      ],
      totalUnread: 5,
      profilesCount: 1
    }
  ],
  totalUnread: 5,
  totalProfiles: 1
}
```

---

## 📤 ОТПРАВКА СООБЩЕНИЙ

### Алгоритм:

```javascript
// 1. Добавить в очередь
await requestQueueService.addRequest({
  accountId,
  profileUid,
  action: async (page) => {
    // 2. Переключить профиль (если нужно)
    const currentProfile = await page.evaluate(() => {
      return modelsChat.getProfile.active?.uid;
    });
    
    if (currentProfile !== profileUid) {
      await page.evaluate((uid) => {
        modelsChat.selectProfile(uid);
      }, profileUid);
      
      await page.waitForTimeout(2000); // Ждем загрузки
    }
    
    // 3. Отправить сообщение
    await page.evaluate(({ memberUid, text, chatIdentity }) => {
      modelsChat.sendMessage({
        uid: memberUid,
        body: text,
        identity: chatIdentity
      });
    }, { memberUid, text, chatIdentity });
    
    return { success: true };
  }
});
```

---

## 🔑 КЛЮЧЕВЫЕ ОТЛИЧИЯ

### Проверка:
- ✅ Читает API напрямую
- ✅ НЕ переключает профили
- ✅ НЕ использует очередь
- ✅ Быстрая (мгновенная)
- ✅ Не мешает отправке

### Отправка:
- ⚠️ Переключает профили
- ⚠️ Использует очередь
- ⚠️ Медленная (2-3 сек)
- ⚠️ Блокирует другие операции в очереди

---

## 🎯 ПОЧЕМУ ТАК?

### Проблема старой архитектуры:
```
❌ Проверка переключала профили
❌ Отправка переключала профили
❌ Конфликты при одновременной работе
❌ Отправка прерывалась проверкой
```

### Решение:
```
✅ Проверка просто читает данные
✅ Отправка в очереди (последовательно)
✅ Нет конфликтов
✅ Отправка не прерывается
```

---

## 📈 ПРОИЗВОДИТЕЛЬНОСТЬ

### Проверка сообщений:
- **Частота:** Каждые 8 секунд
- **Время:** ~100ms (чтение API)
- **Нагрузка:** Минимальная

### Отправка сообщений:
- **Время:** 2-3 секунды
- **Включает:**
  - Переключение профиля: ~1-2 сек
  - Отправка: ~500ms
  - Обновление UI: ~100ms

---

## 🔧 СЕРВИСЫ

### messageCheckIntervalService
**Назначение:** Автоматическая проверка каждые 8 сек  
**Запуск:** При логине в Luxee аккаунт  
**Остановка:** При удалении аккаунта

### messageCheckService
**Назначение:** Проверка сообщений  
**Методы:**
- `checkAllMessages({ userId })` - все аккаунты
- `checkAccountMessages({ userId, accountId })` - один аккаунт

### requestQueueService
**Назначение:** Очередь для отправки  
**Методы:**
- `addRequest({ accountId, profileUid, action })` - добавить
- `processQueue()` - обработать
- `getQueueStatus(accountId)` - статус

### messageSendService
**Назначение:** Отправка сообщений  
**Метод:**
- `sendMessage({ userId, accountId, profileUid, memberUid, text, chatIdentity })`

---

**Связанные документы:**
- `../api/luxee-api.md` - Luxee API
- `chat-identity.md` - система chatId
- `project-structure.md` - структура файлов
