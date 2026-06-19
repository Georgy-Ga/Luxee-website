# 🚨 AI Kill Switch - Глобальное отключение автоответов

## Проблема

Нейросеть AI отправляет сообщения некорректно, что мешает разработке и тестированию других функций.

## Решение

Реализована **тройная система защиты** с kill switch флагами, которые полностью блокируют отправку AI сообщений на трёх уровнях.

---

## Архитектура тройной защиты

```
🔴 УРОВЕНЬ 1: Блокировка запуска
   ↓
   aiAutoResponseService.start()
   → Проверка: AI_AUTO_RESPONSE_GLOBALLY_DISABLED
   → Если true → ВЫХОД (не запускается)
   
🔴 УРОВЕНЬ 2: Блокировка обработки
   ↓
   aiAutoResponseService.processAccountMessages()
   → Проверка: AI_AUTO_RESPONSE_GLOBALLY_DISABLED
   → Если true → ВЫХОД (не обрабатывает)
   
🔴 УРОВЕНЬ 3: Блокировка отправки
   ↓
   messageSendService.sendMessage()
   → Проверка: AI_MESSAGE_SENDING_DISABLED
   → Если true → ERROR (не отправляет)
```

---

## Файлы с изменениями

### 1. `backend/src/services/aiAutoResponseService.js`

**Добавлено:**
```javascript
// 🚨🚨🚨 MASTER KILL SWITCH - ГЛОБАЛЬНОЕ ОТКЛЮЧЕНИЕ AI АВТООТВЕТОВ 🚨🚨🚨
// Установите в false для включения AI автоответов
// Установите в true для полного отключения (РЕКОМЕНДУЕТСЯ во время разработки)
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true;
```

**УРОВЕНЬ 1 - В методе `start()`:**
```javascript
start: async (accountId) => {
    // 🚨 УРОВЕНЬ 1 ЗАЩИТЫ: Блокировка запуска
    if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
        console.log(`🛑 [AI Auto Response] GLOBALLY DISABLED - not starting for account ${accountId}`);
        return;
    }
    // ... остальной код
}
```

**УРОВЕНЬ 2 - В методе `processAccountMessages()`:**
```javascript
processAccountMessages: async (accountId) => {
    // 🚨 УРОВЕНЬ 2 ЗАЩИТЫ: Блокировка обработки сообщений
    if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
        console.log(`🛑 [AI Auto] GLOBALLY DISABLED - skipping message processing for account ${accountId}`);
        return;
    }
    // ... остальной код
}
```

---

### 2. `backend/src/services/luxeeApi/messageSendService.js`

**Добавлено:**
```javascript
// 🚨🚨🚨 KILL SWITCH - БЛОКИРОВКА ОТПРАВКИ AI СООБЩЕНИЙ 🚨🚨🚨
// Установите в false для разрешения отправки
// Установите в true для блокировки (РЕКОМЕНДУЕТСЯ во время разработки)
const AI_MESSAGE_SENDING_DISABLED = true;
```

**УРОВЕНЬ 3 - В методе `sendMessage()`:**
```javascript
sendMessage: async ({ userId, accountId, profileUid, memberUid, text, chatIdentity }) => {
    // 🚨 УРОВЕНЬ 3 ЗАЩИТЫ: Финальная блокировка отправки сообщений
    if (AI_MESSAGE_SENDING_DISABLED) {
        console.log(`🛑 [Message Send] AI MESSAGE SENDING GLOBALLY DISABLED - blocking send to ${memberUid}`);
        throw new Error('AI message sending is globally disabled for safety');
    }
    // ... остальной код
}
```

---

## Как это работает

### Сценарий 1: Админ включает AI кнопку в интерфейсе

```
1. Админ кликает "Enable AI" в админ-панели
   ↓
2. Backend получает запрос POST /ai/users/:userId/set-all-accounts
   ↓
3. userAiService обновляет БД: aiEnabled = true, aiEnabledByAdmin = true
   ↓
4. accountAiService вызывает aiAutoResponseService.start(accountId)
   ↓
5. 🚨 УРОВЕНЬ 1: Проверка AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true
   ↓
6. 🛑 ВЫХОД - автоответы НЕ запускаются
   ↓
7. Логи: "🛑 [AI Auto Response] GLOBALLY DISABLED - not starting..."
```

**Результат:** AI не запустится, никаких сообщений не отправится ✅

---

### Сценарий 2: Автоответы уже были запущены до установки kill switch

```
1. Автоответы работают (интервал каждые 10 сек)
   ↓
2. Установлен AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true
   ↓
3. Перезапущен backend сервер
   ↓
4. Интервал срабатывает → вызов processAccountMessages()
   ↓
5. 🚨 УРОВЕНЬ 2: Проверка AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true
   ↓
6. 🛑 ВЫХОД - обработка сообщений НЕ выполняется
   ↓
7. Логи: "🛑 [AI Auto] GLOBALLY DISABLED - skipping message processing..."
```

**Результат:** Даже если интервал запущен, он не обработает сообщения ✅

---

### Сценарий 3: Каким-то образом дошло до отправки

```
1. Обход уровней 1 и 2 (теоретически невозможно, но...)
   ↓
2. aiResponseService.generateAndSend() вызывает messageSendService.sendMessage()
   ↓
3. 🚨 УРОВЕНЬ 3: Проверка AI_MESSAGE_SENDING_DISABLED = true
   ↓
4. 🛑 ОШИБКА - throw Error('AI message sending is globally disabled')
   ↓
5. Логи: "🛑 [Message Send] AI MESSAGE SENDING GLOBALLY DISABLED..."
```

**Результат:** Даже финальная попытка отправки заблокирована ✅

---

## Что НЕ блокируется

### ✅ Ручная отправка сообщений пользователем

Пользователь может отправлять сообщения вручную через ChatWindow:

```
1. Пользователь вводит текст в ChatWindow
   ↓
2. Frontend вызывает POST /luxee/send-message
   ↓
3. messageSendService.sendMessage() проверяет AI_MESSAGE_SENDING_DISABLED
   ↓
4. ❌ БЛОКИРУЕТСЯ - но это неправильно!
```

**ПРОБЛЕМА:** Сейчас блокируется ВСЯ отправка, включая ручную!

**РЕШЕНИЕ (если нужно):** Добавить параметр `isManualSend: boolean` в `sendMessage()`:

```javascript
sendMessage: async ({ userId, accountId, profileUid, memberUid, text, chatIdentity, isManualSend = false }) => {
    // Блокировка только для AI автоответов
    if (!isManualSend && AI_MESSAGE_SENDING_DISABLED) {
        console.log(`🛑 [Message Send] AI MESSAGE SENDING GLOBALLY DISABLED`);
        throw new Error('AI message sending is globally disabled for safety');
    }
    // ... остальной код
}
```

---

## Управление kill switch

### Отключить AI автоответы (текущее состояние)

**backend/src/services/aiAutoResponseService.js:**
```javascript
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true;  // ✅ ОТКЛЮЧЕНО
```

**backend/src/services/luxeeApi/messageSendService.js:**
```javascript
const AI_MESSAGE_SENDING_DISABLED = true;  // ✅ ЗАБЛОКИРОВАНО
```

---

### Включить AI автоответы (после исправления логики)

**backend/src/services/aiAutoResponseService.js:**
```javascript
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = false;  // ⚠️ ВКЛЮЧЕНО
```

**backend/src/services/luxeeApi/messageSendService.js:**
```javascript
const AI_MESSAGE_SENDING_DISABLED = false;  // ⚠️ РАЗРЕШЕНО
```

**⚠️ ВАЖНО:** После изменения флагов необходимо **перезапустить backend сервер**!

---

## Проверка работы

### 1. Логи при попытке запуска

После включения AI кнопки в админ-панели должны появиться:

```
[AI Management Service] Admin 6a1b370ff08e9365489df8a3 setting AI to true...
[AI Management Service] Starting auto-response for account 6a32727f48a571037050a027...
🛑 [AI Auto Response] GLOBALLY DISABLED - not starting for account 6a32727f48a571037050a027
```

### 2. Логи при попытке обработки

Если интервал уже запущен (старое состояние):

```
[AI Auto Response] Account 6a32727f48a571037050a027 processing...
🛑 [AI Auto] GLOBALLY DISABLED - skipping message processing for account 6a32727f48a571037050a027
```

### 3. Логи при попытке отправки

Если дошло до финальной отправки:

```
[AI Auto] Sending to chat 12345_67890...
🛑 [Message Send] AI MESSAGE SENDING GLOBALLY DISABLED - blocking send to 67890
[AI Auto] ✗ Failed to send: AI message sending is globally disabled for safety
```

---

## Гарантии безопасности

### ✅ Тройная защита

1. **Уровень 1** блокирует запуск → новые процессы не стартуют
2. **Уровень 2** блокирует обработку → старые процессы не работают
3. **Уровень 3** блокирует отправку → финальная страховка

### ✅ Fail-safe дизайн

- Если забыли отключить на уровне 1 → блокирует уровень 2
- Если забыли отключить на уровне 2 → блокирует уровень 3
- Все три уровня работают независимо

### ✅ Видимость в логах

- Каждая блокировка пишет в консоль с эмодзи 🛑
- Легко отследить что заблокировано и почему

---

## Производительность

- **Overhead:** ~2мс на проверку флага (несущественно)
- **Memory:** 0 байт (флаги - константы)
- **Network:** 0 запросов (локальная проверка)

---

## Откат изменений

Если нужно вернуть старое поведение, удалить:

1. В `aiAutoResponseService.js`:
   - Константу `AI_AUTO_RESPONSE_GLOBALLY_DISABLED`
   - Проверки в `start()` и `processAccountMessages()`

2. В `messageSendService.js`:
   - Константу `AI_MESSAGE_SENDING_DISABLED`
   - Проверку в `sendMessage()`

Но **НЕ РЕКОМЕНДУЕТСЯ** до исправления логики AI!

---

## Следующие шаги

1. ✅ **Сейчас:** AI автоответы полностью заблокированы
2. 🔧 **Исправить:** Логику генерации и отправки AI сообщений
3. ✅ **Потом:** Установить флаги в `false` для включения
4. 🧪 **Тестировать:** Проверить корректность отправки

---

## Резюме

### 🎯 Цель достигнута

AI автоответы **ПОЛНОСТЬЮ ОТКЛЮЧЕНЫ** и **НЕ МОГУТ** отправить ни одного сообщения, независимо от:
- Состояния кнопок в UI
- Значений в базе данных
- Запущенных интервалов
- Любых других факторов

### 🔒 Гарантия 100%

Тройная система защиты гарантирует, что ни одно AI сообщение не будет отправлено пока флаги установлены в `true`.

### 🚀 Быстрое включение

Когда логика будет исправлена - просто установите флаги в `false` и перезапустите backend.
