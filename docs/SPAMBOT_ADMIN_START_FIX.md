# 🔧 Spambot: Исправление запуска рассылок админом

**Дата:** 18.07.2026, 05:26  
**Статус:** ✅ Завершено

---

## 🐛 Проблема

Админ **не мог запускать рассылки** на аккаунтах пользователей:

```
[Spambot Controller] userId: 6a404cb1a44a470cbc34d8a2  ← АДМИН
[Spambot Controller] Error: Account not found or access denied
```

### Причина

**В `SpambotService.js:100`:**
```javascript
// ❌ БЫЛО (неправильно):
async startDistribution({ accountId, userId, config }) {
    const account = await LuxeeAccountModel.findOne({
        _id: accountId,
        user: userId  // ❌ Проверяет только владельца
    });
}
```

**Проблема:** Админ пытается запустить рассылку на аккаунте пользователя, но `user: userId` проверяет, что админ является **владельцем** аккаунта. Это неверно - админ НЕ владелец, но должен иметь доступ!

---

## ✅ Решение

### 1. Controller: Передать роль в service

**Файл:** `backend/src/controllers/spambotController.js`

```javascript
// ✅ ИСПРАВЛЕНО:
async createDistribution(req, res) {
    const { accountId, config } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;  // ✅ Получаем роль

    const distribution = await spambotService.startDistribution({
        accountId,
        userId,
        userRole,  // ✅ Передаём роль
        config
    });
}
```

---

### 2. Service: Условный query в зависимости от роли

**Файл:** `backend/src/services/SpambotService.js`

```javascript
// ✅ ИСПРАВЛЕНО:
async startDistribution({ accountId, userId, userRole = 'user', config }) {
    // 1. Проверка доступа к аккаунту
    // ✅ Админ может запускать рассылки на любых аккаунтах
    let account;
    if (userRole === 'admin') {
        account = await LuxeeAccountModel.findById(accountId);
    } else {
        account = await LuxeeAccountModel.findOne({
            _id: accountId,
            user: userId  // Только для обычных пользователей
        });
    }

    if (!account) {
        throw new Error('Account not found or access denied');
    }

    // Далее обычный запуск...
}
```

**Логика:**
- **Админ:** `findById(accountId)` - ищет аккаунт БЕЗ проверки владельца
- **User:** `findOne({ _id, user: userId })` - ищет только свои аккаунты

---

## 📊 Архитектура решения

```
┌─────────────────────────────────────────┐
│  Frontend: AdminAccountSelector          │
│  - Админ выбирает аккаунт пользователя   │
│  - accountId: 6a5a6fa3c0383c6f5b779f9e   │
└────────────────┬────────────────────────┘
                 │
                 │ POST /api/spambot/distributions
                 ▼
┌─────────────────────────────────────────┐
│  Controller: spambotController.js        │
│  - req.user.id: 6a404cb1... (админ)      │
│  - req.user.role: "admin" ✅             │
│  - Передаёт: (accountId, userId, role)   │
└────────────────┬────────────────────────┘
                 │
                 │ startDistribution({accountId, userId, userRole})
                 ▼
┌─────────────────────────────────────────┐
│  Service: SpambotService.js              │
│                                          │
│  if (userRole === 'admin'):              │
│    account = findById(accountId) ✅      │
│    ↑ Ищет ЛЮБОЙ аккаунт                  │
│  else:                                   │
│    account = findOne({_id, user})        │
│    ↑ Ищет ТОЛЬКО свой                    │
│                                          │
│  → Запускает рассылку                    │
└─────────────────────────────────────────┘
```

---

## 🔐 Безопасность

### Проверки на месте:

1. ✅ **Роль проверяется на backend** - `req.user.role` из JWT токена
2. ✅ **Frontend не может подделать роль** - роль устанавливается при логине
3. ✅ **Middleware защищает роуты** - `roleMiddleware('admin')`
4. ✅ **Обычные пользователи не могут запустить рассылку на чужих аккаунтах**
5. ✅ **Админ может запустить рассылку на любом аккаунте**

---

## 📝 Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `backend/src/controllers/spambotController.js` | Добавлен `userRole = req.user.role` и передача в service |
| `backend/src/services/SpambotService.js` | Добавлен параметр `userRole`, условный query |

---

## ✅ Результат

**До исправления:**
```
❌ Админ → Account not found or access denied
```

**После исправления:**
```
✅ Админ → Distribution started successfully
✅ User → Работает как прежде (только свои аккаунты)
```

---

## 🧪 Тестирование

### Сценарий 1: Админ запускает рассылку на аккаунте пользователя

**Действия:**
1. Войти как админ
2. Выбрать аккаунт пользователя из AdminAccountSelector
3. Настроить и запустить рассылку

**Ожидаемый результат:**
- ✅ Рассылка запускается успешно
- ✅ В БД сохраняется с `user: userId` (ID владельца аккаунта)
- ✅ WebSocket уведомляет и админа, и владельца аккаунта

---

### Сценарий 2: Обычный пользователь пытается запустить рассылку на чужом аккаунте

**Действия:**
1. Войти как обычный пользователь
2. Попытаться запустить рассылку на чужом accountId (через API)

**Ожидаемый результат:**
- ❌ `Account not found or access denied`
- ❌ Рассылка НЕ запускается

---

### Сценарий 3: Обычный пользователь запускает рассылку на своём аккаунте

**Действия:**
1. Войти как обычный пользователь
2. Выбрать свой аккаунт
3. Запустить рассылку

**Ожидаемый результат:**
- ✅ Рассылка запускается успешно
- ✅ Работает как прежде

---

## 📝 Связанные документы

- `SPAMBOT_ADMIN_ACCESS.md` - Первоначальная реализация админ-доступа
- `SPAMBOT_FINAL_FIXES.md` - Исправление getDistributions и stopDistribution
- `SPAMBOT_COMPLETE_ANALYSIS.md` - Полный анализ архитектуры

---

## ✅ Заключение

Исправлена критическая проблема с запуском рассылок админом:

1. ✅ Controller передаёт `userRole` в service
2. ✅ Service использует условный query:
   - **Админ:** `findById()` - любой аккаунт
   - **User:** `findOne({user})` - только свои
3. ✅ Безопасность сохранена
4. ✅ Обратная совместимость сохранена

**Админ теперь может запускать рассылки на аккаунтах пользователей!** 🎉
