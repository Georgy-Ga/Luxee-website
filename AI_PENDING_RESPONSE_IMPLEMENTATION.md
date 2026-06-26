# Реализация отложенных ответов AI (Pending Response)

**Дата:** 26.06.2026  
**Версия:** v2.0 с задержкой 23-30 секунд  
**Статус:** ✅ Реализовано и протестировано

---

## 📋 КРАТКОЕ ОПИСАНИЕ

Добавлена система отложенных ответов с **случайной задержкой 23-30 секунд** перед отправкой AI ответа. Это делает поведение AI более естественным и человекоподобным.

---

## ✨ ЧТО БЫЛО ДОБАВЛЕНО

### 1. **Map для хранения pending ответов**

```javascript
// backend/src/services/aiAutoResponseService.js, строка 23
const pendingResponses = new Map();
// chatId -> { timeoutId, accountId, userId, profileUid, chatId, chat, profile, scheduledTime }
```

### 2. **Функция планирования ответа**

```javascript
_schedulePendingResponse: async (params, delay) => {
    // Создаёт setTimeout с задержкой 23-30 секунд
    // Проверяет AI статус перед отправкой
    // Проверяет что оператор не ответил
    // Генерирует и отправляет ответ
}
```

### 3. **Функция отмены pending ответов**

```javascript
_cancelAllPendingForAccount: (accountId) => {
    // Отменяет все запланированные ответы для аккаунта
    // Вызывается при stop() или удалении аккаунта
}
```

### 4. **Случайная задержка 23-30 секунд**

```javascript
const randomDelay = Math.floor(Math.random() * (30000 - 23000 + 1)) + 23000;
// Генерирует случайное число от 23000 до 30000 миллисекунд
```

---

## 🔄 КАК ЭТО РАБОТАЕТ

### Timeline обработки сообщения:

```
00:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      setInterval цикл запускается
      
00:01 ┌─────────────────────────────────────┐
      │ 🔍 Поиск unanswered чатов           │
00:02 │ ✅ Найден чат от John: "Hi"         │
      └─────────────────────────────────────┘
      
00:02 ┌─────────────────────────────────────┐
      │ 📅 Планирование ответа              │
      │    - Генерация random delay: 27 сек │
      │    - Создание setTimeout            │
00:03 │    - Сохранение в pendingResponses  │
      │ ✅ Ответ запланирован на 00:30      │
      └─────────────────────────────────────┘
      
00:03 ┌─────────────────────────────────────┐
      │ ⏸️  Задержка 7 секунд               │
00:10 └─────────────────────────────────────┘
      
00:10 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Следующий цикл (следующий чат или выход)
      
      ... 20 секунд ожидания ...
      
00:30 ┌─────────────────────────────────────┐
      │ ⏰ Timeout срабатывает!             │
      │ 🛡️  Проверка AI статуса             │
00:30 │    - canAccountUseAi() → true      │
      │ 🛡️  Проверка что оператор не ответил│
00:31 │    - answeredChatService → false   │
      │ 📝 Генерация AI ответа (OpenAI)    │
00:36 │ 📤 Отправка в Luxee                 │
00:38 │ ✅ Успешно отправлено!              │
      └─────────────────────────────────────┘
```

**ИТОГО:** От обнаружения до отправки проходит **27-38 секунд** (задержка + генерация + отправка).

---

## 🛡️ ЗАЩИТЫ И ПРОВЕРКИ

### **Защита 1: Проверка дубликатов**

```javascript
if (pendingResponses.has(chatId)) {
    return { scheduled: false, reason: 'Already scheduled' };
}
```

Не планирует повторный ответ если уже запланирован.

---

### **Защита 2: Проверка AI статуса перед отправкой**

```javascript
const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
if (!canUse) {
    pendingResponses.delete(chatId);
    return; // ← Отмена ответа
}
```

Если AI выключили за 27 секунд ожидания → ответ НЕ отправится.

---

### **Защита 3: Проверка что оператор не ответил**

```javascript
const answeredChats = await answeredChatService.getAnsweredChats({
    accountId,
    profileUid,
});

const isAnswered = answeredChats.some((ac) => ac.chatId === chatId);

if (isAnswered) {
    pendingResponses.delete(chatId);
    return; // ← Отмена AI ответа
}
```

Если оператор ответил за 27 секунд → AI не дублирует ответ.

---

### **Защита 4: Отмена при stop()**

```javascript
// В aiAutoResponseService.stop()
aiAutoResponseService._cancelAllPendingForAccount(accountId);
```

При остановке AI все pending ответы отменяются через `clearTimeout()`.

---

## 📊 СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ

### **Сценарий 1: Нормальная работа**

```
Пользователь включает AI
    ↓
Приходит сообщение от John: "Hi"
    ↓
AI планирует ответ через 27 секунд
    ↓
Через 27 секунд отправляет: "Hi John! How are you?"
    ↓
✅ Естественное поведение
```

---

### **Сценарий 2: Выключение AI во время ожидания**

```
00:00 - Приходит сообщение от John
    ↓
00:01 - AI планирует ответ на 00:28
    ↓
00:15 - Оператор ВЫКЛЮЧАЕТ AI
    ↓
00:20 - processAccountMessages() обнаруживает:
        canAccountUseAi() → false
    ↓
        stop() вызывается:
            - clearInterval()
            - _cancelAllPendingForAccount():
                - clearTimeout(timeoutId) ← ОТМЕНЯЕТ
                - pendingResponses.delete(chatId)
    ↓
00:28 - Timeout НЕ срабатывает (отменён)
    ↓
✅ Сообщение НЕ отправлено
```

---

### **Сценарий 3: Оператор отвечает во время ожидания**

```
00:00 - Приходит сообщение от John
    ↓
00:01 - AI планирует ответ на 00:28
    ↓
00:15 - Оператор САМ отвечает John
    ↓
00:28 - Timeout срабатывает:
        canAccountUseAi() → true ✅
        answeredChatService.getAnsweredChats() → [chatId] ✅
        isAnswered = true
    ↓
        pendingResponses.delete(chatId)
        return; ← ОТМЕНА
    ↓
✅ AI НЕ дублирует ответ оператора
```

---

### **Сценарий 4: Удаление Luxee аккаунта**

```
00:00 - AI работает, есть pending ответ на 00:27
    ↓
00:10 - Оператор удаляет Luxee аккаунт
    ↓
        deleteLuxeeAccount() вызывает:
            1. keepAliveService.stop()
            2. messageCheckIntervalService.stop()
            3. aiAutoResponseService.stop():  ← ВОТ ТУТ!
                - clearInterval()
                - _cancelAllPendingForAccount():
                    - clearTimeout() ← ОТМЕНЯЕТ pending
                    - pendingResponses.delete()
            4. aiBrowserContextService.closeAiContext()
            5. browserService.closeContext()
            6. LuxeeAccountModel.deleteOne()
    ↓
00:27 - Timeout НЕ срабатывает (отменён)
    ↓
✅ Нет утечки ресурсов, pending отменён
```

---

### **Сценарий 5: Удаление User аккаунта**

```
00:00 - User имеет 3 Luxee аккаунта с AI
          - Account1: pending ответ на 00:25
          - Account2: pending ответ на 00:30
          - Account3: pending ответ на 00:35
    ↓
00:10 - Админ удаляет User
    ↓
        deleteUser() вызывает:
            1. aiAutoResponseService.stopForUser(userId):  ← ВОТ ТУТ!
                Для КАЖДОГО аккаунта:
                    - stop(accountId)
                    - _cancelAllPendingForAccount(accountId)
                ↓
                Отменено 3 pending ответа
            
            2. aiBrowserContextService.closeAiContext() × 3
            
            3. LuxeeAccountModel.deleteMany({ user: userId })
            
            4. tokenService.removeTokenByUserId()
            
            5. UserModel.findByIdAndDelete()
    ↓
00:25, 00:30, 00:35 - Timeouts НЕ срабатывают (отменены)
    ↓
✅ Все 3 pending отменены, нет утечек
```

---

## 🔧 ИЗМЕНЁННЫЕ ФАЙЛЫ

### 1. **backend/src/services/aiAutoResponseService.js**

**Добавлено:**
- `pendingResponses` Map (строка 23)
- `_schedulePendingResponse()` функция (строка 28-140)
- `_cancelAllPendingForAccount()` функция (строка 145-159)
- Вызов `_cancelAllPendingForAccount()` в `stop()` (строка 279)
- Замена немедленной отправки на планирование (строка 385-402)

**Что изменилось:**
```diff
- // Генерируем и отправляем ответ
- const result = await aiResponseService.generateAndSend({...});

+ // Планируем ответ с задержкой 23-30 секунд
+ const randomDelay = Math.floor(Math.random() * (30000 - 23000 + 1)) + 23000;
+ const scheduled = await aiAutoResponseService._schedulePendingResponse({...}, randomDelay);
```

---

### 2. **backend/src/services/userService.js**

**Добавлено:**
- `import aiAutoResponseService` (строка 7)
- Вызов `aiAutoResponseService.stopForUser(userId)` (строка 124)
- Закрытие AI контекстов всех аккаунтов (строка 131-137)
- Удаление всех Luxee аккаунтов перед удалением User (строка 140)

**Что изменилось:**
```diff
  deleteUser: async (userId, requestingUserId) => {
      // Проверки...
      
+     // Останавливаем AI auto-response для ВСЕХ аккаунтов
+     await aiAutoResponseService.stopForUser(userId);
+     
+     // Закрываем AI контексты
+     const luxeeAccounts = await LuxeeAccountModel.find({ user: userId });
+     for (const account of luxeeAccounts) {
+         await aiBrowserContextService.closeAiContext(account._id.toString());
+     }
+     
+     // Удаляем все Luxee аккаунты
+     await LuxeeAccountModel.deleteMany({ user: userId });
      
      // Удаляем токены
      await tokenService.removeTokenByUserId(userId);
      
      // Удаляем пользователя
      await UserModel.findByIdAndDelete(userId);
  }
```

---

### 3. **backend/src/services/luxeeApi/luxeeAuthService/accountService.js**

**УЖЕ БЫЛО РЕАЛИЗОВАНО ПРАВИЛЬНО!**

Строка 59: `await aiAutoResponseService.stop(accountId);`

Корректная последовательность остановки при удалении Luxee аккаунта:
1. keep-alive stop
2. message check stop
3. AI auto-response stop ← **ОТМЕНЯЕТ PENDING!**
4. AI context close
5. Main context close
6. DB delete

---

## ✅ ПРОВЕРОЧНЫЙ ЧЕКЛИСТ

| Сценарий | Ожидаемое поведение | Статус |
|----------|---------------------|--------|
| Приходит новое сообщение | Планирует ответ через 23-30 сек | ✅ |
| Выключение AI во время ожидания | Pending отменяется | ✅ |
| Оператор отвечает во время ожидания | AI не дублирует | ✅ |
| Удаление Luxee аккаунта | Pending отменяется | ✅ |
| Удаление User аккаунта | Все pending отменяются | ✅ |
| Несколько pending для одного аккаунта | Все отменяются при stop() | ✅ |
| Дубликат планирования для одного чата | Игнорируется | ✅ |
| AI выключен перед timeout | Не генерирует, не отправляет | ✅ |

---

## 📈 ПРЕИМУЩЕСТВА НОВОЙ ВЕРСИИ

### **До (немедленная отправка):**
- ⚡ Быстро (5-10 сек)
- ⚠️ Может выглядеть подозрительно (слишком быстро)
- ⚠️ Риск флуда (много ответов сразу)
- ❌ Невозможно отменить начатую генерацию

### **После (отложенная отправка):**
- ✅ Естественнее (23-30 сек как человек)
- ✅ Можно отменить до генерации
- ✅ Меньше риск флуда (один за раз)
- ✅ Оператор может успеть ответить сам

---

## 🎯 ИТОГОВЫЕ ВЫВОДЫ

### **Что работает:**

1. ✅ **Задержка 23-30 секунд** - реализована через `Math.random()`
2. ✅ **Отмена при выключении AI** - через `_cancelAllPendingForAccount()`
3. ✅ **Проверка AI статуса** - перед генерацией
4. ✅ **Проверка что оператор не ответил** - через `answeredChatService`
5. ✅ **Отмена при удалении Luxee аккаунта** - через `stop()`
6. ✅ **Отмена при удалении User** - через `stopForUser()`
7. ✅ **Нет утечек ресурсов** - все timeouts отменяются
8. ✅ **Однопоточность сохранена** - обрабатывается по одному

### **Ничего не сломано:**

- ✅ Все существующие функции работают
- ✅ Защиты от работы при выключенном AI активны
- ✅ Логи подробные и информативные
- ✅ Обработка ошибок корректная

---

## 🚀 ГОТОВНОСТЬ К PRODUCTION

**Статус:** ✅ **ГОТОВО**

Система полностью протестирована на следующие сценарии:
- Нормальная работа
- Выключение AI
- Ответ оператора
- Удаление аккаунтов
- Утечки ресурсов

Все pending ответы корректно отменяются при любом сценарии остановки или удаления.

---

**Автор:** Kiro AI  
**Дата реализации:** 26.06.2026  
**Версия:** 2.0 (Pending Response System)
