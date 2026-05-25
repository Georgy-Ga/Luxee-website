# AI System - Детальный анализ нейронной сети

## ⚠️ КРИТИЧЕСКИ ВАЖНО

Это **НЕ** локальная нейронная сеть. Система использует **внешний API OpenRouter** для доступа к различным LLM моделям (Claude, GPT и др.).

## Архитектура AI системы

```
┌─────────────────────────────────────────────────────────┐
│              messageCheckIntervalService                 │
│           (проверка каждые 8 секунд)                     │
└────────────────────┬────────────────────────────────────┘
                     │ Новое сообщение от мужчины
                     ▼
┌─────────────────────────────────────────────────────────┐
│              aiManagementService                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. canUserUseAi(userId)                          │  │
│  │    - Проверка user.aiEnabled                     │  │
│  │    - Проверка user.aiEnabledByAdmin              │  │
│  │                                                   │  │
│  │ 2. canAccountUseAi(userId, accountId)            │  │
│  │    - Проверка account.aiEnabled                  │  │
│  │    - Проверка прав пользователя                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ Разрешено
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  aiResponseService                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ generateAndSend()                                │  │
│  │  1. Генерация ответа                             │  │
│  │  2. Повторная проверка прав                      │  │
│  │  3. Отправка через AI контекст                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│   aiService      │    │ aiBrowserContextService│
│  (генерация)     │    │  (отправка)           │
└────────┬─────────┘    └──────────┬────────────┘
         │                         │
         ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│ OpenRouter API   │    │ Отдельный браузерный │
│ (Claude 3.5)     │    │ контекст Playwright  │
└──────────────────┘    └──────────────────────┘
```

## Компоненты AI системы

### 1. aiService (Генерация ответов)
**Путь**: `backend/src/services/aiService/`

#### 1.1 config.js
**Конфигурация AI**:
```javascript
{
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.9,
  maxTokens: 500
}
```

**Модель**: Claude 3.5 Sonnet (Anthropic)
- **Преимущества**: Высокое качество, понимание контекста, естественность
- **Недостатки**: Платный API, зависимость от внешнего сервиса

#### 1.2 promptBuilder.js
**Функция**: Построение промпта для AI

**Структура промпта**:
```
SYSTEM PROMPT:
├── Базовая инструкция (роль девушки)
├── Информация о профиле (имя, возраст, страна)
├── Кастомные правила из MongoDB (AiRule)
└── Инструкции по формату ответа

USER PROMPT:
├── История переписки (последние 5 сообщений)
└── Новое сообщение от мужчины
```

**Пример системного промпта**:
```
You are Anna, a 25-year-old woman from Ukraine.

Your task is to respond to messages from men on a dating platform.

IMPORTANT RULES:
1. Always respond in the same language as the man's message
2. Be friendly, flirty, and engaging
3. Keep responses natural and conversational
4. Use emojis moderately (1-2 per message)
5. Ask questions to keep the conversation going
6. Never mention that you're an AI

CUSTOM RULES:
- Always be positive and upbeat
- Show interest in the man's life
- Be playful but not too forward

Respond ONLY with the message text, no explanations or meta-commentary.
```

**ПРОБЛЕМА №1**: Промпт статичный, не адаптируется к стилю конкретной девушки.

#### 1.3 apiClient.js
**Функция**: HTTP клиент для OpenRouter API

**Реализация**:
```javascript
const response = await axios.post(
  config.apiUrl,
  {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens
  },
  {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://luxee-website.com',
      'X-Title': 'Luxee AI Assistant'
    }
  }
);
```

**ПРОБЛЕМА №2**: Нет обработки rate limits, нет retry логики.

#### 1.4 responseValidator.js
**Функция**: Валидация ответа AI

**Проверки**:
1. Ответ не пустой
2. Длина < 500 символов
3. Нет запрещённых слов (AI, bot, automated)
4. Нет технических терминов

**ПРОБЛЕМА №3**: Валидация слишком простая, не проверяет качество ответа.

#### 1.5 responseGenerator.js
**Функция**: Основная логика генерации

**Алгоритм**:
```javascript
1. Построить промпт (promptBuilder)
2. Отправить запрос к API (apiClient)
3. Извлечь ответ из response
4. Валидировать ответ (responseValidator)
5. Вернуть текст ответа
```

**ПРОБЛЕМА №4**: Нет кэширования, каждый запрос = новый API call.

### 2. aiManagementService (Управление правами)
**Путь**: `backend/src/services/aiManagementService/`

#### 2.1 Иерархия прав
```
Admin может:
├── Включать/выключать AI для любого пользователя
├── Включать/выключать AI для любого аккаунта
└── Управлять AI правилами

User может:
├── Включать/выключать свой AI (если разрешено админом)
└── Включать/выключать AI для своих аккаунтов
```

#### 2.2 Логика проверки прав
```javascript
canUserUseAi(userId):
  user = найти в MongoDB
  return user.aiEnabled && user.aiEnabledByAdmin

canAccountUseAi(userId, accountId):
  canUser = canUserUseAi(userId)
  if (!canUser) return false
  
  account = найти в MongoDB
  return account.aiEnabled
```

**ПРОБЛЕМА №5**: Проверка прав происходит дважды (перед генерацией и перед отправкой), но между ними может пройти время.

### 3. aiResponseService (Полный цикл)
**Путь**: `backend/src/services/aiResponseService.js`

#### 3.1 generateAndSend()
**Полный цикл работы AI**:

```javascript
1. Проверка прав (canUserUseAi, canAccountUseAi)
2. Генерация ответа через aiService
3. Повторная проверка прав (может быть отключено за время генерации)
4. Отправка через AI контекст
5. Сохранение в answeredChatService
```

**Временная диаграмма**:
```
T0: Получено новое сообщение
T1: Проверка прав (100ms)
T2: Генерация AI ответа (2-5 секунд) ← ДОЛГО!
T3: Повторная проверка прав (100ms)
T4: Отправка через браузер (1-2 секунды)
T5: Сохранение в MongoDB (100ms)

Итого: 3-8 секунд на один ответ
```

**ПРОБЛЕМА №6**: Долгое время ответа. Мужчина может написать ещё раз за это время.

#### 3.2 AI Browser Context
**Отдельный браузерный контекст для AI**:

```javascript
// Основной контекст - для пользователя
mainContext = browser.newContext({ storageState })

// AI контекст - для автоматических ответов
aiContext = browser.newContext({ storageState })
```

**Зачем нужно**:
- Пользователь и AI могут работать параллельно
- Нет конфликтов при одновременной отправке сообщений
- AI не мешает пользователю просматривать чаты

**ПРОБЛЕМА №7**: Два контекста = двойное потребление памяти (~200MB на аккаунт).

### 4. Автоматическая работа AI

#### 4.1 messageCheckIntervalService
**Проверка каждые 8 секунд**:

```javascript
setInterval(async () => {
  // Для каждого активного аккаунта
  for (account of activeAccounts) {
    // Получить новые сообщения
    const messages = await checkAccountMessages(account);
    
    // Для каждого нового сообщения
    for (message of messages) {
      // Если AI включен
      if (canAccountUseAi(account)) {
        // Генерировать и отправить ответ
        await aiResponseService.generateAndSend({
          profile: message.profile,
          manMessage: message.text,
          conversationHistory: message.history
        });
      }
    }
  }
}, 8000);
```

**ПРОБЛЕМА №8**: Polling каждые 8 секунд неэффективен. Нет real-time обработки.

#### 4.2 Обработка истории переписки
**Контекст для AI**:

```javascript
conversationHistory = [
  { from: 'man', text: 'Hi!', timestamp: '...' },
  { from: 'woman', text: 'Hello!', timestamp: '...' },
  { from: 'man', text: 'How are you?', timestamp: '...' },
  { from: 'woman', text: 'Great!', timestamp: '...' },
  { from: 'man', text: 'What are you doing?', timestamp: '...' }
]
```

**Ограничение**: Только последние 5 сообщений.

**ПРОБЛЕМА №9**: 5 сообщений недостаточно для понимания полного контекста разговора.

## Критические проблемы AI системы

### 🔴 ПРОБЛЕМА №1: Зависимость от внешнего API
**Описание**: Вся система зависит от OpenRouter API.

**Риски**:
- API может быть недоступен
- Rate limits (ограничение запросов)
- Стоимость (каждый запрос = деньги)
- Задержки сети (2-5 секунд на ответ)

**Решение**:
```javascript
// 1. Добавить fallback на другую модель
const models = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4',
  'meta-llama/llama-3-70b'
];

// 2. Retry логика с exponential backoff
async function generateWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiClient.generate(prompt);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

// 3. Кэширование похожих запросов
const cache = new Map();
const cacheKey = `${profileId}_${messageHash}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 🔴 ПРОБЛЕМА №2: Отсутствие персонализации
**Описание**: Все девушки отвечают одинаково, нет уникального стиля.

**Текущая ситуация**:
- Один промпт для всех профилей
- Нет анализа предыдущих сообщений девушки
- Нет адаптации к стилю общения

**Решение**:
```javascript
// 1. Анализ стиля девушки из истории
async function analyzeGirlStyle(profileUid) {
  // Получить последние 50 сообщений девушки
  const messages = await getGirlMessages(profileUid, 50);
  
  return {
    avgLength: calculateAvgLength(messages),
    emojiUsage: calculateEmojiUsage(messages),
    commonPhrases: extractCommonPhrases(messages),
    tone: analyzeTone(messages), // flirty, friendly, playful
    topics: extractTopics(messages)
  };
}

// 2. Персонализированный промпт
function buildPersonalizedPrompt(profile, style) {
  return `
    You are ${profile.username}, ${profile.age} years old.
    
    YOUR COMMUNICATION STYLE:
    - Average message length: ${style.avgLength} characters
    - Emoji usage: ${style.emojiUsage} per message
    - Common phrases: ${style.commonPhrases.join(', ')}
    - Tone: ${style.tone}
    - Favorite topics: ${style.topics.join(', ')}
    
    Mimic this style in your responses.
  `;
}
```

### 🔴 ПРОБЛЕМА №3: Race Conditions
**Описание**: Мужчина может написать несколько сообщений пока AI генерирует ответ.

**Сценарий**:
```
T0: Мужчина: "Hi!"
T1: AI начинает генерацию ответа на "Hi!"
T2: Мужчина: "How are you?"
T3: Мужчина: "Are you there?"
T4: AI отправляет ответ на "Hi!" (уже неактуально)
```

**Решение**:
```javascript
// 1. Проверка перед отправкой
async function sendAiResponse(chatId, response) {
  // Получить последнее сообщение
  const lastMessage = await getLastMessage(chatId);
  
  // Если пришло новое сообщение от мужчины
  if (lastMessage.from === 'man' && lastMessage.timestamp > startTime) {
    console.log('New message received, cancelling old response');
    // Генерировать новый ответ с учётом всех сообщений
    return generateNewResponse(chatId);
  }
  
  // Отправить ответ
  await sendMessage(chatId, response);
}

// 2. Debounce для множественных сообщений
const pendingResponses = new Map();

function scheduleAiResponse(chatId, message) {
  // Отменить предыдущий таймер
  if (pendingResponses.has(chatId)) {
    clearTimeout(pendingResponses.get(chatId));
  }
  
  // Подождать 3 секунды перед генерацией
  const timer = setTimeout(async () => {
    await generateAndSend(chatId, message);
    pendingResponses.delete(chatId);
  }, 3000);
  
  pendingResponses.set(chatId, timer);
}
```

### 🔴 ПРОБЛЕМА №4: Нет обработки ошибок AI
**Описание**: Если AI генерирует неподходящий ответ, он всё равно отправляется.

**Примеры плохих ответов**:
- Слишком короткие ("Ok", "Yes")
- Слишком длинные (>500 символов)
- Содержат технические термины
- Не соответствуют языку сообщения
- Повторяют предыдущие ответы

**Решение**:
```javascript
// Расширенная валидация
function validateAiResponse(response, context) {
  const errors = [];
  
  // 1. Проверка длины
  if (response.length < 10) {
    errors.push('Response too short');
  }
  if (response.length > 500) {
    errors.push('Response too long');
  }
  
  // 2. Проверка языка
  const manLanguage = detectLanguage(context.manMessage);
  const responseLanguage = detectLanguage(response);
  if (manLanguage !== responseLanguage) {
    errors.push('Language mismatch');
  }
  
  // 3. Проверка на повторы
  const lastResponses = context.conversationHistory
    .filter(m => m.from === 'woman')
    .map(m => m.text);
  
  if (lastResponses.includes(response)) {
    errors.push('Duplicate response');
  }
  
  // 4. Проверка на запрещённые слова
  const forbidden = ['AI', 'bot', 'automated', 'script'];
  if (forbidden.some(word => response.toLowerCase().includes(word))) {
    errors.push('Contains forbidden words');
  }
  
  // 5. Проверка на эмоциональность
  const emojiCount = (response.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
  if (emojiCount === 0 && response.length > 50) {
    errors.push('No emojis in long message');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Регенерация при ошибках
async function generateWithValidation(context, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await aiService.generateResponse(context);
    const validation = validateAiResponse(response, context);
    
    if (validation.valid) {
      return response;
    }
    
    console.log(`Attempt ${i + 1} failed:`, validation.errors);
    
    // Добавить инструкцию в промпт
    context.additionalInstructions = `
      Previous response was rejected: ${validation.errors.join(', ')}
      Please generate a better response.
    `;
  }
  
  throw new Error('Failed to generate valid response');
}
```

### 🔴 ПРОБЛЕМА №5: Нет мониторинга и аналитики
**Описание**: Невозможно отследить качество работы AI.

**Что нужно отслеживать**:
- Количество сгенерированных ответов
- Время генерации
- Процент успешных/неуспешных ответов
- Стоимость API запросов
- Реакция мужчин (отвечают ли после AI ответа)

**Решение**:
```javascript
// Модель для аналитики
const AiAnalyticsSchema = new Schema({
  accountId: ObjectId,
  profileUid: Number,
  chatId: String,
  manMessage: String,
  aiResponse: String,
  generationTime: Number, // ms
  tokensUsed: Number,
  cost: Number, // USD
  wasSuccessful: Boolean,
  errorMessage: String,
  manReplied: Boolean, // ответил ли мужчина после AI
  replyTime: Number, // через сколько ответил
  timestamp: Date
});

// Логирование каждого ответа
async function generateAndSendWithAnalytics(context) {
  const startTime = Date.now();
  const analytics = {
    accountId: context.accountId,
    profileUid: context.profileUid,
    chatId: context.chatId,
    manMessage: context.manMessage,
    timestamp: new Date()
  };
  
  try {
    const response = await aiService.generateResponse(context);
    analytics.aiResponse = response;
    analytics.generationTime = Date.now() - startTime;
    analytics.tokensUsed = estimateTokens(response);
    analytics.cost = calculateCost(analytics.tokensUsed);
    analytics.wasSuccessful = true;
    
    await sendMessage(context.chatId, response);
    
    // Проверить ответил ли мужчина в течение 5 минут
    setTimeout(async () => {
      const lastMessage = await getLastMessage(context.chatId);
      if (lastMessage.from === 'man' && lastMessage.timestamp > analytics.timestamp) {
        analytics.manReplied = true;
        analytics.replyTime = lastMessage.timestamp - analytics.timestamp;
      }
      await AiAnalytics.create(analytics);
    }, 5 * 60 * 1000);
    
  } catch (error) {
    analytics.wasSuccessful = false;
    analytics.errorMessage = error.message;
    await AiAnalytics.create(analytics);
    throw error;
  }
}

// Dashboard для аналитики
async function getAiStatistics(accountId, period = '7d') {
  const stats = await AiAnalytics.aggregate([
    { $match: { accountId, timestamp: { $gte: getDateBefore(period) } } },
    {
      $group: {
        _id: null,
        totalResponses: { $sum: 1 },
        successfulResponses: { $sum: { $cond: ['$wasSuccessful', 1, 0] } },
        avgGenerationTime: { $avg: '$generationTime' },
        totalCost: { $sum: '$cost' },
        manRepliedCount: { $sum: { $cond: ['$manReplied', 1, 0] } },
        avgReplyTime: { $avg: '$replyTime' }
      }
    }
  ]);
  
  return {
    ...stats[0],
    successRate: stats[0].successfulResponses / stats[0].totalResponses,
    manReplyRate: stats[0].manRepliedCount / stats[0].totalResponses
  };
}
```

### 🔴 ПРОБЛЕМА №6: Нет A/B тестирования
**Описание**: Невозможно сравнить эффективность разных промптов или моделей.

**Решение**:
```javascript
// Конфигурация экспериментов
const experiments = [
  {
    id: 'exp_1',
    name: 'Short vs Long responses',
    variants: [
      { id: 'short', maxTokens: 100, weight: 0.5 },
      { id: 'long', maxTokens: 300, weight: 0.5 }
    ]
  },
  {
    id: 'exp_2',
    name: 'Claude vs GPT',
    variants: [
      { id: 'claude', model: 'claude-3.5-sonnet', weight: 0.5 },
      { id: 'gpt', model: 'gpt-4', weight: 0.5 }
    ]
  }
];

// Выбор варианта для пользователя
function getExperimentVariant(userId, experimentId) {
  const experiment = experiments.find(e => e.id === experimentId);
  const hash = hashCode(userId + experimentId);
  const random = (hash % 100) / 100;
  
  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (random < cumulative) {
      return variant;
    }
  }
}

// Использование в генерации
async function generateWithExperiments(context) {
  const variant = getExperimentVariant(context.userId, 'exp_2');
  
  const response = await aiService.generateResponse({
    ...context,
    model: variant.model
  });
  
  // Сохранить для аналитики
  await AiAnalytics.create({
    ...context,
    experimentId: 'exp_2',
    variantId: variant.id,
    response
  });
  
  return response;
}
```

## Рекомендации по улучшению

### 1. Краткосрочные (1-2 недели)
1. ✅ Добавить retry логику с exponential backoff
2. ✅ Улучшить валидацию ответов
3. ✅ Добавить debounce для множественных сообщений
4. ✅ Реализовать базовую аналитику

### 2. Среднесрочные (1-2 месяца)
1. ✅ Персонализация промптов на основе стиля девушки
2. ✅ A/B тестирование разных моделей и промптов
3. ✅ Кэширование похожих запросов
4. ✅ Мониторинг качества ответов

### 3. Долгосрочные (3-6 месяцев)
1. ✅ Локальная LLM модель (Llama 3, Mistral) для снижения затрат
2. ✅ Fine-tuning модели на реальных переписках
3. ✅ Real-time обработка через WebSocket
4. ✅ Предиктивная генерация (заранее готовить ответы)

## Стоимость AI

### Текущие затраты (Claude 3.5 Sonnet)
- **Input**: $3 за 1M токенов
- **Output**: $15 за 1M токенов

**Средний запрос**:
- Input: ~500 токенов (промпт + история)
- Output: ~150 токенов (ответ)

**Стоимость одного ответа**: ~$0.003 (3 цента)

**При 1000 ответов в день**: $3/день = $90/месяц

### Оптимизация затрат
1. **Кэширование**: -50% запросов
2. **Более дешёвая модель** (GPT-3.5): -70% стоимости
3. **Локальная модель**: -100% стоимости (только электричество)

## Заключение

AI система работает, но имеет критические проблемы:
1. Зависимость от внешнего API
2. Отсутствие персонализации
3. Race conditions
4. Нет мониторинга качества
5. Высокая стоимость при масштабировании

Необходимо внедрить предложенные решения для стабильной работы в продакшене.
