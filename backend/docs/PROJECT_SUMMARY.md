# 📊 Сводка по проекту Model-site Backend

> Дата обновления: 25.04.2026  
> Статус: Активная разработка

---

## 🎯 Что это за проект

Backend-система для автоматизации работы с платформой Luxee.io через Playwright.  
Позволяет управлять несколькими аккаунтами Luxee, проверять сообщения, работать с профилями девушек.

**Основная задача:** Автоматизация работы с Luxee без официального API через браузерную автоматизацию.

---

## 🏗️ Архитектура проекта

```
backend/
├── index.js                    # Точка входа, Express сервер
├── createAdmin.js              # Скрипт создания админа
├── package.json                # Зависимости
│
├── src/
│   ├── models/                 # MongoDB модели
│   │   ├── UserModel.js        # Пользователи системы
│   │   └── LuxeeAccountModel.js # Аккаунты Luxee
│   │
│   ├── controllers/            # Контроллеры API
│   │   ├── userController.js   # Авторизация, регистрация
│   │   └── luxeeController.js  # Работа с Luxee
│   │
│   ├── routes/                 # Маршруты API
│   │   └── index.js            # Все роуты
│   │
│   └── services/               # Бизнес-логика
│       ├── browser/            # Playwright браузер
│       │   ├── browserService.js    # Управление браузером
│       │   └── pageHelpers.js       # Хелперы для страниц
│       │
│       └── luxeeApi/           # Работа с Luxee
│           ├── luxeeAuthService.js       # Авторизация
│           ├── chatNavigationService.js  # Навигация
│           ├── profileParserService.js   # Парсинг профилей
│           ├── messageCheckService.js    # Проверка сообщений
│           └── keepAliveService.js       # Keep-alive система
│
└── docs/                       # Документация
    ├── LUXEE_JS_API.md         # ✅ Проверенное API
    ├── LUXEE_MESSAGES.md       # API endpoints
    ├── API_MIGRATION.md        # План миграции
    ├── README.md               # Общая информация
    ├── BROWSER_SETTINGS.md     # Настройки браузера
    ├── PROJECT_SUMMARY.md      # Эта сводка
    │
    ├── analysis/               # Непроверенная документация
    │   └── LUXEE_API_ANALYSIS.md
    │
    └── extractedLuxee/         # Исходники Luxee
        ├── chat.v2.js          # 10,253 строки
        └── chat.api.js         # WebSocket API
```

---

## 🔧 Технологии

### Backend:
- **Node.js** + **Express** - сервер
- **MongoDB** + **Mongoose** - база данных
- **Playwright** - браузерная автоматизация
- **JWT** - авторизация
- **bcrypt** - хеширование паролей

### Ключевые библиотеки:
```json
{
  "playwright": "^1.49.1",
  "express": "^4.21.2",
  "mongoose": "^8.9.4",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1"
}
```

---

## 🚀 Основные функции сервера

### 1. Управление пользователями
- ✅ Регистрация (`POST /api/register`)
- ✅ Авторизация (`POST /api/login`)
- ✅ JWT токены
- ✅ Роли (admin, user)

### 2. Управление аккаунтами Luxee
- ✅ Добавление аккаунта (`POST /api/luxee/login`)
- ✅ Список аккаунтов (`GET /api/luxee/accounts`)
- ✅ Удаление аккаунта (`DELETE /api/luxee/accounts/:id`)
- ✅ Восстановление сессии (`POST /api/luxee/accounts/:id/restore`)

### 3. Проверка сообщений
- ✅ Все аккаунты (`GET /api/luxee/check-messages`)
- ✅ Конкретный аккаунт (`GET /api/luxee/check-messages/account`)
- ✅ Только непрочитанные (`GET /api/luxee/check-messages/unread`)

### 4. Браузерная автоматизация
- ✅ Изолированные контексты для каждого аккаунта
- ✅ Keep-alive система (каждые 45 сек)
- ✅ Автоматическое закрытие popup "You're inactive"
- ✅ Headless режим

### 5. Работа с Luxee JavaScript API
- ✅ `modelsChat.getProfile.data` - получение профилей
- ✅ `modelsChat.getChats.list` - получение чатов
- ✅ `modelsChat.selectProfile(uid)` - переключение профиля
- ✅ `modelsChat.selectChat(identity)` - открытие чата
- ✅ `modelsChat.getActiveProfile()` - текущий профиль
- 🔄 `modelsChat.sendMessage()` - отправка (в разработке)
- 🔄 `modelsChat.getMessageHistory()` - история (в разработке)

---

## 📡 API Endpoints

### Авторизация
```
POST /api/register          # Регистрация
POST /api/login             # Вход
```

### Luxee аккаунты
```
POST   /api/luxee/login                    # Добавить аккаунт
GET    /api/luxee/accounts                 # Список аккаунтов
DELETE /api/luxee/accounts/:id             # Удалить аккаунт
POST   /api/luxee/accounts/:id/restore     # Восстановить сессию
```

### Сообщения
```
GET /api/luxee/check-messages              # Все аккаунты
GET /api/luxee/check-messages/account      # Конкретный аккаунт
GET /api/luxee/check-messages/unread       # Только непрочитанные
```

---

## 🗄️ База данных (MongoDB)

### Коллекция: users
```javascript
{
  _id: ObjectId,
  email: String,           // Уникальный
  password: String,        // Хешированный
  role: String,            // 'admin' | 'user'
  createdAt: Date
}
```

### Коллекция: luxeeaccounts
```javascript
{
  _id: ObjectId,
  user: ObjectId,          // Ссылка на users
  luxeeEmail: String,      // Email Luxee
  luxeePassword: String,   // Пароль Luxee (зашифрован)
  isActive: Boolean,       // Активен ли аккаунт
  lastLogin: Date,
  createdAt: Date
}
```

---

## 🔄 Как работает система

### 1. Авторизация на Luxee
```
1. Пользователь добавляет аккаунт Luxee
   ↓
2. Создаётся изолированный браузерный контекст
   ↓
3. Playwright открывает luxee.io/login
   ↓
4. Вводит логин/пароль
   ↓
5. Переходит на /chats/
   ↓
6. Запускается Keep-Alive (каждые 45 сек)
   ↓
7. Аккаунт сохраняется в БД
```

### 2. Проверка сообщений
```
1. Запрос GET /api/luxee/check-messages
   ↓
2. Получаем все активные аккаунты пользователя
   ↓
3. Для каждого аккаунта:
   - Получаем контекст
   - Выполняем page.evaluate()
   - Вызываем modelsChat.getProfile.data
   - Парсим профили с newMessages
   ↓
4. Возвращаем агрегированные данные
```

### 3. Keep-Alive система
```
Каждые 45 секунд для каждого контекста:
1. Делаем контекст активным
2. Проверяем popup "You're inactive"
3. Если есть - закрываем
4. Нажимаем Shift для активности
5. Логируем статус
```

---

## 🎨 Особенности реализации

### Изоляция контекстов
- Каждый аккаунт Luxee = отдельный BrowserContext
- Независимые сессии, cookies, localStorage
- Ошибка одного не влияет на другие

### Прямой переход вместо кликов
```javascript
// ❌ Старый способ
await page.click('a:has-text("Communication")');
await page.click('a[href="/chats/"]');

// ✅ Новый способ
await page.goto('https://luxee.io/chats/');
```

### JavaScript API вместо HTML парсинга
```javascript
// ❌ Старый способ
const profiles = await page.$$eval('.profile', els => ...);

// ✅ Новый способ
const profiles = await page.evaluate(() => {
    return modelsChat.getProfile.data;
});
```

### Автоматический Keep-Alive
- Запускается при логине
- Работает в фоне
- Останавливается при удалении аккаунта
- Не требует дополнительных запросов

---

## 📝 Что уже работает

### ✅ Полностью реализовано:
1. Авторизация пользователей (JWT)
2. Добавление/удаление аккаунтов Luxee
3. Браузерная автоматизация (Playwright)
4. Keep-Alive система
5. Проверка сообщений на всех аккаунтах
6. Парсинг профилей через JavaScript API
7. Изолированные контексты
8. Автоматическое закрытие popup

### ✅ Протестировано:
- `modelsChat.selectChat("1389492_1772829")` - работает
- `modelsChat.getActiveProfile()` - работает, возвращает:
  ```json
  {
    "uid": 1420,
    "username": "Maria",
    "gender": 2,
    "avatar": { "src": "...", "preview": "...", "thumbnail": "..." },
    "newMessages": 0
  }
  ```

---

## 🔄 В разработке (с Playwright)

### Планируется добавить:

1. **Отправка сообщений**
   - Метод: `modelsChat.sendMessage()`
   - Требует тестирования
   - Нужно понять параметры

2. **История сообщений**
   - Метод: `modelsChat.getMessageHistory()`
   - Для загрузки старых сообщений
   - Callback-based API

3. **Чтение сообщений**
   - Парсинг текущих сообщений в чате
   - Через `modelsChat.getChat.list`

4. **Дополнительные функции**
   - `modelsChat.editMessage()` - редактирование
   - `modelsChat.deleteMessage()` - удаление
   - `modelsChat.sendWink()` - подмигивания
   - `modelsChat.toggleFavorite()` - избранное

---

## 📚 Документация

### Проверенная (можно использовать):
- **LUXEE_JS_API.md** - JavaScript API Luxee (протестировано)
- **LUXEE_MESSAGES.md** - API endpoints сервера
- **API_MIGRATION.md** - план миграции на JS API
- **BROWSER_SETTINGS.md** - настройки Playwright

### Непроверенная (требует тестирования):
- **analysis/LUXEE_API_ANALYSIS.md** - анализ исходного кода
  - Найдено 30+ методов API
  - Требуют тестирования перед использованием

### Исходники Luxee:
- **extractedLuxee/chat.v2.js** - 10,253 строки основного кода
- **extractedLuxee/chat.api.js** - WebSocket API

---

## 🚦 Текущий статус

### Что работает стабильно:
- ✅ Авторизация пользователей
- ✅ Управление аккаунтами Luxee
- ✅ Проверка сообщений
- ✅ Keep-Alive система
- ✅ Парсинг профилей

### Что нужно доработать:
- 🔄 Отправка сообщений (тестирование)
- 🔄 История сообщений (тестирование)
- 🔄 Чтение текущих сообщений
- 🔄 Frontend для удобного управления

### Известные ограничения:
- Максимум 20 профилей на аккаунт (ограничение Luxee)
- Keep-Alive каждые 45 секунд (оптимально)
- Нет официального API Luxee (используем браузер)

---

## 🎯 Следующие шаги

### Приоритет 1 (высокий):
1. Протестировать `modelsChat.sendMessage()` в консоли
2. Создать `luxeeMessageService.js` для отправки
3. Добавить endpoint `POST /api/luxee/send-message`
4. Протестировать отправку через API

### Приоритет 2 (средний):
5. Протестировать `modelsChat.getMessageHistory()`
6. Добавить endpoint для получения истории
7. Создать сервис для чтения сообщений
8. Добавить endpoint для получения сообщений чата

### Приоритет 3 (низкий):
9. Дополнительные функции (wink, favorite, edit)
10. Frontend для управления
11. Статистика и аналитика
12. Уведомления о новых сообщениях

---

## 🔐 Безопасность

### Реализовано:
- ✅ JWT токены для авторизации
- ✅ Хеширование паролей (bcrypt)
- ✅ Изолированные контексты браузера
- ✅ Проверка прав доступа к аккаунтам

### Рекомендации:
- Использовать HTTPS в продакшене
- Хранить .env в безопасности
- Регулярно обновлять зависимости
- Логировать подозрительную активность

---

## 📊 Производительность

### Текущие показатели:
- Проверка сообщений: ~1-2 сек на аккаунт
- Keep-Alive: каждые 45 сек (минимальная нагрузка)
- Память: ~100-200 MB на контекст
- CPU: низкая нагрузка в idle

### Рекомендации:
- Проверять сообщения каждые 30 сек (не чаще)
- Использовать один запрос для всех аккаунтов
- Закрывать неиспользуемые контексты
- Мониторить память при большом количестве аккаунтов

---

## 🛠️ Запуск проекта

### Требования:
- Node.js 18+
- MongoDB
- 2GB RAM минимум

### Установка:
```bash
cd backend
npm install
```

### Настройка .env:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/model-site
JWT_SECRET=your-secret-key
```

### Запуск:
```bash
# Создать админа
node createAdmin.js

# Запустить сервер
npm start
```

### Тестирование API:
```bash
# Регистрация
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# Логин
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```

---

## 📞 Контакты и поддержка

### Документация:
- Основная: `backend/docs/README.md`
- API: `backend/docs/LUXEE_JS_API.md`
- Endpoints: `backend/docs/LUXEE_MESSAGES.md`

### Логи:
- Все операции логируются в консоль
- Keep-Alive: `[Keep-Alive]` префикс
- Message Check: `[Message Check]` префикс
- Browser: `[Browser Service]` префикс

---

## 🎉 Заключение

Проект находится в активной разработке. Основной функционал работает стабильно.  
Следующий этап - добавление отправки сообщений через Playwright и JavaScript API.

**Статус:** Готов к использованию для проверки сообщений ✅  
**Следующее:** Отправка сообщений 🔄
