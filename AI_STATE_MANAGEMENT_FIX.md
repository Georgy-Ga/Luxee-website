# Исправление управления состоянием AI кнопок

## 🔍 Проблема

Из логов видно что:
1. **AccountToggleButton (админ)** - не меняет цвет при нажатии
2. **GlobalAIButton (sidebar)** - не меняет состояние AccountAIButton при выключении
3. **AccountAIButton (sidebar)** - не синхронизируется с другими кнопками
4. Mongoose deprecation warning: `findByIdAndUpdate` с `{new: true}`

## 📊 Анализ логов

```
chatStore.js:153 [ChatStore] 🔒 Starting bulk operation - blocking all buttons
chatStore.js:159 [ChatStore] 🔓 Ending bulk operation - unblocking buttons
chatStore.js:168 [ChatStore] 🔒 Account processing started: 6a32727f48a571037050a027
useAiSync.js:22 [AI Sync] Received AI status change
chatStore.js:129 [ChatStore] 🔄 Updating account in admin data
useAiSync.js:51 [AI Sync] ✓ Updated account 6a32727f48a571037050a027
```

Проблема: **старый chatStore.js используется вместо нового aiStateStore.js**!

## ✅ Исправления

### 1. **Mongoose deprecation warning** ✅
**Файл:** `backend/src/services/aiManagementService/accountAiService.js`

**Было:**
```javascript
const account = await LuxeeAccountModel.findByIdAndUpdate(
  accountId,
  { aiEnabledByAdmin: enabled, aiEnabled: enabled },
  { new: true }, // ⚠️ deprecated
);
```

**Стало:**
```javascript
const account = await LuxeeAccountModel.findByIdAndUpdate(
  accountId,
  { aiEnabledByAdmin: enabled, aiEnabled: enabled },
  { returnDocument: 'after' }, // ✅ новый синтаксис Mongoose 7+
);
```

### 2. **Race condition при удалении аккаунта** ✅
**Файл:** `backend/src/services/luxeeApi/luxeeAuthService/accountService.js`

**Проблема:** AI контексты не останавливались перед удалением аккаунта

**Решение:**
```javascript
// ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ОСТАНОВКИ:
// 1. Останавливаем keep-alive
keepAliveService.stop(accountId);

// 2. Останавливаем проверку сообщений
messageCheckIntervalService.stop(userId);

// 3. Останавливаем AI auto-response
await aiAutoResponseService.stop(accountId);

// 4. Даём время завершить текущий цикл AI (300ms)
await new Promise(resolve => setTimeout(resolve, 300));

// 5. Закрываем AI контекст
await aiBrowserContextService.closeAiContext(accountId);

// 6. Закрываем основной контекст
await browserService.closeContext(accountId);

// 7. Удаляем из БД
await LuxeeAccountModel.deleteOne({ _id: accountId });

// 8. Emit WebSocket событие
socketService.emitAccountDeleted(userId, accountId);
```

### 3. **Устаревший chatStore.js** ⚠️ ТРЕБУЕТ ИСПРАВЛЕНИЯ

**Проблема:** Логи показывают что используется старый `chatStore.js` вместо нового `aiStateStore.js`

**Файлы для проверки:**
- `frontend/src/hooks/useAiSync.js` - может ссылаться на chatStore
- `frontend/src/components/AdminModal/AiTab/useAiManagement.js` - может использовать chatStore
- Все компоненты кнопок

**Нужно:**
1. Найти все импорты `chatStore.js` связанные с AI
2. Заменить на `aiStateStore.js`
3. Проверить что WebSocket обработчики используют правильный store

## 🎯 Архитектура состояния (как должно быть)

### Хранилище: `aiStateStore.js`
```
{
  // Пользовательские данные (Sidebar)
  userAccounts: Map<accountId, {aiEnabled, aiEnabledByAdmin}>,
  
  // Админские данные (AdminModal)
  adminData: {
    users: [{
      _id, email, aiEnabled, aiEnabledByAdmin,
      accounts: [{_id, luxeeEmail, aiEnabled, aiEnabledByAdmin}]
    }]
  },
  
  // Блокировки
  processingBulk: boolean,
  processingAccounts: Set<accountId>
}
```

### 4 кнопки и их источники данных:

| Кнопка | Компонент | Источник данных | Действие |
|--------|-----------|-----------------|----------|
| **GlobalAIButton** | Sidebar | `aiStateStore.userAccounts` | Включает/выключает **все** аккаунты пользователя |
| **AccountAIButton** | Sidebar | `aiStateStore.userAccounts[accountId]` | Включает/выключает **конкретный** аккаунт (если админ разрешил) |
| **AccountToggleButton** | AdminModal | `aiStateStore.adminData.users[].accounts[]` | Админ разрешает/запрещает AI для **конкретного** аккаунта |
| **AccountAIToggleButton** | AdminModal | `aiStateStore.adminData.users[].accounts[]` | Админ видит статус `aiEnabled` (но не может менять) |

### WebSocket синхронизация:

**События:**
1. `ai:status:changed` - изменение одного аккаунта (от админа или пользователя)
2. `ai:bulk:changed` - массовое изменение (GlobalAIButton)
3. `luxee:account:created` - создание нового аккаунта
4. `luxee:account:deleted` - удаление аккаунта

**Обработчик:** `useAiSync.js`
- Слушает WebSocket события
- Обновляет `aiStateStore.updateUserAccount()` для Sidebar
- Обновляет `aiStateStore.updateAccountInAdminData()` для AdminModal

## 🔧 Следующие шаги

1. ✅ Исправить Mongoose deprecation
2. ✅ Исправить race condition при удалении
3. ⚠️ **Найти и удалить использование chatStore для AI состояния**
4. ⚠️ Убедиться что все кнопки читают из `aiStateStore`
5. ⚠️ Проверить WebSocket обработчики
6. 🧪 Протестировать все 4 кнопки

## 🐛 Дебаг

Для отладки добавлены логи:
- `[AI State]` - aiStateStore operations
- `[AI Sync]` - WebSocket синхронизация
- `[Luxee Auth]` - создание/удаление аккаунтов
- `[AI Management Service]` - включение/выключение AI

## 📝 Концепция прав:

1. **Админ (`aiEnabledByAdmin`):**
   - Может ВКЛЮЧИТЬ или ВЫКЛЮЧИТЬ AI для любого аккаунта
   - Когда включает - автоматически `aiEnabled = true`
   - Когда выключает - автоматически `aiEnabled = false`

2. **Пользователь (`aiEnabled`):**
   - Может ВЫКЛЮЧИТЬ AI (если админ разрешил)
   - НЕ может ВКЛЮЧИТЬ без разрешения админа
   - Ошибка если пытается включить когда `aiEnabledByAdmin = false`

3. **GlobalAIButton:**
   - Если ВСЕ аккаунты включены → выключает все
   - Если НЕ все включены → включает только те где `aiEnabledByAdmin = true`
