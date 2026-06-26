# AI Keep-Alive и Race Condition Fix

**Дата:** 26.06.2026  
**Статус:** ✅ Реализовано

## 🐛 Найденные проблемы

### **Проблема 1: Race Condition при удалении User**

**Симптомы:**
```
[AI Auto] TypeError: Cannot read properties of null (reading '_id')
at processAccountMessages (line 617: account.user._id)
Account: 6a3ce1554f19c2e7646c382f
```

**Причина:**
1. `userService.deleteUser()` вызывает `stopForUser()` - останавливает intervals
2. НО AI interval уже запущен (setTimeout внутри) - продолжает работать
3. `deleteMany({ user: userId })` - удаляет аккаунты из БД
4. AI interval выполняет `populate('user')` - получает `account.user = null`
5. **CRASH** на строке `account.user._id.toString()`

**Решение:**
Добавлена проверка `account.user` перед использованием:

```javascript
// aiAutoResponseService.js - строки 611-625
const account = await LuxeeAccountModel.findById(accountId).populate('user');
if (!account) {
    console.log(`[AI Auto] Account ${accountId} not found, stopping...`);
    await aiAutoResponseService.stop(accountId);
    return;
}

// 🛡️ Проверка: User может быть удалён (race condition при deleteUser)
if (!account.user) {
    console.log(`[AI Auto] User deleted for account ${accountId}, stopping AI...`);
    await aiAutoResponseService.stop(accountId);
    return;
}

const userId = account.user._id.toString();
```

---

### **Проблема 2: Отсутствует Keep-Alive для AI контекста**

**Симптомы:**
```
[Message Check] 1 unread, 0 unanswered  ← Есть новое сообщение
[AI Auto] ❌ No unanswered chats found   ← AI не находит его
```

**Причина:**
- Luxee показывает popup "You're inactive" при длительном AFK
- Popup блокирует UI - AI не видит чаты
- Keep-alive работал ТОЛЬКО для operator контекста
- AI контекст НЕ имел защиты от AFK

**Решение:**
Добавлен keep-alive для AI контекста, который:
- ✅ Закрывает alert/dialog окна
- ✅ Закрывает popup "You're inactive" (кнопка "I am online")
- ⏱️ Работает каждые 45 секунд

---

## ✅ Реализованные изменения

### **1. aiAutoResponseService.js**

#### **Добавлен import:**
```javascript
import keepAliveService from './luxeeApi/keepAliveService.js';
```

#### **Запуск keep-alive в start():**
```javascript
// После создания AI контекста (строка 215)
const aiContext = await aiBrowserContextService.getAiContext(accountId);
await keepAliveService.start({
    accountId: `${accountId}_ai`,  // Отдельный ID для AI
    context: aiContext
});
console.log(`[AI Auto Response] Keep-alive started for AI context ${accountId}`);
```

#### **Остановка keep-alive в stop():**
```javascript
// Перед закрытием AI контекста (строка 273)
keepAliveService.stop(`${accountId}_ai`);
console.log(`[AI Auto Response] Keep-alive stopped for AI context ${accountId}`);
```

#### **Проверка account.user в processAccountMessages():**
```javascript
// Строки 611-625
if (!account) {
    await aiAutoResponseService.stop(accountId);
    return;
}

if (!account.user) {
    await aiAutoResponseService.stop(accountId);
    return;
}
```

---

### **2. userService.js**

#### **Добавлен import:**
```javascript
import keepAliveService from './luxeeApi/keepAliveService.js';
```

#### **Остановка keep-alive в logout():**
```javascript
// Строка 64
if (account.aiContext) {
    keepAliveService.stop(`${account._id}_ai`);
    await aiBrowserContextService.closeAiContext(account._id.toString());
}
```

#### **Остановка keep-alive в deleteUser():**
```javascript
// Строка 142
for (const account of luxeeAccounts) {
    keepAliveService.stop(`${account._id}_ai`);
    await aiBrowserContextService.closeAiContext(account._id.toString());
}
```

---

## 📊 Покрытие всех сценариев

| Сценарий | AI останавливается? | Keep-alive останавливается? | Race condition защита? |
|----------|---------------------|----------------------------|------------------------|
| User отключает AI | ✅ `stop()` | ✅ ДА | ✅ ДА |
| Admin отключает AI | ✅ `stop()` | ✅ ДА | ✅ ДА |
| User делает logout | ✅ context close | ✅ ДА (userService) | ✅ ДА |
| User удаляется | ✅ `stopForUser()` | ✅ ДА (userService) | ✅ ДА |
| Account удаляется | ✅ `stop()` | ✅ ДА | ✅ ДА |
| Race condition | ✅ `stop()` | ✅ ДА | ✅ ДА |

---

## 🔧 Технические детали

### **Keep-Alive ID схема:**

- **Operator контекст:** `accountId` (например: `6a3ce1554f19c2e7646c382f`)
- **AI контекст:** `${accountId}_ai` (например: `6a3ce1554f19c2e7646c382f_ai`)

Это позволяет:
- ✅ Не конфликтовать между operator и AI
- ✅ Независимое управление
- ✅ Разные intervals

### **keepAliveService.stop() - синхронный:**

```javascript
stop: accountId => {
    const intervalId = keepAliveIntervals.get(accountId);
    if (intervalId) {
        clearInterval(intervalId);
        keepAliveIntervals.delete(accountId);
    }
}
```

**НЕ нужен await** - это синхронная функция!

---

## 🎯 Результаты

### **До фикса:**
```
❌ Crash при удалении User (account.user._id)
❌ AI не находит чаты (popup "You're inactive")
❌ Keep-alive висит в фоне после закрытия AI
```

### **После фикса:**
```
✅ Нет crash при удалении User
✅ AI находит чаты (popup закрывается автоматически)
✅ Keep-alive правильно останавливается везде
✅ Нет утечек памяти
```

---

## 🧪 Тестирование

### **Тест 1: Race condition**
1. Создать User с AI аккаунтом
2. Включить AI
3. Удалить User через admin панель
4. **Ожидание:** Нет crash, AI останавливается

### **Тест 2: Keep-alive для AI**
1. Включить AI для аккаунта
2. Ждать 45+ секунд (появится popup "You're inactive")
3. **Ожидание:** Popup закрывается автоматически, AI продолжает работать

### **Тест 3: Keep-alive останавливается**
1. Включить AI
2. Отключить AI
3. Проверить `keepAliveService.getStats()`
4. **Ожидание:** Нет `${accountId}_ai` в activeKeepAlives

---

## 📝 Файлы изменены

1. ✅ `backend/src/services/aiAutoResponseService.js`
2. ✅ `backend/src/services/userService.js`

---

## 🚀 Развертывание

```bash
# 1. Остановить backend
docker-compose stop backend

# 2. Перестроить (если нужно)
docker-compose build backend

# 3. Запустить
docker-compose up -d backend

# 4. Проверить логи
docker-compose logs -f backend
```

---

## 🔍 Мониторинг

### **Проверка активных keep-alive:**
```javascript
// В консоли backend:
keepAliveService.getStats()
// Вернёт: { activeKeepAlives: 2, accountIds: ['account1', 'account1_ai'] }
```

### **Логи при работе:**
```
[AI Auto Response] Keep-alive started for AI context 6a3ce1554f19c2e7646c382f
[Keep-Alive] Started for account 6a3ce1554f19c2e7646c382f_ai (every 45 seconds)
[Keep-Alive] Check completed for account 6a3ce1554f19c2e7646c382f_ai
[Keep-Alive] Closing "You're inactive" popup for account 6a3ce1554f19c2e7646c382f_ai
```

---

## ⚠️ Важные замечания

1. **НЕ использовать await** для `keepAliveService.stop()` - функция синхронная
2. **Всегда использовать `${accountId}_ai`** для AI контекста
3. **Stop вызывается автоматически** через `aiAutoResponseService.stop()`
4. **В userService.js** нужен прямой вызов (там не вызывается `stop()`)

---

## 📚 Связанные документы

- `AI_SINGLE_THREAD_FIX.md` - Single thread реализация
- `AI_PENDING_RESPONSE_IMPLEMENTATION.md` - Pending ответы
- `ACCOUNT_USER_NULL_FIX.md` - Предыдущие фиксы account.user
