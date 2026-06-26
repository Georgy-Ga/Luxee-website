# AI Conversation History Implementation
# Реализация Истории Переписки для AI

**Дата:** 26.06.2026  
**Задача:** Отправлять AI последние 10 сообщений вместо одного

---

## 📋 ТЕКУЩАЯ РЕАЛИЗАЦИЯ

### **Что сейчас происходит:**

```javascript
// aiAutoResponseService.js (строка ~380)
const result = await aiResponseService.generateAndSend({
    userId,
    accountId,
    profileUid: profile.uid,
    chatId: chat.chatId,
    profile: {
        username: profile.username,
        age: profile.age,
        country: profile.country,
        city: profile.city,
    },
    manMessage: chat.lastManMessage.body,  // ← ТОЛЬКО последнее сообщение!
    messageType: 1,
    conversationHistory: [],  // ← ПУСТО!
});
```

**Проблема:** AI видит только ОДНО последнее сообщение мужчины, без контекста!

---

## 🎯 НОВАЯ РЕАЛИЗАЦИЯ

### **Что нужно:**

1. ✅ Получить последние 10 сообщений из чата
2. ✅ Определить кто автор (девушка или мужчина)
3. ✅ Получить время отправки
4. ✅ Отправить в правильном порядке (старые → новые)
5. ✅ Указать AI на что отвечать

---

## 🔍 ДОСТУПНЫЕ API

### **1. modelsChat.getChats.list[chatId]**

**Структура чата:**

```javascript
{
    identity: "1506986_1874153",  // chatId
    unAnswered: true,
    lastActivity: "...",
    members: [
        {
            uid: 1506986,           // UID девушки
            type: 2,                // type = 2 = профиль
            username: "Anna",
            first_name: "Anna",
            avatar: { ... }
        },
        {
            uid: 1874153,           // UID мужчины
            type: 10,               // type = 10 = мужчина
            username: "John",
            first_name: "John", 
            avatar: { ... }
        }
    ],
    message: [  // ← МАССИВ СООБЩЕНИЙ!
        {
            _id: "msg1",
            messageId: "6a3d5b26...",
            uid: 1506986,           // Кто отправил
            body: "Hello!",         // Текст
            bodyOrigin: "Hello!",
            createdAt: 1719328526000,  // Timestamp
            uType: 1,               // 1 = от девушки, 2 = от мужчины
            isDeleted: false,
            type: 1                 // 1 = текст, другие = медиа
        },
        {
            _id: "msg2",
            uid: 1874153,           // От мужчины
            body: "Hi there!",
            createdAt: 1719328648000,
            uType: 2,
            type: 1
        },
        // ... и т.д.
    ]
}
```

### **2. modelsChat.getChat.container[0]**

Это HTML контейнер активного чата (DOM элемент).  
Нам НЕ нужен - работаем с `modelsChat.getChats.list` (JSON данные)!

---

## 💡 ПЛАН РЕАЛИЗАЦИИ

### **ШАГ 1: Создать функцию извлечения истории**

```javascript
// В aiAutoResponseService.js или отдельный файл

/**
 * Получить последние N сообщений из чата
 * @param {Object} page - Playwright page
 * @param {string} chatId - ID чата
 * @param {number} limit - Сколько сообщений взять (по умолчанию 10)
 * @returns {Array} - Массив сообщений с метаданными
 */
const getChatHistory = async (page, chatId, limit = 10) => {
    const history = await page.evaluate(({ cId, maxMessages }) => {
        if (!modelsChat || !modelsChat.getChats || !modelsChat.getChats.list) {
            return { error: 'modelsChat not available', messages: [] };
        }

        const chat = modelsChat.getChats.list[cId];
        if (!chat) {
            return { error: 'Chat not found', messages: [] };
        }

        // Получаем members для определения имён
        const profileMember = chat.members?.find(m => m.type === 2);  // Девушка
        const manMember = chat.members?.find(m => m.type === 10);     // Мужчина

        if (!chat.message || !Array.isArray(chat.message)) {
            return { error: 'No messages', messages: [] };
        }

        // Берём последние N сообщений
        const recentMessages = chat.message.slice(-maxMessages);

        // Форматируем каждое сообщение
        const formatted = recentMessages.map(msg => {
            // Определяем автора по uid
            const isFromProfile = msg.uid === profileMember?.uid;
            const author = isFromProfile ? profileMember : manMember;

            return {
                text: msg.body || msg.bodyOrigin || '',
                timestamp: msg.createdAt,
                timestampFormatted: new Date(msg.createdAt).toLocaleString('ru-RU'),
                isFromProfile: isFromProfile,
                isFromMan: !isFromProfile,
                authorName: author?.username || author?.first_name || 'Unknown',
                authorUid: msg.uid,
                messageType: msg.type || 1,  // 1 = текст
                uType: msg.uType  // 1 = от профиля, 2 = от мужчины
            };
        });

        return {
            messages: formatted,
            profileName: profileMember?.username || profileMember?.first_name,
            manName: manMember?.username || manMember?.first_name,
            totalMessages: chat.message.length
        };
    }, { cId: chatId, maxMessages: limit });

    return history;
};
```

### **ШАГ 2: Форматировать для AI**

```javascript
/**
 * Форматировать историю для отправки AI
 * @param {Array} messages - Массив сообщений
 * @param {string} profileName - Имя девушки
 * @param {string} manName - Имя мужчины
 * @returns {string} - Отформатированная история
 */
const formatHistoryForAI = (messages, profileName, manName) => {
    if (!messages || messages.length === 0) {
        return '';
    }

    let formatted = '=== CONVERSATION HISTORY (recent messages) ===\n\n';

    messages.forEach((msg, index) => {
        const authorName = msg.isFromProfile ? profileName : manName;
        const timeStr = new Date(msg.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        formatted += `[${timeStr}] ${authorName}: ${msg.text}\n`;
    });

    formatted += '\n=== END OF HISTORY ===\n\n';
    formatted += `You are responding to the LAST message from ${manName}.\n`;
    formatted += `Write your reply as ${profileName}.\n`;

    return formatted;
};
```

### **ШАГ 3: Интегрировать в aiAutoResponseService**

```javascript
// В _processProfileWithRetries или _schedulePendingResponse

// БЫЛО:
const result = await aiResponseService.generateAndSend({
    manMessage: chat.lastManMessage.body,
    conversationHistory: [],
});

// СТАНЕТ:
// 1. Получаем историю
const history = await getChatHistory(page, chat.chatId, 10);

// 2. Форматируем
const formattedHistory = formatHistoryForAI(
    history.messages,
    profile.username,
    chat.memberUsername
);

// 3. Отправляем AI
const result = await aiResponseService.generateAndSend({
    manMessage: chat.lastManMessage.body,  // Оставляем для обратной совместимости
    conversationHistory: history.messages,  // ← НОВОЕ!
    formattedHistory: formattedHistory,     // ← Для промпта
});
```

### **ШАГ 4: Обновить aiService для использования истории**

```javascript
// В aiService/index.js

const generateResponse = async ({
    profile,
    manMessage,
    messageType,
    conversationHistory = [],
    formattedHistory = ''
}) => {
    // Строим промпт с историей
    let userPrompt = '';

    if (formattedHistory) {
        // Если есть история - добавляем её
        userPrompt = `${formattedHistory}\n\nMan's last message: ${manMessage}\n\nYour reply:`;
    } else {
        // Fallback - старая логика
        userPrompt = `Man's message: ${manMessage}\n\nYour reply:`;
    }

    // Отправляем в AI API
    const response = await fetch(AI_API_URL, {
        // ... формируем запрос
    });

    return aiResponse;
};
```

---

## 🧪 СПОСОБЫ ТЕСТИРОВАНИЯ

### **ВАРИАНТ 1: Тест в браузере (F12 Console)**

```javascript
// 1. Открыть luxee.io/chats
// 2. Открыть любой чат
// 3. В консоли F12:

// Получить chatId активного чата
const activeChatId = modelsChat.getChats?.active?.identity;
console.log('Active chat ID:', activeChatId);

// Получить чат
const chat = modelsChat.getChats.list[activeChatId];
console.log('Chat data:', chat);

// Получить сообщения
console.log('Total messages:', chat.message.length);
console.log('Last 10 messages:', chat.message.slice(-10));

// Форматировать как мы хотим
const profileMember = chat.members.find(m => m.type === 2);
const manMember = chat.members.find(m => m.type === 10);

chat.message.slice(-10).forEach(msg => {
    const author = msg.uid === profileMember.uid ? profileMember.username : manMember.username;
    const time = new Date(msg.createdAt).toLocaleString();
    console.log(`[${time}] ${author}: ${msg.body}`);
});
```

**Результат:** Увидите форматированную историю в консоли!

### **ВАРИАНТ 2: Тест через backend (логи)**

```javascript
// В aiAutoResponseService.js добавить логи:

console.log('');
console.log('🔍 [HISTORY TEST] ===== CHAT HISTORY =====');
const history = await getChatHistory(page, chat.chatId, 10);
console.log('  Total messages in chat:', history.totalMessages);
console.log('  Returned messages:', history.messages.length);
console.log('  Profile name:', history.profileName);
console.log('  Man name:', history.manName);
console.log('');
console.log('  Messages:');
history.messages.forEach((msg, i) => {
    console.log(`    ${i + 1}. [${msg.timestampFormatted}] ${msg.authorName}: ${msg.text}`);
});
console.log('═'.repeat(80));
console.log('');
```

**Результат:** В логах backend увидите всю историю!

### **ВАРИАНТ 3: Dry-run без отправки**

```javascript
// 1. Установить AI_DEBUG_MODE = true
// 2. Добавить логирование промпта:

if (AI_DEBUG_MODE) {
    console.log('');
    console.log('📨 [AI DEBUG] Full prompt that would be sent:');
    console.log('═'.repeat(80));
    console.log(formattedHistory);
    console.log('═'.repeat(80));
    console.log('');
}
```

**Результат:** Увидите весь промпт который пошёл бы в AI!

### **ВАРИАНТ 4: Playwright evaluate тест**

```javascript
// Создать тестовый файл test-chat-history.js

import aiBrowserContextService from './services/browser/aiBrowserContextService.js';
import pageHelpers from './services/browser/pageHelpers.js';

const testChatHistory = async (accountId, chatId) => {
    const context = await aiBrowserContextService.getAiContext(accountId);
    const page = await pageHelpers.getOrCreatePage(context);

    const history = await page.evaluate((cId) => {
        const chat = modelsChat.getChats.list[cId];
        return {
            totalMessages: chat.message.length,
            last10: chat.message.slice(-10).map(m => ({
                author: m.uid,
                text: m.body,
                time: m.createdAt
            }))
        };
    }, chatId);

    console.log('History test result:', JSON.stringify(history, null, 2));
};

// Запустить
testChatHistory('accountId', 'chatId');
```

---

## 📊 ПРИМЕР ВЫВОДА

### **В консоли F12:**

```
[Jun 25, 7:45 PM] Anna: BOOORRRIIINGGGG... why men don't write me?
[Jun 25, 7:50 PM] John: [Wink emoji]
[Jun 25, 7:52 PM] Anna: My friend's husband brings her coffee in bed...
[Jun 26, 9:25 AM] Anna: are you fake?
```

### **В логах backend:**

```
🔍 [HISTORY TEST] ===== CHAT HISTORY =====
  Total messages in chat: 4
  Returned messages: 4
  Profile name: Anna
  Man name: John

  Messages:
    1. [25.06.2026, 19:45:26] Anna: BOOORRRIIINGGGG... why men don't write me?
    2. [25.06.2026, 19:50:48] John: [Wink]
    3. [25.06.2026, 19:52:06] Anna: My friend's husband brings her coffee...
    4. [26.06.2026, 09:25:23] Anna: are you fake?
```

### **Промпт для AI:**

```
=== CONVERSATION HISTORY (recent messages) ===

[Jun 25, 7:45 PM] Anna: BOOORRRIIINGGGG... why men don't write me?
[Jun 25, 7:50 PM] John: [Wink emoji]
[Jun 25, 7:52 PM] Anna: My friend's husband brings her coffee in bed every morning...
[Jun 26, 9:25 AM] Anna: are you fake?

=== END OF HISTORY ===

You are responding to the LAST message from John.
Write your reply as Anna.

Man's last message: [Wink emoji]

Your reply:
```

---

## ✅ ПРЕИМУЩЕСТВА НОВОЙ СИСТЕМЫ

| Что улучшится | Как | Почему важно |
|---------------|-----|--------------|
| **Контекст** | AI видит 10 сообщений | Понимает о чём разговор |
| **Связность** | Ответы связаны с темой | Не случайные темы |
| **Естественность** | Учитывает предыдущие ответы | Не повторяется |
| **Время** | AI видит когда написано | Может учесть задержку |
| **Имена** | AI знает имена обоих | Может обращаться правильно |

---

## 🎯 ИТОГОВЫЙ ЧЕКЛИСТ

### **Для реализации:**

- [ ] Создать функцию `getChatHistory()`
- [ ] Создать функцию `formatHistoryForAI()`
- [ ] Интегрировать в `aiAutoResponseService`
- [ ] Обновить `aiService` для использования истории
- [ ] Добавить логирование для отладки
- [ ] Тестировать в F12 консоли
- [ ] Тестировать через backend логи
- [ ] Проверить что AI отвечает с учётом контекста

### **Для тестирования:**

**Метод 1 - F12 Console (самый быстрый):**
```javascript
const chat = modelsChat.getChats.list[modelsChat.getChats.active.identity];
chat.message.slice(-10).forEach(m => console.log(m.body));
```

**Метод 2 - Backend логи:**
```javascript
console.log('History:', JSON.stringify(history, null, 2));
```

**Метод 3 - AI_DEBUG_MODE:**
```javascript
AI_DEBUG_MODE = true;  // Видим промпт без отправки
```

---

## 🚀 ГОТОВО К РЕАЛИЗАЦИИ!

Всё проанализировано, структура понятна, план готов!  
Можно начинать кодить! 💪
