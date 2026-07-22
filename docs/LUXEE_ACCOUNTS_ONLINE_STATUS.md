# Luxee Accounts Online Status Feature

## 📋 Описание

Система трекинга онлайн статуса Luxee аккаунтов с автоматическим переходом в оффлайн после 15 минут бездействия.

## 🎯 Основная функциональность

### Логика работы

1. **Трекинг ручной активности** - фиксируется при:
   - Клике на Luxee аккаунт в сайдбаре
   - Открытии чата (просмотр сообщений)
   - Отправке сообщения
   - Любых ручных действиях пользователя

2. **Таймаут 15 минут**:
   - Если с момента последнего действия прошло 15+ минут → аккаунт становится **offline**
   - Если была активность в пределах 15 минут → аккаунт **online**

3. **Keep-Alive защита**:
   - `keepAliveService` НЕ кликает "I am online" если прошло 15+ минут
   - Это предотвращает автоматическое поддержание онлайн статуса

4. **Исключения**:
   - ✅ Рассылки (Spambot) НЕ считаются ручной активностью
   - ✅ AI Auto Response НЕ считается ручной активностью
   - ✅ Только действия конкретного пользователя на ЕГО аккаунтах

## 🏗️ Архитектура

### Backend

#### 1. Модели данных

**LuxeeAccountModel**
```javascript
{
  lastManualActivity: { type: Date, default: null }, // Время последней ручной активности
  isOnline: { type: Boolean, default: false }        // Текущий онлайн статус
}
```

**UserModel**
```javascript
{
  lastManualActivity: { type: Date, default: null }  // Время последней активности пользователя
}
```

#### 2. Сервисы

**luxeeAccountOnlineService.js** - основной сервис
- `trackManualActivity(userId, accountId)` - фиксация активности
- `checkAndUpdateOnlineStatus(userId)` - проверка и обновление статусов
- `getUserAccountsOnlineStatus(userId)` - получение статусов
- `startMonitoring()` - запуск мониторинга (каждую минуту)

#### 3. Интеграции

**chatOpenService.js**
```javascript
// После успешного открытия чата
await luxeeAccountOnlineService.trackManualActivity(account.user.toString(), accountId);
```

**messageSendService.js**
```javascript
// После успешной отправки сообщения
await luxeeAccountOnlineService.trackManualActivity(userId, accountId);
```

**keepAliveService.js**
```javascript
// Проверка перед кликом "I am online"
const account = await LuxeeAccount.findById(accountId);
if (account && account.lastManualActivity) {
  const timeSinceActivity = Date.now() - account.lastManualActivity.getTime();
  if (timeSinceActivity >= MANUAL_ACTIVITY_TIMEOUT) { // 15 минут
    console.log('Manual activity timeout - NOT clicking "I am online"');
    continue; // НЕ кликаем
  }
}
```

#### 4. API Endpoints

```
POST /api/luxee/track-activity
Body: { accountId: string }
- Трекинг ручной активности пользователя

GET /api/luxee/accounts/online-status
- Получение онлайн статуса всех аккаунтов пользователя (один общий статус)
Response: { isOnline: boolean }
```

#### 5. WebSocket события

```javascript
SOCKET_EVENTS.ACCOUNTS_ONLINE_STATUS = 'luxee:accounts:online-status'

// Данные события
{
  accounts: [
    {
      accountId: string,
      isOnline: boolean,
      lastActivity: Date,
      minutesSinceActivity: number
    }
  ],
  timestamp: string
}
```

#### 6. Мониторинг

**index.js**
```javascript
// Запуск через 12 секунд после старта сервера
setTimeout(() => {
  luxeeAccountOnlineService.startMonitoring();
  console.log('✓ Online Status Monitor started (updates every 1 minute)');
}, 12000);
```

## 🔄 Процесс работы

### 1. Трекинг активности

```
Пользователь кликает на аккаунт
    ↓
Frontend отправляет POST /api/luxee/track-activity
    ↓
Backend обновляет lastManualActivity для аккаунта и пользователя
    ↓
Все аккаунты пользователя становятся online
    ↓
WebSocket broadcast обновленных статусов
```

### 2. Автоматическая проверка (каждую минуту)

```
Мониторинг запускается каждые 60 секунд
    ↓
Для каждого пользователя с активностью:
    ├─ Проверка: прошло ли 15+ минут?
    │   ├─ ДА → устанавливаем isOnline = false
    │   └─ НЕТ → устанавливаем isOnline = true
    ↓
WebSocket broadcast обновленных статусов всем пользователям
```

### 3. Keep-Alive защита

```
Keep-Alive детектирует popup "You're inactive"
    ↓
Проверяет lastManualActivity аккаунта
    ↓
Если прошло 15+ минут:
    └─ НЕ кликает "I am online"
    └─ Аккаунт остаётся offline
    
Если активность недавняя (< 15 мин):
    └─ Кликает "I am online"
    └─ Перезагружает страницу
    └─ Аккаунт остаётся online
```

## 📊 Примеры данных

### Статус online (активность 5 минут назад)
```json
{
  "accountId": "507f1f77bcf86cd799439011",
  "isOnline": true,
  "lastActivity": "2026-07-22T21:03:00.000Z",
  "minutesSinceActivity": 5
}
```

### Статус offline (активность 20 минут назад)
```json
{
  "accountId": "507f1f77bcf86cd799439011",
  "isOnline": false,
  "lastActivity": "2026-07-22T20:48:00.000Z",
  "minutesSinceActivity": 20
}
```

## ⚙️ Конфигурация

```javascript
// luxeeAccountOnlineService.js
const MANUAL_ACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 минут
const STATUS_CHECK_INTERVAL = 60 * 1000;        // 1 минута (проверка)

// keepAliveService.js
const MANUAL_ACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 минут
```

## 🔍 Логирование

### Backend логи
```
[Luxee Account Online] ✅ Manual activity tracked for user 123, account 456
[Luxee Account Online] 📊 User 123: 3 online, 1 offline
[Luxee Account Online] 📤 WebSocket update sent to user 123
[Keep-Alive] ⏰ Manual activity timeout (20 min) - NOT clicking "I am online"
```

## 🎨 Frontend ✅

### 1. API Client (`frontend/src/api/luxeeApi.js`)
```javascript
// Трекинг ручной активности (ВСЕ аккаунты пользователя станут online)
trackManualActivity: async (accountId = null) => {
  const response = await api.post('/luxee/online/track', { accountId });
  return response.data;
},

// Получить онлайн статус (общий для всех аккаунтов пользователя)
getOnlineStatus: async () => {
  const response = await api.get('/luxee/online/status');
  return response.data;
}
```

### 2. Hook (`frontend/src/hooks/useLuxeeOnlineStatus.js`)
```javascript
const { isOnline, lastActivity, loading, trackActivity } = useLuxeeOnlineStatus();

// isOnline - boolean, статус ВСЕХ аккаунтов пользователя (один общий)
// lastActivity - Date, время последней активности
// loading - boolean, идёт загрузка
// trackActivity(accountId) - вызвать при ручном действии
```

**Особенности:**
- Автоматически загружает начальный статус при монтировании
- Подписывается на WebSocket события `luxee:accounts:online-status`
- Real-time обновление статуса без перезагрузки

### 3. UI Components

#### SidebarHeader - Общий индикатор статуса
```jsx
// frontend/src/components/Sidebar/SidebarHeader.jsx
import { useLuxeeOnlineStatus } from '../../hooks/useLuxeeOnlineStatus';

const { isOnline, loading } = useLuxeeOnlineStatus();

// Показывает:
// 🟢 Online - если хотя бы одно действие было в последние 15 минут
// ⚪ Offline - если прошло 15+ минут с последнего действия
```

#### AccountItem - Трекинг кликов
```jsx
// frontend/src/components/Sidebar/AccountItem.jsx
import { useLuxeeOnlineStatus } from '../../hooks/useLuxeeOnlineStatus';

const { trackActivity } = useLuxeeOnlineStatus();

const handleAccountClick = () => {
  trackActivity(account.accountId); // ← Трекаем при клике
  onToggle();
};
```

### 4. WebSocket Integration
Hook автоматически обрабатывает события:
```javascript
socket.on('luxee:accounts:online-status', (data) => {
  // data = { isOnline: boolean }
  // Автоматически обновляет состояние isOnline
});
```

### 5. Где происходит трекинг

**Автоматически** (уже интегрировано в backend):
- ✅ При открытии чата (`chatOpenService`)
- ✅ При отправке сообщения (`messageSendService`)

**Frontend** (нужно вызвать вручную):
- ✅ При клике на аккаунт (`AccountItem`)
- 🔄 При любых других ручных действиях (если добавятся)

## ✅ Критические требования

1. **✅ Только ручные действия**
   - Рассылки НЕ учитываются
   - AI Auto Response НЕ учитывается
   - Только действия конкретного пользователя

2. **✅ Таймаут 15 минут**
   - После 15 минут → offline
   - Keep-Alive НЕ кликает "I am online"

3. **✅ Все аккаунты пользователя**
   - При любом действии ВСЕ аккаунты пользователя становятся online
   - Проверка идет только для аккаунтов, принадлежащих пользователю

4. **✅ Админские аккаунты**
   - Админ видит ТОЛЬКО свои аккаунты
   - Аккаунты других пользователей (для управления AI) НЕ учитываются

## 📝 Статус реализации

### Backend
- [x] Модели данных (LuxeeAccount, User)
- [x] Сервис luxeeAccountOnlineService
- [x] Интеграция в chatOpenService
- [x] Интеграция в messageSendService
- [x] Модификация keepAliveService
- [x] API endpoints
- [x] WebSocket события
- [x] Запуск мониторинга в index.js

### Frontend
- [x] API client (luxeeApi.js) - методы `trackManualActivity` и `getOnlineStatus`
- [x] Hook useLuxeeOnlineStatus - управление статусом + WebSocket
- [x] Компонент SidebarHeader - отображение Online/Offline
- [x] Интеграция кликов в AccountItem - трекинг при клике на аккаунт
- [x] WebSocket real-time обновления

## 🐛 Отладка

### Проверка трекинга
```bash
# Проверить lastManualActivity аккаунта
db.luxeeaccounts.find({ _id: ObjectId("...") }, { lastManualActivity: 1, isOnline: 1 })

# Проверить lastManualActivity пользователя
db.users.find({ _id: ObjectId("...") }, { lastManualActivity: 1 })
```

### Логи мониторинга
```
[Luxee Account Online] 🔄 Starting online status check...
[Luxee Account Online] 📊 User 123: 3 online, 1 offline
[Luxee Account Online] ✅ Online status check complete
```

## 🚀 Развертывание

1. Backend уже готов и запустится автоматически
2. Frontend требует реализации (API + UI компоненты)
3. Мониторинг запускается через 12 секунд после старта сервера

---

**Дата создания:** 22.07.2026  
**Версия:** 1.0.0
