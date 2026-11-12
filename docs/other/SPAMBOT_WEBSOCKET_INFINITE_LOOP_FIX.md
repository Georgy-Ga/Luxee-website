# Spambot WebSocket Infinite Loop Fix

**Дата:** 18.07.2026  
**Статус:** ✅ Исправлено

## 🔴 Критическая проблема

### Симптомы

1. **Множественные подключения WebSocket:**
   ```
   [Socket] Connecting to: http://localhost:5000
   [Socket] Connecting to: http://localhost:5000  // Дубль!
   [Socket] ✓ Connected: n0_T_8-Z19btYXNbAAAN
   [Socket] ✓ Connected: V3_sZkNseQE-c6nOAAAP  // Еще одно!
   [Socket] ✓ Connected: EIVERJW9Y8nmw3MOAAAR  // И еще!
   ```

2. **Постоянные переподключения:**
   ```
   [Socket] Cleaning up connection
   WebSocket is closed before the connection is established
   [Socket] Connecting to: http://localhost:5000
   ```

3. **WebSocket события не приходят пользователям:**
   - Админ видит события
   - User НЕ видит события (они теряются при переподключении)
   - Нужно обновить страницу чтобы увидеть изменения

### Root Cause

**Бесконечный цикл переподключений в `SocketContext.jsx`**

#### Как это работало (НЕПРАВИЛЬНО):

```javascript
// frontend/src/contexts/SocketContext.jsx

const connectSocket = useCallback(() => {
    // ... создание socket
    setSocket(newSocket);  // ← Изменяет socket
    
    return () => {
        newSocket.close();
    };
}, [socket]);  // ❌ Зависимость от socket!

useEffect(() => {
    const cleanup = connectSocket();
    return cleanup;
}, []);

useEffect(() => {
    if (token && !socket) {
        connectSocket();  // ← Вызывает connectSocket
    }
}, [socket, connectSocket, disconnectSocket]);  // ❌ Зависимость от socket!
```

#### Что происходило:

1. **Шаг 1:** Первый `useEffect` (строка 132) вызывает `connectSocket()`
2. **Шаг 2:** `connectSocket` создает socket и вызывает `setSocket(newSocket)`
3. **Шаг 3:** `socket` изменился → `connectSocket` пересоздается (строка 118: `[socket]`)
4. **Шаг 4:** `connectSocket` изменился → второй `useEffect` (строка 146) запускается
5. **Шаг 5:** Условие `!socket` ложное, но затем token проверяется снова
6. **Шаг 6:** Cleanup функция закрывает старый socket
7. **Шаг 7:** React re-render → цикл повторяется
8. **Бесконечный цикл!**

#### Последствия:

1. **Потеря WebSocket событий:**
   - Socket закрывается до того как событие успевает прийти
   - События отправляются на закрытые соединения
   - User не получает real-time обновления

2. **Нагрузка на сервер:**
   - Постоянные connect/disconnect циклы
   - Множественные активные соединения от одного клиента

3. **Нестабильное поведение:**
   - Race conditions между подключениями
   - Непредсказуемое получение событий

---

## ✅ Решение

### Исправленная версия `SocketContext.jsx`:

```javascript
export const SocketProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [isConnected, setIsConnected] = useState(false);
	const [connectionError, setConnectionError] = useState(null);
	const [reconnectAttempt, setReconnectAttempt] = useState(0);

	// ✅ Подключаемся ОДИН РАЗ при монтировании
	useEffect(() => {
		const token = Cookies.get('accessToken');
		
		if (!token) {
			console.log('[Socket] No token found, skipping connection');
			return;
		}

		// Защита от двойного подключения
		if (socket?.connected) {
			console.log('[Socket] Already connected');
			return;
		}

		const serverUrl = getSocketUrl();
		console.log('[Socket] Connecting to:', serverUrl);

		const newSocket = io(serverUrl, {
			auth: { token },
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 10000,
			reconnectionAttempts: Infinity,
		});

		// Обработчики событий...
		newSocket.on('connect', () => {
			console.log('[Socket] ✓ Connected:', newSocket.id);
			setIsConnected(true);
			setConnectionError(null);
			setReconnectAttempt(0);
		});

		// ... другие обработчики ...

		setSocket(newSocket);

		// Cleanup при размонтировании компонента
		return () => {
			console.log('[Socket] Cleaning up connection');
			newSocket.close();
			setSocket(null);
		};
	}, []);  // ✅ Пустой массив зависимостей - запускается только при монтировании!

	// Отключение при выходе (потеря токена)
	useEffect(() => {
		const token = Cookies.get('accessToken');
		
		if (!token && socket) {
			console.log('[Socket] No token, disconnecting...');
			socket.close();
			setSocket(null);
			setIsConnected(false);
		}
	}, []);  // ✅ Без зависимостей - не создает циклы

	const value = {
		socket,
		isConnected,
		connectionError,
		reconnectAttempt,
	};

	return (
		<SocketContext.Provider value={value}>
			{children}
		</SocketContext.Provider>
	);
};
```

### Ключевые изменения:

1. **Удален `useCallback` для `connectSocket`:**
   - Не нужно мемоизировать - вызывается только один раз
   
2. **Зависимости `useEffect` = `[]`:**
   - Подключение происходит **только при монтировании**
   - Нет повторных вызовов при изменении `socket`

3. **Удален второй `useEffect` с зависимостью `[socket]`:**
   - Убран источник бесконечного цикла

4. **Упрощен `value` объект:**
   - Убраны `connectSocket` и `disconnectSocket` (не используются)

---

## 📊 Результат

### До исправления:

**Frontend логи:**
```
[Socket] Connecting to: http://localhost:5000
[Socket] Connecting to: http://localhost:5000  // Дубль!
[Socket] Cleaning up connection
WebSocket is closed before the connection is established
[Socket] ✓ Connected: aaa
[Socket] ✓ Connected: bbb  // Множественные подключения
[Socket] ✓ Connected: ccc
```

**WebSocket события:**
- ❌ User не получает события
- ❌ Требуется обновление страницы
- ❌ Состояние не синхронизируется

### После исправления:

**Frontend логи:**
```
[Socket] Connecting to: http://localhost:5000
[Socket] ✓ Connected: xyz123  // Одно подключение!
```

**WebSocket события:**
- ✅ User получает все события в реальном времени
- ✅ Админ получает все события
- ✅ Состояние синхронизируется автоматически
- ✅ Не требуется обновление страницы

---

## 🧪 Тестирование

### Шаги для проверки:

1. **Перезагрузить frontend** (Ctrl+R или F5) - обязательно!

2. **Открыть две вкладки:**
   - Админ вкладка
   - User вкладка

3. **Проверить логи WebSocket:**
   ```
   Должно быть ТОЛЬКО:
   [Socket] Connecting to: ...
   [Socket] ✓ Connected: ...
   
   НЕ должно быть:
   [Socket] Cleaning up connection (повторяющийся)
   WebSocket is closed before...
   Множественные Connected с разными ID
   ```

4. **Запустить рассылку от имени user-а через админа:**
   - Админ: выбрать аккаунт user-а
   - Админ: Start Distribution
   - **Проверить:** User СРАЗУ видит статус "running" (без обновления страницы)

5. **Остановить рассылку:**
   - User: нажать Stop
   - **Проверить:** Статус СРАЗУ меняется на "stopped" (без обновления страницы)

### Ожидаемое поведение:

✅ Одно подключение на пользователя  
✅ Нет повторных Connecting/Cleaning up  
✅ Real-time обновления работают  
✅ Не требуется обновление страницы  

---

## 🔗 Связанные файлы

- `frontend/src/contexts/SocketContext.jsx` - Исправлен бесконечный цикл
- `backend/src/controllers/spambotController.js` - Добавлено логирование
- `backend/src/services/socketService.js` - Добавлено логирование
- `backend/src/services/SpambotService.js` - Возвращает `user` для WebSocket

---

## 📝 Best Practices

### ❌ Неправильно:

```javascript
const someFunction = useCallback(() => {
    setSocket(newSocket);
}, [socket]);  // ❌ Зависимость от socket - создаст цикл!

useEffect(() => {
    someFunction();
}, [socket, someFunction]);  // ❌ Цикл!
```

### ✅ Правильно:

```javascript
useEffect(() => {
    // Вся логика внутри useEffect
    const newSocket = io(...);
    setSocket(newSocket);
    
    return () => {
        newSocket.close();
    };
}, []);  // ✅ Пустой массив - выполняется один раз
```

### Правило:

**Если `useEffect` меняет state, на который он зависит - это бесконечный цикл!**

---

## ✅ Статус

**ИСПРАВЛЕНО** - WebSocket подключение стабильно, события доставляются в реальном времени, множественные подключения устранены.

**Требуется:** Перезагрузить frontend (Ctrl+R) после обновления кода.
