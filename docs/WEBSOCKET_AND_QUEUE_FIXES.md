# WebSocket и Queue Исправления

**Дата:** 23.07.2026  
**Статус:** ✅ Исправлено

## 🔍 Обнаруженные проблемы

### 1. Двойная отправка WebSocket событий `spambot:distribution:started`

**Проблема:**
- При добавлении рассылки в очередь (`queued` статус) контроллер отправлял событие `started`
- Затем `SpambotQueueService` при фактическом запуске отправлял его снова
- Результат: Две записи в истории рассылок на фронтенде

**Причина:**
```javascript
// backend/src/controllers/spambotController.js - НЕПРАВИЛЬНО
const distribution = await spambotService.startDistribution(...);

// Отправляем событие ВСЕГДА, даже если status = 'queued'
socketService.emitDistributionStarted(ownerUserId, distribution);
```

**Решение:**
```javascript
// Отправляем WebSocket событие ТОЛЬКО если статус 'running'
// SpambotQueueService уже отправил 'spambot:distribution:queued'
if (distribution.status === 'running') {
    socketService.emitDistributionStarted(ownerUserId, distribution);
} else if (distribution.status === 'queued') {
    console.log('[Spambot Controller] ⏳ Distribution queued - WebSocket event already sent by QueueService');
}
```

---

### 2. Потеря связи между временным и реальным `distributionId`

**Проблема:**
- При добавлении в очередь создается временный UUID
- При фактическом запуске Python Service генерирует реальный UUID
- Frontend не может связать эти две записи → дублирование в истории

**Сценарий:**
```
1. Создание рассылки → distributionId = "temp-uuid-123" (queued)
2. Запуск из очереди → distributionId = "real-uuid-456" (running)
3. Frontend видит ДВЕ разные рассылки вместо обновления одной
```

**Решение:**

#### Backend (SpambotQueueService.js)
```javascript
async startNextInQueue(accountId) {
    const next = await this.getNextInQueue(accountId);
    const oldDistributionId = next.distributionId; // Сохраняем временный ID
    const mongoId = next._id.toString(); // MongoDB _id для надежной связи

    // Запуск в Python Service
    const { distribution_id } = await axios.post(...);
    
    // Обновляем distributionId на реальный
    next.distributionId = distribution_id;
    next.status = 'running';
    await next.save();

    // ✅ Отправляем оба ID чтобы frontend мог связать записи
    socketService.emitDistributionStarted(userId, {
        distributionId: next.distributionId, // Новый реальный
        oldDistributionId: oldDistributionId, // Старый временный
        id: next._id, // MongoDB _id для надежности
        ...
    });
}
```

#### Frontend (Spambot.jsx)
```javascript
const handleDistributionStarted = data => {
    setDistributionHistory(prev => {
        // ✅ Ищем по трем критериям:
        const existingIndex = prev.findIndex(d => 
            d.distributionId === data.distributionId || // Обычное совпадение
            d.distributionId === data.oldDistributionId || // Старый временный ID
            (d.id && data.id && d.id === data.id) // По MongoDB _id
        );
        
        if (existingIndex !== -1) {
            // ОБНОВЛЯЕМ существующую запись
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...data };
            return updated;
        }
        
        // Добавляем новую только если не нашли
        return [data, ...prev];
    });
};
```

---

### 3. Ошибка `prev is not defined` в SocketContext.jsx

**Проблема:**
```javascript
newSocket.on('connect_error', (error) => {
    setReconnectAttempt((prev) => prev + 1);
    console.error(`[Socket] Connection error (attempt ${prev + 1}):`, error.message);
    //                                                    ↑↑↑↑
    //                                    'prev' используется ВНЕ функции обновления!
    setConnectionError(error.message);
});
```

**Причина:**
- `prev` доступен только внутри функции `setReconnectAttempt((prev) => ...)`
- Попытка использовать его снаружи вызывает ReferenceError

**Решение:**
```javascript
newSocket.on('connect_error', (error) => {
    setReconnectAttempt((prev) => {
        // ✅ console.log ВНУТРИ функции обновления
        console.error(`[Socket] Connection error (attempt ${prev + 1}):`, error.message);
        return prev + 1;
    });
    setConnectionError(error.message);
    setIsConnected(false);
});
```

---

### 5. WebSocket не подключается после авторизации

**Проблема:**
- useEffect с пустым массивом зависимостей `[]` выполняется только при монтировании
- При авторизации токен появляется, но WebSocket не инициализируется
- Логи показывают: `socketExists: false` даже после успешного логина

**Причина:**
```javascript
useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return; // Выходим при первой проверке
    
    // Код подключения...
}, []); // ❌ Никогда не перезапустится когда токен появится!
```

**Решение:**
```javascript
// Добавляем useRef для отслеживания socket instance
const socketRef = useRef(null);

// Основной useEffect остается с []
useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    
    if (socketRef.current?.connected) return;
    
    // ... создание socket ...
    socketRef.current = newSocket;
    setSocket(newSocket);
    
    return () => {
        newSocket.close();
        socketRef.current = null;
    };
}, []);

// ✅ Отдельный useEffect для мониторинга токена
useEffect(() => {
    const checkToken = () => {
        const token = Cookies.get('accessToken');
        
        // Токен появился и нет подключения - перезагружаем страницу
        if (token && !socketRef.current) {
            console.log('[Socket] Token detected, reloading...');
            setTimeout(() => window.location.reload(), 500);
        }
        
        // Токен пропал - отключаемся
        if (!token && socketRef.current) {
            console.log('[Socket] Token removed, disconnecting...');
            socketRef.current.close();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
        }
    };
    
    const interval = setInterval(checkToken, 1000);
    return () => clearInterval(interval);
}, []);
```

**Почему перезагрузка страницы:**
- Socket.io требует токен при инициализации (`auth: { token }`)
- Изменить токен у уже созданного socket нельзя
- Перезагрузка - самый надежный способ переинициализировать все соединение
- Альтернатива: создавать новый socket динамически, но это сложнее и может вызвать race conditions

---

### 4. React Strict Mode двойное подключение/отключение

**Проблема:**
- В development режиме React Strict Mode монтирует компоненты дважды
- useEffect вызывается → подключение → cleanup → подключение снова
- Логи показывают: "Connecting → Connected → Cleaning up → WebSocket is closed"

**Текущее состояние:**
```javascript
useEffect(() => {
    // Создаем socket
    const newSocket = io(serverUrl, { ... });
    setSocket(newSocket);
    
    return () => {
        // Cleanup - закрываем соединение
        newSocket.close();
        setSocket(null);
    };
}, []); // Пустой массив зависимостей - правильно!
```

**Вердикт:** ✅ Это нормальное поведение в development
- Production режим не использует Strict Mode
- Двойное монтирование помогает выявить проблемы с side effects
- Текущая реализация корректна для Strict Mode

---

## 📊 Сценарии работы

### Сценарий 1: Прямой запуск (аккаунт свободен)

```
1. User → POST /api/spambot/distributions
2. spambotController.createDistribution()
3. spambotService.startDistribution()
4. Python Service запускает → distributionId = "real-uuid"
5. MongoDB: status = 'running', distributionId = "real-uuid"
6. ✅ Controller отправляет WebSocket: spambot:distribution:started
7. Frontend: Добавляет запись в history
```

### Сценарий 2: Добавление в очередь (аккаунт занят)

```
1. User → POST /api/spambot/distributions
2. spambotController.createDistribution()
3. spambotService.startDistribution()
4. Проверка: аккаунт занят → добавление в очередь
5. MongoDB: status = 'queued', distributionId = "temp-uuid"
6. ✅ QueueService отправляет: spambot:distribution:queued
7. ❌ Controller НЕ отправляет started (status !== 'running')
8. Frontend: Добавляет запись со статусом "В очереди"
```

### Сценарий 3: Запуск из очереди

```
1. Текущая рассылка завершается
2. spambotPollingService обрабатывает completed/stopped
3. SpambotQueueService.startNextInQueue(accountId)
4. Берется первая рассылка из очереди
5. Сохраняется oldDistributionId = "temp-uuid"
6. Python Service запускает → distributionId = "real-uuid"
7. MongoDB: обновляется distributionId = "real-uuid", status = 'running'
8. ✅ QueueService отправляет: spambot:distribution:started
   - distributionId: "real-uuid"
   - oldDistributionId: "temp-uuid" ← Для связи!
   - id: MongoDB ObjectId
9. Frontend: Находит запись по oldDistributionId и ОБНОВЛЯЕТ её
```

---

## ✅ Результаты исправлений

### До исправлений:
- ❌ Дублирование рассылок в истории
- ❌ Потеря связи между queued → running
- ❌ Ошибка "prev is not defined" в консоли
- ❌ Непонятное поведение при запуске из очереди

### После исправлений:
- ✅ Одна запись на рассылку
- ✅ Плавное обновление статуса queued → running
- ✅ Нет ошибок в консоли
- ✅ Корректная работа очереди
- ✅ Realtime обновление счетчиков (отправлено, пропущено)

---

## 🧪 Тестирование

### Тест 1: Прямой запуск
```
1. Открыть Spambot страницу
2. Выбрать свободный аккаунт
3. Создать рассылку
4. Проверить: 
   - Одна запись в истории
   - Статус "Запущена"
   - Обновляются счетчики
```

### Тест 2: Очередь
```
1. Запустить рассылку на аккаунте A
2. Добавить ещё 2 рассылки на тот же аккаунт
3. Проверить:
   - 3 записи в истории
   - Первая "Запущена", остальные "В очереди #1, #2"
4. Дождаться завершения первой
5. Проверить:
   - Вторая рассылка автоматически запустилась
   - Статус обновился на "Запущена"
   - НЕТ дублирования записей
```

### Тест 3: Остановка и удаление
```
1. Запустить рассылку
2. Остановить её
3. Проверить: статус "Остановлена"
4. Добавить рассылку в очередь
5. Удалить её до запуска
6. Проверить: запись удалена из истории
```

### Тест 4: Перезагрузка страницы
```
1. Запустить рассылку
2. Перезагрузить страницу (F5)
3. Проверить:
   - WebSocket переподключился
   - История загрузилась
   - Обновления продолжают приходить
   - НЕТ ошибки "prev is not defined"
```

### Тест 5: Авторизация
```
1. Войти в систему
2. Проверить консоль:
   - "[Socket] Connecting to: ..."
   - "[Socket] ✓ Connected: ..."
   - GET /api/refresh 401 - нормально (проверка сессии)
   - "Not authenticated" - если нет refresh token
3. После успешной авторизации:
   - WebSocket подключен
   - Аккаунты загружены
```

---

## 📝 Изменённые файлы

### Backend
1. **backend/src/controllers/spambotController.js**
   - Убрана отправка `started` для `queued` статуса

2. **backend/src/services/SpambotQueueService.js**
   - Добавлено сохранение `oldDistributionId`
   - Обновление `distributionId` перед запуском
   - Отправка `oldDistributionId` в WebSocket событии

### Frontend
3. **frontend/src/pages/Spambot.jsx**
   - Улучшен `handleDistributionStarted`
   - Поиск по трем критериям (distributionId, oldDistributionId, MongoDB _id)
   - Обновление вместо дублирования

4. **frontend/src/contexts/SocketContext.jsx**
   - Исправлена ошибка `prev is not defined`
   - console.log перемещен внутрь функции обновления

---

## 🎯 Выводы

### Ключевые принципы:
1. **Одно событие = одна отправка** - избегать дублирования WebSocket событий
2. **Связь через ID** - передавать oldDistributionId для связи записей
3. **Множественный поиск** - искать по всем доступным идентификаторам
4. **Scope awareness** - использовать переменные только в их области видимости

### Архитектурные решения:
1. `queued` статус обрабатывается отдельным событием `spambot:distribution:queued`
2. `running` статус при запуске из очереди передает `oldDistributionId`
3. Frontend использует иммутабельные обновления состояния
4. MongoDB `_id` служит надежным идентификатором для связи

---

## 🔄 Дальнейшие улучшения

### Опциональные оптимизации:
1. **Persistent Queue** - сохранять очередь в Redis для восстановления после перезапуска
2. **Priority Queue** - поддержка приоритетов для рассылок
3. **Queue Analytics** - статистика по времени ожидания в очереди
4. **Batch Operations** - массовая остановка/удаление рассылок

### Мониторинг:
1. Метрики времени в очереди
2. Количество дублирований (должно быть 0)
3. Успешность переходов queued → running
4. WebSocket reconnect rate
