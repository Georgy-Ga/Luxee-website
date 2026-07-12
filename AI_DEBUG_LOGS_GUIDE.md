# 🔍 AI Debug Logs - Полное руководство

## 📋 Обзор

Добавлено подробное логирование во все ключевые компоненты AI системы для диагностики проблем с обработкой сообщений.

**Логика работы НЕ изменена!** Только добавлены console.log для отладки.

---

## 🎯 Что логируется

### 1️⃣ **Поиск чатов** (`profileScanner.js`)
### 2️⃣ **Извлечение истории** (`chatMessagesExtractorService.js`)
### 3️⃣ **Обработка чата** (`chatProcessor.js`)
### 4️⃣ **Главный цикл** (`index.js`)

---

## 📊 Логи по категориям

### 🔍 **[SCAN] - Поиск unanswered чатов**

**Файл:** `backend/src/services/aiAuto/profileScanner.js`

**Функция:** `getAllChatsForProfile()`

```
[🔍 SCAN] ========== SCANNING CHATS ==========
[🔍 SCAN] Profile UIDs: [610648, 1766301, 2042563, 2090508, 2090514, 2122836]
[🔍 SCAN] Total chats in system: 250
```

**Для каждого чата профиля:**
```
[🔍 SCAN] Chat 2042563_2563925: {
  profileUid: '2042563',
  manUid: '2563925',
  unAnswered: true,
  lastActivity: 1720710245000,
  membersCount: 2
}
```

**Если чат пропускается:**
```
[🔍 SCAN] ❌ Chat 2042563_2563925 skipped: unAnswered=false
```

**Если чат найден (unanswered):**
```
[🔍 SCAN] ✅ UNANSWERED Chat 2042563_2563925: {
  manMember: {
    uid: 2563925,
    username: 'Andy',
    firstName: 'Andrew',
    gender: 1
  }
}
```

**Итоги сканирования:**
```
[🔍 SCAN] ========== SCAN COMPLETE ==========
[🔍 SCAN] Total scanned: 250
[🔍 SCAN] Belongs to profile: 14
[🔍 SCAN] Has unAnswered=true: 2
[🔍 SCAN] Final result: 2 chats
[🔍 SCAN] Result: [
  { chatId: '2042563_2563925', manName: 'Andy', ... },
  { chatId: '2090508_2808646', manName: 'Philarious', ... }
]
```

---

### 💬 **[HISTORY] - Извлечение истории сообщений**

**Файл:** `backend/src/services/luxeeApi/chatMessagesExtractorService.js`

**Функция:** `getChatHistory()`

**Начало извлечения:**
```
[💬 HISTORY] ========== EXTRACTING CHAT HISTORY ==========
[💬 HISTORY] Active chat ID: 2042563_2563925
[💬 HISTORY] Chat data: {
  chatId: '2042563_2563925',
  unAnswered: true,
  lastActivity: 1720710245000,
  membersCount: 2
}
```

**🔑 КРИТИЧНО! Проверка members:**
```
[💬 HISTORY] All members: [
  {
    uid: 2563925,
    username: 'Andy',
    firstName: 'Andrew',
    type: undefined,    ← Если undefined - БАГ!
    gender: 1
  },
  {
    uid: 2042563,
    username: 'Tanya',
    firstName: 'Tatiana',
    type: undefined,    ← Если undefined - БАГ!
    gender: 2
  }
]
```

**Поиск по type (текущий код):**
```
[💬 HISTORY] Found by type: {
  profileMember: 'NOT_FOUND',  ← Если NOT_FOUND - поле type не существует!
  manMember: 'NOT_FOUND'
}
```

**Поиск по gender (правильный способ):**
```
[💬 HISTORY] Found by gender: {
  profileByGender: {
    uid: 2042563,
    username: 'Tanya',
    type: undefined,
    gender: 2
  },
  manByGender: {
    uid: 2563925,
    username: 'Andy',
    type: undefined,
    gender: 1
  }
}
```

**Извлечение сообщений:**
```
[💬 HISTORY] Total DOM messages found: 15
```

**Итоги:**
```
[💬 HISTORY] ========== MESSAGES EXTRACTED ==========
[💬 HISTORY] Total messages: 15
[💬 HISTORY] Recent messages: 10
[💬 HISTORY] Last message: {
  author: 'Tanya',
  isFromProfile: true,
  isFromMan: false,
  text: 'Yay, another pizza lover! What\'s your go-to toppi...',
  messageType: 'text',
  cssClasses: 'owner=true, opponent=false'
}
```

**Последние 3 сообщения:**
```
[💬 HISTORY] Last 3 messages:
  [1] Andy (profile=false, man=true): I love pussy...
  [2] Tanya (profile=true, man=false): Hi Andy! Pizza is the best, right?...
  [3] Tanya (profile=true, man=false): Yay, another pizza lover! What's your...
```

---

### 🔧 **[PROCESSOR] - Обработка чата**

**Файл:** `backend/src/services/aiAuto/chatProcessor.js`

**Функция:** `processSingleChat()`

**Начало обработки:**
```
[🔧 PROCESSOR] ========== PROCESSING CHAT ==========
[🔧 PROCESSOR] Chat: {
  chatId: '2042563_2563925',
  manName: 'Andy',
  manUid: 2563925,
  lastActivity: 1720710245000
}
[🔧 PROCESSOR] Profile: {
  uid: 610648,
  username: 'Tanya',
  allUids: [610648, 1766301, 2042563, 2090508, 2090514, 2122836]
}
```

**Навигация:**
```
[🔧 PROCESSOR] Navigation URL: https://luxee.io/chats/?ownerUid=610648&profileUid=2042563&userUid=2563925
```

**🎯 КРИТИЧНО! Проверка shouldReply:**
```
[🔧 PROCESSOR] Should reply check: {
  shouldReply: false,
  reason: 'Last message is from profile (Tanya) - already replied',
  lastMessageAuthor: 'Tanya',
  lastMessageIsFromProfile: true,
  lastMessageIsFromMan: false
}
```

**Если пропускается:**
```
[🔧 PROCESSOR] ❌ SKIPPING CHAT: Last message is from profile (Tanya) - already replied
```

**Если будет ответ:**
```
[🔧 PROCESSOR] ✅ Will generate AI response
```

---

### 🤖 **[AI AUTO] - Главный оркестратор**

**Файл:** `backend/src/services/aiAuto/index.js`

**Функция:** `processAccountMessages()`

**Активный профиль:**
```
[🤖 AI AUTO] ========== ACTIVE PROFILE ==========
[🤖 AI AUTO] Profile: {
  username: 'Tanya',
  uid: 610648,
  allUids: [610648, 1766301, 2042563, 2090508, 2090514, 2122836]
}
```

**Найденные чаты:**
```
[🤖 AI AUTO] Active chats found: 2
[🤖 AI AUTO] All active chats: [
  { chatId: '2042563_2563925', manName: 'Andy', lastActivity: 1720710245000 },
  { chatId: '2090508_2808646', manName: 'Philarious', lastActivity: 1720710100000 }
]
```

**🚨 ВАЖНО! Какой чат обрабатывается:**
```
[🤖 AI AUTO] 🎯 Processing FIRST chat: {
  chatId: '2042563_2563925',
  manName: 'Andy',
  position: '1 of 2'
}
```

**Если не удалось отправить:**
```
[🤖 AI AUTO] ⚠️  Failed on active profile: shouldnt_reply
[🤖 AI AUTO] Note: Only FIRST chat was processed. Remaining chats: 1
```

**🔥 ВОТ ПРОБЛЕМА!** Второй чат (Philarious) **НИКОГДА НЕ ОБРАБАТЫВАЕТСЯ!**

---

## 🎯 Как использовать логи для диагностики

### **Проблема: "Система находит unanswered чаты, но не отвечает"**

#### Шаг 1: Проверь логи `[🔍 SCAN]`

**Смотри:**
- Сколько чатов найдено с `unAnswered=true`?
- Какие chatId?
- Порядок чатов в Result?

#### Шаг 2: Проверь логи `[🤖 AI AUTO]`

**Смотри:**
- Какой чат обрабатывается ПЕРВЫМ?
- Сколько чатов осталось необработанными?

#### Шаг 3: Проверь логи `[💬 HISTORY]`

**🔑 КРИТИЧНО! Смотри:**
```
[💬 HISTORY] Found by type: {
  profileMember: 'NOT_FOUND',  ← ❌ ЕСЛИ ЭТО NOT_FOUND
  manMember: 'NOT_FOUND'        ← ❌ ЗНАЧИТ БАГ!
}
```

**Если `NOT_FOUND` → поле `m.type` не существует в API!**

**Проверь:**
```
[💬 HISTORY] Found by gender: {
  profileByGender: { ... },  ← ✅ ДОЛЖНО БЫТЬ НАЙДЕНО
  manByGender: { ... }        ← ✅ ДОЛЖНО БЫТЬ НАЙДЕНО
}
```

**Если по gender находится, а по type нет → нужно исправить код!**

#### Шаг 4: Проверь логи `[🔧 PROCESSOR]`

**Смотри:**
```
[🔧 PROCESSOR] Should reply check: {
  shouldReply: false,  ← ❌ Почему false?
  reason: '...',
  lastMessageIsFromProfile: true,  ← Это правильно?
  lastMessageIsFromMan: false
}
```

**Проверь последние 3 сообщения:**
```
[💬 HISTORY] Last 3 messages:
  [1] Andy: ...      ← Это сообщение от мужчины
  [2] Tanya: ...     ← Это от девушки
  [3] Tanya: ...     ← Это последнее (от девушки)
```

**Если последнее от девушки → система правильно пропускает!**

**НО! Если в API `unAnswered: true`, а последнее от девушки → НЕСООТВЕТСТВИЕ!**

---

## 🚨 Типичные проблемы в логах

### **Проблема #1: members NOT_FOUND**

```
[💬 HISTORY] Found by type: {
  profileMember: 'NOT_FOUND',
  manMember: 'NOT_FOUND'
}
```

**Причина:** Поле `m.type` не существует в Luxee API

**Решение:** Использовать `m.gender` вместо `m.type`

```javascript
// БЫЛО:
const profileMember = chat.members.find(m => m.type === 2);
const manMember = chat.members.find(m => m.type === 10);

// ДОЛЖНО БЫТЬ:
const profileMember = chat.members.find(m => m.gender === 2);
const manMember = chat.members.find(m => m.gender === 1);
```

---

### **Проблема #2: Цикл на одном чате**

```
[🤖 AI AUTO] All active chats: [
  { chatId: 'A', ... },
  { chatId: 'B', ... }
]
[🤖 AI AUTO] Processing FIRST chat: { chatId: 'A', position: '1 of 2' }
[🔧 PROCESSOR] ❌ SKIPPING CHAT: already replied
[🤖 AI AUTO] Note: Only FIRST chat was processed. Remaining chats: 1

// Через 5 секунд повторяется:
[🤖 AI AUTO] Processing FIRST chat: { chatId: 'A', position: '1 of 2' }
```

**Причина:** Обрабатывается только ПЕРВЫЙ чат из списка

**Решение:** Обрабатывать ВСЕ чаты по очереди, а не только первый

---

### **Проблема #3: unAnswered=true, но lastMessage от девушки**

```
[🔍 SCAN] Chat A: { unAnswered: true, ... }
[💬 HISTORY] Last message: { author: 'Tanya', isFromProfile: true }
[🔧 PROCESSOR] ❌ SKIPPING: Last message is from profile
```

**Причина:** 
- API показывает `unAnswered: true` (есть непрочитанное старое сообщение)
- Но ПОСЛЕДНЕЕ сообщение от девушки (новое)

**Это НОРМАЛЬНО!** Система правильно пропускает чат.

---

## 📝 Как читать логи в Docker

```bash
# Показать последние 100 строк логов
docker-compose logs --tail=100 luxee-backend

# Фильтр только AI логов
docker-compose logs --tail=200 luxee-backend | grep "\[🔍\|💬\|🔧\|🤖\]"

# Следить за логами в реальном времени
docker-compose logs -f luxee-backend | grep "SCAN\|HISTORY\|PROCESSOR\|AI AUTO"
```

---

## ✅ Следующие шаги

1. **Запусти AI систему**
2. **Смотри логи в Docker**
3. **Найди паттерн:**
   - Какие чаты находятся?
   - Какой чат обрабатывается?
   - Почему пропускается?
   - Есть ли `members NOT_FOUND`?
4. **Сообщи результаты**

**С этими логами мы точно найдем проблему!** 🎯
