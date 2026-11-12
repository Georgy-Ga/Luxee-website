# Spambot Polling Fix - Критическое исправление синхронизации статусов

## 🔴 Проблема

### Главная проблема
Python Spambot Service **успешно завершал рассылки**, но Node.js backend **НЕ получал обновления статусов**. Результат:
- ✅ Python: Рассылка завершена, 1 сообщение отправлено
- ❌ Frontend: Показывает статус "Выполняется", 0 сообщений отправлено
- ❌ MongoDB: Статус остаётся "running" навсегда

### Анализ логов Python Service
```
23:03:19 - Distribution f87bbc45-56c7-4a59-a353-c103a4565df2 completed. Sent: 1, Skipped: 0
23:03:20 - Logged out successfully
```
✅ Рассылка **ЗАВЕРШЕНА УСПЕШНО** в 23:03:19

### Анализ Node.js Backend
```javascript
[Spambot Service] Distribution started: f87bbc45-56c7-4a59-a353-c103a4565df2
[Socket Service] spambot:distribution:started sent
// ... тишина ...
// ❌ НЕТ логов о completion!
```

### Почему так произошло?

#### 1. Python Service обновляет свой внутренний статус
```python
# backend-spambot/api/service.py:157-161
self.statuses[distribution_id] = DistributionStatus(
    status="completed",
    sent_messages_count=distribution.sent_messages_count,
    skipped_clients=distribution.skipped_clients
)
```
✅ Python знает что рассылка завершена

#### 2. Node.js НЕ опрашивает Python
Метод `getDistributionStatus()` в `SpambotService.js` **СУЩЕСТВУЕТ** (строки 243-308), но **НИКТО ЕГО НЕ ВЫЗЫВАЕТ!**

```javascript
// backend/src/services/SpambotService.js:270-280
// ✅ Метод есть, но его никто не вызывает!
async getDistributionStatus(distributionId, userId) {
    // ...
    const response = await axios.get(
        `${PYTHON_SERVICE_URL}/api/distribution/${distribution.distributionId}/status`
    );
    // ...
}
```

#### 3. Отсутствует Polling механизм
```bash
$ grep -r "setInterval.*spambot" backend/src/
# ❌ Результат: 0 найденных файлов
```

**НЕТ фонового процесса** который бы периодически проверял статусы активных рассылок!

---

## ✅ Решение

### 1. Создан Spambot Polling Service

**Файл:** `backend/src/services/spambotPollingService.js`

```javascript
class SpambotPollingService {
    constructor() {
        this.pollIntervalMs = 10000; // 10 секунд
    }

    start() {
        // Периодически проверять все активные рассылки
        this.pollingInterval = setInterval(() => {
            this.checkActiveDistributions();
        }, this.pollIntervalMs);
    }

    async checkActiveDistributions() {
        // Найти все рассылки со статусом 'running'
        const activeDistributions = await SpambotDistributionModel.find({
            status: 'running'
        });

        // Для каждой рассылки запросить статус у Python Service
        for (const distribution of activeDistributions) {
            const status = await SpambotService.getDistributionStatus(
                distribution._id,
                distribution.user._id
            );

            // Если статус изменился - отправить WebSocket событие
            if (statusChanged) {
                socketService.emitToUser(userId, 'spambot:distribution:completed', {
                    distributionId: distribution.distributionId,
                    status: status.status,
                    sentMessagesCount: status.sentMessagesCount,
                    // ...
                });
            }
        }
    }
}
```

**Что делает:**
1. Каждые 10 секунд находит все рассылки со статусом `running`
2. Для каждой запрашивает актуальный статус у Python Service через `/api/distribution/{id}/status`
3. Если статус изменился → обновляет MongoDB и отправляет WebSocket событие клиенту

### 2. Запуск в index.js

```javascript
// backend/index.js:169-177
setTimeout(() => {
    console.log('\n[Server] Starting Spambot Polling Service...');
    spambotPollingService.start();
    console.log('[Server] ✓ Spambot Polling Service started\n');
}, 9000); // Запуск через 9 секунд после старта сервера
```

### 3. Frontend уже готов!

WebSocket обработчики **УЖЕ СУЩЕСТВУЮТ** в `frontend/src/pages/Spambot.jsx`:

```javascript
// Строки 173-211
socket.on('spambot:distribution:status', handleDistributionStatus);
socket.on('spambot:distribution:completed', handleDistributionCompleted);
socket.on('spambot:distribution:error', handleDistributionError);
```

**Никаких изменений на frontend не требуется!**

---

## 📊 Как это работает

### Полный flow рассылки:

```
1. USER: Нажимает "Запустить рассылку"
   ↓
2. FRONTEND: POST /api/spambot/distribution/create
   ↓
3. NODE.JS: Создаёт запись в MongoDB (status: 'running')
   ↓
4. NODE.JS: POST http://localhost:8001/api/distribution/start → PYTHON
   ↓
5. PYTHON: Запускает рассылку в фоновом потоке
   ↓
6. PYTHON: Обновляет свой внутренний self.statuses
   ↓
7. 🆕 POLLING SERVICE: Каждые 10 сек проверяет активные рассылки
   ↓
8. POLLING: GET http://localhost:8001/api/distribution/{id}/status
   ↓
9. PYTHON: Возвращает актуальный статус
   ↓
10. POLLING: Обновляет MongoDB
    ↓
11. POLLING: socket.emit('spambot:distribution:completed', data)
    ↓
12. FRONTEND: Получает событие → обновляет UI ✅
```

---

## 🔧 Дополнительные исправления

### 1. Mongoose Pre-Save Hook
**Проблема:** `next is not a function`
```javascript
// ❌ Было:
distributionSchema.pre('save', function(next) {
    // ...
    next(); // ← TypeError!
});

// ✅ Стало:
distributionSchema.pre('save', function() {
    // ... просто без next()
});
```

### 2. DistributionHistory.jsx
**Проблема:** `Cannot read properties of undefined (reading 'profileName')`
```jsx
// ❌ Было:
{dist.config.profileName}  // config undefined!

// ✅ Стало:
{dist.profileName || 'N/A'}  // прямой доступ
```

### 3. LocalStorage для очереди
Очередь теперь сохраняется при перезагрузке страницы:
```javascript
// frontend/src/pages/Spambot.jsx:30-47
useEffect(() => {
    localStorage.setItem('spambot_queue', JSON.stringify(queuedDistributions));
}, [queuedDistributions]);
```

### 4. Email аккаунта
```javascript
// DistributionQueue.jsx
// ❌ Было: account.username || account.email
// ✅ Стало: account.luxeeEmail || account.username || account.email
```

---

## 🎯 Результат

### До исправления:
```
❌ Рассылка завершена в Python, но UI показывает "Выполняется"
❌ Статус в MongoDB навсегда остаётся "running"
❌ Счётчики не обновляются (sent: 0, skipped: 0)
```

### После исправления:
```
✅ Polling Service проверяет статус каждые 10 секунд
✅ MongoDB автоматически обновляется
✅ Frontend получает WebSocket события
✅ UI показывает актуальный статус и счётчики
```

---

## 📝 Тестирование

### Как проверить что работает:

1. **Запустить Node.js backend:**
   ```bash
   cd backend
   npm start
   ```
   
   Должны увидеть:
   ```
   [Server] ✓ Spambot Polling Service started
   ```

2. **Запустить Python service:**
   ```bash
   cd backend-spambot
   python main.py
   ```

3. **Создать рассылку в UI**

4. **Наблюдать логи Node.js:**
   ```
   [Spambot Polling] Checking 1 active distributions
   [Spambot Polling] Status update for f87bbc45...: running -> completed, sent: 0 -> 1
   [Socket Service] Emit to user: spambot:distribution:completed
   ```

5. **Проверить UI:**
   - Статус должен измениться на "Завершена"
   - Счётчик "Отправлено" должен показать реальное число

---

## 🚀 Изменённые файлы

1. ✅ `backend/src/services/spambotPollingService.js` - **СОЗДАН**
2. ✅ `backend/index.js` - добавлен запуск polling service
3. ✅ `backend/src/models/SpambotDistributionModel.js` - исправлен Mongoose hook
4. ✅ `frontend/src/components/Spambot/DistributionHistory.jsx` - исправлен доступ к данным
5. ✅ `frontend/src/pages/Spambot.jsx` - добавлен localStorage
6. ✅ `frontend/src/components/Spambot/DistributionQueue.jsx` - исправлен email

---

## 💡 Альтернативные решения (НЕ реализованы)

### Вариант 1: Python отправляет Webhook
Python Service мог бы сам отправлять HTTP callback в Node.js при завершении:
```python
requests.post('http://nodejs:5000/api/spambot/webhook', {
    'distributionId': distribution_id,
    'status': 'completed'
})
```
**Минусы:** Требует изменений в Python, менее надёжно (что если Node.js недоступен?)

### Вариант 2: Shared Redis/RabbitMQ
Использовать очередь сообщений для событий.
**Минусы:** Дополнительная инфраструктура, избыточная сложность

### Вариант 3: Polling только на Frontend
Frontend сам опрашивает Node.js каждые 10 секунд.
**Минусы:** Лишний трафик, медленнее чем WebSocket

**Выбранное решение (Polling Service в Node.js) - оптимальное:**
- ✅ Не требует изменений в Python
- ✅ Централизованное управление
- ✅ WebSocket для мгновенных обновлений UI
- ✅ Работает даже если frontend закрыт (обновит MongoDB)

---

## 🎉 Заключение

Главная проблема была **НЕ** в Python Service (он работал правильно), **НЕ** во frontend (WebSocket обработчики были готовы), а в **отсутствии моста** между ними.

**Spambot Polling Service** — это тот самый мост, который синхронизирует состояние между Python и Node.js.

**Теперь всё работает! 🚀**
