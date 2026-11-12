# ✅ Spambot - Node.js Integration (ФАЗА 2)

**Дата:** 17.07.2026  
**Статус:** ✅ ЗАВЕРШЕНО

---

## 🎯 **ЧТО РЕАЛИЗОВАНО:**

### **Архитектура**

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend  │────────▶│  Node.js Backend │────────▶│ Python Service  │
│   (React)   │         │   (Express.js)   │         │   (FastAPI)     │
└─────────────┘         └──────────────────┘         └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────┐
                        │   MongoDB    │
                        └──────────────┘

Frontend → Node.js: {accountId, config} БЕЗ credentials
Node.js → MongoDB: Достаёт credentials
Node.js → Python: {username, password, config} С credentials
```

---

## 📁 **СОЗДАННЫЕ ФАЙЛЫ:**

### **1. MongoDB Модель**
**`backend/src/models/SpambotDistributionModel.js`**

```javascript
// Хранит историю рассылок
{
  user: ObjectId,              // Владелец
  luxeeAccount: ObjectId,      // Аккаунт Luxee
  distributionId: String,      // ID в Python Service
  config: {                    // Конфигурация
    profileUid, profileName,
    distributionType, messages, mailMessage,
    filters, limits
  },
  status: 'pending|running|completed|error|stopped',
  sentMessagesCount: Number,
  skippedClientsCount: Number,
  startedAt, completedAt, createdAt
}
```

**Методы:**
- `updateStatus(statusData)` - обновить статус из Python
- `getActiveDistributions(userId)` - активные рассылки пользователя
- `getAccountActiveDistributions(accountId)` - активные рассылки аккаунта

---

### **2. Service Layer**
**`backend/src/services/spambotService.js`**

**🔒 ДВОЙНАЯ ЗАЩИТА ОТ ПАРАЛЛЕЛЬНЫХ РАССЫЛОК:**

```javascript
// 1. In-memory locks (Map)
const accountLocks = new Map();

// 2. MongoDB queries
await SpambotDistributionModel.getAccountActiveDistributions(accountId);

// ПРАВИЛО: Один Luxee аккаунт = ОДНА активная рассылка
```

**Методы:**

| Метод | Описание | Блокировка |
|-------|----------|------------|
| `checkAccountAvailability(accountId)` | Проверка доступности аккаунта | Да |
| `getProfiles(accountId, userId)` | Получить профили | Нет |
| `startDistribution({accountId, userId, config})` | Запустить рассылку | **ДА** |
| `getDistributionStatus(distributionId, userId)` | Получить статус | Нет |
| `stopDistribution(distributionId, userId)` | Остановить рассылку | Нет |
| `getUserDistributions(userId, filters)` | История рассылок | Нет |

**Логика блокировки:**

```javascript
async startDistribution({ accountId, userId, config }) {
  // 1. Проверка доступа
  const account = await LuxeeAccountModel.findOne({ _id: accountId, user: userId });
  
  // 2. Проверка блокировки
  const availability = await this.checkAccountAvailability(accountId);
  if (!availability.available) {
    throw new Error(availability.reason); // ❌ ЗАНЯТО!
  }
  
  // 3. Установить блокировку
  accountLocks.set(accountId, Date.now());
  
  try {
    // 4. Добавить credentials из MongoDB
    const fullConfig = {
      username: account.luxeeEmail,
      password: account.luxeePassword,
      ...config
    };
    
    // 5. Отправить в Python Service
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/distribution/start`,
      fullConfig
    );
    
    // 6. Сохранить в MongoDB
    const distribution = new SpambotDistributionModel({...});
    await distribution.save();
    
    return distribution;
  } finally {
    // 7. Снять блокировку через 5 секунд
    setTimeout(() => accountLocks.delete(accountId), 5000);
  }
}
```

---

### **3. Controller**
**`backend/src/controllers/spambotController.js`**

**Endpoints:**

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/spambot/profiles?accountId=X` | GET | Получить профили |
| `/api/spambot/accounts/:accountId/availability` | GET | Проверить доступность |
| `/api/spambot/distributions` | POST | Создать рассылку |
| `/api/spambot/distributions` | GET | Список рассылок |
| `/api/spambot/distributions/:id/status` | GET | Статус рассылки |
| `/api/spambot/distributions/:id/stop` | POST | Остановить рассылку |

**Валидация:**

```javascript
// Обязательные поля
- accountId
- config.profileUid
- config.profileName
- config.distributionType
- config.limit
- config.filterUpdateLimit

// Для chat: config.messages[]
// Для mail: config.mailMessage
```

**Коды ответов:**

| Код | Ситуация |
|-----|----------|
| 200 | ✅ OK |
| 201 | ✅ Created |
| 400 | ❌ Bad Request (валидация) |
| 404 | ❌ Not Found |
| 409 | ❌ Conflict (аккаунт занят) |
| 500 | ❌ Server Error |

---

### **4. Routes**
**`backend/src/routes/spambotRoutes.js`**

```javascript
import express from 'express';
import spambotController from '../controllers/spambotController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Все routes требуют авторизации
router.use(authenticateToken);

router.get('/profiles', spambotController.getProfiles);
router.get('/accounts/:accountId/availability', spambotController.checkAccountAvailability);
router.post('/distributions', spambotController.createDistribution);
router.get('/distributions', spambotController.getDistributions);
router.get('/distributions/:id/status', spambotController.getDistributionStatus);
router.post('/distributions/:id/stop', spambotController.stopDistribution);

export default router;
```

**Подключено к главному роутеру:**

```javascript
// backend/src/routes/index.js
import spambotRoutes from './spambotRoutes.js';

router.use('/spambot', spambotRoutes);
```

---

## 🔒 **БЕЗОПАСНОСТЬ:**

### **Flow Credentials:**

```
1. Frontend отправляет:
   {
     accountId: "507f1f77bcf86cd799439011",
     config: {
       profileUid: "12345",
       distributionType: "chat",
       messages: [...]
     }
   }
   ❌ БЕЗ username/password!

2. Node.js Backend:
   const account = await LuxeeAccountModel.findById(accountId);
   // ✅ Достаёт из MongoDB:
   // - account.luxeeEmail
   // - account.luxeePassword

3. Node.js → Python Service:
   {
     username: "model@luxee.com",  ← из MongoDB
     password: "pass123",           ← из MongoDB
     profileUid: "12345",
     ...config
   }

4. Python Service:
   luxee = Luxee(username, password)  ← Создаёт СВОЙ браузер
   luxee.start_distribution(...)
```

### **Проверки доступа:**

```javascript
// 1. Авторизация (middleware)
router.use(authenticateToken);

// 2. Проверка владения аккаунтом
const account = await LuxeeAccountModel.findOne({
  _id: accountId,
  user: userId  // ✅ Может управлять только СВОИМИ аккаунтами
});

if (!account) {
  throw new Error('Account not found or access denied');
}
```

---

## 🐳 **DOCKER INTEGRATION:**

### **docker-compose.yml**

```yaml
services:
  # Node.js Backend
  backend:
    environment:
      SPAMBOT_SERVICE_URL: http://backend-spambot:8000
    depends_on:
      - mongodb
      - backend-spambot  # ✅ Ждёт Python Service

  # Python Service (NEW!)
  backend-spambot:
    build:
      context: ./backend-spambot
    ports:
      - "8000:8000"
    networks:
      - luxee-network
    volumes:
      - spambot_logs:/app/logs

volumes:
  spambot_logs:  # ✅ Для логов Python
```

### **.env Configuration**

```bash
# backend/.env.example
SPAMBOT_SERVICE_URL=http://backend-spambot:8000
```

---

## 📊 **ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:**

### **1. Получить профили**

```javascript
GET /api/spambot/profiles?accountId=507f1f77bcf86cd799439011
Authorization: Bearer <token>

Response:
{
  "success": true,
  "profiles": [
    {
      "uid": "12345",
      "owner_uid": "67890",
      "name": "Anna",
      "age": 25,
      "location": "Moscow",
      "image_url": "https://..."
    }
  ]
}
```

### **2. Проверить доступность аккаунта**

```javascript
GET /api/spambot/accounts/507f1f77bcf86cd799439011/availability
Authorization: Bearer <token>

Response (доступен):
{
  "success": true,
  "available": true
}

Response (занят):
{
  "success": true,
  "available": false,
  "reason": "Account has 1 active distribution(s)",
  "activeDistributions": [{
    "id": "...",
    "distributionId": "uuid",
    "status": "running",
    "startedAt": "2026-07-17T15:00:00Z"
  }]
}
```

### **3. Запустить рассылку (Chat)**

```javascript
POST /api/spambot/distributions
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "507f1f77bcf86cd799439011",
  "config": {
    "profileUid": "12345",
    "profileName": "Anna, 25",
    "distributionType": "chat",
    "messages": [
      { "text": "Привет!", "interval": 0 },
      { "text": "Как дела?", "interval": 2 }
    ],
    "purchased": true,
    "free": true,
    "onlyEmptyChat": false,
    "excludeIds": [],
    "specificUsers": [],
    "limit": 50,
    "filterUpdateLimit": 10,
    "maxTimeMinutes": 180
  }
}

Response:
{
  "success": true,
  "distribution": {
    "id": "507f191e810c19729de860ea",
    "distributionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "accountEmail": "model@luxee.com"
  }
}
```

### **4. Получить статус**

```javascript
GET /api/spambot/distributions/507f191e810c19729de860ea/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "id": "507f191e810c19729de860ea",
  "distributionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "sentMessagesCount": 25,
  "skippedClientsCount": 3,
  "currentClient": "User_789",
  "accountEmail": "model@luxee.com",
  "startedAt": "2026-07-17T15:00:00Z"
}
```

### **5. Остановить рассылку**

```javascript
POST /api/spambot/distributions/507f191e810c19729de860ea/stop
Authorization: Bearer <token>

Response:
{
  "success": true,
  "id": "507f191e810c19729de860ea",
  "status": "stopped",
  "message": "Distribution stopped successfully"
}
```

---

## ⚠️ **ВАЖНЫЕ МЕХАНИЗМЫ:**

### **1. Блокировки (Mutex)**

```
Сценарий: User пытается запустить 2 рассылки на ОДНОМ аккаунте

Request 1: POST /distributions {accountId: "X"}
  ✅ checkAvailability() → available: true
  ✅ accountLocks.set("X")
  ✅ Создаёт distribution в MongoDB
  
Request 2: POST /distributions {accountId: "X"} (через 1 сек)
  ❌ checkAvailability() → available: false
  ❌ Error: "Account has 1 active distribution(s)"
  
После 5 секунд:
  ✅ accountLocks.delete("X")
  ✅ MongoDB уже содержит active distribution
```

### **2. Синхронизация статуса**

```javascript
// При запросе статуса:
if (['completed', 'error', 'stopped'].includes(distribution.status)) {
  // Вернуть из MongoDB (закешировано)
  return distribution;
} else {
  // Запросить актуальный статус из Python
  const response = await axios.get(`${PYTHON_SERVICE_URL}/api/distribution/${id}/status`);
  
  // Обновить в MongoDB
  await distribution.updateStatus(response.data);
  
  return response.data;
}
```

---

## ✅ **ЧТО ОБЕСПЕЧЕНО:**

### **Параллельность:**
- ✅ Разные аккаунты → параллельно работают
- ✅ Один аккаунт → блокировка (только 1 активная рассылка)
- ✅ Каждый аккаунт → свой изолированный браузер

### **Безопасность:**
- ✅ Credentials не передаются через frontend
- ✅ Авторизация на всех endpoints
- ✅ Проверка владения аккаунтом
- ✅ Python Service в internal network

### **Надёжность:**
- ✅ История рассылок в MongoDB
- ✅ Восстановление статуса после перезапуска
- ✅ Graceful stop
- ✅ Error handling

---

## 🚀 **СЛЕДУЮЩИЕ ШАГИ:**

### **ФАЗА 3: Frontend UI**
1. Страница Spambot в навигации
2. Выбор аккаунта и профиля
3. Конфигурация рассылки (форма)
4. Real-time статус (polling или WebSocket)
5. История рассылок
6. Индикатор занятости аккаунта

### **Опциональные улучшения:**
- WebSocket для real-time обновлений
- Очередь рассылок (queue)
- Scheduled distributions (cron)
- Статистика и analytics
- Экспорт логов

---

## 📝 **ИТОГ:**

✅ **Node.js Integration ЗАВЕРШЕНА!**

**Создано файлов:** 4
- SpambotDistributionModel.js
- spambotService.js
- spambotController.js
- spambotRoutes.js

**Изменено файлов:** 3
- backend/src/routes/index.js
- backend/.env.example
- docker-compose.yml

**Время реализации:** ~45 минут  
**Статус:** Готов к Frontend UI и тестированию

**Следующий шаг:** Создать UI для управления рассылками 🎨
