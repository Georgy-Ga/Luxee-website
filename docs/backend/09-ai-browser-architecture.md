# AI Browser Architecture

## Как работает AI браузер

### Основная концепция

AI использует **отдельный browser context** с той же сессией, что и основной пользователь. Это позволяет AI и пользователю работать одновременно без конфликтов.

### Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Playwright Browser                    │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐   │
│  │  User Context        │  │  AI Context          │   │
│  │  (accountId)         │  │  (accountId_ai)      │   │
│  │                      │  │                      │   │
│  │  - Основная работа   │  │  - AI ответы         │   │
│  │  - Чтение сообщений  │  │  - Параллельная      │   │
│  │  - Отправка          │  │    работа            │   │
│  │                      │  │                      │   │
│  │  Использует:         │  │  Использует:         │   │
│  │  sessionData         │  │  ту же sessionData   │   │
│  └──────────────────────┘  └──────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Как это работает

1. **Создание AI контекста**:
   ```javascript
   // Когда AI включается для аккаунта
   const aiContextId = `${accountId}_ai`;
   const aiContext = await browserService.createContext({
     accountId: aiContextId,
     sessionData: account.sessionData, // ⭐ Та же сессия!
   });
   ```

2. **Параллельная работа**:
   - Пользователь работает в своём контексте
   - AI работает в своём контексте
   - Оба используют одну сессию (cookies)
   - Нет конфликтов и блокировок

3. **Преимущества**:
   - ✅ AI и пользователь не мешают друг другу
   - ✅ Можно открывать разные чаты одновременно
   - ✅ Нет race conditions
   - ✅ Изоляция ошибок

### Жизненный цикл AI контекста

#### 1. Создание
```javascript
// aiBrowserContextService.createAiContext(accountId)
- Проверяет что у аккаунта есть sessionData
- Создаёт новый контекст с ID: accountId_ai
- Копирует sessionData из основного аккаунта
- Навигирует на https://luxee.io/chats/
- Сохраняет aiContext в модели аккаунта
```

#### 2. Использование
```javascript
// AI отвечает на сообщения
const aiContext = await aiBrowserContextService.getOrCreateAiContext(accountId);
const page = await pageHelpers.getOrCreatePage(aiContext);
// Работа с чатами через AI контекст
```

#### 3. Восстановление
```javascript
// После перезапуска сервера
await aiBrowserContextService.restoreAllAiContexts(userId);
// Восстанавливает AI контексты для всех аккаунтов с aiEnabled: true
```

#### 4. Закрытие
```javascript
// Когда AI выключается
await aiBrowserContextService.closeAiContext(accountId);
// Закрывает контекст и очищает aiContext в модели
```

### Важные моменты

#### ⚠️ Одна сессия - два контекста

**Вопрос**: Можно ли работать в разных браузерах с одной сессией?

**Ответ**: Да, но с ограничениями:
- ✅ В одном браузере (разные контексты) - работает идеально
- ⚠️ В разных браузерах - может быть конфликт сессий
- ⚠️ Luxee может заблокировать одновременные сессии

**Текущая реализация**:
- Используем **один браузер, разные контексты**
- Это безопасно и не вызывает проблем с Luxee
- AI и пользователь работают параллельно

#### 🔄 Автоматическое восстановление

При перезапуске сервера:
```javascript
// В contextRecoveryService.js
for (const account of activeAccounts) {
  // Восстанавливаем основной контекст
  await browserService.createContext({...});
  
  // Если AI включен - восстанавливаем AI контекст
  if (account.aiEnabled) {
    await aiBrowserContextService.restoreAiContext(account._id);
  }
}
```

### Пример использования

```javascript
// В aiResponseService.js
async function sendAiResponse(accountId, chatId, message) {
  // Получаем AI контекст (создаст если нет)
  const aiContext = await aiBrowserContextService.getOrCreateAiContext(accountId);
  
  // Работаем через AI контекст
  const page = await pageHelpers.getOrCreatePage(aiContext);
  
  // Открываем чат и отправляем сообщение
  await chatOpenService.openChat(page, chatId);
  await messageSendService.sendMessage(page, message);
}
```

### Отличия от основного контекста

| Параметр | Основной контекст | AI контекст |
|----------|------------------|-------------|
| ID | `accountId` | `accountId_ai` |
| Сессия | `sessionData` | Та же `sessionData` |
| Использование | Пользователь | AI |
| Создание | При логине | При включении AI |
| Восстановление | Всегда | Только если `aiEnabled: true` |

### Безопасность

1. **Изоляция контекстов**:
   - Каждый контекст изолирован
   - Ошибка в AI не влияет на пользователя
   - Можно закрыть AI контекст без влияния на основной

2. **Проверка здоровья**:
   ```javascript
   // Перед использованием проверяем что контекст работает
   try {
     await context.pages();
   } catch (error) {
     // Контекст сломан - пересоздаём
     await aiBrowserContextService.createAiContext(accountId);
   }
   ```

3. **Graceful degradation**:
   - Если AI контекст не создаётся - основной работает
   - Если браузер падает - восстанавливаем оба контекста
   - Логи всех операций для отладки

### Мониторинг

```javascript
// Проверить доступен ли AI контекст
const isAvailable = await aiBrowserContextService.isAiContextAvailable(accountId);

// Получить AI контекст (без создания)
const aiContext = await aiBrowserContextService.getAiContext(accountId);
```

### Заключение

**AI browser context** - это элегантное решение для параллельной работы AI и пользователя:
- ✅ Нет конфликтов
- ✅ Простая реализация
- ✅ Надёжное восстановление
- ✅ Изоляция ошибок

Это позволяет AI работать в фоне, не мешая пользователю, и использовать ту же авторизацию без дополнительных логинов.
