# Spambot Queue: Исправление ошибки 422 при запуске из очереди

**Дата:** 21.07.2026
**Статус:** 🔴 Критическая ошибка - требует исправления

---

## 🔥 Проблема

При завершении первой рассылки, вторая рассылка из очереди пытается запуститься, но получает ошибку **422 Unprocessable Entity** от Python service.

### Логи ошибки:

**Backend (Node.js):**
```
[Queue Service] 🚀 Starting next distribution: temp_1784615028096_hdayihctc
[Queue Service] ❌ Error starting next distribution: Request failed with status code 422
```

**Backend-spambot (Python):**
```
INFO:     127.0.0.1:55115 - "POST /api/distribution/start HTTP/1.1" 422 Unprocessable Entity
```

---

## 🔍 Анализ причины

### 1. Где происходит ошибка?

**Файл:** `backend/src/services/SpambotQueueService.js` - строки 145-188

```javascript
async startNextInQueue(accountId) {
    const next = await this.getNextInQueue(accountId);
    
    // Подготовить конфигурацию для Python Service
    const fullConfig = {
        username: account.luxeeEmail,
        password: account.luxeePassword,
        profile_uid: config.profileUid,
        profile_name: config.profileName,
        distribution_type: config.distributionType,
        // ... остальные поля
    };
    
    // ❌ ПРОБЛЕМА: Отправляем axios.post напрямую
    const response = await axios.post(
        `${PYTHON_SERVICE_URL}/api/distribution/start`,
        fullConfig,
        { timeout: 30000 }
    );
}
```

### 2. Что ожидает Python Service?

**Файл:** `backend-spambot/api/routes.py` - строка 19

```python
@router.post("/distribution/start", response_model=DistributionStartResponse)
async def start_distribution(config: DistributionConfigInternal):
```

**Файл:** `backend-spambot/api/models.py` - строки 75-112

```python
class DistributionConfigInternal(DistributionConfig):
    """INTERNAL model with credentials"""
    
    # Обязательные поля:
    username: str
    password: str
    profile_uid: str
    profile_name: str
    distribution_type: str  # "chat" | "mail"
    
    # Для chat типа:
    messages: Optional[List[MessageCreate]]  # ❗ СПИСОК объектов!
    
    # Для mail типа:
    mail_message: Optional[MailMessageCreate]
    
    # Остальные поля...
```

### 3. В чём проблема?

**SpambotQueueService.js отправляет:**
```javascript
messages: config.messages?.map(m => ({
    text: m.text,
    interval: m.interval || 0,
}))
```

**Но `config.messages` уже содержит Mongoose объекты с `_id`!**

Если посмотреть на MongoDB документ:
```json
{
  "config": {
    "messages": [
      {
        "text": "Hi",
        "interval": 6,
        "_id": "6a5f1074e262ab19082467c2"  // ❌ Mongoose добавил _id!
      }
    ]
  }
}
```

**Проблема:** Pydantic видит `_id` поле и не может его обработать → 422 ошибка

---

## ✅ Решение 1: Исправить SpambotQueueService.js (Рекомендуется)

### Что делать:

**Очистить Mongoose поля при подготовке конфигурации:**

```javascript
// backend/src/services/SpambotQueueService.js - строки 164-167

messages: config.messages?.map(m => ({
    text: m.text,
    interval: m.interval || 0,
    // ✅ НЕ отправляем _id и другие Mongoose поля
})),
```

**Проблема:** Этот код УЖЕ так работает! Но он мапит объект `m`, который содержит `_id`.

### Правильное решение:

```javascript
messages: config.messages?.map(m => ({
    text: String(m.text),           // Явное приведение к string
    interval: Number(m.interval) || 0  // Явное приведение к number
})),
```

Или использовать `.toObject()` для очистки Mongoose объекта:

```javascript
// Получить next из БД
const next = await this.getNextInQueue(accountId);

// ✅ Преобразовать в plain JavaScript object
const config = next.config.toObject ? next.config.toObject() : next.config;

// Теперь messages - обычный массив без Mongoose магии
messages: config.messages?.map(m => ({
    text: m.text,
    interval: m.interval || 0,
})),
```

---

## ✅ Решение 2: Python Service - игнорировать лишние поля

**Файл:** `backend-spambot/api/models.py`

```python
class MessageCreate(BaseModel):
    text: str
    interval: int = Field(0, ge=0)
    
    class Config:
        # ✅ Игнорировать лишние поля (например _id)
        extra = "ignore"  # <-- ДОБАВИТЬ ЭТО!
```

**Преимущество:** Python Service станет более толерантным к входным данным

---

## ✅ Решение 3: Комбинированное (Лучшее)

1. **Node.js** - очищать Mongoose объекты перед отправкой
2. **Python** - игнорировать лишние поля (на случай если что-то пропустим)

### Изменения:

#### 1. Node.js - SpambotQueueService.js

```javascript
async startNextInQueue(accountId) {
    const next = await this.getNextInQueue(accountId);
    
    if (!next) {
        return null;
    }
    
    // ✅ Преобразовать в plain object (убирает Mongoose метаданные)
    const account = next.luxeeAccount.toObject ? next.luxeeAccount.toObject() : next.luxeeAccount;
    const config = next.config.toObject ? next.config.toObject() : next.config;
    
    // Подготовить конфигурацию
    const fullConfig = {
        username: account.luxeeEmail,
        password: account.luxeePassword,
        profile_uid: config.profileUid,
        profile_name: config.profileName,
        distribution_type: config.distributionType,
        purchased: config.purchased ?? true,
        free: config.free ?? true,
        only_empty_chat: config.onlyEmptyChat ?? false,
        only_not_empty_chat: config.onlyNotEmptyChat ?? false,
        
        // ✅ Явно мапим только нужные поля
        messages: config.messages?.map(m => ({
            text: String(m.text),
            interval: Number(m.interval) || 0,
        })) || null,
        
        mail_message: config.mailMessage ? {
            title: String(config.mailMessage.title),
            text: String(config.mailMessage.text),
            pictures_number: Array.isArray(config.mailMessage.picturesNumber) 
                ? config.mailMessage.picturesNumber 
                : [],
        } : null,
        
        exclude_ids: Array.isArray(config.excludeIds) ? config.excludeIds : [],
        specific_users: Array.isArray(config.specificUsers) ? config.specificUsers : [],
        limit: Number(config.limit),
        filter_update_limit: Number(config.filterUpdateLimit),
        max_time_minutes: Number(config.maxTimeMinutes) || 180,
    };
    
    // Отправить в Python Service
    const axios = (await import('axios')).default;
    const PYTHON_SERVICE_URL = process.env.SPAMBOT_SERVICE_URL || 'http://localhost:8001';
    
    const response = await axios.post(
        `${PYTHON_SERVICE_URL}/api/distribution/start`,
        fullConfig,
        { timeout: 30000 }
    );
    
    // ... остальной код
}
```

#### 2. Python - models.py

```python
class MessageCreate(BaseModel):
    text: str = Field(..., description="Message text")
    interval: int = Field(0, ge=0, description="Interval in seconds")
    
    class Config:
        extra = "ignore"  # ✅ Игнорировать лишние поля (_id, и т.д.)


class MailMessageCreate(BaseModel):
    title: str = Field(..., min_length=1)
    text: str = Field(..., min_length=150, max_length=3500)
    pictures_number: List[int] = Field(default=[])
    
    class Config:
        extra = "ignore"  # ✅ Игнорировать лишние поля
```

---

## 📝 Дополнительные задачи из фидбека

### 1. Изменить отображение статуса "queued" → "В очереди"

**Файл:** `frontend/src/components/Spambot/DistributionHistory.jsx`

**Текущий код:**
```jsx
<span className="px-2 py-1 text-xs rounded-full ...">
    {distribution.status}
</span>
```

**Исправить на:**
```jsx
const STATUS_LABELS = {
    'running': 'Выполняется',
    'queued': 'В очереди',
    'completed': 'Завершено',
    'stopped': 'Остановлено',
    'error': 'Ошибка'
};

<span className="px-2 py-1 text-xs rounded-full ...">
    {STATUS_LABELS[distribution.status] || distribution.status}
</span>
```

### 2. Добавить кнопку удаления рассылки из очереди

**Backend уже поддерживает:**
- `SpambotQueueService.removeFromQueue()` - метод существует
- Нужно добавить API endpoint и UI кнопку

**API endpoint** - добавить в `backend/src/routes/spambotRoutes.js`:
```javascript
router.delete('/distributions/:id/queue', 
    authMiddleware, 
    SpambotController.removeFromQueue
);
```

**Controller** - добавить в `backend/src/controllers/spambotController.js`:
```javascript
export const removeFromQueue = async (req, res) => {
    try {
        const { id } = req.params;
        await spambotQueueService.removeFromQueue(id, req.user.id, req.user.role);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
```

**Frontend** - добавить кнопку в `DistributionHistory.jsx`:
```jsx
{distribution.status === 'queued' && (
    <button
        onClick={() => handleRemoveFromQueue(distribution.id)}
        className="text-red-600 hover:text-red-700"
        title="Удалить из очереди"
    >
        ✖ Удалить
    </button>
)}
```

---

## 🎯 План исправления

1. ✅ **Критично:** Исправить ошибку 422 в `SpambotQueueService.js`
   - Добавить `.toObject()` для Mongoose объектов
   - Явно приводить типы полей

2. ✅ **Критично:** Добавить `extra = "ignore"` в Python models
   - `MessageCreate`
   - `MailMessageCreate`

3. ✅ **UI:** Русифицировать статусы
   - `queued` → `В очереди`
   - `running` → `Выполняется`
   - `completed` → `Завершено`
   - `stopped` → `Остановлено`
   - `error` → `Ошибка`

4. ✅ **Feature:** Добавить удаление из очереди
   - API endpoint
   - Controller метод
   - UI кнопка

---

## 📊 Итоги

### Причина ошибки 422:
- Mongoose добавляет `_id` в subdocuments
- Python Pydantic не ожидает это поле
- Validation fails → 422 error

### Решение:
- Очищать Mongoose объекты через `.toObject()`
- Явно мапить только нужные поля
- Добавить `extra = "ignore"` в Python models (защита)

### Дополнительно:
- Русифицировать статусы для пользователей
- Добавить функцию удаления из очереди


