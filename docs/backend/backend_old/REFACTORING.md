# Рефакторинг - Что изменилось

## Основные изменения

### 1. Новая структура папок

```
src/services/
├── browser/                    # НОВОЕ - Логика браузера
│   ├── browserService.js       # Управление браузером и контекстами
│   └── pageHelpers.js          # Вспомогательные функции
├── luxeeApi/
│   ├── luxeeAuthService.js     # ОБНОВЛЕНО - Деструктуризация
│   ├── luxeeScraperService.js  # ОБНОВЛЕНО - Деструктуризация
│   └── browserManager.js       # УСТАРЕЛО - Можно удалить
```

### 2. Один браузер вместо множества

**Было:**
```javascript
// Браузер для каждого пользователя
browsers: new Map(), // userId -> browser
contexts: new Map(), // userId -> context
```

**Стало:**
```javascript
// Один браузер для всех
let browserInstance = null;
// Контексты по accountId
const contexts = new Map(); // accountId -> context
```

### 3. Деструктуризация параметров

**Было:**
```javascript
login: async (userId, luxeeEmail, luxeePassword) => {
	// ...
}
```

**Стало:**
```javascript
login: async ({ userId, luxeeEmail, luxeePassword }) => {
	// Деструктуризация в параметрах
}
```

### 4. Использование pageHelpers

**Было:**
```javascript
await page.goto('https://luxee.io/', { waitUntil: 'networkidle' });
await page.click('button.log__in');
await page.fill('input[name="userIdentifier"]', luxeeEmail);
```

**Стало:**
```javascript
await pageHelpers.navigateTo({ page, url: 'https://luxee.io/' });
await pageHelpers.safeClick({ page, selector: 'button.log__in' });
await pageHelpers.safeFill({ 
	page, 
	selector: 'input[name="userIdentifier"]', 
	value: luxeeEmail,
});
```

## Преимущества

### Экономия ресурсов
- **Было**: N браузеров для N пользователей
- **Стало**: 1 браузер с N контекстами

### Изоляция сессий
- Каждый аккаунт Luxee имеет свой контекст
- Контексты не пересекаются
- Независимые сессии и cookies

### Читаемость кода
- Деструктуризация делает код понятнее
- Явные имена параметров
- Меньше ошибок при вызове функций

### Модульность
- Логика браузера отделена от бизнес-логики
- pageHelpers можно переиспользовать
- Легче тестировать

## Миграция

### Шаг 1: Обновить зависимости
```bash
npm update --prefix backend
```

### Шаг 2: Удалить старый browserManager (опционально)
```bash
rm backend/src/services/luxeeApi/browserManager.js
```

### Шаг 3: Перезапустить сервер
```bash
npm run dev --prefix backend
```

### Шаг 4: Протестировать
```bash
node backend/testRefactored.js
```

## Обратная совместимость

API endpoints **не изменились**:
- ✅ `POST /api/luxee/login`
- ✅ `GET /api/luxee/accounts`
- ✅ `GET /api/luxee/profiles`
- ✅ `DELETE /api/luxee/accounts/:accountId`
- ✅ `POST /api/luxee/accounts/:accountId/restore`

Клиентский код **не требует изменений**.

## Что можно удалить

После успешного тестирования:
- `backend/src/services/luxeeApi/browserManager.js` (старая версия)
- `backend/testApi.js` (старый тест)
- `backend/testLuxee.js` (старый тест)
- `backend/installBrowsers.js` (временный файл)
- `backend/installPlaywright.bat` (временный файл)

## Совместимость с Node.js 24.14.1

Все пакеты обновлены и совместимы:
- ✅ dotenv: 17.4.2
- ✅ uuid: 14.0.0
- ✅ playwright: 1.59.1
- ✅ express: 5.2.1
- ✅ mongoose: 9.4.1

## Дополнительные возможности

### Статистика браузера
```javascript
import browserService from './services/browser/browserService.js';

const stats = browserService.getStats();
console.log(stats);
// {
//   browserRunning: true,
//   activeContexts: 2,
//   accountIds: ['123', '456']
// }
```

### Закрытие всех контекстов
```javascript
await browserService.closeAllContexts();
```

### Закрытие браузера
```javascript
await browserService.closeBrowser();
```
