# 🔧 AI Pending Infinite Loop Fix

## 🐛 Проблема

AI система постоянно находит один и тот же чат как "unanswered" и пытается ответить, хотя сообщение уже было отправлено. Цикл повторяется бесконечно.

### Симптомы из логов:
```
[AI Auto] ✅ Found 2 unanswered chats on Mary (attempt 1)
[AI Auto] Processing FIRST chat: Bigdockdaddy (2400232_2797375)
[Pending] 📅 Scheduling response for Bigdockdaddy in 10 seconds...
[Pending] ⏰ Time's up! Executing scheduled response for Bigdockdaddy...
[Pending] 🔄 Chat mismatch! Opening target chat 2400232_2797375...
[Pending] ❌ Failed to navigate to chat: chatNavigationService.navigateToChat is not a function
[Pending] 🔍 Check result: SKIP ❌
[Pending] 📝 Reason: Last message is from profile (Mary) - already replied
[Pending] ⏭️  Skipping chat 2400232_2797375
// ... цикл повторяется
```

---

## 🔍 Анализ: Корневые причины

### 1. **Навигация НЕ работает**
```javascript
❌ chatNavigationService.navigateToChat is not a function
```
- Старый код пытается вызвать несуществующую функцию
- Навигация не происходит → чат не загружается
- `modelsChat.getChats.active` не обновляется

### 2. **История читается ДО навигации**
```javascript
❌ const history = await chatMessagesExtractorService.getChatHistory(historyPage, 10);
```
- Читает историю из СТАРОГО активного чата
- Поэтому видит сообщение от профиля из ДРУГОГО чата
- Пропускает отправку, но чат остаётся в "unanswered"

### 3. **Проверка `unAnswered` не используется**
```javascript
❌ Нет проверки modelsChat.getChats.active.unAnswered
```
- После отправки сообщения `unAnswered` становится `false`
- Но код этого не проверяет
- Полагается только на последнее сообщение из истории

### 4. **Неправильный формат URL**
```javascript
❌ const [ownerUid, userUid] = chatId.split('_');
❌ const targetUrl = `...?ownerUid=${ownerUid}&profileUid=${profileUid}...`;
```
- `ownerUid` должен быть **inner UID** (например, 608895)
- Но код берёт **outer UID** из chatId (например, 2400232)
- URL неправильный → навигация не работает даже если функция бы существовала

---

## ✅ Решение: 3 ключевых исправления

### Исправление 1: Правильная навигация через `page.goto()`

**Было:**
```javascript
const [ownerUid, userUid] = chatId.split('_');
const targetUrl = `https://luxee.io/chats/?ownerUid=${ownerUid}&profileUid=${profileUid}&userUid=${userUid}`;
await historyPage.goto(targetUrl);
```

**Должно быть:**
```javascript
// chatId = "2400232_2797375" (outer_man)
const [profileUidOuter, userUid] = chatId.split('_');

// profileUid здесь = inner UID (608895 для Mary)
const targetUrl = `https://luxee.io/chats/?ownerUid=${profileUid}&profileUid=${profileUidOuter}&userUid=${userUid}`;
// Результат: https://luxee.io/chats/?ownerUid=608895&profileUid=2400232&userUid=2797375

console.log(`[Pending] 🌐 Navigating to: ${targetUrl}`);
await historyPage.goto(targetUrl, { 
    waitUntil: 'domcontentloaded', 
    timeout: 10000 
});

// КРИТИЧНО: Ждём загрузки чата
await historyPage.waitForTimeout(2000);

// Проверяем что навигация успешна
const newChatId = await historyPage.evaluate(() => {
    return window.modelsChat?.getChats?.active?.identity;
});

if (newChatId !== chatId) {
    console.log(`[Pending] ⚠️  Navigation failed: expected ${chatId}, got ${newChatId}`);
    pendingResponses.delete(chatId);
    return;
}
```

---

### Исправление 2: Проверка `unAnswered` ПЕРЕД чтением истории

**Добавить СРАЗУ после навигации:**
```javascript
// 🔧 ФИКС: Проверяем unAnswered из active чата (после навигации)
console.log(`[Pending] 📜 Checking unAnswered status...`);
const chatStatus = await historyPage.evaluate(() => {
    const activeChat = window.modelsChat?.getChats?.active;
    return {
        identity: activeChat?.identity,
        unAnswered: activeChat?.unAnswered
    };
});

console.log(`[Pending] 📊 Chat status:`, chatStatus);

if (chatStatus.unAnswered === false) {
    console.log(`[Pending] 🔍 Check result: SKIP ❌`);
    console.log(`[Pending] 📝 Reason: unAnswered is false - already replied`);
    console.log(`[Pending] ⏭️  Skipping chat ${chatId}`);
    pendingResponses.delete(chatId);
    return; // ← КРИТИЧНО: Выходим, не генерируем ответ
}
```

---

### Исправление 3: Чтение истории из `getChat.list[chatId]`

**Было:**
```javascript
const history = await chatMessagesExtractorService.getChatHistory(historyPage, 10);
```

**Должно быть:**
```javascript
// Получаем историю ПОСЛЕ навигации из getChat.list[chatId]
console.log(`[Pending] 📜 Extracting chat history from getChat.list...`);
const history = await historyPage.evaluate(() => {
    try {
        const chatId = window.modelsChat?.getChats?.active?.identity;
        const messages = window.modelsChat?.getChat?.list?.[chatId];
        
        if (!messages || messages.length === 0) {
            return { error: 'No messages found in getChat.list', messages: [] };
        }

        console.log(`[Pending] 📊 Found ${messages.length} messages`);

        // Преобразуем в нужный формат
        const formattedMessages = messages.map(msg => ({
            text: msg.body || '',
            author: msg.author?.first_name || msg.author?.username || 'Unknown',
            authorUid: msg.author?.uid,
            gender: msg.author?.gender, // 1=male, 2=female
            created: msg.created,
            media: msg.media || [],
            type: msg.type,
            messageType: 'text'
        }));

        const lastMessage = formattedMessages[formattedMessages.length - 1];

        return {
            messages: formattedMessages,
            lastMessage: lastMessage,
            totalCount: messages.length,
            chatId: chatId
        };
    } catch (error) {
        return { error: error.message, messages: [] };
    }
});

// Проверка последнего сообщения по gender
const lastMessage = history.lastMessage;

console.log(`[Pending] 🔍 Last message check:`);
console.log(`[Pending] 👤 Author: ${lastMessage?.author}`);
console.log(`[Pending] 💬 Text: "${lastMessage?.text?.substring(0, 50)}..."`);
console.log(`[Pending] 🏷️ Gender: ${lastMessage?.gender} (1=male, 2=female)`);

// Если gender === 2, значит последнее сообщение от профиля
if (lastMessage?.gender === 2) {
    console.log(`[Pending] 🔍 Check result: SKIP ❌`);
    console.log(`[Pending] 📝 Reason: Last message from profile (gender=2)`);
    console.log(`[Pending] ⏭️  Skipping chat ${chatId}`);
    pendingResponses.delete(chatId);
    return;
}

// Если gender === 1, значит от мужчины - продолжаем
if (lastMessage?.gender !== 1) {
    console.log(`[Pending] ⚠️  Unknown gender: ${lastMessage?.gender}`);
    pendingResponses.delete(chatId);
    return;
}

console.log(`[Pending] ✅ Last message from man (gender=1) - proceeding`);
```

---

## 📝 Полная последовательность исправлений

### Файл: `backend/src/services/aiAutoResponseService.js`

### Место: Внутри `setTimeout` функции в `_schedulePendingResponse`

**Найти блок:**
```javascript
console.log(`[Pending] ✅ All checks passed, navigating to chat...`);

// 📜 НОВОЕ: Извлекаем историю сообщений из активного чата
const aiContext = await aiBrowserContextService.getAiContext(accountId);
const historyPage = await pageHelpers.getOrCreatePage(aiContext);
```

**Заменить всё от этого места до блока генерации ответа на:**

```javascript
console.log(`[Pending] ✅ All checks passed, navigating to chat...`);

// 📜 Получаем AI контекст
const aiContext = await aiBrowserContextService.getAiContext(accountId);
const historyPage = await pageHelpers.getOrCreatePage(aiContext);

// 🔄 Навигация к нужному чату для загрузки данных
console.log(`[Pending] 📍 Current chat: ${await historyPage.evaluate(() => {
    return window.modelsChat?.getChats?.active?.identity || 'unknown';
})}`);
console.log(`[Pending] 🎯 Target chat: ${chatId}`);

// Проверяем совпадает ли текущий чат с целевым
const currentChatId = await historyPage.evaluate(() => {
    return window.modelsChat?.getChats?.active?.identity;
});

if (currentChatId !== chatId) {
    console.log(`[Pending] 🔄 Chat mismatch! Opening target chat ${chatId}...`);
    
    try {
        // 🔧 ФИКС: Правильный формат URL
        // chatId = "profileUidOuter_userUid" (например "2400232_2797375")
        const [profileUidOuter, userUid] = chatId.split('_');
        
        // ownerUid = inner UID профиля (например 608895 для Mary)
        // profileUid = outer UID профиля из chatId (например 2400232)
        const targetUrl = `https://luxee.io/chats/?ownerUid=${profileUid}&profileUid=${profileUidOuter}&userUid=${userUid}`;
        
        console.log(`[Pending] 🌐 Navigating to: ${targetUrl}`);
        
        await historyPage.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 10000 
        });
        
        // Ждём загрузки чата и проверяем что он активирован
        await historyPage.waitForTimeout(2000);
        
        const newChatId = await historyPage.evaluate(() => {
            return window.modelsChat?.getChats?.active?.identity;
        });
        
        if (newChatId === chatId) {
            console.log(`[Pending] ✅ Navigated to chat ${chatId}`);
        } else {
            console.log(`[Pending] ⚠️  Navigation failed: expected ${chatId}, got ${newChatId}`);
            pendingResponses.delete(chatId);
            return;
        }
    } catch (navError) {
        console.error(`[Pending] ❌ Failed to navigate:`, navError.message);
        pendingResponses.delete(chatId);
        return;
    }
} else {
    console.log(`[Pending] ✅ Already on target chat`);
}

// 🔧 ФИКС: Проверяем unAnswered из active чата (после навигации)
console.log(`[Pending] 📜 Checking unAnswered status...`);
const chatStatus = await historyPage.evaluate(() => {
    const activeChat = window.modelsChat?.getChats?.active;
    return {
        identity: activeChat?.identity,
        unAnswered: activeChat?.unAnswered
    };
});

console.log(`[Pending] 📊 Chat status:`, chatStatus);

if (chatStatus.unAnswered === false) {
    console.log(`[Pending] 🔍 Check result: SKIP ❌`);
    console.log(`[Pending] 📝 Reason: unAnswered is false - already replied`);
    console.log(`[Pending] ⏭️  Skipping chat ${chatId}`);
    pendingResponses.delete(chatId);
    return;
}

// Получаем историю ПОСЛЕ навигации из getChat.list[chatId]
console.log(`[Pending] 📜 Extracting chat history from getChat.list...`);
const history = await historyPage.evaluate(() => {
    try {
        const chatId = window.modelsChat?.getChats?.active?.identity;
        const messages = window.modelsChat?.getChat?.list?.[chatId];
        
        if (!messages || messages.length === 0) {
            return { error: 'No messages found in getChat.list', messages: [] };
        }

        console.log(`[Pending] 📊 Found ${messages.length} messages in getChat.list[${chatId}]`);

        // Преобразуем в нужный формат
        const formattedMessages = messages.map(msg => ({
            text: msg.body || '',
            author: msg.author?.first_name || msg.author?.username || 'Unknown',
            authorUid: msg.author?.uid,
            gender: msg.author?.gender, // 1=male, 2=female
            created: msg.created,
            media: msg.media || [],
            type: msg.type,
            messageType: 'text'
        }));

        const lastMessage = formattedMessages[formattedMessages.length - 1];

        return {
            messages: formattedMessages,
            lastMessage: lastMessage,
            totalCount: messages.length,
            chatId: chatId
        };
    } catch (error) {
        return { error: error.message, messages: [] };
    }
});

console.log(`[Pending] 📊 History result:`, {
    error: history.error,
    messagesCount: history.messages?.length,
    chatId: history.chatId
});

if (history.error) {
    console.log(`[Pending] ⚠️  Could not get chat history: ${history.error}`);
    console.log(`[Pending] Falling back to old method...`);

    // Fallback - используем старый метод
    const result = await aiResponseService.generateAndSend({
        userId,
        accountId,
        profileUid,
        chatId,
        profile,
        manMessage: chat.lastManMessage.body,
        messageType: 1,
        conversationHistory: [],
    });

    if (result.success) {
        console.log(`[Pending] ✅ Successfully sent AI response to ${chat.memberUsername}`);
    } else {
        console.log(`[Pending] ✗ Failed to send: ${result.reason || 'Unknown error'}`);
    }
    pendingResponses.delete(chatId);
    return;
}

// 🔧 ФИКС: Проверяем gender последнего сообщения (1=male, 2=female)
const lastMessage = history.lastMessage;

console.log(`[Pending] 🔍 Last message check:`);
console.log(`[Pending] 👤 Author: ${lastMessage?.author}`);
console.log(`[Pending] 💬 Text: "${lastMessage?.text?.substring(0, 50)}..."`);
console.log(`[Pending] 🏷️ Gender: ${lastMessage?.gender} (1=male, 2=female)`);

// Если gender === 2, значит последнее сообщение от профиля - мы уже ответили
if (lastMessage?.gender === 2) {
    console.log(`[Pending] 🔍 Check result: SKIP ❌`);
    console.log(`[Pending] 📝 Reason: Last message from profile (gender=2) - already replied`);
    console.log(`[Pending] ⏭️  Skipping chat ${chatId}`);
    pendingResponses.delete(chatId);
    return;
}

// Если gender === 1, значит последнее сообщение от мужчины - нужно ответить
if (lastMessage?.gender !== 1) {
    console.log(`[Pending] ⚠️  Unknown gender: ${lastMessage?.gender}`);
    pendingResponses.delete(chatId);
    return;
}

console.log(`[Pending] ✅ Last message from man (gender=1) - proceeding with response`);

// Форматируем историю для AI
const formattedHistory = history.messages.map((msg, i) => {
    const isFromProfile = msg.gender === 2;
    const speakerName = isFromProfile ? profile.username : history.messages.find(m => m.gender === 1)?.author || 'Man';
    return `${speakerName}: ${msg.text}`;
}).join('\n');

console.log(`[Pending] ✅ Should reply to man's message`);
console.log(`[Pending] 📊 History: ${history.messages.length} messages`);
console.log(`[Pending] 💬 Generating AI response...`);

// Генерируем и отправляем с историей
const result = await aiResponseService.generateAndSend({
    userId,
    accountId,
    profileUid,
    chatId,
    profile,
    manMessage: lastMessage.text,
    messageType: 1,
    conversationHistory: history.messages,
    formattedHistory,
    profileName: profile.username,
    manName: history.messages.find(m => m.gender === 1)?.author || 'Man',
});

if (result.success) {
    console.log(`[Pending] ✅ Successfully sent AI response to ${chat.memberUsername}`);
} else {
    console.log(`[Pending] ✗ Failed to send: ${result.reason || 'Unknown error'}`);
}

// Удаляем из очереди
pendingResponses.delete(chatId);
```

---

## 🎯 Что это исправит

### 1. ✅ Навигация будет работать
- Правильный URL формат с inner/outer UIDs
- Используется `page.goto()` вместо несуществующей функции
- Проверка успешности навигации

### 2. ✅ Проверка `unAnswered` ПЕРЕД чтением
- Если `unAnswered === false` → пропускаем (уже ответили)
- Останавливает бесконечный цикл

### 3. ✅ История из правильного чата
- Читаем из `getChat.list[chatId]` ПОСЛЕ навигации
- Используем `author.gender` для определения автора
- Двойная проверка: `unAnswered` + `gender`

### 4. ✅ Нет ложных срабатываний
- Не будет читать историю из другого чата
- Не будет пропускать чаты где действительно нужен ответ

---

## 📚 Дополнительно

См. также:
- **API_LUXEE_DOCUMENTATION.md** - полная документация по Luxee API
- **AI_PENDING_FIX_SOLUTION.md** - предыдущий анализ проблемы

---

**Дата:** 27.06.2026  
**Статус:** ✅ Готово к применению  
**Приоритет:** 🔴 КРИТИЧЕСКИЙ
