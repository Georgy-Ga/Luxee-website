# Проблемы и решения

## Архитектурные проблемы

### 🔴 КРИТИЧЕСКАЯ: Отсутствие обработки ошибок браузера

**Проблема**: Если браузер крашится или контекст закрывается, система не восстанавливается автоматически.

**Где**: `browserService.js`, все Luxee сервисы

**Сценарий**:
```
1. Браузер крашится (OOM, crash)
2. Все контексты теряются
3. API запросы начинают падать с ошибками
4. Пользователь не может работать
5. Нужен ручной перезапуск сервера
```

**Решение**:
```javascript
// browserService.js
let browser = null;
let browserCrashed = false;

async function getBrowser() {
  if (browserCrashed || !browser || !browser.isConnected()) {
    console.log('[Browser] Recreating browser...');
    browserCrashed = false;
    
    try {
      if (browser) {
        await browser.close().catch(() => {});
      }
    } catch (e) {}
    
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Обработка краша
    browser.on('disconnected', () => {
      console.error('[Browser] Browser disconnected!');
      browserCrashed = true;
      browser = null;
      
      // Уведомить все активные контексты
      notifyContextsAboutCrash();
    });
  }
  
  return browser;
}

// Автоматическое восстановление контекстов
async function notifyContextsAboutCrash() {
  const accounts = await LuxeeAccountModel.find({ isActive: true });
  
  for (const account of accounts) {
    try {
      console.log(`[Browser] Auto-recovering context for ${account._id}`);
      await contextRecoveryService.recoverContext(account._id);
    } catch (error) {
      console.error(`[Browser] Failed to recover ${account._id}:`, error);
    }
  }
}
```

### 🔴 КРИТИЧЕСКАЯ: Race Condition в requestQueueService

**Проблема**: Очередь может обрабатывать задачи параллельно при быстрых запросах.

**Где**: `requestQueueService.js`

**Текущий код**:
```javascript
const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true; // ← Не атомарная операция!
  const { task, resolve, reject } = queue.shift();
  
  try {
    const result = await task();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isProcessing = false;
    processQueue(); // Рекурсивный вызов
  }
};
```

**Проблема**: Между проверкой `isProcessing` и установкой `true` может пройти время.

**Решение**:
```javascript
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = null; // Promise текущей задачи
  }
  
  async addToQueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    // Если уже обрабатываем, ждём завершения
    if (this.processing) {
      await this.processing;
    }
    
    // Если очередь пуста, выходим
    if (this.queue.length === 0) {
      return;
    }
    
    // Берём задачу
    const { task, resolve, reject } = this.queue.shift();
    
    // Создаём Promise для текущей задачи
    this.processing = (async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.processing = null;
        // Обрабатываем следующую задачу
        this.processQueue();
      }
    })();
  }
}
```

### 🟡 СРЕДНЯЯ: Утечка памяти в messageCheckIntervalService

**Проблема**: Интервалы не очищаются при удалении аккаунта.

**Где**: `messageCheckIntervalService.js`

**Текущий код**:
```javascript
const intervals = new Map();

const start = (accountId) => {
  const interval = setInterval(async () => {
    await checkMessages(accountId);
  }, 8000);
  
  intervals.set(accountId, interval);
};

const stop = (accountId) => {
  const interval = intervals.get(accountId);
  if (interval) {
    clearInterval(interval);
    intervals.delete(accountId);
  }
};
```

**Проблема**: Если `stop()` не вызывается, интервал продолжает работать.

**Решение**:
```javascript
class MessageCheckService {
  constructor() {
    this.intervals = new Map();
    this.activeChecks = new Map(); // Отслеживание активных проверок
  }
  
  start(accountId) {
    // Остановить предыдущий интервал если есть
    this.stop(accountId);
    
    const interval = setInterval(async () => {
      // Проверить что аккаунт всё ещё активен
      const account = await LuxeeAccountModel.findById(accountId);
      if (!account || !account.isActive) {
        console.log(`[Message Check] Account ${accountId} inactive, stopping`);
        this.stop(accountId);
        return;
      }
      
      // Предотвратить параллельные проверки
      if (this.activeChecks.has(accountId)) {
        console.log(`[Message Check] Previous check still running for ${accountId}`);
        return;
      }
      
      this.activeChecks.set(accountId, true);
      
      try {
        await checkMessages(accountId);
      } catch (error) {
        console.error(`[Message Check] Error for ${accountId}:`, error);
      } finally {
        this.activeChecks.delete(accountId);
      }
    }, 8000);
    
    this.intervals.set(accountId, interval);
    console.log(`[Message Check] Started for ${accountId}`);
  }
  
  stop(accountId) {
    const interval = this.intervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(accountId);
      this.activeChecks.delete(accountId);
      console.log(`[Message Check] Stopped for ${accountId}`);
    }
  }
  
  stopAll() {
    for (const [accountId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.activeChecks.clear();
    console.log('[Message Check] Stopped all intervals');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  messageCheckService.stopAll();
  process.exit(0);
});
```

### 🟡 СРЕДНЯЯ: Нет таймаутов для page.evaluate()

**Проблема**: `page.evaluate()` может зависнуть навсегда.

**Где**: Все Luxee сервисы (profileParser, messageCheck, messageSend и т.д.)

**Текущий код**:
```javascript
const result = await page.evaluate(() => {
  // Может зависнуть если modelsChat не загрузился
  return modelsChat.getProfiles();
});
```

**Решение**:
```javascript
// pageHelpers.js
async function evaluateWithTimeout(page, fn, args, timeout = 10000) {
  return Promise.race([
    page.evaluate(fn, args),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Evaluate timeout')), timeout)
    )
  ]);
}

// Использование
const result = await evaluateWithTimeout(
  page,
  () => modelsChat.getProfiles(),
  null,
  10000
);
```

### 🟡 СРЕДНЯЯ: Хардкод задержек (setTimeout)

**Проблема**: Везде используются фиксированные задержки (500ms, 1000ms, 2000ms).

**Где**: Все Luxee сервисы

**Примеры**:
```javascript
await new Promise(resolve => setTimeout(resolve, 1000)); // Почему 1000?
await new Promise(resolve => setTimeout(resolve, 500));  // Почему 500?
await new Promise(resolve => setTimeout(resolve, 2000)); // Почему 2000?
```

**Проблема**: 
- Слишком долго для быстрых операций
- Слишком быстро для медленных операций
- Нет адаптации к скорости сети

**Решение**:
```javascript
// pageHelpers.js
async function waitForCondition(page, condition, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await page.evaluate(condition);
      if (result) {
        return true;
      }
    } catch (e) {}
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Condition timeout');
}

// Использование вместо фиксированных задержек
await waitForCondition(
  page,
  () => typeof modelsChat !== 'undefined' && modelsChat.getProfiles,
  5000
);

// Вместо setTimeout(1000) после selectProfile
await waitForCondition(
  page,
  () => modelsChat.getChats && modelsChat.getChats.list,
  3000
);
```

### 🟢 НИЗКАЯ: Дублирование кода в profileParserService

**Проблема**: Одинаковая логика в `profileExtractor`, `chatExtractor`, `messageExtractor`.

**Где**: `profileParserService/*`

**Дублирование**:
```javascript
// В каждом файле:
if (!chatNavigationService.isOnChatsPage(page)) {
  await chatNavigationService.navigateToChats({ page });
}

return new Promise(resolve => {
  setTimeout(() => {
    // Логика
  }, 1000);
});
```

**Решение**:
```javascript
// profileParserService/baseExtractor.js
class BaseExtractor {
  async ensureOnChatsPage(page) {
    if (!chatNavigationService.isOnChatsPage(page)) {
      await chatNavigationService.navigateToChats({ page });
    }
  }
  
  async evaluateWithDelay(page, fn, args, delay = 1000) {
    return page.evaluate(
      ({ fn, args, delay }) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const result = eval(`(${fn})`)(args);
            resolve(result);
          }, delay);
        });
      },
      { fn: fn.toString(), args, delay }
    );
  }
}

// profileExtractor.js
class ProfileExtractor extends BaseExtractor {
  async getProfiles(page) {
    await this.ensureOnChatsPage(page);
    return this.evaluateWithDelay(page, () => {
      return modelsChat.getProfiles();
    });
  }
}
```

## Неиспользуемый код

### ❌ УДАЛИТЬ: Устаревшие scraper методы

**Файлы**: 
- `luxeeController.getProfiles()` - строки 89-110
- `luxeeController.getPageContent()` - строки 112-133

**Причина**: Используется новый `profileParserService` через JavaScript API.

**Код для удаления**:
```javascript
// luxeeController.js - УДАЛИТЬ
static async getProfiles(req, res, next) {
  // ... весь метод
}

static async getPageContent(req, res, next) {
  // ... весь метод
}

// routes/index.js - УДАЛИТЬ
router.get('/luxee/profiles', authMiddleware, LuxeeController.getProfiles);
router.get('/luxee/page-content', authMiddleware, LuxeeController.getPageContent);
```

### ❌ УДАЛИТЬ: Неиспользуемый import в tokenService

**Файл**: `tokenService.js` строка 3

**Код**:
```javascript
import { validate } from 'uuid'; // ← Нигде не используется
```

**Решение**: Удалить эту строку.

### ❌ УДАЛИТЬ: testRefactored.js

**Файл**: `backend/testRefactored.js`

**Причина**: Тестовый файл, не используется в продакшене.

**Решение**: Удалить файл или переместить в `backend/tests/`.

### ❌ УДАЛИТЬ: Неиспользуемые функции в chatNavigationService

**Файл**: `chatNavigationService.js`

**Проблема**: Файл не найден в структуре, но импортируется в других файлах.

**Где импортируется**:
- `profileExtractor.js` строка 2
- `chatExtractor.js` строка 2
- `messageExtractor.js` строка 2

**Решение**: Либо создать файл, либо удалить импорты и использовать прямые проверки.

## Потенциальные проблемы

### ⚠️ ВНИМАНИЕ: Слабое хеширование паролей

**Проблема**: bcrypt с salt=3 слишком слабый.

**Где**: `userService.js` строка 15

**Текущий код**:
```javascript
const hashPassword = await bcrypt.hash(password, 3); // ← Слишком мало!
```

**Рекомендация**: Минимум 10, оптимально 12.

**Решение**:
```javascript
const hashPassword = await bcrypt.hash(password, 12);
```

### ⚠️ ВНИМАНИЕ: JWT токены живут слишком долго

**Проблема**: Access token живёт 300 минут (5 часов).

**Где**: `tokenService.js` строка 7

**Текущий код**:
```javascript
const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
  expiresIn: '300m', // ← 5 часов!
});
```

**Рекомендация**: Access token должен жить 15-30 минут.

**Решение**:
```javascript
const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
  expiresIn: '15m', // 15 минут
});
```

### ⚠️ ВНИМАНИЕ: Нет rate limiting

**Проблема**: API не защищён от брутфорса и DDoS.

**Где**: Отсутствует middleware

**Решение**:
```javascript
// npm install express-rate-limit
import rateLimit from 'express-rate-limit';

// Общий лимит
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов
  message: 'Too many requests'
});

// Лимит для логина
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 попыток
  message: 'Too many login attempts'
});

app.use('/api', generalLimiter);
app.use('/api/login', loginLimiter);
```

### ⚠️ ВНИМАНИЕ: Нет валидации входных данных

**Проблема**: Только для пароля при регистрации, остальное не валидируется.

**Где**: `routes/index.js`

**Текущая валидация**:
```javascript
router.post(
  '/registration',
  body('password').isLength({ min: 3, max: 32 }), // ← Только пароль!
  authMiddleware,
  roleMiddleware('admin'),
  UserController.registration,
);
```

**Решение**:
```javascript
import { body, query, param } from 'express-validator';

// Валидация для всех эндпоинтов
router.post(
  '/registration',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 32 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  authMiddleware,
  roleMiddleware('admin'),
  UserController.registration,
);

router.post(
  '/luxee/login',
  body('luxeeEmail').isEmail(),
  body('luxeePassword').notEmpty(),
  authMiddleware,
  LuxeeController.login
);

router.post(
  '/luxee/messages/send',
  body('accountId').isMongoId(),
  body('profileUid').isInt(),
  body('memberUid').isInt(),
  body('text').isLength({ min: 1, max: 1000 }),
  authMiddleware,
  LuxeeController.sendMessage
);
```

### ⚠️ ВНИМАНИЕ: Нет логирования

**Проблема**: Только console.log, нет структурированных логов.

**Решение**:
```javascript
// npm install winston
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Использование
logger.info('User logged in', { userId, email });
logger.error('Failed to send message', { error, accountId, chatId });
```

### ⚠️ ВНИМАНИЕ: Нет мониторинга здоровья системы

**Проблема**: Невозможно узнать состояние системы без логов.

**Решение**:
```javascript
// Эндпоинт для health check
router.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    services: {}
  };
  
  // Проверка MongoDB
  try {
    await mongoose.connection.db.admin().ping();
    health.services.mongodb = 'ok';
  } catch (error) {
    health.services.mongodb = 'error';
    health.status = 'degraded';
  }
  
  // Проверка браузера
  try {
    const browser = await browserService.getBrowser();
    health.services.browser = browser.isConnected() ? 'ok' : 'error';
  } catch (error) {
    health.services.browser = 'error';
    health.status = 'degraded';
  }
  
  // Проверка OpenRouter API
  try {
    await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
      timeout: 5000
    });
    health.services.openrouter = 'ok';
  } catch (error) {
    health.services.openrouter = 'error';
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Метрики
router.get('/metrics', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const metrics = {
    activeAccounts: await LuxeeAccountModel.countDocuments({ isActive: true }),
    totalUsers: await UserModel.countDocuments(),
    browserContexts: browserService.getActiveContextsCount(),
    queueLength: requestQueueService.getQueueLength(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  };
  
  res.json(metrics);
});
```

## Приоритеты исправления

### 🔴 Критические (исправить немедленно)
1. Обработка краша браузера
2. Race condition в requestQueueService
3. Таймауты для page.evaluate()

### 🟡 Средние (исправить в течение недели)
1. Утечка памяти в messageCheckIntervalService
2. Удалить неиспользуемый код
3. Добавить rate limiting
4. Улучшить валидацию

### 🟢 Низкие (исправить когда будет время)
1. Рефакторинг дублирования кода
2. Структурированное логирование
3. Health check эндпоинты
4. Мониторинг метрик

## Заключение

Система работает, но требует серьёзных улучшений для продакшена:
1. Обработка ошибок и восстановление
2. Безопасность (rate limiting, валидация, хеширование)
3. Мониторинг и логирование
4. Удаление неиспользуемого кода
5. Рефакторинг дублирования

Рекомендуется исправить критические проблемы перед запуском в продакшен.
