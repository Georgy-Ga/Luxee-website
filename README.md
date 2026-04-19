# Luxee-website

Система автоматизации работы с сайтом Luxee.io для операторов.

## Описание

Проект представляет собой backend-систему для управления аккаунтами на платформе Luxee.io с использованием автоматизации через Playwright.

## Функционал

### Реализовано:
- ✅ Авторизация пользователей (JWT токены)
- ✅ Система ролей (admin/user)
- ✅ Регистрация новых операторов (только для админов)
- ✅ Интеграция с Luxee.io через Playwright
- ✅ Автоматическая авторизация на Luxee
- ✅ Сохранение и восстановление сессий браузера
- ✅ Управление несколькими аккаунтами Luxee

### В планах:
- [ ] Парсинг анкет с сайта
- [ ] Получение и отправка сообщений
- [ ] Интеграция с AI для автоответов
- [ ] Чёрный список пользователей
- [ ] Уведомления о новых сообщениях
- [ ] Админ-панель для управления

## Технологии

- **Backend**: Node.js, Express.js
- **База данных**: MongoDB, Mongoose
- **Авторизация**: JWT (jsonwebtoken), bcrypt
- **Автоматизация**: Playwright
- **Валидация**: express-validator

## Установка

```bash
# Клонировать репозиторий
git clone https://github.com/Georgy-Ga/Luxee-website.git

# Перейти в папку backend
cd Luxee-website/backend

# Установить зависимости
npm install

# Создать файл .env
# PORT=5000
# MONGO_URL=mongodb://localhost:27017/luxeeAi
# JWT_ACCESS_SECRET=your_secret_key
# JWT_REFRESH_SECRET=your_refresh_secret_key

# Запустить сервер
npm run dev
```

## API Документация

Подробная документация API доступна в файле [backend/LUXEE_API.md](backend/LUXEE_API.md)

### Основные эндпоинты:

**Авторизация:**
- `POST /api/login` - Вход в систему
- `POST /api/logout` - Выход из системы
- `GET /api/refresh` - Обновление токенов
- `POST /api/registration` - Регистрация (только для админов)

**Luxee интеграция:**
- `POST /api/luxee/login` - Авторизация на Luxee
- `GET /api/luxee/accounts` - Список аккаунтов Luxee
- `DELETE /api/luxee/accounts/:id` - Удаление аккаунта
- `POST /api/luxee/accounts/:id/restore` - Восстановление сессии

## Структура проекта

```
backend/
├── src/
│   ├── controllers/        # HTTP контроллеры
│   ├── models/            # Mongoose модели
│   ├── services/          # Бизнес-логика
│   │   └── luxeeApi/      # Сервисы для работы с Luxee
│   ├── middleware/        # Middleware (auth, role, error)
│   ├── routes/            # API роуты
│   ├── dtos/              # Data Transfer Objects
│   └── exceptions/        # Обработка ошибок
├── index.js               # Точка входа
└── package.json
```

## Создание админа

```bash
# Запустить скрипт для генерации хеша пароля
node backend/createAdmin.js

# Добавить пользователя в MongoDB Compass в коллекцию 'users'
```

## Лицензия

ISC

## Автор

Georgy-Ga
