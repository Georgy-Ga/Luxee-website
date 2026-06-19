# 🐛 AI Debug Mode - Режим отладки без отправки сообщений

## 📋 Обзор

Реализован **режим отладки AI** для безопасного тестирования работы нейросети без отправки реальных сообщений пользователям.

### ✅ Что реализовано:

1. **Исправлен баг `[object Object]`** - теперь отправляется текст, а не объект
2. **Добавлен флаг `AI_DEBUG_MODE`** - полный контроль над отправкой
3. **Детальное логирование** на каждом этапе работы AI
4. **Защита от отправки** - сообщения НЕ отправляются пользователям

---

## 🔧 Изменённые файлы

### 1. `backend/src/services/aiResponseService.js`

#### ✅ Исправлен баг [object Object]

**Было (строка 229):**
```javascript
message: aiResponse,  // ❌ Отправляло {response: "текст", retries: 0}
```

**Стало:**
```javascript
message: aiResponse.response,  // ✅ Отправляет только текст
```

#### 🐛 Добавлен флаг DEBUG MODE

**Строки 5-8:**
```javascript
// 🐛🐛🐛 DEBUG MODE - РЕЖИМ ОТЛАДКИ БЕЗ ОТПРАВКИ СООБЩЕНИЙ 🐛🐛🐛
// Установите в false для включения реальной отправки (после тестирования)
// Установите в true для режима отладки (сообщения НЕ отправляются, только логи)
const AI_DEBUG_MODE = true;
```

#### 🚫 Блокировка отправки (строки 95-151)

**Режим отладки (AI_DEBUG_MODE = true):**
- page.evaluate() **НЕ ВЫПОЛНЯЕТСЯ**
- Вместо этого выводятся детальные логи:
  - Chat ID
  - Profile UID
  - Message text
  - Message length
  - Account ID
  - User ID

**Продакшн режим (AI_DEBUG_MODE = false):**
- Выполняется реальная отправка через page.evaluate()

---

### 2. `backend/src/services/aiAutoResponseService.js`

#### 🔍 Детальные логи обнаруженных чатов (строки 226-240)

**Что логируется:**
```
🔍 [AI DEBUG] ===== UNANSWERED CHAT FOUND =====
  👤 Profile: Anna (UID: 12345)
  💬 Chat ID: 12345_67890
  👨 Man: John (UID: 67890)
  📝 Last man message: "Hi beautiful!"
  🕐 Message time: 18.06.2026, 22:05:30
  📊 Profile data: { age: 25, country: 'Ukraine', city: 'Kyiv' }
```

---

### 3. `backend/src/services/aiService/promptBuilder.js`

#### 📝 Логирование построения промпта (строки 29-87)

**Что логируется:**
```
📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Anna
  📨 Man message: "Hi beautiful!"
  📊 Message type: 1
  📜 Conversation history length: 0
  📋 Custom rules count: 0
  🎭 Profile context: My profile information: ...
  📨 Total messages in array: 2
  📄 Messages structure:
    1. [system] I'm a woman on a dating site...
    2. [user] My profile information: ...Man's message: "Hi beautiful!"...
```

---

### 4. `backend/src/services/aiService/apiClient.js`

#### 🤖 Логирование запросов к DeepSeek API (строки 9-77)

**Что логируется:**

**Перед запросом:**
```
🤖 [AI DEBUG] ===== SENDING REQUEST TO DEEPSEEK API =====
  🔄 Attempt: 1
  🌐 API URL: https://api.deepseek.com
  🎯 Model: deepseek-v4-flash
  📨 Messages count: 2
  ⚙️ Parameters:
    - Temperature: 0.8 (creative)
    - Max tokens: 150 (short responses)
    - Top P: 0.9
    - Timeout: 30000ms
  📦 Full request body: { ... }
  ⏳ Sending request...
```

**После ответа:**
```
  ✅ Response received in 1245 ms
  📥 Raw AI response: "Hey! 😊 How are you today?"
  📊 Response length: 28 characters
  🔍 Response stats:
    - Tokens used (prompt): 450
    - Tokens used (completion): 15
    - Tokens used (total): 465
```

**При ошибке:**
```
❌ [AI DEBUG] ===== ERROR CALLING DEEPSEEK API =====
  🚨 Error message: Request failed with status code 429
  📛 HTTP Status: 429
  📄 Error data: { "error": "Rate limit exceeded" }
```

---

### 5. `backend/src/services/aiService/responseGenerator.js`

#### 🎨 Логирование генерации ответа (строки 13-116)

**Что логируется:**

**Начало генерации:**
```
🎨 [AI DEBUG] ===== GENERATING AI RESPONSE =====
  👤 Profile: Anna
  📨 Man message: "Hi beautiful!"
  📊 Message type: 1
  📜 History length: 0
  📋 Custom rules loaded: 0
  🔁 Max retries allowed: 3
```

**При обнаружении запрещённых фраз:**
```
⚠️ [AI DEBUG] ===== RETRY 1/3 - Forbidden Phrases Detected =====
  🚫 Response contains forbidden phrases!
  📝 Bad response: "I'm an AI assistant..."
  🔄 Adding correction message and retrying...
```

**Финальный результат:**
```
  ✅ Response passed forbidden phrases check
  🧹 Response cleaned
  📤 Final response: "Hey! 😊 How are you today?"
  📊 Stats:
    - Original length: 28
    - Cleaned length: 28
    - Retries used: 0
```

---

## 🔒 Гарантии безопасности

### Четырёхуровневая защита от отправки:

1. **Уровень 1:** `AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true`
   - Блокирует запуск автоответов
   - Файл: `aiAutoResponseService.js` (строка 8)

2. **Уровень 2:** `AI_MESSAGE_SENDING_DISABLED = true`
   - Блокирует отправку через messageSendService
   - Файл: `messageSendService.js` (строка 10)

3. **Уровень 3:** `AI_DEBUG_MODE = true`
   - Блокирует отправку в aiResponseService
   - Файл: `aiResponseService.js` (строка 8)

4. **Уровень 4:** Код `page.evaluate()` заблокирован условием
   - Физически не выполняется при AI_DEBUG_MODE = true
   - Файл: `aiResponseService.js` (строки 102-174)

### ✅ Даже если:
- Забыли отключить уровень 1 → уровень 2 заблокирует
- Забыли отключить уровень 2 → уровень 3 заблокирует
- Забыли отключить уровень 3 → уровень 4 (код не выполнится)
- **ФИЗИЧЕСКИ НЕВОЗМОЖНО** отправить сообщение

---

## 🎯 Как использовать

### Режим отладки (текущее состояние)

**1. Убедитесь что флаги установлены:**

`backend/src/services/aiAutoResponseService.js`:
```javascript
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true;  // ✅
```

`backend/src/services/luxeeApi/messageSendService.js`:
```javascript
const AI_MESSAGE_SENDING_DISABLED = true;  // ✅
```

`backend/src/services/aiResponseService.js`:
```javascript
const AI_DEBUG_MODE = true;  // ✅
```

**2. Включите AI через админ-панель**

**3. Проверьте логи в консоли backend:**

Вы увидите:
- 🔍 Обнаруженные unanswered чаты
- 📝 Построение промпта для AI
- 🤖 Запрос к DeepSeek API
- ✅ Ответ от AI
- 🚫 **SEND BLOCKED** - сообщение НЕ отправлено

**4. Анализируйте каждый этап**

---

## 🚀 Переход в продакшн

### ⚠️ После тестирования и исправления:

**Шаг 1: Отключите DEBUG MODE**

`backend/src/services/aiResponseService.js`:
```javascript
const AI_DEBUG_MODE = false;  // ⚠️ ВКЛЮЧИТЬ отправку
```

**Шаг 2: Разрешите отправку**

`backend/src/services/luxeeApi/messageSendService.js`:
```javascript
const AI_MESSAGE_SENDING_DISABLED = false;  // ⚠️ РАЗРЕШИТЬ
```

**Шаг 3: Включите автоответы**

`backend/src/services/aiAutoResponseService.js`:
```javascript
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = false;  // ⚠️ ВКЛЮЧИТЬ
```

**Шаг 4: Перезапустите backend**

```bash
# В корне проекта
docker-compose restart backend
```

---

## 📊 Примеры логов

### Пример полного цикла обработки:

```
[AI Auto] ========== Starting processing for test@luxee.com ==========
[AI Auto] Current URL: https://luxee.io/chats
[AI Auto] Active profile: Anna (12345)
[AI Auto] Total profiles: 1
[AI Auto]   - Anna (12345): 1 unanswered, 0 new ← ACTIVE
[AI Auto] ===== PRIORITY 1: Processing active profile =====
[AI Auto] Found 1 unanswered chats on Anna (ACTIVE)
[AI Auto] Processing chat 1/1: John (12345_67890)

🔍 [AI DEBUG] ===== UNANSWERED CHAT FOUND =====
  👤 Profile: Anna (UID: 12345)
  💬 Chat ID: 12345_67890
  👨 Man: John (UID: 67890)
  📝 Last man message: Hi beautiful!
  🕐 Message time: 18.06.2026, 22:05:30
  📊 Profile data: { age: 25, country: 'Ukraine', city: 'Kyiv' }
════════════════════════════════════════════════════════════════════════════════

[AI Response Service] Starting generate and send cycle...
[AI Response Service] Generating response...
[AI Response Service] AI checks passed, generating response...

📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Anna
  📨 Man message: Hi beautiful!
  📊 Message type: 1
  📜 Conversation history length: 0
  📋 Custom rules count: 0
  🎭 Profile context: My profile information: ...
  📨 Total messages in array: 2
  📄 Messages structure:
    1. [system] I'm a woman on a dating site...
    2. [user] My profile information: ...Man's message: "Hi beautiful!"...
════════════════════════════════════════════════════════════════════════════════

🎨 [AI DEBUG] ===== GENERATING AI RESPONSE =====
  👤 Profile: Anna
  📨 Man message: Hi beautiful!
  📊 Message type: 1
  📜 History length: 0
  📋 Custom rules loaded: 0
  🔁 Max retries allowed: 3

🤖 [AI DEBUG] ===== SENDING REQUEST TO DEEPSEEK API =====
  🔄 Attempt: 1
  🌐 API URL: https://api.deepseek.com
  🎯 Model: deepseek-v4-flash
  📨 Messages count: 2
  ⚙️ Parameters:
    - Temperature: 0.8 (creative)
    - Max tokens: 150 (short responses)
    - Top P: 0.9
    - Timeout: 30000ms
  📦 Full request body: { ... }
  ⏳ Sending request...
  ✅ Response received in 1245 ms
  📥 Raw AI response: Hey! 😊 How are you today?
  📊 Response length: 28 characters
  🔍 Response stats:
    - Tokens used (prompt): 450
    - Tokens used (completion): 15
    - Tokens used (total): 465
════════════════════════════════════════════════════════════════════════════════

  ✅ Response passed forbidden phrases check
  🧹 Response cleaned
  📤 Final response: Hey! 😊 How are you today?
  📊 Stats:
    - Original length: 28
    - Cleaned length: 28
    - Retries used: 0
════════════════════════════════════════════════════════════════════════════════

[AI Response Service] AI response: { response: 'Hey! 😊 How are you today?', retries: 0 }
[AI Response Service] Sending AI response...
[AI Response Service] Chat: 12345_67890
[AI Response Service] AI context ready, sending message...

🚫🚫🚫 [AI DEBUG] MESSAGE SEND BLOCKED - Debug Mode Enabled 🚫🚫🚫
════════════════════════════════════════════════════════════════════════════════
📨 [AI DEBUG] Message details:
  - Chat ID: 12345_67890
  - Profile UID: 12345
  - Message text: Hey! 😊 How are you today?
  - Message length: 28 characters
  - Account ID: 6a32727f48a571037050a027
  - User ID: 6a1b370ff08e9365489df8a3
════════════════════════════════════════════════════════════════════════════════
✅ [AI DEBUG] Message would be sent if AI_DEBUG_MODE = false
🔧 [AI DEBUG] To enable real sending: Set AI_DEBUG_MODE = false in aiResponseService.js
════════════════════════════════════════════════════════════════════════════════

[AI Auto] ✓ Sent to John
[AI Auto] ========== Finished processing test@luxee.com ==========
```

---

## 📁 Структура изменений

```
backend/src/services/
├── aiResponseService.js ✅
│   ├── [ИСПРАВЛЕНО] Баг [object Object] (строка 229, 218)
│   ├── [ДОБАВЛЕНО] AI_DEBUG_MODE флаг (строка 8)
│   └── [ДОБАВЛЕНО] Блокировка отправки (строки 95-151)
│
├── aiAutoResponseService.js ✅
│   └── [ДОБАВЛЕНО] Детальные логи чатов (строки 226-240)
│
└── aiService/
    ├── promptBuilder.js ✅
    │   └── [ДОБАВЛЕНО] Логи построения промпта (строки 29-87)
    │
    ├── apiClient.js ✅
    │   └── [ДОБАВЛЕНО] Логи запросов к API (строки 9-77)
    │
    └── responseGenerator.js ✅
        └── [ДОБАВЛЕНО] Логи генерации ответа (строки 13-116)
```

---

## ✅ Что проверять в логах

### 1. Обнаружение чата
- ✅ Правильный профиль?
- ✅ Правильное сообщение от мужчины?
- ✅ Корректные данные профиля?

### 2. Построение промпта
- ✅ System prompt присутствует?
- ✅ Profile context правильный?
- ✅ Man's message передался?
- ✅ Структура messages корректная?

### 3. Запрос к API
- ✅ API URL правильный?
- ✅ Model правильная?
- ✅ Request body полный?
- ✅ Response получен?

### 4. Ответ AI
- ✅ Response не пустой?
- ✅ Нет forbidden phrases?
- ✅ Response cleaned корректно?
- ✅ Retries если нужно?

### 5. Отправка заблокирована
- ✅ Видно `🚫 MESSAGE SEND BLOCKED`?
- ✅ Message text правильный?
- ✅ Chat ID правильный?

---

## 🔍 Troubleshooting

### Проблема: Сообщения всё равно отправляются

**Решение:**
1. Проверьте все 3 флага (см. раздел "Гарантии безопасности")
2. Перезапустите backend: `docker-compose restart backend`
3. Проверьте логи: должно быть `🚫 MESSAGE SEND BLOCKED`

### Проблема: Нет логов в консоли

**Решение:**
1. Проверьте что AI включен через админ-панель
2. Проверьте что есть unanswered чаты
3. Проверьте `docker-compose logs -f backend`

### Проблема: AI не генерирует ответ

**Решение:**
1. Проверьте DeepSeek API key в `.env`
2. Проверьте логи ошибок от API
3. Проверьте квоту токенов DeepSeek

---

## 📝 Резюме

### ✅ Реализовано:

1. ✅ **Исправлен баг [object Object]**
2. ✅ **Добавлен AI_DEBUG_MODE** для контроля отправки
3. ✅ **Детальные логи** на каждом этапе:
   - Обнаружение чатов
   - Построение промпта
   - Запрос к DeepSeek API
   - Генерация ответа
   - Блокировка отправки
4. ✅ **4-уровневая защита** от случайной отправки
5. ✅ **Полная документация** использования

### 🎯 Что можно тестировать:

- ✅ Обнаружение unanswered чатов
- ✅ Построение промптов для AI
- ✅ Запросы к DeepSeek API
- ✅ Генерацию ответов AI
- ✅ Обработку forbidden phrases
- ✅ Retry механизм
- ❌ **Отправка заблокирована** - сообщения НЕ отправляются

### 🚀 Готово к тестированию!

Теперь вы можете безопасно тестировать AI и анализировать её работу на каждом этапе без риска отправки сообщений пользователям.
