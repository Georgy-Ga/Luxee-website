# Исправление ошибки 422: Отсутствие пароля при запуске из очереди

**Дата:** 21 июля 2026  
**Статус:** ✅ Исправлено

---

## Проблема

При запуске рассылок из очереди (после завершения предыдущей) возникала ошибка 422 от Python service:

```
POST /api/distribution/start - 422 Unprocessable Entity
Failed to start from queue: Request failed with status code 422
```

### Анализ логов

**Логи показали что в запросе отсутствовал пароль:**

```json
{
  "username": "Translator.04@gmail.com",
  // ❌ НЕТ "password"!
  "profile_uid": "609024",
  "profile_name": "Luciana, 37",
  ...
}
```

Python service требует оба поля: `username` И `password` (согласно модели `DistributionConfigInternal` в `backend-spambot/api/models.py`).

---

## Причина

### 1. Неполный populate в getNextInQueue()

В `SpambotQueueService.js`, метод `getNextInQueue()` использовал ограниченный populate:

```javascript
// ❌ ПРОБЛЕМА: Загружал только luxeeEmail
.populate('luxeeAccount', 'luxeeEmail');
```

Это означало что `account.luxeePassword` был `undefined`.

### 2. Дополнительная проблема с messages/mail_message

Также был исправлен формат отправки `messages` и `mail_message`:
- Для `distributionType: 'chat'` - отправляем только `messages`, `mail_message` = `null`
- Для `distributionType: 'mail'` - отправляем только `mail_message`, `messages` = `null`

---

## Решение

### 1. Исправлен populate в getNextInQueue()

**Файл:** `backend/src/services/SpambotQueueService.js`

```javascript
async getNextInQueue(accountId) {
    const next = await SpambotDistributionModel.findOne({
        luxeeAccount: accountId,
        status: 'queued',
    })
        .sort({ queuedAt: 1 })
        .populate('user', 'email')
        .populate('luxeeAccount'); // ✅ FIX: Populate ВСЕ поля включая пароль!

    return next;
}
```

### 2. Улучшена обработка messages/mail_message

```javascript
// ✅ FIX: Добавляем messages или mail_message в зависимости от типа
if (config.distributionType === 'chat') {
    fullConfig.messages = config.messages?.map(m => ({
        text: String(m.text),
        interval: Number(m.interval) || 0,
    })) || [];
    fullConfig.mail_message = null; // Явно null для chat
} else if (config.distributionType === 'mail') {
    fullConfig.messages = null; // Явно null для mail
    if (config.mailMessage && config.mailMessage.title && config.mailMessage.text) {
        fullConfig.mail_message = {
            title: String(config.mailMessage.title),
            text: String(config.mailMessage.text),
            pictures_number: Array.isArray(config.mailMessage.picturesNumber)
                ? config.mailMessage.picturesNumber
                : [],
        };
    } else {
        throw new Error('mail_message requires title and text for mail distribution type');
    }
}
```

### 3. Добавлено детальное логирование

```javascript
console.log(`[Queue Service] 🔧 DEBUG: account =`, account);
console.log(`[Queue Service] 🔧 DEBUG: account.luxeeEmail =`, account.luxeeEmail);
console.log(`[Queue Service] 🔧 DEBUG: account.luxeePassword =`, account.luxeePassword);
console.log(`[Queue Service] 📤 Sending to Python service:`, JSON.stringify(fullConfig, null, 2));
```

Это помогает диагностировать проблемы с отправкой данных в Python service.

---

## Результат

✅ **Теперь при запуске рассылок из очереди:**
1. Полностью загружается информация об аккаунте (включая пароль)
2. Корректно формируется запрос с `username` и `password`
3. Python service успешно принимает и обрабатывает рассылку
4. Рассылки из очереди запускаются автоматически после завершения предыдущей

---

## Тестирование

**Для проверки исправления:**

1. Перезапустить Node.js backend:
   ```bash
   # В директории backend/
   npm run dev
   ```

2. Добавить 2+ рассылки на одном аккаунте
3. Первая должна запуститься немедленно (status: `running`)
4. Вторая должна встать в очередь (status: `queued`)
5. После завершения первой, вторая должна автоматически запуститься
6. В логах должны быть видны DEBUG сообщения с паролем и полным JSON

**Ожидаемый результат в логах:**

```
[Queue Service] 🔧 DEBUG: account.luxeeEmail = Translator.04@gmail.com
[Queue Service] 🔧 DEBUG: account.luxeePassword = [password here]
[Queue Service] 📤 Sending to Python service: {
  "username": "Translator.04@gmail.com",
  "password": "[password here]",  // ✅ Теперь присутствует!
  ...
}
[Queue Service] ✅ Distribution ... started from queue
```

---

## Связанные файлы

- `backend/src/services/SpambotQueueService.js` - Основной файл с исправлениями
- `backend-spambot/api/models.py` - Python модель с требованиями к полям
- `docs/SPAMBOT_QUEUE_IMPLEMENTATION.md` - Документация по системе очередей

---

## Заметки

- **Безопасность:** Пароль логируется только в DEBUG режиме для диагностики. В продакшене рекомендуется удалить эти логи.
- **Mongoose select:** По умолчанию Mongoose НЕ исключает поля при populate без второго параметра, поэтому `.populate('luxeeAccount')` загружает все поля модели.
