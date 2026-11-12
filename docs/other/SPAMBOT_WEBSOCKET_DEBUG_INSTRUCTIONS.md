# Инструкция по отладке WebSocket проблемы

## 🔧 Что было сделано

Добавлено детальное логирование в:
1. `backend/src/controllers/spambotController.js` - показывает кто запустил vs кому принадлежит
2. `backend/src/services/socketService.js` - показывает подключенных пользователей и отправку событий

## 📋 Шаги для тестирования

### 1. Перезапустить backend

**ВАЖНО:** Изменения в коде не применятся без перезапуска!

```bash
# Остановить текущий процесс (Ctrl+C)
# Затем запустить заново:
cd backend
npm start
```

### 2. Открыть две вкладки браузера

- **Вкладка 1 (Админ):** Обычный браузер или инкогнито
  - Войти как админ
  - Открыть Spambot страницу
  
- **Вкладка 2 (User):** Другой браузер или инкогнито
  - Войти как обычный пользователь (владелец аккаунта)
  - Открыть Spambot страницу

**Примечание:** Инкогнито НЕ влияет на WebSocket, но каждая вкладка должна быть авторизована.

### 3. Запустить рассылку от имени user-а (через админа)

1. В админской вкладке выбрать аккаунт user-а через Admin Account Selector
2. Настроить рассылку
3. Нажать "Start Distribution"

### 4. Проверить логи backend

В консоли backend должны появиться такие логи:

```
[Spambot Controller] 📡 Sending WebSocket event:
[Spambot Controller] 📡 Initiator (req.user.id): 507f1f77bcf86cd799439011  <-- ID админа
[Spambot Controller] 📡 Owner (distribution.user): 507f191e810c19729de860ea  <-- ID user-а
[Spambot Controller] 📡 distributionId: abc-123-def-456

[Socket Service] 🚀 emitDistributionStarted called
[Socket Service] 🚀 Target userId: 507f191e810c19729de860ea  <-- Должен быть ID user-а!
[Socket Service] 🚀 User connected: true  <-- Должно быть true если user открыл страницу!
[Socket Service] 🚀 Total connected users: 2  <-- Админ + User
[Socket Service] 🚀 Distribution ID: abc-123-def-456
[Socket Service] 🚀 Connected users: [
  { userId: '507f1f77bcf86cd799439011', connections: 1 },  <-- Админ
  { userId: '507f191e810c19729de860ea', connections: 1 }   <-- User
]
[Socket Service] Emit to user 507f191e810c19729de860ea + admins (2 connections, 2 users): spambot:distribution:started
[Socket Service] ✅ Distribution started event sent to user 507f191e810c19729de860ea + admins
```

## 🔍 Что проверить в логах

### ✅ Правильное поведение:

1. **Initiator ≠ Owner:**
   ```
   Initiator (req.user.id): 507f1f77bcf86cd799439011  <-- Админ
   Owner (distribution.user): 507f191e810c19729de860ea  <-- User
   ```

2. **Target userId = Owner:**
   ```
   Target userId: 507f191e810c19729de860ea  <-- ID user-а (НЕ админа!)
   ```

3. **User connected = true:**
   ```
   User connected: true  <-- User открыл страницу и подключился
   ```

4. **Оба пользователя в списке:**
   ```
   Connected users: [
     { userId: 'adminId', connections: 1 },
     { userId: 'userId', connections: 1 }
   ]
   ```

### ❌ Проблемные ситуации:

#### Проблема 1: User connected = false

```
User connected: false
Connected users: [
  { userId: 'adminId', connections: 1 }
]
```

**Причина:** User не открыл страницу Spambot или не авторизован

**Решение:**
- Убедитесь что user залогинен во второй вкладке
- Откройте страницу `/spambot` в user вкладке
- Проверьте что WebSocket подключился (в браузерной консоли не должно быть ошибок)

#### Проблема 2: Target userId = Initiator ID

```
Initiator (req.user.id): 507f1f77bcf86cd799439011
Owner (distribution.user): 507f1f77bcf86cd799439011  <-- ❌ Один и тот же ID!
Target userId: 507f1f77bcf86cd799439011
```

**Причина:** SpambotService.startDistribution() возвращает неправильный `user`

**Решение:** Проверить что изменения в `backend/src/services/SpambotService.js` применены (строки 207-215)

#### Проблема 3: Событие отправлено но user не получает

```
✅ Distribution started event sent to user 507f191e810c19729de860ea + admins
```

Но user не видит обновление в UI.

**Возможные причины:**

1. **Frontend не слушает событие:**
   - Проверить `frontend/src/pages/Spambot.jsx` 
   - Должен быть `socket.on('spambot:distribution:started', ...)`

2. **Socket переподключается:**
   - Открыть DevTools → Network → WS
   - Проверить что WebSocket connection активен
   - Не должно быть постоянных reconnect

3. **Frontend фильтрует событие:**
   - Проверить что `distribution.userId` совпадает с `currentUser.id`

## 🐛 Дополнительная отладка Frontend

### В браузере (DevTools Console):

```javascript
// Проверить что socket подключен
console.log('Socket connected:', socket.connected);

// Слушать ВСЕ события
socket.onAny((event, ...args) => {
  console.log('📨 Socket event:', event, args);
});

// Проверить текущего пользователя
console.log('Current user:', currentUser);
```

## 📊 Ожидаемый результат

После правильного исправления:

1. **Админ запускает рассылку для user-а**
2. **Backend логи показывают:**
   - Initiator = adminId
   - Owner = userId  
   - Target = userId ✅
   - User connected = true ✅
3. **User видит в UI:**
   - Рассылка появляется в таблице
   - Статус меняется: pending → running
   - Счетчики обновляются в реальном времени
4. **Админ видит то же самое**

---

## 📝 Если проблема остается

Пришлите логи backend после запуска рассылки, они должны содержать:
- `[Spambot Controller] 📡 Sending WebSocket event:`
- `[Socket Service] 🚀 emitDistributionStarted called`
- `[Socket Service] 🚀 Connected users:`
