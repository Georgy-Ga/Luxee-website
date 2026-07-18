# Spambot Critical Bug Fixes

**Дата:** 18.07.2026  
**Статус:** ✅ Исправлено

## 🐛 Проблемы и Решения

### 1. ❌ Кнопка "Остановить" не работала

**Проблема:**
```
POST http://localhost:5000/api/spambot/distributions/81fc50a3-5dd4-4ba6-99ac-397fa53e1541/stop 500
Cast to ObjectId failed for value "81fc50a3-5dd4-4ba6-99ac-397fa53e1541"
```

**Причина:**
1. Frontend передавал `dist.distributionId` (UUID) ✅
2. Но Backend искал по `_id` вместо `distributionId` ❌

**Решение:**
```javascript
// backend/src/services/spambotService.js
// ❌ Было:
const distribution = await SpambotDistributionModel.findOne({
	_id: distributionId,  // ❌ Ищет MongoDB ObjectId
	user: userId
});

// ✅ Стало:
const distribution = await SpambotDistributionModel.findOne({
	distributionId: distributionId,  // ✅ Ищет UUID от Python Service
	user: userId
});
```

---

### 2. ❌ Админ не видит рассылки других пользователей

**Проблема:**
```
[Socket Service] User 6a404db898f7c6a44e4f9957 not connected, skipping emit: spambot:distribution:completed
```

Админ запускал рассылку от имени пользователя, но WebSocket события отправлялись только владельцу, а не админу.

**Причина:**
`socketService.emitToUser()` отправляет события только конкретному пользователю. Админы не получали уведомления о рассылках других пользователей.

**Решение:**

#### 2.1. Добавлен новый метод в `socketService.js`:

```javascript
/**
 * Отправить событие пользователю + всем админам
 * Используется для событий, которые админы должны видеть (например, рассылки)
 */
emitToUserAndAdmins(userId, event, data) {
	if (!this.ensureInitialized()) return;

	let sentToSockets = new Set();
	let sentToUsers = 0;

	// Отправить владельцу
	const userSockets = this.connectedUsers.get(userId);
	if (userSockets && userSockets.size > 0) {
		userSockets.forEach(socketId => {
			this.io.to(socketId).emit(event, data);
			sentToSockets.add(socketId);
		});
		sentToUsers++;
	}

	// Отправить всем админам
	this.io.sockets.sockets.forEach((socket) => {
		if (socket.userRole === 'admin' && !sentToSockets.has(socket.id)) {
			socket.emit(event, data);
			sentToSockets.add(socket.id);
			sentToUsers++;
		}
	});

	console.log(`[Socket Service] Emit to user ${userId} + admins (${sentToSockets.size} connections, ${sentToUsers} users): ${event}`);
}
```

#### 2.2. Обновлены методы в `socketService.js`:

```javascript
// Все методы теперь используют emitToUserAndAdmins:
- emitDistributionStarted()
- emitDistributionCompleted()
- emitDistributionStopped()
- emitDistributionError()
```

#### 2.3. Обновлен `spambotPollingService.js`:

```javascript
// ❌ Было:
socketService.emitToUser(distribution.user._id, eventName, { ... });

// ✅ Стало:
socketService.emitToUserAndAdmins(distribution.user._id, eventName, { ... });
```

---

### 3. ❌ WebSocket обновления не отображались мгновенно

**Проблема:**
История рассылок не обновлялась в реальном времени, даже если WebSocket события приходили.

**Причина:**
Обработчики WebSocket вызывали `loadDistributionHistory()`, который делал **полный HTTP запрос** на сервер для перезагрузки всей истории. Это медленно и создает ненужную нагрузку.

**Решение:**
```javascript
// frontend/src/pages/Spambot.jsx
// ❌ Было:
const handleDistributionStatus = (data) => {
	console.log('[Spambot] Distribution status update:', data);
	loadDistributionHistory(); // ❌ HTTP запрос на сервер
};

// ✅ Стало:
const handleDistributionStatus = (data) => {
	console.log('[Spambot] Distribution status update:', data);
	
	// ✅ Обновить напрямую в state (без HTTP)
	setDistributionHistory(prev => 
		prev.map(dist => 
			dist.distributionId === data.distributionId 
				? { ...dist, ...data }
				: dist
		)
	);
};
```

**Преимущества:**
- ⚡ Мгновенное обновление UI (без задержки HTTP)
- 🔥 Нет лишних запросов на сервер
- 🎯 Обновляется только нужная запись, а не вся история

---

## ✅ Результат

### До исправлений:
- ❌ Кнопка "Остановить" возвращала 500 ошибку
- ❌ Админ не видел рассылки других пользователей в реальном времени
- ❌ История рассылок обновлялась только у владельца

### После исправлений:
- ✅ Кнопка "Остановить" работает корректно
- ✅ Админ видит ВСЕ рассылки в реальном времени
- ✅ WebSocket события доставляются владельцу + всем админам
- ✅ История синхронизируется между пользователем и админом

---

## 🔄 Затронутые файлы

### Frontend:
1. `frontend/src/pages/Spambot.jsx` - оптимизированы WebSocket обработчики (обновление state без HTTP)

### Backend:
1. `backend/src/services/spambotService.js` - исправлен `stopDistribution()` (поиск по `distributionId`)
2. `backend/src/services/socketService.js` - добавлен `emitToUserAndAdmins()`, обновлены все методы рассылки
3. `backend/src/services/spambotPollingService.js` - использует `emitToUserAndAdmins()` везде

---

## 🧪 Тестирование

### Сценарий 1: Остановка рассылки
1. Запустить рассылку
2. Нажать "Остановить" в истории
3. ✅ Рассылка останавливается без ошибок

### Сценарий 2: Админ видит рассылки пользователей
1. Пользователь запускает рассылку
2. Админ находится на странице Spambot
3. ✅ Админ мгновенно видит новую рассылку в истории
4. ✅ Статус обновляется в реальном времени

### Сценарий 3: Админ запускает рассылку от имени пользователя
1. Админ выбирает аккаунт пользователя
2. Запускает рассылку
3. ✅ Админ видит рассылку в своей истории
4. ✅ Пользователь (если подключен) тоже видит рассылку

---

## 📊 WebSocket Events Flow

```
Рассылка запущена:
├─ Владелец получает: spambot:distribution:started
└─ Все админы получают: spambot:distribution:started

Обновление статуса (каждые 10 сек):
├─ Владелец получает: spambot:distribution:status
└─ Все админы получают: spambot:distribution:status

Рассылка завершена:
├─ Владелец получает: spambot:distribution:completed
└─ Все админы получают: spambot:distribution:completed
```

---

## 🔐 Безопасность

- ✅ Роли проверяются через `socket.userRole` (устанавливается в `socketAuthMiddleware`)
- ✅ Админы видят все рассылки, но не могут изменять чужие данные без авторизации
- ✅ API endpoints защищены middleware (`authMiddleware`, `roleMiddleware`)

---

## 📝 Примечания

- WebSocket роль (`socket.userRole`) устанавливается в `backend/src/middleware/socketAuth.js`
- Метод `emitToUserAndAdmins` предотвращает дублирование (если админ = владелец)
- Polling service проверяет статусы каждые 10 секунд
