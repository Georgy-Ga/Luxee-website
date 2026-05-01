# Архитектура проекта

## Структура проекта

```
backend/
├── src/
│   ├── controllers/          # Контроллеры (обработка HTTP запросов)
│   │   ├── UserController.js
│   │   └── luxeeController.js
│   ├── services/            # Бизнес-логика
│   │   ├── browser/         # Сервисы для работы с браузером
│   │   │   ├── browserService.js    # Управление браузером и контекстами
│   │   │   └── pageHelpers.js       # Вспомогательные функции для страниц
│   │   ├── luxeeApi/        # Сервисы для работы с Luxee
│   │   │   ├── luxeeAuthService.js  # Авторизация на Luxee
│   │   │   └── luxeeScraperService.js # Парсинг данных с Luxee
│   │   ├── userService.js   # Работа с пользователями
│   │   └── tokenService.js  # Работа с JWT токенами
│   ├── models/              # Mongoose модели
│   │   ├── UserModel.js
│   │   ├── TokenModel.js
│   │   └── LuxeeAccountModel.js
│   ├── middleware/          # Middleware
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── errorMiddleware.js
│   ├── dtos/               # Data Transfer Objects
│   │   └── UserDto.js
│   ├── exceptions/         # Кастомные ошибки
│   │   └── apiError.js
│   └── routes/             # Маршруты
│       └── index.js
└── index.js                # Точка входа
```

## Ключевые концепции

### 1. Функциональный подход

Все сервисы реализованы как объекты с функциями:

```javascript
const myService = {
	method1: async ({ param1, param2 }) => {
		// Деструктуризация параметров
		// Логика
	},
	method2: async ({ param1 }) => {
		// Логика
	},
};
```

### 2. Деструктуризация параметров

Все функции принимают объект с параметрами и используют деструктуризацию:

```javascript
// ❌ Плохо
login: async (userId, luxeeEmail, luxeePassword) => { }

// ✅ Хорошо
login: async ({ userId, luxeeEmail, luxeePassword }) => { }
```

### 3. Один браузер, множество контекстов

**browserService** управляет одним экземпляром браузера Playwright для всего приложения.
Для каждого аккаунта Luxee создаётся отдельный контекст (изолированная сессия).

```javascript
// Один браузер на всё приложение
let browserInstance = null;

// Map контекстов: accountId -> context
const contexts = new Map();
```

**Преимущества:**
- Экономия ресурсов (один процесс браузера)
- Изоляция сессий между аккаунтами
- Простое управление контекстами

### 4. Разделение ответственности

#### browserService
- Запуск/остановка браузера
- Создание/удаление контекстов
- Сохранение состояния сессий

#### pageHelpers
- Навигация по страницам
- Клики, заполнение форм
- Извлечение данных
- Ожидание элементов

#### luxeeAuthService
- Авторизация на Luxee
- Управление аккаунтами
- Восстановление сессий

#### luxeeScraperService
- Парсинг данных с Luxee
- Получение профилей
- Извлечение контента страниц

## Работа с браузером

### Создание контекста

```javascript
const context = await browserService.createContext({
	accountId: '123',
	sessionData: savedSession, // опционально
});
```

### Получение страницы

```javascript
const page = await pageHelpers.getOrCreatePage(context);
```

### Навигация

```javascript
await pageHelpers.navigateTo({ 
	page, 
	url: 'https://example.com',
});
```

### Извлечение данных

```javascript
const { data } = await pageHelpers.extractData({
	page,
	extractor: () => {
		// Код выполняется в контексте браузера
		return {
			title: document.title,
			url: window.location.href,
		};
	},
});
```

## API Endpoints

### Авторизация пользователя
- `POST /api/login` - Вход в систему
- `POST /api/logout` - Выход
- `GET /api/refresh` - Обновление токена
- `POST /api/registration` - Регистрация (только для админов)

### Luxee API
- `POST /api/luxee/login` - Авторизация на Luxee
- `GET /api/luxee/accounts` - Список аккаунтов Luxee
- `DELETE /api/luxee/accounts/:accountId` - Удалить аккаунт
- `POST /api/luxee/accounts/:accountId/restore` - Восстановить сессию
- `GET /api/luxee/profiles?accountId=ID` - Получить профили
- `GET /api/luxee/page-content?accountId=ID&url=URL` - Получить контент страницы

## Совместимость

- **Node.js**: >= 24.14.1
- **Playwright**: ^1.59.1
- **MongoDB**: ^7.1.1
- **Express**: ^5.2.1

## Особенности реализации

1. **Один браузер для всех** - экономия ресурсов
2. **Контексты по accountId** - изоляция сессий
3. **Деструктуризация везде** - читаемость кода
4. **Функциональный подход** - консистентность
5. **Разделение логики** - browser отдельно от luxeeApi
