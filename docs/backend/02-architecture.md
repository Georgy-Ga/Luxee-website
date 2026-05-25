# Architecture

## Общая архитектура проекта

Проект построен по **модульной архитектуре** с разделением на слои:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│                  HTTP/WebSocket Requests                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Express.js Server                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Routes & Middleware                  │  │
│  │  (authMiddleware, roleMiddleware, errorMiddleware)│  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │               Controllers                         │  │
│  │  (userController, luxeeController, aiController)  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │                Services                           │  │
│  │  (Business Logic Layer)                           │  │
│  └──────────────────┬───────────────────────────────┘  │
└────────────────────┬┴───────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼────────────┐
│   MongoDB    │ │Playwright│ │ OpenRouter API│
│  (Mongoose)  │ │ Browser  │ │   (AI API)    │
└──────────────┘ └──────────┘ └───────────────┘
```

## Структура папок

```
backend/
├── index.js                    # Точка входа, запуск сервера
├── createAdmin.js              # Скрипт создания админа
├── package.json
│
└── src/
    ├── controllers/            # Контроллеры (обработка HTTP запросов)
    │   ├── userController.js
    │   ├── luxeeController.js
    │   ├── aiController.js
    │   └── aiManagementController/
    │       ├── index.js
    │       ├── rulesController.js
    │       ├── userAiController.js
    │       └── accountAiController.js
    │
    ├── services/               # Бизнес-логика
    │   ├── userService.js
    │   ├── tokenService.js
    │   ├── aiRuleService.js
    │   ├── answeredChatService.js
    │   ├── aiResponseService.js
    │   │
    │   ├── browser/            # Браузерная автоматизация
    │   │   ├── browserService.js
    │   │   ├── pageHelpers.js
    │   │   ├── requestQueueService.js
    │   │   ├── contextRecoveryService.js
    │   │   └── aiBrowserContextService.js
    │   │
    │   ├── luxeeApi/           # Интеграция с Luxee.io
    │   │   ├── luxeeAuthService/
    │   │   │   ├── index.js
    │   │   │   ├── loginService.js
    │   │   │   ├── sessionService.js
    │   │   │   └── accountService.js
    │   │   │
    │   │   ├── messageCheckService/
    │   │   │   ├── index.js
    │   │   │   ├── checkAllMessages.js
    │   │   │   ├── checkAccountMessages.js
    │   │   │   └── profileDataExtractor.js
    │   │   │
    │   │   ├── profileParserService/
    │   │   │   ├── index.js
    │   │   │   ├── profileExtractor.js
    │   │   │   ├── chatExtractor.js
    │   │   │   └── messageExtractor.js
    │   │   │
    │   │   ├── messageCheckIntervalService.js
    │   │   ├── messageSendService.js
    │   │   ├── profileChatsLoadService.js
    │   │   ├── chatOpenService.js
    │   │   ├── profileActivationService.js
    │   │   ├── keepAliveService.js
    │   │   └── chatNavigationService.js
    │   │
    │   ├── aiService/          # AI генерация ответов
    │   │   ├── index.js
    │   │   ├── config.js
    │   │   ├── promptBuilder.js
    │   │   ├── apiClient.js
    │   │   ├── responseGenerator.js
    │   │   ├── responseValidator.js
    │   │   └── testService.js
    │   │
    │   └── aiManagementService/  # Управление AI
    │       ├── index.js
    │       ├── userAiService.js
    │       └── accountAiService.js
    │
    ├── models/                 # Mongoose модели
    │   ├── UserModel.js
    │   ├── TokenModel.js
    │   ├── LuxeeAccountModel.js
    │   ├── AiRule.js
    │   └── AnsweredChat.js
    │
    ├── middleware/             # Express middleware
    │   ├── authMiddleware.js
    │   ├── roleMiddleware.js
    │   └── errorMiddleware.js
    │
    ├── routes/                 # Маршруты API
    │   └── index.js
    │
    ├── dtos/                   # Data Transfer Objects
    │   └── UserDto.js
    │
    └── exceptions/             # Кастомные ошибки
        └── apiError.js
```

## Слои архитектуры

### 1. Routes Layer (Маршруты)
**Файл**: `src/routes/index.js`

**Ответственность**:
- Определение API эндпоинтов
- Применение middleware (auth, role, validation)
- Маршрутизация запросов к контроллерам

**Пример**:
```javascript
router.post('/luxee/login', authMiddleware, LuxeeController.login);
router.get('/ai/rules', authMiddleware, AiManagementController.getRules);
```

### 2. Middleware Layer
**Файлы**: `src/middleware/*`

**Компоненты**:
- **authMiddleware** - Проверка JWT токена
- **roleMiddleware** - Проверка роли пользователя (admin/user)
- **errorMiddleware** - Централизованная обработка ошибок

### 3. Controllers Layer (Контроллеры)
**Файлы**: `src/controllers/*`

**Ответственность**:
- Обработка HTTP запросов
- Валидация входных данных
- Вызов сервисов
- Формирование HTTP ответов

**Контроллеры**:
- **userController** - Регистрация, логин, управление пользователями
- **luxeeController** - Работа с Luxee аккаунтами, сообщениями, чатами
- **aiController** - Тестирование AI, получение промптов
- **aiManagementController** - Управление AI правилами, пользователями, аккаунтами

### 4. Services Layer (Сервисы)
**Файлы**: `src/services/*`

**Ответственность**:
- Бизнес-логика приложения
- Взаимодействие с базой данных
- Интеграция с внешними API
- Браузерная автоматизация

**Основные группы сервисов**:

#### 4.1 User Services
- **userService** - CRUD операции с пользователями
- **tokenService** - Генерация и валидация JWT токенов
- **aiRuleService** - Управление AI правилами

#### 4.2 Browser Services
- **browserService** - Управление Playwright браузером и контекстами
- **pageHelpers** - Вспомогательные функции для работы со страницами
- **requestQueueService** - Очередь запросов (предотвращение конфликтов)
- **contextRecoveryService** - Восстановление контекстов после перезапуска
- **aiBrowserContextService** - Управление отдельными AI контекстами

#### 4.3 Luxee API Services
- **luxeeAuthService** - Авторизация на Luxee.io
- **messageCheckService** - Проверка новых сообщений
- **messageCheckIntervalService** - Автоматическая проверка каждые 8 сек
- **profileParserService** - Извлечение данных профилей и чатов
- **messageSendService** - Отправка сообщений
- **chatOpenService** - Открытие чатов
- **profileChatsLoadService** - Загрузка чатов профиля
- **keepAliveService** - Поддержание активности (каждые 45 сек)
- **profileActivationService** - Активация профилей

#### 4.4 AI Services
- **aiService** - Генерация AI ответов через OpenRouter API
- **aiResponseService** - Полный цикл: генерация + отправка AI ответов
- **aiManagementService** - Управление AI для пользователей и аккаунтов

#### 4.5 Data Services
- **answeredChatService** - Работа с отвеченными чатами в MongoDB

### 5. Models Layer (Модели данных)
**Файлы**: `src/models/*`

**Mongoose модели**:
- **UserModel** - Пользователи системы
- **TokenModel** - Refresh токены
- **LuxeeAccountModel** - Luxee аккаунты
- **AiRule** - Кастомные AI правила
- **AnsweredChat** - Отвеченные чаты (до 5 на профиль)

## Ключевые паттерны

### 1. Singleton Pattern
**Где**: `browserService`, `requestQueueService`

Один экземпляр браузера и одна очередь запросов на всё приложение.

```javascript
let browser = null;
const getBrowser = async () => {
  if (!browser) {
    browser = await chromium.launch({ headless: false });
  }
  return browser;
};
```

### 2. Queue Pattern
**Где**: `requestQueueService`

Все операции с чатами выполняются последовательно через очередь.

```javascript
const queue = [];
let isProcessing = false;

const addToQueue = async (task) => {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    processQueue();
  });
};
```

### 3. Context Isolation Pattern
**Где**: `browserService`, `aiBrowserContextService`

Каждый Luxee аккаунт работает в отдельном браузерном контексте. AI работает в своём отдельном контексте.

```javascript
// Основной контекст для пользователя
const mainContext = await browser.newContext({ storageState });

// Отдельный AI контекст для параллельной работы
const aiContext = await browser.newContext({ storageState });
```

### 4. Service Layer Pattern
Контроллеры не содержат бизнес-логику, только вызывают сервисы.

```javascript
// Controller
static async login(req, res, next) {
  const result = await luxeeAuthService.login({ userId, luxeeEmail, luxeePassword });
  res.json(result);
}

// Service
const login = async ({ userId, luxeeEmail, luxeePassword }) => {
  // Вся бизнес-логика здесь
};
```

### 5. Middleware Chain Pattern
Последовательное применение middleware для проверок.

```javascript
router.post('/registration',
  body('password').isLength({ min: 3, max: 32 }),
  authMiddleware,
  roleMiddleware('admin'),
  UserController.registration
);
```

## Потоки данных

### Поток 1: Авторизация пользователя
```
1. POST /api/login
2. userController.login()
3. userService.login()
   - Проверка email/password в MongoDB
   - Генерация JWT токенов
4. Сохранение refresh token в MongoDB
5. Возврат access + refresh токенов
```

### Поток 2: Добавление Luxee аккаунта
```
1. POST /api/luxee/login
2. luxeeController.login()
3. luxeeAuthService.login()
   - browserService.getOrCreateContext()
   - Playwright: открытие luxee.io
   - loginService.performLogin()
   - sessionService.saveSession()
   - profileActivationService.activateFirstProfile()
4. keepAliveService.start() → каждые 45 сек
5. messageCheckIntervalService.start() → каждые 8 сек
6. Сохранение в MongoDB
```

### Поток 3: Проверка новых сообщений (автоматическая)
```
1. messageCheckIntervalService (каждые 8 сек)
2. checkAllMessages.checkAllUserMessages()
3. Для каждого аккаунта:
   - profileParserService.getProfiles()
   - Для активного профиля:
     - chatExtractor.getProfileChatsWithUnanswered()
4. Если AI включен:
   - aiResponseService.generateAndSend()
   - aiService.generateResponse() → OpenRouter API
   - aiResponseService.sendResponse() → через AI контекст
   - answeredChatService.saveAnsweredChat()
```

### Поток 4: Отправка сообщения пользователем
```
1. POST /api/luxee/messages/send
2. luxeeController.sendMessage()
3. requestQueueService.addToQueue()
4. messageSendService.sendMessage()
   - page.evaluate() → modelsChat.selectProfile()
   - page.evaluate() → modelsChat.selectChat()
   - page.evaluate() → modelsChat.sendMessage()
5. Проверка unAnswered статуса
6. Если unAnswered === false:
   - answeredChatService.saveAnsweredChat()
```

## Критические зависимости

### Внешние зависимости
1. **MongoDB** - Хранение всех данных
2. **Luxee.io** - Платформа для работы (через JavaScript API `modelsChat`)
3. **OpenRouter API** - AI генерация ответов

### Внутренние зависимости
1. **browserService** ← Все Luxee сервисы зависят от браузера
2. **requestQueueService** ← Все операции с чатами идут через очередь
3. **aiManagementService** ← AI проверяет права перед генерацией

## Масштабируемость

### Текущие ограничения
1. **Один браузер на сервер** - Все контексты в одном Playwright браузере
2. **Последовательная очередь** - Операции с чатами выполняются по одной
3. **Polling каждые 8 сек** - Нет WebSocket для real-time обновлений

### Возможности масштабирования
1. **Горизонтальное** - Несколько серверов с балансировщиком
2. **Вертикальное** - Больше RAM для большего количества контекстов
3. **Кэширование** - Redis для сессий и частых запросов
4. **WebSocket** - Real-time обновления вместо polling

## Безопасность

### Реализованные меры
1. **JWT аутентификация** - Access (300 мин) + Refresh (30 дней) токены
2. **Role-based access** - Разделение admin/user
3. **Password hashing** - bcrypt с salt=3
4. **CORS** - Ограничение origins
5. **Изоляция контекстов** - Каждый аккаунт в своём контексте

### Потенциальные уязвимости
См. [Security](./08-security.md)

## Следующий шаг

Изучите [Services](./03-services.md) для детального понимания каждого сервиса.
