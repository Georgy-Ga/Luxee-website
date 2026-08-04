# Activity Center Integration - Final Implementation

## 📋 Статус: ПОЧТИ ГОТОВО

Интеграция Activity Center (колокольчик с уведомлениями) в AI Auto почти завершена. Осталось внести небольшие изменения в `index.js`.

---

## ✅ Что уже сделано

### 1. Создан модуль `activityCenterScanner.js`

Файл: `backend/src/services/aiAuto/activityCenterScanner.js`

**Основные функции:**
- ✅ `openActivityCenter(page)` - открывает колокольчик
- ✅ `closeActivityCenter(page)` - закрывает колокольчик
- ✅ `getUnreadCount(page)` - проверяет есть ли новые уведомления (класс `has-new`)
- ✅ `getUnreadNotifications(page)` - получает все непрочитанные (с классом `.new`)
- ✅ `clickNotification(page, notification, ownerUid)` - открывает чат через `page.goto()`
- ⚠️ `getChatInfoFromNotification()` - **НЕ ИСПОЛЬЗУЕТСЯ** (можно удалить)

### 2. Добавлен промпт для Activity Center

Файл: `backend/src/services/aiService/promptBuilder.js`

```javascript
export async function buildActivityCenterPrompt(messages, profile, notification) {
	// Специальный промпт для уведомлений из Activity Center
	// Учитывает тип действия: favorite, like, wink
}
```

### 3. Интегрирован в основной цикл

Файл: `backend/src/services/aiAuto/index.js`

Activity Center обрабатывается **ПОСЛЕ** Catch Up, если не было отправлено ни одного сообщения.

---

## ⚠️ Что нужно исправить

### Проблема в `index.js` (строки 661-730)

**Текущий код:**
```javascript
// Обрабатываем ПЕРВОЕ уведомление (FIFO)
const notification = notifications[0];

utils.log('AI Auto', `🖱️  Clicking notification: ${notification.manName} (${notification.activityType})`);

// ❌ ПРОБЛЕМА: clickNotification теперь требует 3 параметра
const chatOpened = await activityCenterScanner.clickNotification(
	page,
	notification,
);

if (chatOpened) {
	// ❌ ПРОБЛЕМА: getChatInfoFromNotification не нужна
	const chatInfo = await activityCenterScanner.getChatInfoFromNotification(
		page,
		notification,
	);
	
	if (chatInfo) {
		const messages = await chatMessagesExtractorService.getChatMessages(page);
		
		if (messages.length > 0) {
			// ❌ ПРОБЛЕМА: activeProfile получается слишком поздно
			const activeProfile = await utils.getActiveProfile(page);
```

**Правильный код:**
```javascript
// Обрабатываем ПЕРВОЕ уведомление (FIFO)
const notification = notifications[0];

utils.log('AI Auto', `🖱️  Opening chat from notification: ${notification.manName} (${notification.activityType})`);

// ✅ Получаем активный профиль ДО открытия чата
const activeProfile = await utils.getActiveProfile(page);

if (!activeProfile) {
	utils.log('AI Auto', '❌ No active profile for Activity Center');
} else {
	// ✅ Открываем чат через page.goto (передаём ownerUid)
	const chatOpened = await activityCenterScanner.clickNotification(
		page,
		notification,
		activeProfile.uid, // ← ДОБАВЛЕН ТРЕТИЙ ПАРАМЕТР
	);
	
	if (chatOpened) {
		// ✅ getChatInfoFromNotification УДАЛЕНА
		// Сразу получаем сообщения
		const messages = await chatMessagesExtractorService.getChatMessages(page);
		
		if (messages.length > 0) {
			// ✅ activeProfile уже есть
			// Построить промпт для Activity Center
			const prompt = await buildActivityCenterPrompt(
				messages,
				activeProfile,
				notification,
			);
			
			// Отправить сообщение через AI
			const result = await chatProcessor.processAndSendMessage(
				page,
				prompt,
				account,
				messages,
				{ type: 'activityCenter', notification },
			);
			
			if (result.success) {
				utils.log('AI Auto', `✅ Sent message to ${notification.manName} from Activity Center`);
				
				messageSent = true;
				
				// Возвращаемся к чатам
				await page.goto('https://luxee.io/chats/', {
					waitUntil: 'domcontentloaded',
					timeout: 10000,
				});
				await utils.sleep(2000);
				
				const elapsed = Date.now() - startTime;
				utils.log('AI Auto', `✅ Finished cycle - message sent from Activity Center (${Math.round(elapsed / 1000)}s)`);
				return { processed: true, reason: 'activity_center' };
			} else {
				utils.log('AI Auto', `❌ Failed to send message to ${notification.manName}`);
			}
		}
	}
}

// Закрываем Activity Center
await activityCenterScanner.closeActivityCenter(page);
```

---

## 🔧 Инструкция по исправлению

### Шаг 1: Открыть файл
```
backend/src/services/aiAuto/index.js
```

### Шаг 2: Найти строки 661-730
Ищем блок с комментарием:
```javascript
// Обрабатываем ПЕРВОЕ уведомление (FIFO)
```

### Шаг 3: Заменить код
Заменить весь блок от строки 661 до строки 736 (включая закрывающую скобку `}`) на исправленный код выше.

### Шаг 4: Удалить ненужную функцию (опционально)
В файле `activityCenterScanner.js` удалить функцию `getChatInfoFromNotification` и её экспорт, так как она больше не используется.

---

## 📊 Как это работает

### Приоритет обработки (в AI Auto):

1. **NewMessages** (новые сообщения в обычных чатах)
2. **UnAnswered** (неотвеченные сообщения)
3. **Catch Up** (старые чаты)
4. **Activity Center** ← новая категория!

### Логика Activity Center:

```
1. Проверить есть ли класс `has-new` на кнопке колокольчика
   ↓ ДА
2. Открыть Activity Center (клик на #activity-center-btn)
   ↓
3. Получить все элементы с классом `.activity-center-link.new`
   ↓
4. Взять ПЕРВОЕ уведомление (FIFO)
   ↓
5. Получить activeProfile.uid
   ↓
6. Открыть чат через page.goto():
   https://luxee.io/chats/?ownerUid={profile.uid}&profileUid={notification.profileUid}&userUid={notification.userUid}
   ↓
7. Получить историю сообщений
   ↓
8. Сгенерировать ответ через AI (специальный промпт для Activity Center)
   ↓
9. Отправить сообщение
   ↓ УСПЕХ
10. Вернуться к /chats/
11. Завершить цикл
```

### Типы уведомлений:

```javascript
// В HTML:
<li class="activity-center-link new favorite" ...> // ← подписка (followed)
<li class="activity-center-link new like" ...>     // ← лайк (liked)
<li class="activity-center-link new wink" ...>     // ← подмигивание (winked)

// Класс 'new' = непрочитанное
// Класс 'favorite' / 'like' / 'wink' = тип действия
```

---

## 🎯 Преимущества

1. **Правильная навигация** - используется `page.goto()` вместо `click()`, как в обычных чатах
2. **Контекстный промпт** - AI знает что это уведомление (favorite/like/wink) и может адаптировать ответ
3. **FIFO очередь** - обрабатываем уведомления по порядку
4. **Оптимизация** - проверяем `has-new` перед открытием колокольчика
5. **Безопасность** - всегда закрываем Activity Center после обработки

---

## 🧪 Тестирование

После внесения изменений проверить:

1. ✅ AI Auto игнорирует Activity Center если нет класса `has-new`
2. ✅ AI Auto открывает колокольчик если есть `has-new`
3. ✅ Чат открывается корректно через `page.goto()`
4. ✅ История сообщений извлекается правильно
5. ✅ AI генерирует адекватный ответ на уведомление
6. ✅ Сообщение отправляется успешно
7. ✅ После отправки возвращаемся к `/chats/`
8. ✅ Уведомление помечается как прочитанное (убирается класс `new`)

---

## 📝 Примечания

- **Кеширование не требуется** - уведомления автоматически помечаются как прочитанные на сайте
- **Обрабатываем только ОДНО** уведомление за цикл (по принципу FIFO)
- **Activity Center = последний резерв** - обрабатывается только если все обычные чаты пусты

---

## 🚀 Дальнейшие улучшения (опционально)

1. Обрабатывать несколько уведомлений за цикл (но с задержками)
2. Приоритизировать wink > like > favorite
3. Фильтровать только онлайн мужчин
4. Добавить статистику по Activity Center в логи

---

**Автор:** AI Assistant  
**Дата:** 31.07.2026  
**Статус:** Ожидает финального исправления в index.js
