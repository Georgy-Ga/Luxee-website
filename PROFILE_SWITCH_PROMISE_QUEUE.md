# 🚀 Profile Switch Service - Promise Queue Architecture

**Дата**: 07.07.2026, 17:44  
**Версия**: 2.0 (Event Loop Style)  
**Статус**: ✅ PRODUCTION READY

---

## 🎯 Архитектура (Event Loop Style)

### Глобальная структура данных:

```javascript
Map<accountId, Queue> где Queue = {
    isProcessing: boolean,      // Обрабатывается ли сейчас
    currentProfileUid: number,  // Текущий активный профиль
    queue: [                    // FIFO очередь запросов
        {
            profileUid: number,
            caller: string,
            resolve: Function,
            reject: Function,
            timestamp: number
        }
    ]
}
```

### Изоляция на уровне аккаунта:

```
Account A → Queue A (независимая)
Account B → Queue B (независимая)
Account C → Queue C (независимая)
```

✅ **Разные аккаунты** работают **параллельно**  
✅ **Один аккаунт** обрабатывает запросы **последовательно**

---

## 📊 Workflow (как Event Loop в Node.js)

### 1. Запрос приходит:

```javascript
await profileSwitchService.switchProfile(page, accountId, 608895, 'AI Auto');
```

### 2. Проверки:

```
┌─────────────────────────────────────────┐
│ 1. Уже на нужном профиле?               │
│    ✅ YES → return true (skip)          │
│    ❌ NO → продолжаем                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 2. Профиль уже в очереди? (дедупликация)│
│    ✅ YES → ждём его выполнения (15s)  │
│    ❌ NO → добавляем в очередь          │
└─────────────────────────────────────────┘
```

### 3. Добавление в очередь:

```javascript
const request = {
    profileUid: 608895,
    caller: 'AI Auto',
    resolve: (value) => { /* Promise resolve */ },
    reject: (error) => { /* Promise reject */ },
    timestamp: Date.now()
};

queue.push(request); // FIFO
```

### 4. Обработка очереди (Event Loop Processor):

```
┌───────────────────────────────────────────────┐
│  while (queue.length > 0) {                   │
│    request = queue.shift(); // FIFO           │
│                                               │
│    1. page.evaluate(selectProfile)            │
│    2. await sleep(3000) // загрузка чатов    │
│    3. Проверка что переключились              │
│    4. request.resolve(true) ИЛИ reject(error) │
│    5. await sleep(500) // антиспам            │
│  }                                            │
└───────────────────────────────────────────────┘
```

---

## ✅ Преимущества Promise Queue

### 1. **Дедупликация автоматическая**

```javascript
// AI Auto запрашивает профиль 608895
await switchProfile(page, accountId, 608895, 'AI Auto');

// Pending Response запрашивает ТОТ ЖЕ профиль (дубль!)
await switchProfile(page, accountId, 608895, 'Pending'); 

// ✅ Второй запрос НЕ добавляется в очередь
// ✅ Он просто ЖДЁТ пока первый выполнится
// ✅ Когда профиль 608895 станет активным - оба resolve(true)
```

**Лог:**
```
[Profile Switch] 📥 Queued profile 608895 (AI Auto) - queue size: 1
[Profile Switch] 🔄 Profile 608895 already queued - waiting for it...
[Profile Switch] 📊 Current caller: Pending, Queue size: 1
[Profile Switch] ✅ Success: profile 608895 (AI Auto) in 3124ms
[Profile Switch] ✅ Profile 608895 ready (waited 3200ms) - Pending
```

### 2. **Event-driven (НЕ busy waiting)**

**ДО (Simple Mutex):**
```javascript
// ❌ Busy waiting - тратит CPU
while (lock.isLocked) {
    await sleep(500); // каждые 500ms проверяем
}
```

**ПОСЛЕ (Promise Queue):**
```javascript
// ✅ Event-driven - не тратит CPU
return new Promise((resolve, reject) => {
    queue.push({ profileUid, resolve, reject });
    if (!isProcessing) processQueue(); // запускаем если не запущен
});
```

### 3. **FIFO порядок**

```
Запросы:
1. AI Auto → Profile A
2. Pending → Profile B  
3. AI Response → Profile C

Выполнение:
1. Profile A (AI Auto) ✅
2. Profile B (Pending) ✅
3. Profile C (AI Response) ✅

Предсказуемо и понятно!
```

### 4. **Быстрый timeout**

- ⏱️ **15 секунд** для ожидания дубля (вместо 30)
- ⏱️ **3 секунды** на переключение + проверку
- ⏱️ **500ms** антиспам между переключениями

### 5. **Наблюдаемость**

```javascript
// Получить статус очереди
const status = profileSwitchService.getQueueStatus(accountId);
console.log(status);
// {
//   isProcessing: true,
//   currentProfileUid: 608895,
//   queueLength: 2,
//   queuedProfiles: [
//     { profileUid: 605196, caller: 'AI Auto', waitingMs: 1523 },
//     { profileUid: 608100, caller: 'Pending', waitingMs: 845 }
//   ]
// }

// Глобальная статистика
const stats = profileSwitchService.getGlobalStats();
console.log(stats);
// {
//   totalAccounts: 3,
//   activeProcessors: 2,
//   totalQueuedRequests: 4,
//   accounts: [...]
// }
```

---

## 📝 API Reference

### `switchProfile(page, accountId, profileUid, caller)`

Переключить профиль через Promise Queue.

```javascript
const success = await profileSwitchService.switchProfile(
    page,
    'account123',
    608895,
    'AI Auto'
);
// Returns: Promise<boolean>
```

**Параметры:**
- `page` - Playwright page объект
- `accountId` - ID Luxee аккаунта (для изоляции очереди)
- `profileUid` - UID профиля для переключения
- `caller` - Название сервиса (для логов)

**Возвращает:**
- `Promise<true>` - успешное переключение
- `Promise<false>` / `reject(Error)` - ошибка

---

### `getCurrentProfile(page)`

Получить текущий активный профиль.

```javascript
const currentUid = await profileSwitchService.getCurrentProfile(page);
// Returns: Promise<number|null>
```

---

### `getQueueStatus(accountId)`

Получить статус очереди для аккаунта.

```javascript
const status = profileSwitchService.getQueueStatus('account123');
// Returns: {
//   isProcessing: boolean,
//   currentProfileUid: number,
//   queueLength: number,
//   queuedProfiles: Array<{ profileUid, caller, waitingMs }>
// }
```

---

### `clearQueue(accountId, reason)`

Принудительно очистить очередь (экстренный случай).

```javascript
const cancelledCount = profileSwitchService.clearQueue(
    'account123',
    'User disconnected'
);
// Returns: number (количество отменённых запросов)
```

**Использование:**
- Пользователь отключил AI
- Аккаунт отключается
- Критическая ошибка

---

### `deleteQueue(accountId)`

Удалить очередь аккаунта полностью.

```javascript
profileSwitchService.deleteQueue('account123');
// Очищает очередь + удаляет из Map
```

**Использование:**
- При отключении аккаунта
- При удалении аккаунта из системы

---

### `forceUnlock(accountId)`

Принудительно разблокировать процессор (отладка).

```javascript
const wasLocked = profileSwitchService.forceUnlock('account123');
// Returns: boolean
```

**Использование:**
- Процессор завис
- Для тестирования

---

### `getGlobalStats()`

Получить статистику по всем очередям.

```javascript
const stats = profileSwitchService.getGlobalStats();
// Returns: {
//   totalAccounts: number,
//   activeProcessors: number,
//   totalQueuedRequests: number,
//   accounts: Array<{ accountId, isProcessing, currentProfileUid, queueLength }>
// }
```

**Использование:**
- Мониторинг системы
- Дебаггинг
- Метрики

---

## 🎯 Типичные логи

### Нормальная работа:

```
[Profile Switch] 🆕 Created queue for account 6a3ac2d7df47167e9b3f68ec
[Profile Switch] 📥 Queued profile 608895 (AI Auto) - queue size: 1
[Profile Switch] 🚀 Starting queue processor for account 6a3ac2d7df47167e9b3f68ec (1 items)
[Profile Switch] 🔄 Processing: profile 608895 (AI Auto)
[Profile Switch] ⏱️  Request waited in queue: 12ms
[Browser] 🔄 Switching to profile 608895 (caller: AI Auto)
[Profile Switch] ✅ Success: profile 608895 (AI Auto) in 3124ms
[Profile Switch] 📊 Remaining in queue: 0
[Profile Switch] 🏁 Queue processor finished for account 6a3ac2d7df47167e9b3f68ec
```

### Skip (уже на профиле):

```
[Profile Switch] ⚡ Already on profile 608895 (AI Auto) - skipping
```

### Дедупликация:

```
[Profile Switch] 📥 Queued profile 608895 (AI Auto) - queue size: 1
[Profile Switch] 🔄 Profile 608895 already queued by another caller - waiting for it...
[Profile Switch] 📊 Current caller: Pending Response, Queue size: 1
[Profile Switch] ✅ Success: profile 608895 (AI Auto) in 3156ms
[Profile Switch] ✅ Profile 608895 ready (waited 3200ms) - Pending Response
```

### Несколько запросов:

```
[Profile Switch] 📥 Queued profile 608895 (AI Auto) - queue size: 1
[Profile Switch] 📥 Queued profile 605196 (Pending) - queue size: 2
[Profile Switch] 📥 Queued profile 608100 (AI Response) - queue size: 3
[Profile Switch] 🚀 Starting queue processor (3 items)
[Profile Switch] 🔄 Processing: profile 608895 (AI Auto)
[Profile Switch] ⏱️  Request waited in queue: 45ms
[Profile Switch] ✅ Success: profile 608895 (AI Auto) in 3145ms
[Profile Switch] 📊 Remaining in queue: 2
[Profile Switch] 🔄 Processing: profile 605196 (Pending)
[Profile Switch] ⏱️  Request waited in queue: 3672ms
[Profile Switch] ✅ Success: profile 605196 (Pending) in 3201ms
[Profile Switch] 📊 Remaining in queue: 1
[Profile Switch] 🔄 Processing: profile 608100 (AI Response)
[Profile Switch] ⏱️  Request waited in queue: 7345ms
[Profile Switch] ✅ Success: profile 608100 (AI Response) in 3098ms
[Profile Switch] 📊 Remaining in queue: 0
[Profile Switch] 🏁 Queue processor finished
```

---

## 🔒 Изоляция на уровне аккаунта

### Ключевой момент:

```javascript
const profileSwitchQueues = new Map(); // accountId → Queue
```

**Каждый Luxee аккаунт имеет:**
- ✅ Свою независимую очередь
- ✅ Свой процессор очереди
- ✅ Свой текущий профиль

**Результат:**
```
Account A (queue: 3 items, processing: true)  ┐
Account B (queue: 1 item,  processing: true)  ├─ Параллельно!
Account C (queue: 0 items, processing: false) ┘

Но внутри Account A: последовательно!
Profile 1 → Profile 2 → Profile 3 (FIFO)
```

---

## ⚠️ Важные правила

### 1. ВСЕ переключения ТОЛЬКО через этот сервис

```javascript
// ❌ НЕПРАВИЛЬНО
await page.evaluate(uid => modelsChat.selectProfile(uid), profileUid);

// ✅ ПРАВИЛЬНО
await profileSwitchService.switchProfile(page, accountId, profileUid, 'My Service');
```

### 2. Всегда передавай accountId

```javascript
// ❌ НЕПРАВИЛЬНО
await profileSwitchService.switchProfile(page, profileUid, 'My Service');

// ✅ ПРАВИЛЬНО
await profileSwitchService.switchProfile(page, accountId, profileUid, 'My Service');
```

### 3. Указывай понятный caller

```javascript
// ❌ ПЛОХО
await profileSwitchService.switchProfile(page, accountId, profileUid, 'service1');

// ✅ ХОРОШО
await profileSwitchService.switchProfile(page, accountId, profileUid, 'AI Auto Response');
```

### 4. Удаляй очередь при отключении

```javascript
// При отключении аккаунта
profileSwitchService.deleteQueue(accountId);
```

---

## 🚀 Масштабируемость

### Текущая реализация поддерживает:

- ✅ Неограниченное количество аккаунтов
- ✅ Каждый аккаунт → независимая очередь
- ✅ Параллельная обработка разных аккаунтов
- ✅ Последовательная обработка внутри аккаунта
- ✅ Автоматическая дедупликация
- ✅ FIFO порядок (предсказуемость)

### Если нужно больше (в будущем):

- 🔮 **Приоритеты** - AI Auto выше чем Pending
- 🔮 **Debounce** - фильтрация спама запросов
- 🔮 **Metrics** - Prometheus метрики
- 🔮 **Redis Queue** - распределённая очередь

---

## 📊 Сравнение: Simple Mutex vs Promise Queue

| Критерий | Simple Mutex | Promise Queue |
|----------|--------------|---------------|
| CPU Usage | ❌ Busy waiting | ✅ Event-driven |
| Timeout | ❌ 30 секунд | ✅ 15 секунд |
| Дедупликация | ❌ Нет | ✅ Автоматическая |
| Очередь | ❌ Нет | ✅ FIFO |
| Наблюдаемость | ⚠️ Базовая | ✅ Полная (stats) |
| Порядок выполнения | ❌ Неопределённый | ✅ FIFO (понятный) |
| Изоляция аккаунтов | ✅ Есть | ✅ Есть |
| Сложность кода | ✅ Простой | ⚠️ Средняя |

**Выбор:** Promise Queue - оптимальное решение для production!

---

## ✅ Чек-лист для разработчиков

При добавлении нового сервиса, который переключает профили:

- [ ] Импортируй `profileSwitchService`
- [ ] Используй динамический import (избежание циклов)
- [ ] Передавай `accountId` (не пропускай!)
- [ ] Указывай понятный `caller`
- [ ] Обрабатывай `reject` (try/catch)
- [ ] Не вызывай `selectProfile` напрямую!

---

**Автор**: Kiro AI  
**Дата**: 07.07.2026, 17:44  
**Версия**: 2.0 (Promise Queue)  
**Статус**: ✅ PRODUCTION READY
