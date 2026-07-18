# Spambot: Admin Access Implementation

## 📋 Обзор

Реализован функционал, позволяющий администратору запускать рассылки от имени любого пользователя в системе.

## 🎯 Требования (выполнено)

- ✅ Администратор видит все Luxee аккаунты всех пользователей
- ✅ Аккаунты сгруппированы по пользователям в иерархической структуре
- ✅ Администратор может выбрать любой аккаунт и запустить рассылку
- ✅ Список аккаунтов обновляется в реальном времени через WebSocket
- ✅ Используется существующая архитектура (roleMiddleware, socketService)

## 🏗️ Архитектура

### Backend

#### 1. Routes (`backend/src/routes/spambotRoutes.js`)

Добавлены admin-only эндпоинты:

```javascript
// Admin routes (требуют roleMiddleware('admin'))
GET /api/spambot/admin/accounts
GET /api/spambot/admin/distributions
GET /api/spambot/admin/profiles
```

#### 2. Controller (`backend/src/controllers/spambotController.js`)

Добавлены методы:
- `getAdminAccounts()` - получить все аккаунты сгруппированные по пользователям
- `getAdminDistributions()` - получить все рассылки с фильтрами
- `getAdminProfiles()` - получить профили для любого аккаунта

#### 3. Service (`backend/src/services/spambotService.js`)

Добавлены методы:
- `getAllAccountsGroupedByUser()` - группировка аккаунтов по пользователям
- `getAllDistributions()` - получение всех рассылок с фильтрами
- `getProfilesAdmin()` - получение профилей без проверки владельца

#### 4. WebSocket Events (`backend/src/config/socket.js`)

Добавлены события:
```javascript
LUXEE_ACCOUNT_CREATED: 'luxee:account:created'
LUXEE_ACCOUNT_UPDATED: 'luxee:account:updated'
LUXEE_ACCOUNT_DELETED: 'luxee:account:deleted'
```

### Frontend

#### 1. API Client (`frontend/src/api/spambotApi.js`)

Добавлены методы:
```javascript
getAdminAccounts()      // Получить все аккаунты
getAdminDistributions() // Получить все рассылки
getAdminProfiles()      // Получить профили для любого аккаунта
```

#### 2. Компонент AdminAccountSelector

**Файл:** `frontend/src/components/Spambot/AdminAccountSelector.jsx`

**Особенности:**
- Иерархическая структура: пользователи → их аккаунты
- Collapsible секции для каждого пользователя
- Показывает email пользователя и количество аккаунтов
- Визуально отличается от обычного AccountSelector

**UI:**
```
┌─────────────────────────────────────┐
│ Шаг 1: Выберите аккаунт             │
├─────────────────────────────────────┤
│ ▼ user@example.com            [2]   │
│   ├─ account1@luxee.io     [✓]      │
│   └─ account2@luxee.io              │
│                                      │
│ ▶ admin@example.com           [1]   │
└─────────────────────────────────────┘
```

#### 3. Обновленный Spambot.jsx

**Условный рендеринг:**
```javascript
{isAdmin ? (
  <AdminAccountSelector
    usersWithAccounts={accounts}
    selectedAccount={selectedAccount}
    onSelect={setSelectedAccount}
    loading={accountsLoading}
  />
) : (
  <AccountSelector
    accounts={accounts}
    selectedAccount={selectedAccount}
    onSelect={setSelectedAccount}
    loading={accountsLoading}
  />
)}
```

**WebSocket подписка:**
```javascript
// Обновление списка при создании нового аккаунта
useEffect(() => {
  if (!socket || !isConnected || !isAdmin) return;
  
  const handleAccountCreated = (data) => {
    console.log('[Spambot] New account created:', data);
    refetchAccounts();
  };
  
  socket.on('luxee:account:created', handleAccountCreated);
  
  return () => {
    socket.off('luxee:account:created', handleAccountCreated);
  };
}, [socket, isConnected, isAdmin, refetchAccounts]);
```

## 🔐 Безопасность

1. **Backend Protection:**
   - Все admin routes защищены `roleMiddleware('admin')`
   - Проверка роли происходит на уровне middleware
   - Обычные пользователи получают 403 Forbidden

2. **Frontend Protection:**
   - Условный рендеринг на основе `user.role === 'admin'`
   - Разные API endpoints для админа и пользователя
   - Admin компоненты не загружаются для обычных пользователей

## 📊 API Структура

### GET /api/spambot/admin/accounts

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "user": {
        "_id": "user_id",
        "email": "user@example.com",
        "role": "user"
      },
      "accounts": [
        {
          "_id": "account_id",
          "luxeeEmail": "account@luxee.io",
          "isActive": true,
          "lastActivity": "2026-07-18T00:00:00.000Z",
          "createdAt": "2026-07-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### GET /api/spambot/admin/distributions

**Query Params:**
- `status` - фильтр по статусу (pending, running, completed, stopped, error)
- `userId` - фильтр по пользователю
- `limit` - количество (default: 100)

**Response:**
```json
{
  "success": true,
  "distributions": [
    {
      "id": "dist_id",
      "distributionId": "unique_id",
      "status": "running",
      "accountEmail": "account@luxee.io",
      "userEmail": "user@example.com",
      "userId": "user_id",
      "profileName": "Profile Name",
      "distributionType": "chat",
      "sentMessagesCount": 10,
      "skippedClientsCount": 2,
      "limit": 100,
      "startedAt": "2026-07-18T00:00:00.000Z",
      "createdAt": "2026-07-18T00:00:00.000Z"
    }
  ]
}
```

### GET /api/spambot/admin/profiles

**Query Params:**
- `accountId` (required) - ID Luxee аккаунта

**Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "uid": "profile_uid",
      "owner_uid": "owner_uid",
      "name": "Profile Name",
      "age": 25,
      "location": "Location",
      "image_url": "https://..."
    }
  ]
}
```

## 🔄 WebSocket Events

### luxee:account:created

Отправляется всем подключенным клиентам при создании нового Luxee аккаунта.

**Payload:**
```json
{
  "userId": "user_id",
  "account": {
    "_id": "account_id",
    "luxeeEmail": "account@luxee.io",
    "isActive": true,
    "lastActivity": "2026-07-18T00:00:00.000Z",
    "createdAt": "2026-07-18T00:00:00.000Z",
    "aiEnabled": false,
    "aiEnabledByAdmin": false
  },
  "timestamp": "2026-07-18T00:00:00.000Z"
}
```

**Обработка на frontend:**
- Админ: обновляет список всех аккаунтов через `refetchAccounts()`
- Пользователь: игнорирует (не подписан на событие)

## 🎨 UI/UX

### Для админа:
1. Видит список всех пользователей
2. Каждый пользователь - collapsible секция
3. Внутри секции - список его аккаунтов
4. Бейдж показывает количество аккаунтов
5. Выбранный аккаунт подсвечивается

### Для пользователя:
1. Видит только свои аккаунты
2. Простой плоский список
3. Без группировки

## 📝 Использование

### Как админ запускает рассылку:

1. Открыть страницу Spambot
2. В списке аккаунтов развернуть нужного пользователя (▼)
3. Выбрать аккаунт этого пользователя
4. Выбрать профиль
5. Настроить рассылку
6. Добавить в очередь
7. Запустить

### Что происходит:

1. Рассылка запускается от имени аккаунта пользователя
2. В истории рассылок видно: `userEmail` и `accountEmail`
3. Статистика привязывается к аккаунту пользователя
4. WebSocket обновления получают оба (админ и владелец аккаунта)

## ✅ Преимущества реализации

1. **Минимальные изменения:** использована существующая архитектура
2. **Безопасность:** roleMiddleware проверяет права доступа
3. **Масштабируемость:** легко добавить новые admin функции
4. **Real-time:** WebSocket синхронизация работает из коробки
5. **UX:** интуитивный иерархический интерфейс
6. **Переиспользование:** существующие компоненты и логика

## 🚀 Что можно улучшить в будущем

1. **Поиск:** добавить поиск по email пользователя/аккаунта
2. **Фильтры:** фильтр по активным/неактивным аккаунтам
3. **Статистика:** показывать статистику по каждому пользователю
4. **Batch actions:** массовые операции с аккаунтами
5. **Права:** гранулярные права (view-only admin, distribution admin)

## 🐛 Известные ограничения

1. Админ видит все аккаунты сразу (нет пагинации)
2. При большом количестве пользователей может быть медленная загрузка
3. WebSocket broadcast может быть избыточным (отправляется всем)

## 📚 Связанные файлы

### Backend:
- `backend/src/routes/spambotRoutes.js`
- `backend/src/controllers/spambotController.js`
- `backend/src/services/spambotService.js`
- `backend/src/config/socket.js`
- `backend/src/middleware/roleMiddleware.js`

### Frontend:
- `frontend/src/pages/Spambot.jsx`
- `frontend/src/components/Spambot/AdminAccountSelector.jsx`
- `frontend/src/api/spambotApi.js`

### Документация:
- `SPAMBOT_INTEGRATION_PLAN.md` - общий план интеграции
- `SPAMBOT_ADMIN_ACCESS.md` - этот файл

## 🔍 Тестирование

### Как протестировать:

1. **Создать админа:**
   ```bash
   npm run create-admin
   ```

2. **Создать тестового пользователя:**
   - Зарегистрироваться через UI
   - Добавить Luxee аккаунт

3. **Войти как админ:**
   - Открыть /spambot
   - Проверить что видны все пользователи и их аккаунты

4. **Запустить рассылку:**
   - Выбрать аккаунт пользователя
   - Настроить и запустить рассылку

5. **Проверить WebSocket:**
   - Открыть вторую вкладку с пользователем
   - Добавить новый Luxee аккаунт
   - Проверить что админ видит обновление

## ✨ Итог

Реализация выполнена согласно требованиям. Админ может управлять рассылками любого пользователя через удобный иерархический интерфейс с real-time обновлениями.
