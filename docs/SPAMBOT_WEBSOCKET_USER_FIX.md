# Spambot WebSocket User ID Fix

**Дата:** 18.07.2026  
**Статус:** ✅ Исправлено

## 🔴 Проблема

### Описание
Когда администратор запускал рассылку от имени обычного пользователя (через Admin Account Selector), WebSocket события о старте/прогрессе/завершении рассылки **не приходили пользователю-владельцу аккаунта**, а приходили только администратору.

### Симптомы
1. ✅ Админ видел все обновления рассылки в реальном времени
2. ❌ Пользователь-владелец аккаунта **НЕ** видел обновления
3. ❌ В таблице рассылок у пользователя статус оставался "pending" вместо "running"

### Root Cause

**Неправильное использование `userId` в WebSocket уведомлениях при старте рассылки.**

#### Что происходило:

```javascript
// backend/src/controllers/spambotController.js (СТАРЫЙ КОД)
async createDistribution(req, res) {
    const userId = req.user.id;  // ❌ ID того, кто нажал кнопку (админ)
    
    const distribution = await spambotService.startDistribution({
        accountId,
        userId,  // Передавался ID админа
        userRole,
        config
    });
    
    // ❌ Отправка события с userId = adminId
    socketService.emitDistributionStarted(userId, { ... });
}
```

**Проблема:** 
- `req.user.id` - это ID **того, кто нажал кнопку** (админ)
- `distribution.user` - это ID **владельца аккаунта** (обычный user)
- WebSocket события отправлялись админу, а не владельцу!

#### Механизм `emitToUserAndAdmins`:

```javascript
// backend/src/services/socketService.js
emitToUserAndAdmins(userId, event, data) {
    // Отправляет события:
    // 1. Всем сокетам указанного userId
    // 2. Всем админским сокетам
    
    // ❌ Если userId = adminId, то обычный user НЕ получит событие!
}
```

### Почему это работало в polling service?

Polling service **уже правильно использовал** `distribution.user._id`:

```javascript
// backend/src/services/spambotPollingService.js (УЖЕ ПРАВИЛЬНО)
socketService.emitDistributionCompleted(distribution.user._id, { ... });
socketService.emitDistributionError(distribution.user._id, { ... });
```

Поэтому:
- ✅ Обновления прогресса (polling каждые 10 сек) - приходили user-у
- ❌ Событие старта (createDistribution) - НЕ приходило user-у

---

## ✅ Решение

### 1. SpambotService - добавить `user` в return

**Файл:** `backend/src/services/SpambotService.js`

**Проблема:** Service не возвращал ID владельца аккаунта

**Было:**
```javascript
return {
    id: distribution._id,
    distributionId: distribution_id,
    status: 'running',
    accountEmail: account.luxeeEmail
    // ❌ НЕТ поля user
};
```

**Стало:**
```javascript
return {
    id: distribution._id,
    distributionId: distribution_id,
    status: 'running',
    accountEmail: account.luxeeEmail,
    user: account.user, // ✅ ID владельца аккаунта для WebSocket уведомлений
    config: distribution.config,
    createdAt: distribution.createdAt,
    startedAt: distribution.startedAt
};
```

### 2. SpambotController - использовать `distribution.user`

**Файл:** `backend/src/controllers/spambotController.js`

**Было:**
```javascript
const userId = req.user.id;  // ❌ ID админа

socketService.emitDistributionStarted(userId, {
    distributionId: distribution.distributionId,
    // ...
});
```

**Стало:**
```javascript
// ✅ Используем distribution.user (владелец аккаунта), а не req.user.id (кто запустил)
// Это обеспечивает что user получит уведомление, даже если админ запустил рассылку
socketService.emitDistributionStarted(distribution.user, {
    distributionId: distribution.distributionId,
    // ...
});
```

---

## 📊 Проверенные компоненты

### ✅ Правильно работают (не требуют изменений):

1. **`spambotService.stopDistribution`**
   - Уже использует `distribution.user` для WebSocket
   ```javascript
   socketService.emitDistributionStopped(distribution.user, { ... });
   ```

2. **`spambotPollingService`**
   - Все события используют `distribution.user._id`
   ```javascript
   socketService.emitDistributionCompleted(distribution.user._id, { ... });
   socketService.emitDistributionError(distribution.user._id, { ... });
   socketService.emitToUserAndAdmins(distribution.user._id, 'spambot:distribution:status', ...);
   ```

3. **SpambotDistributionModel**
   - Правильно сохраняет владельца:
   ```javascript
   user: account.user, // ID владельца аккаунта (не админа!)
   ```

---

## 🎯 Результат

После исправления:

### Сценарий: Админ запускает рассылку для user-а

1. ✅ **User** видит:
   - Событие старта (`spambot:distribution:started`)
   - Обновления прогресса каждые 10 секунд
   - Событие завершения/ошибки
   - Статус в таблице меняется: pending → running → completed

2. ✅ **Админ** видит:
   - Те же события (благодаря `emitToUserAndAdmins`)
   - Может мониторить рассылки всех пользователей

### Сценарий: User запускает свою рассылку

1. ✅ **User** видит:
   - Все события в реальном времени
   - `req.user.id` === `distribution.user` (один и тот же ID)

2. ✅ **Админ** видит:
   - Те же события (мониторинг)

---

## 🔍 Техническая деталь: emitToUserAndAdmins

```javascript
emitToUserAndAdmins(userId, event, data) {
    const sentToSockets = new Set();
    
    // 1. Отправить сокетам указанного userId
    this.sockets.forEach((socket) => {
        if (socket.userId === userId.toString() && !sentToSockets.has(socket.id)) {
            socket.emit(event, data);
            sentToSockets.add(socket.id);
        }
    });
    
    // 2. Отправить всем админам
    this.sockets.forEach((socket) => {
        if (socket.userRole === 'admin' && !sentToSockets.has(socket.id)) {
            socket.emit(event, data);
            sentToSockets.add(socket.id);
        }
    });
}
```

**Важно:** Метод отправляет события:
- Пользователю с конкретным `userId`
- Всем администраторам

Поэтому **критически важно** передавать правильный `userId` (владельца рассылки, а не инициатора действия).

---

## 📝 Выводы

### Причина проблемы:
- Путаница между **кто запустил** (`req.user.id`) и **кому принадлежит** (`distribution.user`)

### Решение:
- Всегда использовать `distribution.user` для WebSocket событий
- Service должен возвращать `user` вместе с другими данными

### Best Practice:
Для всех операций с рассылками использовать:
```javascript
socketService.emitDistributionXXX(distribution.user, { ... });
```

А **НЕ**:
```javascript
socketService.emitDistributionXXX(req.user.id, { ... });  // ❌ Неправильно!
```

---

## 🔗 Связанные файлы

- `backend/src/services/SpambotService.js` - Возврат `user` из `startDistribution`
- `backend/src/controllers/spambotController.js` - Использование `distribution.user`
- `backend/src/services/socketService.js` - Механизм `emitToUserAndAdmins`
- `backend/src/services/spambotPollingService.js` - Уже правильно использовал `distribution.user._id`

---

## ✅ Статус

**ИСПРАВЛЕНО** - WebSocket события теперь корректно отправляются владельцам рассылок, независимо от того, кто запустил рассылку (user или admin).
