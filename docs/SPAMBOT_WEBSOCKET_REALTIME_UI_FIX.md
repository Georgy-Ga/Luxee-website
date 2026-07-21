# Исправление: WebSocket обновления UI в реальном времени

**Дата:** 21 июля 2026  
**Статус:** ✅ Исправлено

---

## Проблема

UI не обновлялся в реальном времени при изменениях статуса рассылок:

1. **Рассылка добавлялась в очередь (`queued`)** - не отображалась в истории до обновления страницы
2. **Рассылка запускалась из очереди (`queued → running`)** - статус не обновлялся
3. **Рассылка удалялась из очереди** - оставалась в истории до обновления страницы
4. **Рассылка завершалась (`running → completed`)** - работало корректно ✅

### Ожидаемое поведение

Все изменения статуса должны **мгновенно** отображаться в UI через WebSocket без перезагрузки страницы:

- ✅ `queued` - добавиться в историю
- ✅ `queued → running` - обновить статус
- ✅ `running → completed` - обновить статус
- ✅ Удаление - исчезнуть из истории

---

## Причина

В `frontend/src/pages/Spambot.jsx` **отсутствовали обработчики** для двух WebSocket событий:

1. `spambot:distribution:queued` - Backend отправляет, Frontend не слушает ❌
2. `spambot:distribution:removed` - Backend отправляет, Frontend не слушает ❌

**Backend отправляет события:**

```javascript
// backend/src/services/SpambotQueueService.js (строка 122)
socketService.emitToUserAndAdmins(
    distribution.user._id?.toString() || distribution.user.toString(),
    'spambot:distribution:queued',  // ⬅️ Отправляется
    eventData,
);

// backend/src/services/SpambotQueueService.js (строка 326)
socketService.emitToUserAndAdmins(
    distribution.user._id.toString(),
    'spambot:distribution:removed',  // ⬅️ Отправляется
    {...}
);
```

**Frontend НЕ слушает эти события:**

```javascript
// frontend/src/pages/Spambot.jsx (строки 403-414) - ДО ИСПРАВЛЕНИЯ
socket.on('spambot:distribution:status', handleDistributionStatus);
socket.on('spambot:distribution:started', handleDistributionStarted);
socket.on('spambot:distribution:completed', handleDistributionCompleted);
socket.on('spambot:distribution:stopped', handleDistributionStopped);
socket.on('spambot:distribution:error', handleDistributionError);
// ❌ НЕТ обработчиков для 'queued' и 'removed'!
```

---

## Решение

Добавлены два недостающих обработчика WebSocket событий.

**Файл:** `frontend/src/pages/Spambot.jsx`  
**Строки:** 419-454 (новые обработчики)

### 1. Обработчик `spambot:distribution:queued`

```javascript
// ✅ NEW: Обработчик добавления в очередь
const handleDistributionQueued = (data) => {
    console.log('[Spambot] Distribution queued:', data);
    
    // Добавить в начало истории
    setDistributionHistory(prev => {
        // Проверить если уже есть
        const exists = prev.find(d => d.distributionId === data.distributionId || d.id === data.id);
        if (exists) {
            // Обновить существующую
            return prev.map(d => 
                (d.distributionId === data.distributionId || d.id === data.id)
                    ? { ...d, ...data }
                    : d
            );
        }
        // Добавить новую
        return [data, ...prev];
    });
};
```

**Логика:**
- Если рассылка уже есть в истории (по `distributionId` или `id`) - **обновить** её
- Если рассылки нет - **добавить** в начало истории
- Проверка по обоим ID нужна т.к. временные ID (`temp_...`) могут не совпадать

### 2. Обработчик `spambot:distribution:removed`

```javascript
// ✅ NEW: Обработчик удаления из очереди
const handleDistributionRemoved = (data) => {
    console.log('[Spambot] Distribution removed:', data);
    
    // Удалить из истории
    setDistributionHistory(prev =>
        prev.filter(dist => 
            dist.distributionId !== data.distributionId && dist.id !== data.id
        )
    );
};
```

**Логика:**
- Удалить рассылку из истории по `distributionId` или `id`
- Фильтруем оба поля для надёжности

### 3. Регистрация обработчиков

```javascript
// Добавлены в строки 464-465
socket.on('spambot:distribution:queued', handleDistributionQueued);
socket.on('spambot:distribution:removed', handleDistributionRemoved);

// И в cleanup (строки 472-473)
socket.off('spambot:distribution:queued', handleDistributionQueued);
socket.off('spambot:distribution:removed', handleDistributionRemoved);
```

---

## Результат

✅ **Теперь UI обновляется в реальном времени:**

### Сценарий 1: Добавление рассылки в очередь

1. Пользователь добавляет 2 рассылки на одном аккаунте
2. Первая запускается (`status: running`)
3. Вторая ставится в очередь (`status: queued`)
4. **Frontend сразу видит вторую рассылку** в истории со статусом "В очереди"
5. Не нужно обновлять страницу ✅

### Сценарий 2: Запуск из очереди

1. Первая рассылка завершается
2. Backend автоматически запускает вторую из очереди
3. WebSocket отправляет `spambot:distribution:started` с **новым distributionId**
4. Frontend обновляет статус: `queued → running`
5. UI показывает прогресс в реальном времени ✅

### Сценарий 3: Удаление из очереди

1. Админ видит рассылку со статусом `queued`
2. Нажимает кнопку "Удалить из очереди"
3. Backend удаляет из MongoDB
4. WebSocket отправляет `spambot:distribution:removed`
5. Frontend **мгновенно убирает** рассылку из истории ✅

---

## Тестирование

**Для проверки исправления:**

1. Открыть DevTools Console (F12)
2. Добавить 2 рассылки на одном аккаунте
3. **Проверить логи:**
   ```
   [Spambot] Distribution started: {...}  // Первая
   [Spambot] Distribution queued: {...}   // Вторая ✅ NEW
   ```
4. Подождать завершения первой
5. **Проверить логи:**
   ```
   [Spambot] Distribution completed: {...}  // Первая завершена
   [Queue Service] 🚀 Starting next distribution...  // Backend
   [Spambot] Distribution started: {...}  // Вторая запустилась ✅
   ```
6. Удалить рассылку из очереди (если есть)
7. **Проверить логи:**
   ```
   [Spambot] Distribution removed: {...}  // ✅ NEW
   ```

**Без обновления страницы все изменения должны быть видны!**

---

## Связанные исправления

Этот фикс работает вместе с:

### 1. Исправление distributionId (SPAMBOT_QUEUE_DISTRIBUTION_ID_FIX.md)

Без этого рассылки из очереди получали 404 ошибки при polling:
- Backend обновляет `temp_...` на реальный UUID
- Frontend корректно отслеживает статус

### 2. Сортировка истории (в том же коммите)

Самые новые рассылки всегда сверху:
```javascript
.sort({ createdAt: -1 })  // Только по дате
```

---

## Архитектура WebSocket событий

### Backend → Frontend

| Событие | Когда отправляется | Обработчик Frontend |
|---------|-------------------|-------------------|
| `spambot:distribution:started` | Рассылка запущена | `handleDistributionStarted` ✅ |
| `spambot:distribution:status` | Обновление прогресса | `handleDistributionStatus` ✅ |
| `spambot:distribution:completed` | Рассылка завершена | `handleDistributionCompleted` ✅ |
| `spambot:distribution:stopped` | Рассылка остановлена | `handleDistributionStopped` ✅ |
| `spambot:distribution:error` | Ошибка | `handleDistributionError` ✅ |
| **`spambot:distribution:queued`** | **Добавлена в очередь** | **`handleDistributionQueued` ✅ NEW** |
| **`spambot:distribution:removed`** | **Удалена из очереди** | **`handleDistributionRemoved` ✅ NEW** |

---

## Связанные файлы

- `frontend/src/pages/Spambot.jsx` - добавлены обработчики
- `backend/src/services/SpambotQueueService.js` - отправка событий queued/removed
- `backend/src/services/socketService.js` - эмиттер событий

---

## Связанные документы

- `docs/SPAMBOT_QUEUE_DISTRIBUTION_ID_FIX.md` - Исправление 404 ошибок
- `docs/SPAMBOT_QUEUE_IMPLEMENTATION.md` - Архитектура системы очередей
- `docs/SPAMBOT_REALTIME_WEBSOCKET_FIXES.md` - Предыдущие WebSocket исправления

---

## Заметки

- **Почему проверяем оба ID?** Временный `temp_...` ID может не совпадать с реальным UUID до запуска рассылки. Проверка обоих гарантирует корректное обновление.
- **Зачем добавлять в начало?** Самые новые рассылки должны быть сверху для удобства мониторинга.
- **Cleanup важен!** `socket.off()` в return предотвращает утечки памяти при размонтировании компонента.


