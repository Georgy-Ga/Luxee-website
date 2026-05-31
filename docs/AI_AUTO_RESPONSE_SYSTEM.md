# AI Auto Response System - Система автоматических ответов

## Обзор

Система автоматических ответов AI позволяет автоматически отвечать на новые сообщения от мужчин на платформе Luxee. Каждый Luxee аккаунт с включенным AI получает отдельный браузерный контекст, который работает параллельно с основным контекстом пользователя.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    User Login                                │
│              (автозапуск автоответов)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              aiAutoResponseService                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Для каждого аккаунта с AI:                           │  │
│  │  1. Создаётся отдельный AI контекст                  │  │
│  │  2. Запускается интервал проверки (каждые 10 сек)    │  │
│  │  3. Обрабатываются неотвеченные сообщения            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│ AI Context 1     │    │ AI Context 2         │
│ (Account 1)      │    │ (Account 2)          │
│                  │    │                      │
│ - Проверка чатов │    │ - Проверка чатов     │
│ - Генерация AI   │    │ - Генерация AI       │
│ - Отправка       │    │ - Отправка           │
└──────────────────┘    └──────────────────────┘
```

## Компоненты системы

### 1. aiAutoResponseService.js
**Путь**: `backend/src/services/aiAutoResponseService.js`

Основной сервис управления автоответами.

#### Методы:

##### `start(accountId)`
Запускает автоответы для конкретного аккаунта.

**Процесс:**
1. Проверяет что AI включен для аккаунта
2. Создаёт или получает AI контекст
3. Запускает интервал проверки каждые 10 секунд
4. Сохраняет состояние в Map

**Пример:**
```javascript
await aiAutoResponseService.start('account_id_123');
```

##### `stop(accountId)`
Останавливает автоответы для аккаунта.

**Процесс:**
1. Останавливает интервал
2. Закрывает AI контекст
3. Удаляет из Map

##### `processAccountMessages(accountId)`
Обрабатывает все неотвеченные сообщения для аккаунта.

**Процесс:**
1. Получает список профилей через AI контекст
2. Для каждого профиля получает неотвеченные чаты
3. Проверяет что чат ещё не отвечен (через MongoDB)
4. Генерирует AI ответ
5. Отправляет ответ через AI контекст
6. Сохраняет в MongoDB как отвеченный

**Важно:**
- Обрабатывает чаты по одному (последовательно)
- Задержка 3 секунды между ответами
- Пропускает уже отвеченные чаты

##### `startForUser(userId)`
Запускает автоответы для всех аккаунтов пользователя с включенным AI.

##### `stopForUser(userId)`
Останавливает автоответы для всех аккаунтов пользователя.

##### `getStatus()`
Возвращает статус всех активных автоответов.

**Возвращает:**
```javascript
{
  activeCount: 2,
  accounts: [
    { accountId: 'acc1', isProcessing: false },
    { accountId: 'acc2', isProcessing: true }
  ]
}
```

##### `isRunning(accountId)`
Проверяет запущены ли автоответы для аккаунта.

### 2. aiAutoResponseController.js
**Путь**: `backend/src/controllers/aiAutoResponseController.js`

Контроллер для API endpoints управления автоответами.

#### Endpoints:

##### POST `/api/ai/auto-response/accounts/:accountId/start`
Запустить автоответы для аккаунта.

**Доступ:** Авторизованные пользователи

**Пример запроса:**
```javascript
POST /api/ai/auto-response/accounts/673abc123def456/start
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "success": true,
  "message": "AI auto-response started",
  "accountId": "673abc123def456"
}
```

##### POST `/api/ai/auto-response/accounts/:accountId/stop`
Остановить автоответы для аккаунта.

##### POST `/api/ai/auto-response/start-all`
Запустить автоответы для всех аккаунтов пользователя.

##### POST `/api/ai/auto-response/stop-all`
Остановить автоответы для всех аккаунтов пользователя.

##### GET `/api/ai/auto-response/status`
Получить статус всех автоответов.

##### GET `/api/ai/auto-response/accounts/:accountId/is-running`
Проверить запущены ли автоответы для аккаунта.

### 3. Интеграция с существующими сервисами

#### accountAiService.js
Обновлён для автоматического запуска/остановки автоответов при включении/выключении AI.

**Изменения:**

##### `setAccountAiByAdmin(accountId, enabled)`
```javascript
if (enabled) {
  // Создаём AI контекст
  await aiBrowserContextService.getOrCreateAiContext(accountId);
  
  // Запускаем автоответы
  await aiAutoResponseService.start(accountId);
} else {
  // Останавливаем автоответы
  await aiAutoResponseService.stop(accountId);
  
  // Закрываем AI контекст
  await aiBrowserContextService.closeAiContext(accountId);
}
```

##### `toggleAccountAi(userId, accountId)`
```javascript
if (account.aiEnabled && account.aiEnabledByAdmin) {
  // Запускаем автоответы
  await aiAutoResponseService.start(accountId);
} else {
  // Останавливаем автоответы
  await aiAutoResponseService.stop(accountId);
  await aiBrowserContextService.closeAiContext(accountId);
}
```

#### UserController.js
Обновлён для автозапуска автоответов при логине пользователя.

**Изменения в методе `login`:**
```javascript
// Автоматически запускаем автоответы для всех аккаунтов с включенным AI
try {
  console.log(`[User Login] Starting AI auto-responses for user ${userData.user.id}`);
  await aiAutoResponseService.startForUser(userData.user.id);
} catch (error) {
  console.error('[User Login] Error starting AI auto-responses:', error.message);
  // Не прерываем логин если не удалось запустить автоответы
}
```

## Логика работы

### 1. Запуск автоответов

**Автоматический запуск происходит:**
- При логине пользователя (для всех аккаунтов с AI)
- При включении AI админом для аккаунта
- При включении AI пользователем для аккаунта

**Ручной запуск через API:**
```javascript
// Для одного аккаунта
POST /api/ai/auto-response/accounts/:accountId/start

// Для всех аккаунтов пользователя
POST /api/ai/auto-response/start-all
```

### 2. Обработка сообщений

**Цикл обработки (каждые 10 секунд):**

1. **Проверка прав:**
   - AI включен для пользователя?
   - AI включен для аккаунта?

2. **Получение данных через AI контекст:**
   ```javascript
   // Через page.evaluate() получаем:
   - Список профилей
   - Чаты с unAnswered === true
   - Последнее сообщение от мужчины
   ```

3. **Фильтрация чатов:**
   - Проверка в MongoDB: уже отвечали на этот чат?
   - Пропуск уже отвеченных чатов

4. **Генерация ответа:**
   ```javascript
   const result = await aiResponseService.generateAndSend({
     userId,
     accountId,
     profileUid,
     chatId,
     profile: { name, age, country, city },
     manMessage: lastManMessage.body,
     conversationHistory: []
   });
   ```

5. **Отправка через AI контекст:**
   - Переключение на профиль
   - Открытие чата
   - Отправка сообщения
   - Проверка статуса

6. **Сохранение в MongoDB:**
   - Если `unAnswered === false` после отправки
   - Сохраняем в коллекцию `answeredchats`

7. **Задержка:**
   - 3 секунды между ответами
   - Предотвращает спам

### 3. Остановка автоответов

**Автоматическая остановка происходит:**
- При выключении AI админом
- При выключении AI пользователем
- При обнаружении что AI выключен во время обработки

**Ручная остановка через API:**
```javascript
// Для одного аккаунта
POST /api/ai/auto-response/accounts/:accountId/stop

// Для всех аккаунтов пользователя
POST /api/ai/auto-response/stop-all
```

## Параллельная работа с пользователем

### Отдельные контексты

Каждый аккаунт имеет **два независимых браузерных контекста:**

1. **Основной контекст** (для пользователя):
   - ID: `accountId`
   - Используется пользователем для ручной работы
   - Управляется через основной интерфейс

2. **AI контекст** (для автоответов):
   - ID: `${accountId}_ai`
   - Используется только AI для автоответов
   - Работает параллельно с основным

**Преимущества:**
- ✅ Пользователь и AI не мешают друг другу
- ✅ Можно одновременно отвечать вручную и автоматически
- ✅ Нет конфликтов при переключении профилей/чатов
- ✅ Независимые сессии браузера

### Синхронизация через MongoDB

Чтобы AI не отвечал на чаты, на которые уже ответил пользователь:

1. **При ручной отправке** (`messageSendService.js`):
   ```javascript
   // После отправки проверяем статус
   if (chatData.unAnswered === false) {
     // Сохраняем в MongoDB
     await answeredChatService.saveAnsweredChat({...});
   }
   ```

2. **При автоответе** (`aiAutoResponseService.js`):
   ```javascript
   // Перед генерацией проверяем MongoDB
   const answeredChats = await answeredChatService.getAnsweredChats({...});
   const isAlreadyAnswered = answeredChats.some(ac => ac.chatId === chat.chatId);
   
   if (isAlreadyAnswered) {
     console.log('Chat already answered, skipping');
     continue;
   }
   ```

## Управление через Admin Panel

### Включение AI для аккаунта

**Админ:**
1. Открывает Admin Modal → AI Tab
2. Находит пользователя
3. Включает AI для нужного аккаунта
4. **Автоматически:**
   - Создаётся AI контекст
   - Запускаются автоответы

**Оператор:**
1. Открывает свой профиль
2. Включает AI для своего аккаунта (если админ разрешил)
3. **Автоматически:**
   - Запускаются автоответы

### Выключение AI для аккаунта

**Админ или Оператор:**
1. Выключает AI для аккаунта
2. **Автоматически:**
   - Останавливаются автоответы
   - Закрывается AI контекст

## Мониторинг и отладка

### Логи

Все операции логируются с префиксом `[AI Auto Response]`:

```javascript
[AI Auto Response] Starting for account 673abc123def456
[AI Auto Response] AI context ready for account 673abc123def456
[AI Auto Response] Started for account 673abc123def456 (every 10 seconds)
[AI Auto Response] Found 2 profiles with unanswered messages for account 673abc123def456
[AI Auto Response] Processing profile 12345 (3 chats)
[AI Auto Response] Generating response for chat 12345_67890...
[AI Auto Response] Successfully sent response to chat 12345_67890
[AI Auto Response] Chat 12345_67890 marked as answered in MongoDB
[AI Auto Response] Finished processing account 673abc123def456
```

### Проверка статуса

**Через API:**
```javascript
GET /api/ai/auto-response/status

// Ответ:
{
  "activeCount": 2,
  "accounts": [
    { "accountId": "acc1", "isProcessing": false },
    { "accountId": "acc2", "isProcessing": true }
  ]
}
```

**Через код:**
```javascript
const status = aiAutoResponseService.getStatus();
console.log('Active auto-responders:', status.activeCount);

const isRunning = aiAutoResponseService.isRunning(accountId);
console.log('Is running:', isRunning);
```

## Обработка ошибок

### Ошибки при запуске

```javascript
try {
  await aiAutoResponseService.start(accountId);
} catch (error) {
  // Логируется, но не прерывает работу
  console.error('Failed to start auto-response:', error);
}
```

### Ошибки при обработке

```javascript
// Если ошибка в одном чате - продолжаем со следующим
for (const chat of profile.unansweredChats) {
  try {
    await processChat(chat);
  } catch (error) {
    console.error('Error processing chat:', error);
    // Продолжаем со следующим чатом
  }
}
```

### Автоматическая остановка

Если AI выключен во время обработки:
```javascript
const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
if (!canUse) {
  console.log('AI disabled, stopping...');
  await aiAutoResponseService.stop(accountId);
  return;
}
```

## Производительность

### Оптимизации

1. **Флаг isProcessing:**
   - Предотвращает параллельную обработку
   - Если уже обрабатываем - пропускаем итерацию

2. **Задержки между ответами:**
   - 3 секунды между чатами
   - Предотвращает перегрузку

3. **Проверка в MongoDB:**
   - Пропускаем уже отвеченные чаты
   - Экономим запросы к AI

4. **Интервал 10 секунд:**
   - Баланс между скоростью и нагрузкой
   - Можно настроить при необходимости

### Ресурсы

**Для каждого активного аккаунта:**
- 1 браузерный контекст Playwright
- 1 интервал (setInterval)
- Память для хранения состояния в Map

**Рекомендации:**
- До 10 аккаунтов: без проблем
- 10-50 аккаунтов: мониторить память
- 50+ аккаунтов: рассмотреть масштабирование

## Безопасность

### Проверки прав

На каждом этапе проверяется:
1. AI включен для пользователя (`user.aiEnabled && user.aiEnabledByAdmin`)
2. AI включен для аккаунта (`account.aiEnabled && account.aiEnabledByAdmin`)

### Изоляция

- Каждый аккаунт работает в своём AI контексте
- Нет доступа к данным других аккаунтов
- Независимые сессии браузера

### Валидация

- Проверка существования аккаунта
- Проверка принадлежности аккаунта пользователю
- Валидация данных перед отправкой

## Примеры использования

### Пример 1: Запуск для одного аккаунта

```javascript
// Backend
import aiAutoResponseService from './services/aiAutoResponseService.js';

await aiAutoResponseService.start('673abc123def456');
```

### Пример 2: Запуск для всех аккаунтов пользователя

```javascript
// Backend
await aiAutoResponseService.startForUser(userId);
```

### Пример 3: Проверка статуса

```javascript
// Backend
const status = aiAutoResponseService.getStatus();
console.log(`Active: ${status.activeCount}`);

// Frontend
const response = await fetch('/api/ai/auto-response/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const status = await response.json();
```

### Пример 4: Остановка автоответов

```javascript
// Backend
await aiAutoResponseService.stop(accountId);

// Frontend
await fetch(`/api/ai/auto-response/accounts/${accountId}/stop`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Troubleshooting

### Автоответы не запускаются

**Проверьте:**
1. AI включен для пользователя?
2. AI включен для аккаунта?
3. Аккаунт активен (`isActive: true`)?
4. Есть сессия у аккаунта?

**Логи:**
```
[AI Auto Response] AI disabled for account, not starting
```

### Автоответы не отправляют сообщения

**Проверьте:**
1. AI контекст создан?
2. Есть неотвеченные сообщения?
3. Чаты не в MongoDB как отвеченные?

**Логи:**
```
[AI Auto Response] No unanswered messages for account
[AI Auto Response] Chat already answered, skipping
```

### AI контекст не создаётся

**Проверьте:**
1. Основной контекст существует?
2. Есть sessionData у аккаунта?
3. Браузер работает?

**Логи:**
```
[AI Browser Context] Account has no session data
[AI Browser Context] Failed to create AI context
```

## Заключение

Система автоматических ответов AI полностью интегрирована в проект и работает автоматически:

✅ **Автозапуск** при логине пользователя  
✅ **Автозапуск** при включении AI админом  
✅ **Автозапуск** при включении AI оператором  
✅ **Параллельная работа** с пользователем через отдельные контексты  
✅ **Синхронизация** через MongoDB  
✅ **Обработка ошибок** без прерывания работы  
✅ **Мониторинг** через API и логи  

Система готова к использованию и не требует дополнительной настройки.
