# 🎯 AI AUTO RESPONSE - ФИНАЛЬНЫЙ ПЛАН РЕФАКТОРИНГА

**Дата:** 07.07.2026  
**Статус:** Ready for implementation  
**Приоритет:** КРИТИЧЕСКИЙ

---

## 📊 АНАЛИЗ ТЕКУЩЕГО КОДА

### ✅ ЧТО РАБОТАЛО ПРАВИЛЬНО:

#### 1. **chatMessagesExtractorService** (строки 1-271)
```javascript
// Отличный сервис для извлечения истории!
const history = await chatMessagesExtractorService.getChatHistory(page, 10);

// Возвращает:
{
    messages: [...],           // Последние 10 сообщений
    lastMessage: {...},        // Последнее сообщение
    profileName: "Mary",       // Имя девушки
    manName: "John",           // Имя мужчины
    totalInChat: 25            // Всего сообщений
}
```

**Что делает правильно:**
- ✅ Использует `modelsChat.getChat.container[0]` (DOM)
- ✅ Определяет участников через `chat.members` (type: 2=profile, 10=man)
- ✅ Извлекает текст, время, дату, тип сообщения
- ✅ Берёт последние N сообщений (limit=10)
- ✅ Форматирует историю для AI с временем и именами
- ✅ Проверяет `isFromProfile` / `isFromMan` (через CSS классы)

**НО ПРОБЛЕМА:** Использует `members.find(m => m.type === 2/10)` вместо `gender`!

#### 2. **Поиск unanswered чатов** (строки 728-771)
```javascript
const unansweredChats = await page.evaluate(pUid => {
    const chats = modelsChat.getChats.list || {};
    
    for (const chatId in chats) {
        const chat = chats[chatId];
        const chatProfileUid = parseInt(chatId.split('_')[0]);
        
        if (chatProfileUid !== pUid) continue; // Только для этого профиля
        
        if (chat.unAnswered === true) {
            // Находим последнее сообщение от мужчины
            const messages = chat.message || [];
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].uType === 2) { // 2 = от мужчины
                    lastManMessage = messages[i];
                    break;
                }
            }
            
            result.push({
                chatId: chat.identity,
                memberUid: manMember.uid,
                lastManMessage: {...}
            });
        }
    }
    
    return result;
}, profile.uid);
```

**Что работало:**
- ✅ Получает чаты из `modelsChat.getChats.list`
- ✅ Фильтрует по `profileUid` (из chatId)
- ✅ Проверяет `unAnswered === true`
- ✅ Извлекает `lastManMessage` через `uType === 2`

---

### ❌ ЧТО НЕ РАБОТАЛО:

#### 1. **Pending система** (строки 24-308)
- Создаёт setTimeout на 10-15 сек
- НО каждые 5 сек находит ТОТ ЖЕ чат снова
- Создаёт НОВЫЙ setTimeout → ДУБЛИ
- Навигация падает → история извлекается из другого чата

#### 2. **Навигация в pending** (строки 107-143)
```javascript
await chatNavigationService.navigateToChat(page, targetChatId, profileUid);
// ❌ Этот метод НЕ СУЩЕСТВУЕТ!
```

**Проблема:** `chatNavigationService` имеет только `navigateToChats()`, а не `navigateToChat()`!

#### 3. **Race conditions**
- Нет глобальной блокировки
- Может переключиться на другой профиль во время генерации
- История читается из НЕПРАВИЛЬНОГО чата

---

## 🎯 ТРЕБОВАНИЯ К НОВОЙ СИСТЕМЕ

### 1. **ПРИОРИТЕТЫ (КРИТИЧНО!):**
```
1️⃣ unanswered чаты (ВЫСШИЙ ПРИОРИТЕТ)
2️⃣ newMessages (если нет unanswered)
```

**Логика:**
```javascript
// Всегда проверяем ОБА типа, но обрабатываем unanswered ПЕРВЫМИ
const profiles = await getProfilesWithMessages(page);

for (const profile of profiles) {
    // Сначала ищем unanswered
    const unanswered = await findUnansweredChats(page, profile);
    if (unanswered.length > 0) {
        await processChat(unanswered[0]);
        return; // STOP после одного чата
    }
    
    // Если нет unanswered - проверяем newMessages
    if (profile.newMessages > 0) {
        await switchToProfile(profile);
        const chats = await findUnansweredChats(page, profile);
        if (chats.length > 0) {
            await processChat(chats[0]);
            return; // STOP
        }
    }
}
```

### 2. **СИНХРОННОСТЬ (КРИТИЧНО!):**
- Глобальная блокировка для аккаунта (Mutex)
- Один профиль → один чат → обработка → разблокировка
- НЕТ параллельных операций навигации

### 3. **ПРОВЕРКИ:**
- ✅ Двойная проверка: `unAnswered` (API) + DOM container
- ✅ Проверка ДО навигации
- ✅ Проверка ПОСЛЕ генерации (перед отправкой)
- ✅ Резервная проверка через 2 сек

### 4. **ЗАДЕРЖКИ:**
- ✅ После отправки: 3-6 секунд (случайная)
- ✅ Между профилями: 3 секунды
- ✅ После навигации: 2 секунды

### 5. **ИСТОРИЯ:**
- ✅ 10 сообщений (как сейчас)
- ✅ Использовать `chatMessagesExtractorService`
- ✅ Форматирование с временем и именами
- ✅ Убрать дубли в AI запросе

---

## 🏗️ НОВАЯ АРХИТЕКТУРА

### Структура файлов:
```
backend/src/services/aiAuto/
├── index.js                          # Главный orchestrator с блокировкой
├── profileScanner.js                 # Поиск профилей (unanswered + newMessages)
├── chatProcessor.js                  # Обработка одного чата (навигация + проверки)
├── chatValidator.js                  # Двойная проверка (API + DOM)
└── utils.js                          # Вспомогательные функции
```

---

## 💻 ДЕТАЛЬНАЯ ЛОГИКА

### **1. index.js - Главный оркестратор**

```javascript
const processingLocks = new Map(); // accountId → { isProcessing, startedAt }

async function processAccountMessages(accountId, userId) {
    // 🔒 ПРОВЕРКА БЛОКИРОВКИ
    if (processingLocks.has(accountId)) {
        console.log(`[AI Auto] ⏸️  Account locked - skipping`);
        return;
    }
    
    try {
        // 🔐 ЗАБЛОКИРОВАТЬ
        processingLocks.set(accountId, {
            isProcessing: true,
            startedAt: Date.now()
        });
        
        const aiContext = await aiBrowserContextService.getAiContext(accountId);
        const page = await pageHelpers.getOrCreatePage(aiContext);
        
        // ========== ОСНОВНАЯ ЛОГИКА ==========
        
        // 1️⃣ Получить активный профиль
        const activeProfile = await getActiveProfile(page);
        
        // 2️⃣ Проверить unanswered на АКТИВНОМ профиле (приоритет!)
        const activeUnanswered = await profileScanner.findUnansweredChats(page, activeProfile.uid);
        
        if (activeUnanswered.length > 0) {
            console.log(`[AI Auto] 🎯 Found ${activeUnanswered.length} unanswered on ACTIVE profile`);
            const result = await chatProcessor.processSingleChat({
                accountId,
                userId,
                page,
                profile: activeProfile,
                chat: activeUnanswered[0]
            });
            
            if (result.sent) {
                await randomDelay(3000, 6000);
                return;
            }
        }
        
        // 3️⃣ Получить ДРУГИЕ профили
        const allProfiles = await profileScanner.getAllProfilesWithMessages(page);
        const otherProfiles = allProfiles.filter(p => p.uid !== activeProfile.uid);
        
        console.log(`[AI Auto] Found ${otherProfiles.length} other profiles with messages`);
        
        // 4️⃣ Обработать другие профили (приоритет: unanswered > newMessages)
        for (const profile of otherProfiles) {
            // Переключиться на профиль
            await switchToProfile(page, profile.uid);
            await sleep(3000);
            
            // Найти unanswered
            const unanswered = await profileScanner.findUnansweredChats(page, profile.uid);
            
            if (unanswered.length > 0) {
                console.log(`[AI Auto] 📝 Processing unanswered on ${profile.username}`);
                const result = await chatProcessor.processSingleChat({
                    accountId,
                    userId,
                    page,
                    profile,
                    chat: unanswered[0]
                });
                
                if (result.sent) {
                    await randomDelay(3000, 6000);
                    return; // STOP после одного чата
                }
            }
        }
        
        console.log(`[AI Auto] ✅ Finished cycle`);
        
    } finally {
        // 🔓 ВСЕГДА РАЗБЛОКИРОВАТЬ
        processingLocks.delete(accountId);
    }
}
```

### **2. profileScanner.js - Поиск профилей и чатов**

```javascript
// Получить все профили с сообщениями (newMessages ИЛИ unanswered)
async function getAllProfilesWithMessages(page) {
    const profiles = await page.evaluate(() => {
        if (!modelsChat?.getProfile?.data) return [];
        
        const profilesData = modelsChat.getProfile.data;
        const result = [];
        
        for (const uid in profilesData) {
            const profile = profilesData[uid];
            const inner = profile.inner;
            const newMessages = profile.newMessages || 0;
            
            // Добавляем профиль если есть новые сообщения
            if (newMessages > 0) {
                result.push({
                    uid: inner.uid,              // Inner UID
                    username: inner.username,
                    age: inner.age,
                    country: inner.country,
                    city: inner.city,
                    newMessages: newMessages
                });
            }
        }
        
        return result;
    });
    
    return profiles;
}

// Найти unanswered чаты конкретного профиля
async function findUnansweredChats(page, profileUid) {
    const chats = await page.evaluate((pUid) => {
        if (!modelsChat?.getChats?.list) return [];
        
        const chatsList = modelsChat.getChats.list;
        const result = [];
        
        for (const chatId in chatsList) {
            const chat = chatsList[chatId];
            
            // Проверка что чат принадлежит этому профилю
            const [chatProfileUid, manUid] = chatId.split('_');
            if (parseInt(chatProfileUid) !== pUid) continue;
            
            // Проверка unAnswered
            if (chat.unAnswered === true) {
                // Найти мужчину через members.gender
                const manMember = chat.members?.find(m => m.gender === 1);
                
                if (manMember) {
                    // Найти последнее сообщение от мужчины
                    const messages = chat.message || [];
                    let lastManMessage = null;
                    
                    for (let i = messages.length - 1; i >= 0; i--) {
                        if (messages[i].uType === 2) { // 2 = от мужчины
                            lastManMessage = messages[i];
                            break;
                        }
                    }
                    
                    if (lastManMessage) {
                        result.push({
                            chatId: chat.identity || chatId,
                            manUid: manMember.uid,
                            manName: manMember.username || manMember.first_name,
                            lastManMessage: {
                                body: lastManMessage.body,
                                createdAt: lastManMessage.createdAt
                            }
                        });
                    }
                }
            }
        }
        
        // Сортировка по времени (старые первые)
        result.sort((a, b) => a.lastManMessage.createdAt - b.lastManMessage.createdAt);
        
        return result;
    }, profileUid);
    
    return chats;
}

export default {
    getAllProfilesWithMessages,
    findUnansweredChats
};
```

### **3. chatProcessor.js - Обработка чата**

```javascript
async function processSingleChat({ accountId, userId, page, profile, chat }) {
    console.log(`[AI Auto] 📝 Processing chat ${chat.chatId}...`);
    
    try {
        // ========== ПРОВЕРКА #1: unAnswered ДО навигации ==========
        const preCheck = await chatValidator.checkUnAnsweredAPI(page, chat.chatId, profile.uid);
        if (!preCheck.shouldReply) {
            console.log(`[AI Auto] ⏭️  Pre-check failed: ${preCheck.reason}`);
            return { sent: false, reason: 'pre_check_failed' };
        }
        
        // ========== НАВИГАЦИЯ К ЧАТУ ==========
        const [profileUidOuter, userUid] = chat.chatId.split('_');
        const url = `https://luxee.io/chats/?ownerUid=${profile.uid}&profileUid=${profileUidOuter}&userUid=${userUid}`;
        
        console.log(`[AI Auto] 🌐 Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(2000);
        
        // Проверка навигации
        const activeChatId = await page.evaluate(() => {
            return modelsChat?.getChats?.active?.identity;
        });
        
        if (activeChatId !== chat.chatId) {
            console.error(`[AI Auto] ❌ Navigation failed: expected ${chat.chatId}, got ${activeChatId}`);
            return { sent: false, reason: 'navigation_failed' };
        }
        
        console.log(`[AI Auto] ✅ Navigated to chat ${chat.chatId}`);
        
        // ========== ИЗВЛЕЧЬ ИСТОРИЮ (10 сообщений) ==========
        const history = await chatMessagesExtractorService.getChatHistory(page, 10);
        
        if (history.error) {
            console.error(`[AI Auto] ❌ Failed to extract history: ${history.error}`);
            return { sent: false, reason: 'history_extraction_failed' };
        }
        
        // Проверка последнего сообщения
        const shouldReply = chatMessagesExtractorService.shouldReplyToChat(history.lastMessage);
        if (!shouldReply.shouldReply) {
            console.log(`[AI Auto] ⏭️  ${shouldReply.reason}`);
            return { sent: false, reason: 'shouldnt_reply' };
        }
        
        // Форматирование истории
        const formattedHistory = chatMessagesExtractorService.formatHistoryForAI(
            history.messages,
            profile.username,
            history.manName
        );
        
        const typeInstructions = chatMessagesExtractorService.getAIInstructionsForMessageType(
            history.lastMessage.messageType
        );
        
        console.log(`[AI Auto] 🤖 Generating response (message type: ${history.lastMessage.messageType})...`);
        
        // ========== ГЕНЕРАЦИЯ ОТВЕТА ==========
        const aiResponse = await aiResponseService.generateAndSend({
            userId,
            accountId,
            profileUid: profile.uid,
            chatId: chat.chatId,
            profile: {
                username: profile.username,
                age: profile.age,
                country: profile.country,
                city: profile.city
            },
            manMessage: history.lastMessage.text,
            formattedHistory: formattedHistory,  // ← ТОЛЬКО formattedHistory!
            profileName: profile.username,
            manName: history.manName,
            typeInstructions: typeInstructions,
            messageType: history.lastMessage.messageType,
            // НЕ передаём conversationHistory отдельно - это создаёт дубли!
            skipSending: true  // Генерируем, но НЕ отправляем сразу
        });
        
        if (!aiResponse || !aiResponse.text) {
            console.error(`[AI Auto] ❌ Failed to generate response`);
            return { sent: false, reason: 'generation_failed' };
        }
        
        // ========== ПРОВЕРКА #2: unAnswered ПЕРЕД отправкой ==========
        const check2 = await chatValidator.checkUnAnsweredAPI(page, chat.chatId, profile.uid);
        
        if (!check2.shouldReply) {
            console.log(`[AI Auto] ⚠️  Check #2 failed - waiting 2 sec...`);
            await sleep(2000);
            
            // ========== ПРОВЕРКА #3: финальная ==========
            const check3 = await chatValidator.checkUnAnsweredAPI(page, chat.chatId, profile.uid);
            
            if (!check3.shouldReply) {
                // ========== РЕЗЕРВНАЯ ПРОВЕРКА: DOM ==========
                const domCheck = await chatValidator.checkDOM(page);
                
                if (!domCheck.shouldReply) {
                    console.log(`[AI Auto] ⏭️  All checks failed - skip`);
                    return { sent: false, reason: 'all_checks_failed' };
                }
            }
        }
        
        // ========== ОТПРАВИТЬ ==========
        console.log(`[AI Auto] 📤 Sending response...`);
        const sendResult = await messageSendService.sendMessage({
            page,
            profileUid: profile.uid,
            chatId: chat.chatId,
            message: aiResponse.text
        });
        
        if (sendResult.success) {
            console.log(`[AI Auto] ✅ Successfully sent to ${chat.manName}`);
            return { sent: true };
        } else {
            console.error(`[AI Auto] ❌ Failed to send: ${sendResult.error}`);
            return { sent: false, reason: 'send_failed' };
        }
        
    } catch (error) {
        console.error(`[AI Auto] ❌ Error:`, error);
        return { sent: false, reason: 'exception', error: error.message };
    }
}

export default {
    processSingleChat
};
```

### **4. chatValidator.js - Проверки**

```javascript
// Проверка через API (modelsChat.getChats.active.unAnswered)
async function checkUnAnsweredAPI(page, chatId, profileUid) {
    const result = await page.evaluate(() => {
        const activeChatId = modelsChat?.getChats?.active?.identity;
        const unAnswered = modelsChat?.getChats?.active?.unAnswered;
        
        return {
            activeChatId,
            unAnswered
        };
    });
    
    // Проверка что мы в правильном чате
    if (result.activeChatId !== chatId) {
        return {
            shouldReply: false,
            reason: `Wrong chat: expected ${chatId}, got ${result.activeChatId}`,
            method: 'API'
        };
    }
    
    return {
        shouldReply: result.unAnswered === true,
        reason: result.unAnswered ? 'unAnswered=true' : 'unAnswered=false',
        method: 'API',
        value: result.unAnswered
    };
}

// Резервная проверка через DOM container
async function checkDOM(page) {
    const result = await page.evaluate(() => {
        const container = document.querySelector('#message-main-wrap');
        if (!container) return { error: 'No container' };
        
        const messages = container.querySelectorAll('.messages');
        if (messages.length === 0) return { error: 'No messages' };
        
        const lastMsg = messages[messages.length - 1];
        const isFromMan = lastMsg.classList.contains('message-opponent');
        const isFromProfile = lastMsg.classList.contains('message-owner');
        
        const text = lastMsg.querySelector('.chat-full-message')?.textContent?.trim();
        
        return {
            isFromMan,
            isFromProfile,
            text: text?.substring(0, 50)
        };
    });
    
    if (result.error) {
        return {
            shouldReply: false,
            reason: result.error,
            method: 'DOM'
        };
    }
    
    return {
        shouldReply: result.isFromMan,
        reason: result.isFromMan ? 'Last from man (DOM)' : 'Last from profile (DOM)',
        method: 'DOM'
    };
}

export default {
    checkUnAnsweredAPI,
    checkDOM
};
```

---

## 🎯 WORKFLOW НОВОЙ СИСТЕМЫ

```
🔄 AI Auto цикл (каждые 5 сек)
  ↓
🔒 Проверка блокировки
  └─ Если заблокирован → SKIP весь цикл
  ↓
🔐 ЗАБЛОКИРОВАТЬ аккаунт
  ↓
1️⃣ Получить активный профиль
  ↓
2️⃣ Найти unanswered на АКТИВНОМ профиле (ПРИОРИТЕТ!)
  ├─ Если найдено → обработать → отправить → задержка 3-6 сек → STOP
  └─ Если нет → продолжить
  ↓
3️⃣ Получить ДРУГИЕ профили с сообщениями
  ↓
4️⃣ ДЛЯ КАЖДОГО профиля:
  ├─ Переключиться на профиль (wait 3 сек)
  ├─ Найти unanswered чаты
  ├─ Если найдено → обработать первый
  └─ Если отправили → задержка 3-6 сек → STOP
  ↓
5️⃣ ОБРАБОТКА ОДНОГО ЧАТА:
  ├─ Проверка #1: unAnswered (до навигации)
  ├─ Навигация к чату (page.goto)
  ├─ Проверка успешности навигации
  ├─ Извлечение истории (10 сообщений)
  ├─ Генерация ответа
  ├─ Проверка #2: unAnswered (перед отправкой)
  ├─ Если failed → wait 2 сек → Проверка #3
  ├─ Если failed → DOM проверка (резерв)
  ├─ Отправка
  └─ Задержка 3-6 сек
  ↓
🔓 РАЗБЛОКИРОВАТЬ аккаунт
```

---

## ✅ ГАРАНТИИ

1. ✅ **Нет бесконечных циклов** - блокировка предотвращает повторную обработку
2. ✅ **Нет дублей** - только formattedHistory, без conversationHistory
3. ✅ **Нет race conditions** - глобальная блокировка
4. ✅ **Правильная история** - всегда из активного чата после навигации
5. ✅ **Приоритеты** - unanswered > newMessages
6. ✅ **Синхронность** - один чат за раз
7. ✅ **Задержки** - 3-6 сек после отправки
8. ✅ **Двойная проверка** - API + DOM container

---

## 📋 ПЛАН РЕАЛИЗАЦИИ

1. ✅ Создать `backend/src/services/aiAuto/` директорию
2. ✅ Реализовать `profileScanner.js`
3. ✅ Реализовать `chatValidator.js`
4. ✅ Реализовать `chatProcessor.js`
5. ✅ Реализовать `index.js` с блокировкой
6. ✅ Обновить `aiAutoResponseService.js` для использования новых модулей
7. ✅ Исправить `members.type` → `members.gender` в chatMessagesExtractorService
8. ✅ Убрать дубли в aiResponseService (только formattedHistory)
9. ✅ Тестирование

---

**Готово к реализации!** 🚀
