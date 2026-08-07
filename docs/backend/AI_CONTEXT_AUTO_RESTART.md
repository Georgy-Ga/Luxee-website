# AI Context Auto-Restart - Автоматический Перезапуск Контекста

## 📋 Описание

Система автоматического перезапуска браузерного контекста для AI каждые 2 часа. Это предотвращает накопление ошибок, утечки памяти и проблемы с авторизацией, которые могут возникать при длительной работе браузерного контекста.

---

## 🎯 Проблема

После нескольких часов непрерывной работы AI могут возникать следующие проблемы:

1. **Перестает отвечать на сообщения** - браузер накапливает ошибки
2. **Утечки памяти** - контекст разрастается
3. **Проблемы с авторизацией** - куки устаревают
4. **API десинхронизация** - данные профилей не обновляются

---

## ✅ Решение

Каждые **2 часа** AI контекст автоматически:

1. **Закрывается** (все вкладки и соединения)
2. **Пересоздается** с актуальными cookies из базы данных
3. **Проверяется авторизация** (навигация на `/chats/`)
4. **Продолжает работу** с чистым контекстом

---

## 🔧 Техническая Реализация

### 1. **Отслеживание времени создания**

```javascript
// backend/src/services/browser/browserService.js
const contextCreationTime = new Map(); // accountId -> timestamp

createContext: async ({ accountId, sessionData = null }) => {
    // ...
    const now = Date.now();
    contextLastActivity.set(accountId, now);
    contextCreationTime.set(accountId, now); // ← Сохраняем время создания
    // ...
}
```

### 2. **Проверка возраста контекста**

```javascript
// backend/src/services/browser/browserService.js
const AI_CONTEXT_RESTART_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

shouldRestartAiContext: (accountId) => {
    if (!accountId.endsWith('_ai')) return false;
    
    const creationTime = contextCreationTime.get(accountId);
    if (!creationTime) return false;
    
    const age = Date.now() - creationTime;
    return age >= AI_CONTEXT_RESTART_INTERVAL; // >= 2 hours
}
```

### 3. **Перезапуск контекста**

```javascript
// backend/src/services/browser/browserService.js
restartAiContext: async (accountId) => {
    // 1. Получаем оригинальный accountId
    const originalAccountId = accountId.replace('_ai', '');
    
    // 2. Получаем актуальные данные авторизации из БД
    const account = await LuxeeAccountModel.findById(originalAccountId);
    const sessionData = JSON.parse(account.sessionData);
    
    // 3. Закрываем старый контекст
    await browserService.closeContext(accountId);
    
    // 4. Создаём новый с теми же cookies
    const newContext = await browserService.createContext({
        accountId: accountId,
        sessionData: sessionData,
    });
    
    // 5. Навигируемся на /chats/ (проверка авторизации)
    const page = await pageHelpers.getOrCreatePage(newContext);
    await pageHelpers.navigateTo({
        page,
        url: 'https://luxee.io/chats/',
    });
}
```

### 4. **Интеграция в очередь AI**

```javascript
// backend/src/services/aiAuto/index.js
const processAccountMessages = async (accountId, userId, page) => {
    // ========== ПРОВЕРКА ПЕРЕЗАПУСКА AI КОНТЕКСТА ==========
    try {
        const aiContextId = `${accountId}_ai`;
        const { default: browserService } = await import('../browser/browserService.js');
        
        if (browserService.shouldRestartAiContext(aiContextId)) {
            const age = browserService.getContextAge(aiContextId);
            const ageHours = (age / (60 * 60 * 1000)).toFixed(1);
            
            console.log(`🔄 AI context is ${ageHours}h old, restarting...`);
            
            await browserService.restartAiContext(aiContextId);
            
            // Получаем новую страницу после перезапуска
            const newContext = browserService.getContext(aiContextId);
            if (newContext) {
                const pages = newContext.pages();
                if (pages.length > 0) {
                    page = pages[0]; // Обновляем page
                }
            }
        }
    } catch (error) {
        console.error('[AI Auto] Error checking context restart:', error);
        // Продолжаем работу со старым контекстом
    }
    
    // ... далее обычная логика обработки сообщений
}
```

---

## 📊 Логирование

### При проверке возраста:

```
[AI Auto] 🔄 AI context is 2.1h old, restarting for account 507f1f77bcf86cd799439011...
```

### При перезапуске:

```
[Browser Service] 🔄 Restarting AI context 507f1f77bcf86cd799439011_ai (age: 126 minutes)
[Browser Service] ✅ Old AI context closed: 507f1f77bcf86cd799439011_ai
[Browser Service] ✅ New AI context created: 507f1f77bcf86cd799439011_ai
[Browser Service] ✅ AI context restarted successfully: 507f1f77bcf86cd799439011_ai
[AI Auto] ✅ AI context restarted successfully for account 507f1f77bcf86cd799439011
[AI Auto] ✅ Using new page after context restart
```

### При ошибках:

```
[Browser Service] ❌ Error restarting AI context 507f1f77bcf86cd799439011_ai: Account has no session data
[AI Auto] Failed to restart AI context: Account has no session data
```

---

## 🔒 Безопасность

### **Данные авторизации**

Cookies хранятся в базе данных (`LuxeeAccountModel.sessionData`):

```javascript
{
    "_id": "507f1f77bcf86cd799439011",
    "luxeeEmail": "user@example.com",
    "sessionData": "{\"cookies\":[...],\"origins\":[...]}",  // ← Актуальные куки
    "isActive": true,
    "aiEnabled": true
}
```

При перезапуске контекста:
1. **Загружаются актуальные куки** из БД
2. **Создается новая сессия** с этими куками
3. **Проверяется авторизация** (навигация на luxee.io)

---

## ⚙️ Настройки

### Интервал перезапуска

```javascript
// backend/src/services/browser/browserService.js
const AI_CONTEXT_RESTART_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

// Изменить на 1 час:
const AI_CONTEXT_RESTART_INTERVAL = 1 * 60 * 60 * 1000;

// Изменить на 3 часа:
const AI_CONTEXT_RESTART_INTERVAL = 3 * 60 * 60 * 1000;
```

---

## 🔍 Мониторинг

### Проверить возраст контекста:

```javascript
const browserService = require('./services/browser/browserService');

const accountId = '507f1f77bcf86cd799439011_ai';
const age = browserService.getContextAge(accountId);
const ageHours = age / (60 * 60 * 1000);

console.log(`Context age: ${ageHours.toFixed(2)} hours`);
```

### Проверить нужен ли перезапуск:

```javascript
const shouldRestart = browserService.shouldRestartAiContext(accountId);
console.log(`Should restart: ${shouldRestart}`); // true если >= 2 hours
```

### Принудительный перезапуск:

```javascript
await browserService.restartAiContext(accountId);
```

---

## 📈 Преимущества

### **До внедрения:**
- ❌ AI перестает работать через несколько часов
- ❌ Нужен ручной перезапуск
- ❌ Накапливаются ошибки и утечки памяти
- ❌ Проблемы с авторизацией

### **После внедрения:**
- ✅ AI работает стабильно 24/7
- ✅ Автоматический перезапуск каждые 2 часа
- ✅ Свежий контекст без накопленных ошибок
- ✅ Актуальные данные авторизации

---

## 🛠️ Отладка

### Логи для отслеживания:

```bash
# Смотреть логи перезапуска
grep "Restarting AI context" logs/backend.log

# Смотреть возраст контекстов
grep "context is.*old" logs/backend.log

# Смотреть ошибки перезапуска
grep "Error restarting AI context" logs/backend.log
```

### Проблемы и решения:

| Проблема | Причина | Решение |
|----------|---------|---------|
| `Account has no session data` | Утеряны cookies | Переавторизовать аккаунт через админ панель |
| `Account not found` | Аккаунт удален из БД | Проверить что аккаунт существует |
| `Failed to navigate to /chats/` | Проблемы с сетью | Проверить доступность luxee.io |
| Context restart takes too long | Медленная сеть | Увеличить timeout в navigateTo |

---

## 🔄 Цикл работы

```
┌─────────────────────────────────────────┐
│  AI Context создан (t=0)                │
│  contextCreationTime.set(accountId, now)│
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Обработка сообщений (t=0 - 2h)        │
│  - processAccountMessages()             │
│  - shouldRestartAiContext() → false     │
│  - Продолжаем работу                    │
└─────────────────┬───────────────────────┘
                  │
                  ▼  (t >= 2 hours)
┌─────────────────────────────────────────┐
│  Проверка: shouldRestartAiContext()     │
│  → true (age >= 2 hours)                │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Перезапуск контекста                   │
│  1. Закрыть старый                      │
│  2. Создать новый с актуальными cookies │
│  3. Навигация на /chats/                │
│  4. Обновить page                       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  AI Context пересоздан (t=2h)           │
│  contextCreationTime.set(accountId, now)│
│  ← Цикл повторяется                     │
└─────────────────────────────────────────┘
```

---

## 📝 Пример использования

```javascript
// В очереди AI
const result = await processAccountMessages(accountId, userId, page);

// Система автоматически:
// 1. Проверит возраст контекста
// 2. Перезапустит если >= 2 часа
// 3. Обновит page
// 4. Продолжит обработку сообщений

console.log(result);
// { processed: true, reason: 'active_profile_processed' }
```

---

## ✅ Итог

Система автоматического перезапуска AI контекста:

- ✅ **Работает в фоне** - не требует вмешательства
- ✅ **Прозрачная** - AI продолжает работу без простоев
- ✅ **Безопасная** - использует актуальные cookies из БД
- ✅ **Логируется** - все действия записываются в лог
- ✅ **Настраиваемая** - интервал можно изменить
- ✅ **Устойчивая к ошибкам** - при ошибке продолжает со старым контекстом

**Результат:** AI работает стабильно 24/7 без накопления ошибок и проблем с авторизацией! 🎉
