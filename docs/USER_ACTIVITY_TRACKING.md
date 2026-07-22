# User Activity Tracking & Keep-Alive System

## Обзор

Система отслеживания активности пользователей для автоматического управления keep-alive процессами. Когда пользователь неактивен более 2 минут, все его keep-alive процессы останавливаются для экономии ресурсов. При возобновлении активности они автоматически запускаются заново.

## Архитектура

### Backend

#### 1. User Model (`backend/src/models/UserModel.js`)
```javascript
{
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  }
}
```

#### 2. User Activity Service (`backend/src/services/userActivityService.js`)

**Основные функции:**

- `handleUserActivity(userId)` - Обновляет lastActivity и запускает keep-alive если нужно
- `getUserActivityStatus(userId)` - Возвращает статус активности пользователя
- `startInactivityMonitor()` - Запускает мониторинг неактивных пользователей (каждые 30 секунд)

**Константы:**
- `INACTIVITY_TIMEOUT` = 2 минуты (120 000 мс)
- `MONITOR_INTERVAL` = 30 секунд

#### 3. Controllers & Routes

**Endpoints:**
- `POST /api/user/activity` - Обновить активность (heartbeat)
- `GET /api/user/activity/status` - Получить статус активности

#### 4. Integration Points

**Luxee Login Service:**
```javascript
// При логине обновляется lastActivity
await User.findByIdAndUpdate(userId, { lastActivity: new Date() });
```

**Server Startup (`backend/index.js`):**
```javascript
// Запуск мониторинга через 12 секунд после старта
userActivityService.startInactivityMonitor();
```

### Frontend

#### 1. useUserActivity Hook (`frontend/src/hooks/useUserActivity.js`)

**Отслеживаемые события:**
- `mousedown`
- `keydown`
- `scroll`
- `touchstart`
- `click`

**Логика работы:**
1. При любом событии активности обновляется `lastActivityRef`
2. Если пользователь был неактивен >30 секунд, отправляется heartbeat немедленно
3. Каждые 30 секунд проверяется активность:
   - Если активность была в последние 35 секунд → отправляется heartbeat
   - Иначе пользователь считается неактивным

#### 2. Integration в App.jsx

```javascript
import useUserActivity from './hooks/useUserActivity';

function App() {
  useUserActivity(); // Активируется для всех авторизованных пользователей
  // ...
}
```

## Логика работы

### Сценарий 1: Активный пользователь

```
User Activity → Frontend Hook → POST /api/user/activity → 
Backend обновляет lastActivity → Keep-alive продолжает работу
```

**Частота heartbeat:** Каждые 30 секунд при активности

### Сценарий 2: Пользователь стал неактивен

```
Нет активности 2+ минуты → Inactivity Monitor обнаруживает → 
Останавливает все keep-alive процессы пользователя →
Логирует: "[User Activity] User {userId} became inactive, stopping keep-alive"
```

### Сценарий 3: Пользователь вернулся

```
User Activity → POST /api/user/activity → 
Backend обновляет lastActivity и запускает keep-alive →
Логирует: "[User Activity] User {userId} became active, starting keep-alive"
```

## Мониторинг и Логирование

### Backend Logs

**Inactivity Monitor:**
```
[User Activity Monitor] Checking inactive users...
[User Activity Monitor] Checking user {userId}, inactive for {time}
[User Activity] User {userId} became inactive, stopping keep-alive for {count} accounts
[User Activity] ✓ Keep-alive stopped for account {accountId}
[User Activity Monitor] Stopped keep-alive for {count} inactive users
```

**Activity Handling:**
```
[User Activity] User {userId} became active, starting keep-alive for {count} accounts
[User Activity] ✓ Keep-alive started for account {accountId}
```

### Frontend Logs

```
[User Activity] Heartbeat sent
[User Activity] Error sending heartbeat: {error}
```

## Преимущества

1. **Экономия ресурсов** - Keep-alive процессы не работают когда пользователь не активен
2. **Автоматическое восстановление** - При возобновлении активности все восстанавливается
3. **Прозрачность** - Пользователь не замечает изменений
4. **Масштабируемость** - Система работает для любого количества пользователей

## Настройка

### Изменить таймаут неактивности:

**Backend (`userActivityService.js`):**
```javascript
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 минут вместо 2
```

### Изменить частоту heartbeat:

**Frontend (`useUserActivity.js`):**
```javascript
heartbeatIntervalRef.current = setInterval(() => {
  // ...
}, 60000); // 1 минута вместо 30 секунд
```

### Изменить частоту мониторинга:

**Backend (`userActivityService.js`):**
```javascript
const MONITOR_INTERVAL = 60 * 1000; // 1 минута вместо 30 секунд
```

## Troubleshooting

### Keep-alive не останавливается при неактивности

1. Проверьте логи: `[User Activity Monitor]`
2. Убедитесь что `startInactivityMonitor()` вызван в `backend/index.js`
3. Проверьте что `lastActivity` обновляется в БД

### Keep-alive не запускается при активности

1. Проверьте что heartbeat отправляется с фронтенда
2. Проверьте логи: `[User Activity] User {userId} became active`
3. Убедитесь что у пользователя есть активные аккаунты

### Heartbeat не отправляется

1. Проверьте консоль браузера на ошибки
2. Убедитесь что `useUserActivity()` вызван в `App.jsx`
3. Проверьте что пользователь авторизован

## Связанные файлы

### Backend
- `backend/src/models/UserModel.js` - Модель с lastActivity
- `backend/src/services/userActivityService.js` - Основная логика
- `backend/src/controllers/userController.js` - Контроллеры
- `backend/src/routes/index.js` - Роуты
- `backend/src/services/luxeeApi/luxeeAuthService/loginService.js` - Обновление при логине
- `backend/index.js` - Запуск монитора

### Frontend
- `frontend/src/hooks/useUserActivity.js` - Хук отслеживания
- `frontend/src/App.jsx` - Интеграция хука

## Версия

Документация актуальна для версии системы от 21.07.2026.
