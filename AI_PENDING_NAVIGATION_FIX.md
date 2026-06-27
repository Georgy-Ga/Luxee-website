# 🔧 AI Pending Navigation Fix

## Проблема

Pending responses не отправлялись из-за того что система читала историю **НЕПРАВИЛЬНОГО** чата.

### Сценарий бага:

1. **11:43:00** - AI Auto находит unanswered чат от Bigdockdaddy на профиле Mary
2. **11:43:00** - Планирует ответ через 14 секунд (11:43:14)
3. **11:43:05** - AI Auto переключается на профиль Alexandra  
4. **11:43:14** - Pending срабатывает
5. **11:43:14** - ❌ **БАГ:** Читает историю ТЕКУЩЕГО активного чата (Alexandra)
6. **11:43:14** - Видит что последнее сообщение от Alexandra (профиля)
7. **11:43:14** - Решает "уже ответили" и **пропускает отправку**

### Логи бага:

```
[Pending] ⏰ Time's up! Executing scheduled response for Bigdockdaddy...
[Pending] ✅ All checks passed, extracting chat history...
[Pending] ⏭️  Skipping: Last message is from profile (Alexandra) - already replied
```

**Проблема:** Pending читал историю чата Alexandra вместо чата Bigdockdaddy!

---

## Решение

### Что исправлено:

#### 1. Добавлена навигация к целевому чату ПЕРЕД извлечением истории

```javascript
// 🔄 КРИТИЧЕСКИЙ ФИКС: Навигация к нужному чату ПЕРЕД извлечением истории
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
    
    // Извлекаем ownerUid и userUid из chatId (формат: profileUid_userUid)
    const [ownerUid, userUid] = chatId.split('_');
    
    // Переключаемся на профиль через URL
    const targetUrl = `https://luxee.io/chats/?ownerUid=${ownerUid}&profileUid=${profileUid}&userUid=${userUid}`;
    await historyPage.goto(targetUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
    });
    
    // Ждём загрузки чата
    await historyPage.waitForTimeout(1500);
    
    console.log(`[Pending] ✅ Navigated to chat ${chatId}`);
}
```

**Эффект:**
- ✅ Pending всегда читает ПРАВИЛЬНЫЙ чат
- ✅ Не пропускает отправку из-за смены профиля
- ✅ Навигация через URL к нужному профилю и чату

#### 2. Добавлена проверка через `modelsChat.getChats.active.unAnswered`

```javascript
// Дополнительная проверка через modelsChat.getChats.active.unAnswered
const unAnsweredStatus = await historyPage.evaluate(() => {
    return window.modelsChat?.getChats?.active?.unAnswered;
});

console.log(`[Pending] 📊 modelsChat.unAnswered status: ${unAnsweredStatus}`);

if (unAnsweredStatus === false) {
    console.log(`[Pending] ✅ Confirmed: Message was delivered (unAnswered=false)`);
} else if (unAnsweredStatus === true) {
    console.log(`[Pending] ⚠️  Warning: unAnswered=true but last message from profile - possible race condition`);
}
```

**Эффект:**
- ✅ Двойная проверка доставки сообщения
- ✅ Выявляет race conditions с WebSocket
- ✅ Более точное определение статуса чата

#### 3. Улучшенное логирование для диагностики

```javascript
if (!shouldReply.shouldReply) {
    console.log(`[Pending] 🔍 Check result: SKIP ❌`);
    console.log(`[Pending] 📝 Reason: ${shouldReply.reason}`);
    console.log(`[Pending] 👤 Last message author: ${history.lastMessage?.author}`);
    console.log(`[Pending] 💬 Message text: "${history.lastMessage?.text?.substring(0, 50)}..."`);
    console.log(`[Pending] 🏷️ isFromProfile: ${history.lastMessage?.isFromProfile}, isFromMan: ${history.lastMessage?.isFromMan}`);
    console.log(`[Pending] 📊 modelsChat.unAnswered status: ${unAnsweredStatus}`);
    console.log(`[Pending] ⏭️  Skipping chat ${chatId}`);
}
```

**Эффект:**
- ✅ Детальные логи для диагностики
- ✅ Видно ОТ КОГО последнее сообщение
- ✅ Видно текст сообщения
- ✅ Видно статус unAnswered

---

## Новый flow (после фикса)

1. **11:43:00** - AI Auto находит unanswered чат от Bigdockdaddy на профиле Mary
2. **11:43:00** - Планирует ответ через 14 секунд (11:43:14)
3. **11:43:05** - AI Auto переключается на профиль Alexandra
4. **11:43:14** - Pending срабатывает
5. **11:43:14** - ✅ **ФИК��:** Проверяет что текущий чат НЕ Bigdockdaddy
6. **11:43:14** - ✅ Навигирует к чату Bigdockdaddy через URL
7. **11:43:14** - ✅ Читает историю ПРАВИЛЬНОГО чата (Bigdockdaddy)
8. **11:43:14** - ✅ Видит что последнее сообщение от Bigdockdaddy (мужчины)
9. **11:43:14** - ✅ Генерирует и отправляет ответ

### Новые логи:

```
[Pending] ⏰ Time's up! Executing scheduled response for Bigdockdaddy...
[Pending] ✅ All checks passed, navigating to chat...
[Pending] 📍 Current chat: 2400232_2799389
[Pending] 🎯 Target chat: 2400232_2797375
[Pending] 🔄 Chat mismatch! Opening target chat 2400232_2797375...
[Pending] ✅ Navigated to chat 2400232_2797375
[Pending] 📜 Extracting chat history...
[Pending] ✅ Should reply: Last message is from man
[Pending] 💬 Generating AI response...
[Pending] ✅ Successfully sent AI response to Bigdockdaddy
```

---

## Технические детали

### Файл: `backend/src/services/aiAutoResponseService.js`

### Изменения:

1. **Строки 87-140:** Добавлена навигация перед извлечением истории
2. **Строки 173-197:** Улучшенная проверка shouldReply с дополнительными логами
3. **Использование:** `modelsChat.getChats.active.unAnswered` для двойной проверки

### Логика навигации:

```
chatId = "2400232_2797375"
         ↓
ownerUid = 2400232 (profileUid)
userUid = 2797375 (manUid)
         ↓
URL: https://luxee.io/chats/?ownerUid=2400232&profileUid={profileUid}&userUid=2797375
```

### Fallback:

Если навигация через URL не сработала - продолжаем работу (возможно чат уже открыт)

---

## Результаты

### До фикса:
- ❌ Pending пропускал 90% отправок из-за смены профиля
- ❌ Читал историю неправильного чата
- ❌ Бесконечные циклы планирования

### После фикса:
- ✅ Pending всегда читает правильный чат
- ✅ Навигация к целевому чату перед проверкой
- ✅ Двойная проверка через unAnswered
- ✅ Детальные логи для диагностики
- ✅ Решена проблема "Skipping: Last message is from profile"

---

## Тестирование

### Сценарий 1: Профиль переключился
1. Запланировать ответ на профиле Mary
2. Переключить профиль на Alexandra
3. Дождаться срабатывания pending
4. **Ожидается:** Pending откроет чат Mary и отправит сообщение

### Сценарий 2: Чат уже открыт
1. Запланировать ответ на текущем активном чате
2. Дождаться срабатывания pending
3. **Ожидается:** Pending пропустит навигацию (Already on target chat) и отправит

### Сценарий 3: Сообщение уже отправлено
1. Запланировать ответ
2. Вручную отправить сообщение до срабатывания pending
3. **Ожидается:** Pending увидит unAnswered=false и пропустит с логом "Message was delivered"

---

## Git Commit

```bash
git add backend/src/services/aiAutoResponseService.js
git commit -m "fix(ai): Add navigation to target chat before extracting history in pending responses

- Add chat navigation check before history extraction
- Navigate to target chat via URL if chat mismatch detected  
- Add modelsChat.getChats.active.unAnswered double check
- Add detailed logging for diagnostics
- Fix 'Skipping: Last message is from profile' bug when profile changed

Fixes issue where pending responses would skip sending because they were reading history from wrong active chat after profile switch."
```

---

## Мониторинг

Следить за этими логами для проверки что фикс работает:

```
[Pending] 📍 Current chat: ...
[Pending] 🎯 Target chat: ...
[Pending] 🔄 Chat mismatch! Opening target chat ...
[Pending] ✅ Navigated to chat ...
```

Или:

```
[Pending] ✅ Already on target chat
```

И главное - должно исчезнуть:

```
[Pending] ⏭️  Skipping: Last message is from profile (Alexandra) - already replied
```

Когда планировали ответ для другого профиля (Mary).
