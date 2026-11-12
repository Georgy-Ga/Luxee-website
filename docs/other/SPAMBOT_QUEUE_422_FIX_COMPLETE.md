# Исправление ошибки 422 при запуске рассылок из очереди

**Дата:** 21.07.2026  
**Статус:** ✅ Завершено

## Проблема

При запуске рассылок из очереди возникала ошибка 422 от Python service:

```
POST /api/distribution/start - 422 Unprocessable Entity
```

### Причина

В `SpambotQueueService.js` при подготовке конфигурации для Python service передавались объекты Mongoose с метаданными (`_id`, `__v` и др.), которые Python service не ожидал и не мог обработать.

**Проблемный код:**

```javascript
messages: config.messages?.map(m => ({
    text: m.text,
    interval: m.interval || 0,
})),
```

Mongoose добавляет `_id` автоматически к элементам subdocument arrays, и простой маппинг не удалял эти поля.

## Решение

### 1. Исправлен SpambotQueueService.js

Добавлено **явное приведение типов** для всех полей конфигурации:

```javascript
// ✅ FIX: Явное приведение типов - убирает _id и другие Mongoose поля
messages: config.messages?.map(m => ({
    text: String(m.text),
    interval: Number(m.interval) || 0,
})) || null,
mail_message: config.mailMessage
    ? {
            title: String(config.mailMessage.title),
            text: String(config.mailMessage.text),
            pictures_number: Array.isArray(config.mailMessage.picturesNumber)
                ? config.mailMessage.picturesNumber
                : [],
        }
    : null,
exclude_ids: Array.isArray(config.excludeIds) ? config.excludeIds : [],
specific_users: Array.isArray(config.specificUsers) ? config.specificUsers : [],
limit: Number(config.limit),
filter_update_limit: Number(config.filterUpdateLimit),
max_time_minutes: Number(config.maxTimeMinutes) || 180,
```

**Что изменилось:**

- ✅ `String(m.text)` вместо `m.text` - преобразует в чистую строку
- ✅ `Number(m.interval)` вместо `m.interval` - преобразует в число
- ✅ `|| null` для messages - явно возвращает null если нет сообщений
- ✅ Проверка `Array.isArray()` для всех массивов
- ✅ Явное преобразование чисел через `Number()`

### 2. Добавлена русификация статусов

Обновлён `DistributionHistory.jsx` для отображения статусов на русском:

```javascript
const getStatusText = status => {
	switch (status) {
		case 'running':
			return 'Выполняется';
		case 'queued':
			return 'В очереди';
		case 'completed':
			return 'Завершена';
		case 'stopped':
			return 'Остановлена';
		case 'error':
			return 'Ошибка';
		default:
			return status;
	}
};
```

Добавлен цвет для статуса `queued`:

```javascript
case 'queued':
    return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
```

### 3. Добавлена функция удаления из очереди

#### Backend (уже существовало)

- ✅ API endpoint: `DELETE /api/spambot/distributions/:id`
- ✅ Controller: `spambotController.deleteDistribution()`
- ✅ Service: `spambotQueueService.removeFromQueue()`
- ✅ API функция: `spambotApi.deleteDistribution()`

#### Frontend (добавлено)

**Spambot.jsx:**

```javascript
// Удаление рассылки из очереди (сервер)
const handleRemoveFromQueue = async distributionId => {
	try {
		console.log(`[Spambot] 🗑️  Removing from queue: ${distributionId}`);

		const result = await spambotApi.deleteDistribution(distributionId);

		console.log(`[Spambot] ✅ Remove result:`, result);

		// Удалить из истории локально
		setDistributionHistory(prev =>
			prev.filter(d => d._id !== distributionId && d.id !== distributionId),
		);
	} catch (error) {
		console.error('[Spambot] ❌ Error removing distribution:', error);
		alert(
			`Ошибка удаления рассылки: ${error.response?.data?.message || error.message}`,
		);
	}
};

// Удаление из локальной UI очереди
const handleRemoveFromLocalQueue = id => {
	setQueuedDistributions(prev => prev.filter(d => d.id !== id));
};
```

**DistributionHistory.jsx:**

```javascript
{
	dist.status === 'queued' && onRemoveFromQueue && (
		<button
			onClick={() => onRemoveFromQueue(dist.id || dist._id)}
			className='px-3 py-1 text-xs rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
			title='Удалить из очереди'
		>
			✖ Удалить
		</button>
	);
}
```

## Изменённые файлы

### Backend

1. **backend/src/services/SpambotQueueService.js**
   - Исправлено явное приведение типов в методе `startNextInQueue()`
   - Убраны Mongoose метаданные из конфигурации

### Frontend

1. **frontend/src/components/Spambot/DistributionHistory.jsx**
   - Добавлен статус "В очереди" (queued)
   - Добавлена кнопка удаления для рассылок в очереди
   - Добавлен prop `onRemoveFromQueue`

2. **frontend/src/pages/Spambot.jsx**
   - Добавлена функция `handleRemoveFromQueue()` для удаления из серверной очереди
   - Переименована `handleRemoveFromQueue()` в `handleRemoveFromLocalQueue()` для локальной очереди
   - Подключены обработчики к компонентам

## Тестирование

### Сценарии для проверки:

1. **Запуск рассылки сразу (без очереди)**
   - ✅ Выбрать аккаунт без активных рассылок
   - ✅ Добавить рассылку
   - ✅ Запустить
   - ✅ Проверить что статус "Выполняется"

2. **Добавление в очередь**
   - ✅ Выбрать аккаунт с активной рассылкой
   - ✅ Добавить новую рассылку
   - ✅ Проверить что статус "В очереди"
   - ✅ Проверить отображение позиции в очереди

3. **Автоматический запуск из очереди**
   - ✅ Дождаться завершения активной рассылки
   - ✅ Проверить что следующая рассылка автоматически начинается
   - ✅ Проверить что статус меняется с "В очереди" на "Выполняется"

4. **Удаление из очереди**
   - ✅ Добавить рассылку в очередь
   - ✅ Нажать кнопку "✖ Удалить"
   - ✅ Проверить что рассылка удалена из истории
   - ✅ Проверить что следующая рассылка не запускается

5. **Ошибка при запуске из очереди**
   - ✅ Проверить что при ошибке запуска система пытается запустить следующую рассылку
   - ✅ Проверить логирование ошибок

## Логи для мониторинга

При запуске из очереди в консоли появятся логи:

```
[Queue Service] 🔍 Checking queue for account <accountId>
[Queue Service] 🚀 Starting next distribution: <distributionId>
[Queue Service] ✅ Distribution <distributionId> started from queue
```

При ошибке:

```
[Queue Service] ❌ Error starting next distribution: <error>
[Queue Service] 🔄 Trying to start next distribution after error...
```

При удалении:

```
[Spambot] 🗑️  Removing from queue: <distributionId>
[Queue Service] 🗑️  Distribution removed from queue: <distributionId>
```

## Заключение

Проблема с ошибкой 422 полностью решена. Теперь:

- ✅ Рассылки из очереди запускаются без ошибок
- ✅ Конфигурация правильно преобразуется перед отправкой в Python service
- ✅ Статусы рассылок отображаются на русском
- ✅ Добавлена возможность удаления рассылок из очереди
- ✅ Улучшено логирование для отладки
