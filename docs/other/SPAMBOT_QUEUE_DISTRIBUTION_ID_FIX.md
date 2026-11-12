# Исправление: Обновление distributionId при запуске из очереди

**Дата:** 21 июля 2026  
**Статус:** ✅ Исправлено

---

## Проблема

Рассылки, запущенные из очереди, получали ошибку **404** при polling статуса, потому что:

1. Рассылка создавалась с временным ID: `temp_1784625464413_i0vig8yoj`
2. Ставилась в очередь со статусом `queued`
3. После завершения первой рассылки, вторая запускалась из очереди
4. **Python service присваивал новый UUID**: `96a72999-5eb5-4667-9f52-740037467178`
5. **НО в MongoDB оставался старый временный ID!**
6. Polling пытался получить статус по старому ID → **404 Not Found**

### Логи ошибки

**Backend-spambot (Python):**
```
INFO: 127.0.0.1:65293 - "GET /api/distribution/temp_1784625464413_i0vig8yoj/status HTTP/1.1" 404 Not Found
INFO: 127.0.0.1:65306 - "GET /api/distribution/temp_1784625464413_i0vig8yoj/status HTTP/1.1" 404 Not Found
...
```

**Backend (Node.js):**
```
[Spambot Service] Error getting status: Request failed with status code 404
[Spambot Polling] 📊 Status received: running, sent: 0, skipped: 0
```

Python service не знал о `temp_...` ID, он знал только о реальном UUID `96a72999...`!

---

## Причина

В `SpambotQueueService.js`, метод `startNextInQueue()` **НЕ обновлял distributionId** после получения ответа от Python service.

**Файл:** `backend/src/services/SpambotQueueService.js`  
**Строки:** 215-224 (до исправления)

```javascript
const response = await axios.post(
    `${PYTHON_SERVICE_URL}/api/distribution/start`,
    fullConfig,
    { timeout: 30000 },
);

// ❌ ПРОБЛЕМА: НЕ обновляется distributionId!
next.status = 'running';
next.startedAt = new Date();
await next.save();
```

Сравни с `SpambotService.startDistribution()` (строки 242-244), где **правильно** обновляется ID:

```javascript
const { distribution_id } = response.data;

distribution.distributionId = distribution_id; // ✅ Обновляем!
distribution.startedAt = new Date();
await distribution.save();
```

---

## Решение

Добавлено обновление `distributionId` из ответа Python service перед сохранением в MongoDB.

**Файл:** `backend/src/services/SpambotQueueService.js`  
**Строки:** 215-227 (после исправления)

```javascript
const response = await axios.post(
    `${PYTHON_SERVICE_URL}/api/distribution/start`,
    fullConfig,
    { timeout: 30000 },
);

const { distribution_id } = response.data;

// ✅ FIX: Обновить distributionId и статус в MongoDB
next.distributionId = distribution_id;
next.status = 'running';
next.startedAt = new Date();
await next.save();
```

---

## Результат

✅ **Теперь рассылки из очереди:**

1. Создаются с временным ID (`temp_...`)
2. Ставятся в очередь (`status: queued`)
3. При запуске получают **реальный UUID** от Python service
4. **UUID сохраняется в MongoDB**
5. Polling использует **правильный ID** → статус обновляется корректно
6. Рассылка успешно завершается без ошибок 404

---

## Тестирование

**Для проверки исправления:**

1. Перезапустить Node.js backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Добавить 2+ рассылки на одном аккаунте
3. Первая запустится немедленно (`status: running`)
4. Вторая встанет в очередь (`status: queued`)
5. После завершения первой, вторая автоматически запустится
6. **Проверить логи - не должно быть ошибок 404**

**Ожидаемые логи:**

```
[Queue Service] 🚀 Starting next distribution: temp_1784625464413_i0vig8yoj
[Queue Service] 📤 Sending to Python service: {...}
[Queue Service] ✅ Distribution 96a72999-5eb5-4667-9f52-740037467178 started from queue
[Spambot Polling] 📡 Fetching status for distribution 96a72999-5eb5-4667-9f52-740037467178
[Spambot Polling] 📊 Status received: running, sent: 1, skipped: 0
```

✅ ID теперь **одинаковый** везде: `96a72999...` (а не `temp_...`)!

---

## Дополнительные исправления

Также в этом же коммите были исправлены:

### 1. Сортировка истории рассылок для админа

**Файл:** `backend/src/services/spambotService.js` (строка 544)

```javascript
// ❌ БЫЛО: Сортировка по статусу и дате
.sort({ status: 1, createdAt: -1 })

// ✅ СТАЛО: Только по дате (самые новые сверху)
.sort({ createdAt: -1 })
```

Теперь история рассылок для админа отображается **в хронологическом порядке** (самые новые сверху), как и для обычных пользователей.

---

## Связанные файлы

- `backend/src/services/SpambotQueueService.js` - основное исправление
- `backend/src/services/spambotService.js` - сортировка истории
- `backend/src/services/spambotPollingService.js` - polling статусов
- `backend-spambot/api/service.py` - Python service (генерирует UUID)

---

## Связанные документы

- `docs/SPAMBOT_QUEUE_IMPLEMENTATION.md` - Документация по системе очередей
- `docs/SPAMBOT_QUEUE_PASSWORD_FIX.md` - Предыдущее исправление (populate пароля)
- `docs/SPAMBOT_QUEUE_422_FIX_COMPLETE.md` - Исправление ошибки 422

---

## Заметки

- **Почему временный ID?** При создании рассылки мы ещё не знаем настоящий UUID, т.к. его присваивает Python service при запуске. Временный ID нужен для идентификации до запуска.
- **Зачем обновлять ID?** Polling service использует `distributionId` для запросов статуса к Python service. Без обновления он пытался бы использовать `temp_...` ID, которого Python не знает.
- **Consistency:** Теперь логика идентична в `SpambotService.startDistribution()` и `SpambotQueueService.startNextInQueue()`.


