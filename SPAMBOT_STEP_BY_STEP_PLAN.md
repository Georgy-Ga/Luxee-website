# 🚀 Spambot Integration - Step by Step Plan

**Дата создания:** 17.07.2026  
**Статус:** 📋 Ready to implement  
**Подход:** Full version поэтапно (маленькими подзадачами)

---

## 📐 Правила реализации

1. ❌ **НЕ удаляем** файлы из `backend-spambot/core/` - они reference для понимания логики
2. ✅ **Используем** `core/src/application/` как образец для frontend компонентов
3. ✅ **Делаем поэтапно** - каждая подзадача = 30-60 минут
4. ✅ **Тестируем каждый этап** перед переходом к следующему
5. ✅ **Full version** но маленькими шагами

---

## 🎯 Общая стратегия

### Фазы разработки:
1. **Фаза 1:** Python Service (базовый API) - 1-2 дня
2. **Фаза 2:** Node.js Integration (proxy + storage) - 1 день
3. **Фаза 3:** Frontend Basic (UI компоненты) - 2 дня
4. **Фаза 4:** Docker + Testing - 1 день
5. **Фаза 5:** Polish + WebSocket - 1 день

**Итого:** 5-7 дней

---

## 📦 ФАЗА 1: Python Service Базовый API

**Цель:** Создать минимальный FastAPI сервис который может запустить рассылку

### ✅ ЭТАП 1.1: Структура проекта (30 минут)

**Задача:** Создать базовую структуру папок и файлов

**Файлы для создания:**
```
backend-spambot/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Docker configuration
├── .env.example              # Environment variables example
├── api/
│   ├── __init__.py
│   ├── routes.py             # API endpoints
│   ├── models.py             # Pydantic schemas
│   └── service.py            # Business logic wrapper
└── core/                      # Существующий spambot код (БЕЗ ИЗМЕНЕНИЙ)
    └── ...
```

**Действия:**
- [ ] Создать папку `backend-spambot/api/`
- [ ] Создать пустые файлы `__init__.py`, `routes.py`, `models.py`, `service.py`
- [ ] Создать `main.py` с базовым FastAPI app
- [ ] Создать `requirements.txt` с зависимостями
- [ ] Создать `.env.example`

**Проверка:** Структура папок создана, файлы существуют

---

### ✅ ЭТАП 1.2: Requirements и базовый FastAPI (45 минут)

**Задача:** Настроить зависимости и создать минимальный работающий API

**requirements.txt должен включать:**
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-dotenv==1.0.0
rpaframework==30.0.2
beautifulsoup4
requests
cryptography
```

**main.py - базовая структура:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

app = FastAPI(title="Luxee Spambot Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "spambot"}
```

**Действия:**
- [ ] Заполнить `requirements.txt`
- [ ] Создать базовый `main.py`
- [ ] Создать `.env.example` с переменными
- [ ] Тест: запустить `uvicorn main:app --reload`
- [ ] Проверить `http://localhost:8000/health`
- [ ] Проверить `http://localhost:8000/docs` (Swagger UI)

**Проверка:** API запускается, `/health` отвечает, Swagger доступен

---

### ✅ ЭТАП 1.3: Pydantic модели (30 минут)

**Задача:** Создать схемы данных для API

**api/models.py структура:**
```python
from pydantic import BaseModel, Field
from typing import List, Optional

class MessageCreate(BaseModel):
    text: str
    interval: int = 0

class MailMessageCreate(BaseModel):
    title: str
    text: str
    pictures_number: List[int] = []

class DistributionConfig(BaseModel):
    # Credentials
    username: str
    password: str
    
    # Profile selection
    profile_uid: str
    profile_name: str
    
    # Distribution type
    distribution_type: str = Field(..., pattern="^(chat|mail)$")
    
    # Filters
    purchased: bool = True
    free: bool = True
    only_empty_chat: bool = False
    only_not_empty_chat: bool = False
    
    # Messages
    messages: Optional[List[MessageCreate]] = None
    mail_message: Optional[MailMessageCreate] = None
    
    # Limits
    exclude_ids: List[int] = []
    specific_users: List[int] = []
    limit: int
    filter_update_limit: int
    max_time_minutes: int = 180

class DistributionStatus(BaseModel):
    status: str  # 'idle', 'running', 'completed', 'error'
    sent_messages_count: int = 0
    skipped_clients: int = 0
    current_client: Optional[str] = None
    error_message: Optional[str] = None
```

**Действия:**
- [ ] Создать все Pydantic модели в `api/models.py`
- [ ] Добавить валидацию полей
- [ ] Добавить примеры (example) для Swagger

**Проверка:** Модели импортируются без ошибок

---

### ✅ ЭТАП 1.4: Service wrapper (1 час)

**Задача:** Обернуть существующий `process.py` в async интерфейс

**api/service.py структура:**
```python
import asyncio
from typing import Dict
from core.src.process import DistributionProcess, extract_profiles
from core.src.models import Distribution, Profile, Message, MailMessage
from api.models import DistributionConfig, DistributionStatus

class SpambotService:
    def __init__(self):
        self.active_processes: Dict[str, DistributionProcess] = {}
        self.statuses: Dict[str, DistributionStatus] = {}
        self._should_stop: Dict[str, bool] = {}
    
    async def start_distribution(self, config: DistributionConfig, distribution_id: str):
        """Запустить рассылку в background"""
        # Создать background task
        task = asyncio.create_task(
            self._run_distribution(config, distribution_id)
        )
        return {"distribution_id": distribution_id, "status": "started"}
    
    async def _run_distribution(self, config: DistributionConfig, distribution_id: str):
        """Внутренний метод для запуска рассылки"""
        try:
            # Обновить статус
            self.statuses[distribution_id] = DistributionStatus(status="running")
            
            # Конвертировать Pydantic модели в spambot модели
            # ... (будет реализовано)
            
            # Запустить процесс
            process = DistributionProcess()
            self.active_processes[distribution_id] = process
            
            # Вызвать существующую логику
            process.start(distribution, config.username, config.password)
            
            # Обновить статус
            self.statuses[distribution_id] = DistributionStatus(
                status="completed",
                sent_messages_count=distribution.sent_messages_count
            )
        except Exception as e:
            self.statuses[distribution_id] = DistributionStatus(
                status="error",
                error_message=str(e)
            )
    
    async def stop_distribution(self, distribution_id: str):
        """Остановить рассылку"""
        self._should_stop[distribution_id] = True
        # Реализация graceful stop
    
    def get_status(self, distribution_id: str) -> DistributionStatus:
        """Получить статус рассылки"""
        return self.statuses.get(distribution_id, DistributionStatus(status="idle"))

# Singleton instance
spambot_service = SpambotService()
```

**Действия:**
- [ ] Создать класс `SpambotService`
- [ ] Реализовать `start_distribution` (базовая версия)
- [ ] Реализовать `get_status`
- [ ] Добавить конвертацию Pydantic → spambot models

**Проверка:** Service создаётся, методы вызываются без ошибок

---

### ✅ ЭТАП 1.5: API Routes (45 минут)

**Задача:** Создать endpoints для управления рассылками

**api/routes.py:**
```python
from fastapi import APIRouter, HTTPException
from api.models import DistributionConfig, DistributionStatus
from api.service import spambot_service
import uuid

router = APIRouter()

@router.post("/distribution/start", response_model=dict)
async def start_distribution(config: DistributionConfig):
    """Запустить рассылку"""
    distribution_id = str(uuid.uuid4())
    result = await spambot_service.start_distribution(config, distribution_id)
    return result

@router.post("/distribution/{distribution_id}/stop")
async def stop_distribution(distribution_id: str):
    """Остановить рассылку"""
    await spambot_service.stop_distribution(distribution_id)
    return {"status": "stopped"}

@router.get("/distribution/{distribution_id}/status", response_model=DistributionStatus)
async def get_status(distribution_id: str):
    """Получить статус рассылки"""
    status = spambot_service.get_status(distribution_id)
    if not status:
        raise HTTPException(status_code=404, detail="Distribution not found")
    return status

@router.get("/profiles")
async def get_profiles(username: str, password: str):
    """Получить список профилей"""
    try:
        from core.src.process import extract_profiles
        profiles = extract_profiles(username, password)
        return {
            "profiles": [
                {
                    "uid": p.owner_uid,
                    "name": p.name,
                    "age": p.age,
                    "location": p.location
                }
                for p in profiles
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Действия:**
- [ ] Создать все endpoints
- [ ] Добавить обработку ошибок
- [ ] Подключить к `main.py`
- [ ] Тест: проверить Swagger UI
- [ ] Тест: вызвать `/api/profiles` с тестовыми данными

**Проверка:** Все endpoints видны в Swagger, `/profiles` работает

---

## 🎯 КОНТРОЛЬНАЯ ТОЧКА 1

**Что должно работать:**
- ✅ FastAPI сервис запускается
- ✅ Swagger UI доступен
- ✅ `/health` endpoint отвечает
- ✅ `/api/profiles` возвращает профили
- ✅ `/api/distribution/start` принимает конфигурацию
- ✅ `/api/distribution/{id}/status` возвращает статус

**Тест:** Запустить сервис и вызвать все endpoints через Swagger UI

**Время на Фазу 1:** ~3-4 часа чистого времени

---

## 📦 ФАЗА 2: Node.js Integration

**Цель:** Создать proxy между frontend и Python service + хранение в MongoDB

### ✅ ЭТАП 2.1: MongoDB модели (30 минут)

**Задача:** Создать схемы для хранения конфигураций рассылок

**Файл:** `backend/src/models/SpambotDistributionModel.js`

**Структура модели:**
```javascript
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    text: { type: String, required: true },
    interval: { type: Number, default: 0 }
});

const MailMessageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, required: true },
    pictures_number: [Number]
});

const SpambotDistributionSchema = new mongoose.Schema({
    // Owner
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    accountId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'LuxeeAccount', 
        required: true 
    },
    
    // Profile
    profileUid: { type: String, required: true },
    profileName: { type: String, required: true },
    
    // Distribution type
    distributionType: { 
        type: String, 
        enum: ['chat', 'mail'], 
        required: true 
    },
    
    // Filters
    purchased: { type: Boolean, default: true },
    free: { type: Boolean, default: true },
    onlyEmptyChat: { type: Boolean, default: false },
    onlyNotEmptyChat: { type: Boolean, default: false },
    
    // Messages
    messages: [MessageSchema],
    mailMessage: MailMessageSchema,
    
    // Limits
    excludeIds: [Number],
    specificUsers: [Number],
    limit: { type: Number, required: true },
    filterUpdateLimit: { type: Number, required: true },
    maxTimeMinutes: { type: Number, default: 180 },
    
    // Status tracking
    status: { 
        type: String, 
        enum: ['idle', 'running', 'completed', 'error', 'stopped'], 
        default: 'idle' 
    },
    pythonDistributionId: String,  // ID в Python service
    sentMessagesCount: { type: Number, default: 0 },
    skippedClients: { type: Number, default: 0 },
    errorMessage: String,
    
    // Timestamps
    startedAt: Date,
    completedAt: Date
}, {
    timestamps: true
});

export default mongoose.model('SpambotDistribution', SpambotDistributionSchema);
```

**Действия:**
- [ ] Создать файл модели
- [ ] Добавить все поля из GUI
- [ ] Добавить индексы для быстрого поиска
- [ ] Экспортировать модель

**Проверка:** Модель импортируется без ошибок

---

### ✅ ЭТАП 2.2: Spambot Service (Node.js) (1 час)

**Задача:** Создать сервис для работы с Python API

**Файл:** `backend/src/services/spambotService.js`

```javascript
import axios from 'axios';
import SpambotDistributionModel from '../models/SpambotDistributionModel.js';

const PYTHON_SERVICE_URL = process.env.SPAMBOT_SERVICE_URL || 'http://localhost:8000';

class SpambotService {
    
    async startDistribution(userId, accountId, config) {
        // 1. Получить credentials из LuxeeAccount
        const account = await LuxeeAccountModel.findById(accountId);
        if (!account) {
            throw new Error('Account not found');
        }
        
        // 2. Создать запись в MongoDB
        const distribution = await SpambotDistributionModel.create({
            userId,
            accountId,
            ...config,
            status: 'idle'
        });
        
        // 3. Вызвать Python service
        try {
            const response = await axios.post(
                `${PYTHON_SERVICE_URL}/api/distribution/start`,
                {
                    username: account.luxeeEmail,
                    password: account.luxeePassword,  // Нужно расшифровать!
                    profile_uid: config.profileUid,
                    profile_name: config.profileName,
                    distribution_type: config.distributionType,
                    purchased: config.purchased,
                    free: config.free,
                    only_empty_chat: config.onlyEmptyChat,
                    only_not_empty_chat: config.onlyNotEmptyChat,
                    messages: config.messages,
                    mail_message: config.mailMessage,
                    exclude_ids: config.excludeIds,
                    specific_users: config.specificUsers,
                    limit: config.limit,
                    filter_update_limit: config.filterUpdateLimit,
                    max_time_minutes: config.maxTimeMinutes
                }
            );
            
            // 4. Сохранить Python distribution ID
            distribution.pythonDistributionId = response.data.distribution_id;
            distribution.status = 'running';
            distribution.startedAt = new Date();
            await distribution.save();
            
            return distribution;
        } catch (error) {
            distribution.status = 'error';
            distribution.errorMessage = error.message;
            await distribution.save();
            throw error;
        }
    }
    
    async stopDistribution(distributionId) {
        const distribution = await SpambotDistributionModel.findById(distributionId);
        if (!distribution || !distribution.pythonDistributionId) {
            throw new Error('Distribution not found');
        }
        
        // Вызвать Python service
        await axios.post(
            `${PYTHON_SERVICE_URL}/api/distribution/${distribution.pythonDistributionId}/stop`
        );
        
        distribution.status = 'stopped';
        distribution.completedAt = new Date();
        await distribution.save();
        
        return distribution;
    }
    
    async getStatus(distributionId) {
        const distribution = await SpambotDistributionModel.findById(distributionId);
        if (!distribution || !distribution.pythonDistributionId) {
            return distribution;
        }
        
        // Получить статус из Python service
        try {
            const response = await axios.get(
                `${PYTHON_SERVICE_URL}/api/distribution/${distribution.pythonDistributionId}/status`
            );
            
            // Обновить статус в MongoDB
            distribution.status = response.data.status;
            distribution.sentMessagesCount = response.data.sent_messages_count;
            distribution.skippedClients = response.data.skipped_clients;
            
            if (response.data.status === 'completed' || response.data.status === 'error') {
                distribution.completedAt = new Date();
            }
            
            await distribution.save();
        } catch (error) {
            console.error('[Spambot Service] Error getting status:', error);
        }
        
        return distribution;
    }
    
    async getUserDistributions(userId) {
        return await SpambotDistributionModel.find({ userId })
            .sort({ createdAt: -1 })
            .populate('accountId', 'luxeeEmail profileName');
    }
}

export default new SpambotService();
```

**Действия:**
- [ ] Создать `SpambotService` класс
- [ ] Реализовать `startDistribution`
- [ ] Реализовать `stopDistribution`
- [ ] Реализовать `getStatus`
- [ ] Реализовать `getUserDistributions`
- [ ] Добавить обработку ошибок

**Проверка:** Service экспортируется, методы вызываются

---

### ✅ ЭТАП 2.3: Spambot Controller (45 минут)

**Задача:** Создать контроллер для API endpoints

**Файл:** `backend/src/controllers/spambotController.js`

```javascript
import spambotService from '../services/spambotService.js';

class SpambotController {
    
    async startDistribution(req, res) {
        try {
            const { accountId, config } = req.body;
            const userId = req.user.id;
            
            const distribution = await spambotService.startDistribution(
                userId,
                accountId,
                config
            );
            
            res.json({
                success: true,
                distribution
            });
        } catch (error) {
            console.error('[Spambot Controller] Start error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async stopDistribution(req, res) {
        try {
            const { distributionId } = req.params;
            const userId = req.user.id;
            
            const distribution = await spambotService.stopDistribution(distributionId);
            
            // Проверка прав доступа
            if (distribution.userId.toString() !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            res.json({
                success: true,
                distribution
            });
        } catch (error) {
            console.error('[Spambot Controller] Stop error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async getStatus(req, res) {
        try {
            const { distributionId } = req.params;
            const distribution = await spambotService.getStatus(distributionId);
            
            res.json({
                success: true,
                distribution
            });
        } catch (error) {
            console.error('[Spambot Controller] Get status error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async getMyDistributions(req, res) {
        try {
            const userId = req.user.id;
            const distributions = await spambotService.getUserDistributions(userId);
            
            res.json({
                success: true,
                distributions
            });
        } catch (error) {
            console.error('[Spambot Controller] Get distributions error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    // Admin endpoints
    async getAllDistributions(req, res) {
        try {
            const distributions = await SpambotDistributionModel.find()
                .populate('userId', 'username email')
                .populate('accountId', 'luxeeEmail')
                .sort({ createdAt: -1 });
            
            res.json({
                success: true,
                distributions
            });
        } catch (error) {
            console.error('[Spambot Controller] Get all distributions error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new SpambotController();
```

**Действия:**
- [ ] Создать контроллер
- [ ] Реализовать все методы
- [ ] Добавить проверку прав доступа
- [ ] Добавить обработку ошибок

**Проверка:** Контроллер экспортируется

---

### ✅ ЭТАП 2.4: Routes (30 минут)

**Задача:** Добавить endpoints в роутер

**Обновить:** `backend/src/routes/index.js`

```javascript
// Добавить импорт
import SpambotController from '../controllers/spambotController.js';

// Добавить routes (после AI routes)

// Spambot routes - User
router.post('/spambot/distributions/start', authMiddleware, SpambotController.startDistribution);
router.post('/spambot/distributions/:distributionId/stop', authMiddleware, SpambotController.stopDistribution);
router.get('/spambot/distributions/:distributionId/status', authMiddleware, SpambotController.getStatus);
router.get('/spambot/my-distributions', authMiddleware, SpambotController.getMyDistributions);

// Spambot routes - Admin
router.get('/spambot/distributions', authMiddleware, roleMiddleware('admin'), SpambotController.getAllDistributions);
```

**Действия:**
- [ ] Добавить импорт контроллера
- [ ] Добавить все routes
- [ ] Проверить middleware (auth + role)

**Проверка:** Routes добавлены, backend компилируется

---

## 🎯 КОНТРОЛЬНАЯ ТОЧКА 2

**Что должно работать:**
- ✅ Node.js backend запускается
- ✅ Новые routes доступны
- ✅ MongoDB модель создана
- ✅ Service может вызвать Python API
- ✅ Controller обрабатывает запросы

**Тест:** 
1. Запустить Python service
2. Запустить Node.js backend
3. Вызвать `/api/spambot/distributions/start` через Postman

**Время на Фазу 2:** ~2-3 часа чистого времени

---

## 📦 ФАЗА 3: Frontend Basic UI

**Цель:** Создать базовый UI для управления рассылками

*[Будет добавлено в следующей части]*

---

**Текущий прогресс документа:** Фаза 1 и 2 детализированы
**Следующий шаг:** Детализация Фазы 3 (Frontend), Фазы 4 (Docker), Фазы 5 (Polish)
