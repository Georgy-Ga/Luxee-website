# Luxee Messages API - Документация

## Обзор

Система для проверки сообщений на аккаунтах Luxee с автоматическим поддержанием активности (keep-alive).

## Архитектура

### Компоненты

1. **keepAliveService** - Поддержание активности контекстов (каждые 45 сек)
2. **chatNavigationService** - Навигация в раздел чатов
3. **profileParserService** - Парсинг профилей и сообщений
4. **messageCheckService** - Проверка сообщений на всех аккаунтах

### Как это работает

```
Авторизация → Навигация в чаты → Запуск Keep-Alive → Готов к проверке сообщений
     ↓              ↓                    ↓                        ↓
  /profile/      /chats/         Shift каждые 45 сек      Парсинг профилей
```

## Keep-Alive система

### Что делает:
- Каждые 45 секунд делает контекст активным
- Проверяет popup "You're inactive" и закрывает его
- Нажимает Shift для поддержания активности
- Автоматически останавливается при удалении аккаунта

### Пример использования:
```javascript
// Запустить keep-alive
await keepAliveService.start({ accountId, context });

// Остановить keep-alive
keepAliveService.stop(accountId);

// Получить статистику
const stats = keepAliveService.getStats();
// { activeKeepAlives: 3, accountIds: ['id1', 'id2', 'id3'] }
```

## API Endpoints

### 1. Проверить сообщения на всех аккаунтах

**Рекомендуется для фронтенда (каждые 30 сек)**

```http
GET /api/luxee/check-messages
Authorization: Bearer TOKEN
```

**Ответ:**
```json
{
  "accounts": [
    {
      "accountId": "507f1f77bcf86cd799439011",
      "accountEmail": "translator40@gmail.com",
      "profiles": [
        {
          "uid": 1420,
          "username": "Maria",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 5,
          "lastActivity": 1777095962,
          "projectsCount": 5
        },
        {
          "uid": 608078,
          "username": "Julia",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 0,
          "lastActivity": 1774265102,
          "projectsCount": 5
        }
      ],
      "totalUnread": 5,
      "profilesCount": 2
    }
  ],
  "totalUnread": 5,
  "totalProfiles": 2
}
```

### 2. Проверить сообщения на конкретном аккаунте

```http
GET /api/luxee/check-messages/account?accountId=507f1f77bcf86cd799439011
Authorization: Bearer TOKEN
```

**Ответ:**
```json
{
  "accountId": "507f1f77bcf86cd799439011",
  "accountEmail": "translator40@gmail.com",
  "profiles": [...],
  "totalUnread": 5,
  "profilesCount": 2
}
```

### 3. Получить только непрочитанные сообщения

```http
GET /api/luxee/check-messages/unread
Authorization: Bearer TOKEN
```

**Ответ:**
```json
{
  "accounts": [
    {
      "accountId": "507f1f77bcf86cd799439011",
      "accountEmail": "translator40@gmail.com",
      "profiles": [
        {
          "uid": 1420,
          "username": "Maria",
          "avatar": "https://img.luxee.date/thumb/...",
          "newMessages": 5,
          "lastActivity": 1777095962,
          "projectsCount": 5
        }
      ],
      "totalUnread": 5,
      "profilesCount": 1
    }
  ],
  "totalUnread": 5
}
```

## Процесс авторизации

### Что происходит при логине:

1. **Создание контекста** - Новый изолированный браузерный контекст
2. **Авторизация** - Ввод логина/пароля, проверка URL (10 сек)
3. **Навигация в чаты** - Прямой переход на https://luxee.io/chats/
4. **Запуск Keep-Alive** - Автоматическое поддержание активности
5. **Сохранение в БД** - Сохранение аккаунта и сессии

```http
POST /api/luxee/login
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "luxeeEmail": "translator40@gmail.com",
  "luxeePassword": "111111"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Успешная авторизация на Luxee",
  "accountId": "507f1f77bcf86cd799439011",
  "luxeeEmail": "translator40@gmail.com",
  "currentUrl": "https://luxee.io/chats/"
}
```

## Рекомендуемый Flow для фронтенда

### При входе пользователя:

```javascript
// 1. Авторизация в системе
const { token } = await login(email, password);

// 2. Получить список аккаунтов Luxee
const accounts = await fetch('/api/luxee/accounts', {
  headers: { Authorization: `Bearer ${token}` }
});

// 3. Отобразить список аккаунтов
displayAccounts(accounts);
```

### Периодическая проверка сообщений:

```javascript
// Каждые 30 секунд
setInterval(async () => {
  const messages = await fetch('/api/luxee/check-messages', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  updateUI(messages);
}, 30000);
```

### Добавление нового аккаунта:

```javascript
// 1. Добавить аккаунт
const result = await fetch('/api/luxee/login', {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    luxeeEmail: 'new@gmail.com',
    luxeePassword: 'password'
  })
});

// 2. Обновить список аккаунтов
const accounts = await fetch('/api/luxee/accounts', {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Обработка ошибок

### Контекст не найден:

```json
{
  "accountId": "507f1f77bcf86cd799439011",
  "accountEmail": "translator40@gmail.com",
  "error": "Context not found",
  "profiles": [],
  "totalUnread": 0,
  "profilesCount": 0
}
```

**Решение:** Восстановить сессию или авторизоваться заново

```http
POST /api/luxee/accounts/507f1f77bcf86cd799439011/restore
Authorization: Bearer TOKEN
```

### Нет активных аккаунтов:

```json
{
  "accounts": [],
  "totalUnread": 0,
  "totalProfiles": 0
}
```

**Решение:** Добавить аккаунт через `/api/luxee/login`

## Особенности

### Множество аккаунтов
- ✅ Один пользователь может иметь несколько аккаунтов Luxee
- ✅ Каждый аккаунт = отдельный контекст
- ✅ Keep-Alive работает для всех контекстов одновременно

### Множество профилей
- ✅ На одном аккаунте Luxee может быть до 20 профилей
- ✅ Все профили парсятся одним запросом
- ✅ Можно фильтровать только с непрочитанными

### Изоляция контекстов
- ✅ Каждый аккаунт работает независимо
- ✅ Ошибка одного не влияет на другие
- ✅ При ошибке авторизации контекст закрывается

### Popup "You're inactive"
- ✅ Автоматически закрывается каждые 45 сек
- ✅ Проверяется перед нажатием Shift
- ✅ Не требует ручного вмешательства

## Производительность

### Рекомендации:
- Проверять сообщения каждые 30 секунд (не чаще)
- Использовать `/api/luxee/check-messages` для всех аккаунтов
- Использовать `/api/luxee/check-messages/unread` если нужны только непрочитанные
- Keep-Alive работает автоматически, не требует дополнительных запросов

### Ограничения:
- Максимум 20 профилей на аккаунт (ограничение Luxee)
- Keep-Alive каждые 45 секунд (оптимально для предотвращения оффлайна)
- Проверка URL при авторизации - 10 секунд (можно настроить)

## Примеры использования

### React Hook для проверки сообщений:

```javascript
function useMessages() {
  const [messages, setMessages] = useState(null);
  const token = useAuth();

  useEffect(() => {
    const checkMessages = async () => {
      const response = await fetch('/api/luxee/check-messages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(data);
    };

    checkMessages();
    const interval = setInterval(checkMessages, 30000);

    return () => clearInterval(interval);
  }, [token]);

  return messages;
}
```

### Отображение непрочитанных:

```javascript
function UnreadBadge() {
  const messages = useMessages();
  
  if (!messages || messages.totalUnread === 0) return null;
  
  return <span className="badge">{messages.totalUnread}</span>;
}
```

## Troubleshooting

### Проблема: Контекст уходит в оффлайн
**Решение:** Keep-Alive должен работать автоматически. Проверьте логи.

### Проблема: Профили не парсятся
**Решение:** Убедитесь что аккаунт авторизован и находится на странице `/chats/`

### Проблема: Много запросов
**Решение:** Используйте `/api/luxee/check-messages` вместо отдельных запросов для каждого аккаунта

### Проблема: Popup "You're inactive" не закрывается
**Решение:** Keep-Alive автоматически закрывает его. Если проблема сохраняется - проверьте селектор кнопки.
