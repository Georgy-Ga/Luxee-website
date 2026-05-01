# Luxee API Документация

## Обзор

Система интеграции с сайтом Luxee.io через Playwright для автоматизации работы с аккаунтами.

## Особенности

- **Постоянная сессия**: Браузер остаётся открытым (headless: false), чтобы анкеты оставались онлайн
- **Сохранение сессий**: Сессии сохраняются в БД и могут быть восстановлены
- **Авторизация**: Все эндпоинты требуют авторизации через JWT токен
- **Привязка к пользователю**: Каждый оператор видит только свои аккаунты Luxee

## API Эндпоинты

### 1. Авторизация на Luxee

**POST** `/api/luxee/login`

Авторизует аккаунт Luxee и сохраняет сессию.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Body:**
```json
{
  "luxeeEmail": "your@email.com",
  "luxeePassword": "yourpassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Успешная авторизация на Luxee",
  "accountId": "507f1f77bcf86cd799439011",
  "luxeeEmail": "your@email.com",
  "currentUrl": "https://luxee.io/dashboard"
}
```

### 2. Получить список аккаунтов Luxee

**GET** `/api/luxee/accounts`

Возвращает все аккаунты Luxee текущего пользователя.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "luxeeEmail": "account1@email.com",
    "isActive": true,
    "lastActivity": "2026-04-17T12:30:00.000Z",
    "createdAt": "2026-04-17T10:00:00.000Z"
  }
]
```

### 3. Удалить аккаунт Luxee

**DELETE** `/api/luxee/accounts/:accountId`

Удаляет аккаунт Luxee и закрывает браузер.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "Аккаунт Luxee удалён"
}
```

### 4. Восстановить сессию

**POST** `/api/luxee/accounts/:accountId/restore`

Восстанавливает сохранённую сессию и открывает браузер.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "Сессия восстановлена",
  "currentUrl": "https://luxee.io/dashboard"
}
```

## Модели данных

### LuxeeAccount

```javascript
{
  user: ObjectId,           // Ссылка на пользователя
  luxeeEmail: String,       // Email аккаунта Luxee
  luxeePassword: String,    // Пароль аккаунта Luxee
  sessionData: String,      // JSON сессии браузера
  isActive: Boolean,        // Активна ли сессия
  lastActivity: Date,       // Последняя активность
  createdAt: Date          // Дата создания
}
```

## Архитектура

```
backend/src/
├── models/
│   └── LuxeeAccountModel.js          # Модель аккаунта Luxee
├── services/
│   └── luxeeApi/
│       ├── browserManager.js         # Управление браузерами
│       └── luxeeAuthService.js       # Логика авторизации
├── controllers/
│   └── luxeeController.js            # HTTP контроллер
└── routes/
    └── index.js                      # Роуты API
```

## Как работает

1. **Авторизация**: Playwright открывает браузер, переходит на luxee.io, нажимает кнопку Log In, заполняет форму
2. **Сохранение сессии**: После успешного логина сохраняется storageState (cookies, localStorage)
3. **Постоянная работа**: Браузер остаётся открытым (headless: false), чтобы анкеты были онлайн
4. **Восстановление**: При перезапуске сервера можно восстановить сессию из БД

## Следующие шаги

- [ ] Парсинг анкет с сайта
- [ ] Получение сообщений
- [ ] Отправка сообщений
- [ ] Интеграция с AI для автоответов
- [ ] Чёрный список пользователей
- [ ] Уведомления о новых сообщениях
