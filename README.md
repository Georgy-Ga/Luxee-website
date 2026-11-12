# Luxee Website - Система автоматизации

Система автоматизации работы с сайтом Luxee.io для операторов.

## 📋 Описание

Проект представляет собой полноценную систему для управления аккаунтами на платформе Luxee.io с использованием автоматизации через Playwright, AI-ответов и удобного веб-интерфейса.

## ✨ Функционал

### Реализовано:
- ✅ Авторизация пользователей (JWT токены)
- ✅ Система ролей (admin/user)
- ✅ Регистрация новых операторов (только для админов)
- ✅ Интеграция с Luxee.io через Playwright
- ✅ Автоматическая авторизация на Luxee
- ✅ Сохранение и восстановление сессий браузера
- ✅ Управление несколькими аккаунтами Luxee
- ✅ Парсинг анкет с сайта
- ✅ Получение и отправка сообщений
- ✅ Автоматическая проверка новых сообщений (каждые 8 сек)
- ✅ Интеграция с AI для автоответов
- ✅ Тестовая среда для AI (страница /ai-test)
- ✅ Управление AI правилами (админ-панель)
- ✅ Система answered chats (сохранение отвеченных чатов)
- ✅ Автоматические ответы через AI (aiAuto, расписания, blacklist-скипы)
- ✅ Чёрный список пользователей (blacklist на аккаунте + категории newMessages/catchUp/activityCenter)
- ✅ Массовая рассылка сообщений (spambot: Node `/spambot/*` + `backend-spambot` FastAPI :8001)
- ✅ WebSocket синхронизация (Socket.io) + cycle-log/cycle-diagnostics
- ✅ Админ-панель для управления пользователями
- ✅ Docker контейнеризация

### В планах:
- [ ] Уведомления о новых сообщениях (push/email)
- [ ] Статистика и аналитика

## 🛠 Технологии

- **Backend**: Node.js, Express.js
- **Frontend**: React, Vite, TailwindCSS
- **База данных**: MongoDB, Mongoose
- **Авторизация**: JWT (jsonwebtoken), bcrypt
- **Автоматизация**: Playwright (Chromium)
- **AI**: DeepSeek / NVIDIA (конфиг `AI_PROVIDER`, `AI_API_KEY`, `NVIDIA_API_KEY`; `OPENAI_*` deprecated)
- **Валидация**: express-validator
- **Контейнеризация**: Docker, Docker Compose

---

## 🚀 Быстрый старт с Docker (Рекомендуется)

### Шаг 1: Клонировать репозиторий

```bash
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
```

### Шаг 2: Настроить переменные окружения

```bash
# Скопировать пример
cp .env.example .env

# Отредактировать .env (ОБЯЗАТЕЛЬНО!)
nano .env  # или любой другой редактор
```

**Обязательно измените:**
- `JWT_ACCESS_SECRET` - случайная строка минимум 32 символа
- `JWT_REFRESH_SECRET` - другая случайная строка минимум 32 символа
- `AI_PROVIDER` - `deepseek` или `nvidia`
- `AI_API_KEY` - ваш ключ DeepSeek API
- `NVIDIA_API_KEY` - ваш ключ NVIDIA API (если `AI_PROVIDER=nvidia`)
- `MONGO_ROOT_PASSWORD` - пароль для MongoDB (измените с "admin")

### Шаг 3: Запустить все сервисы

```bash
docker compose up -d
```

Это запустит:
- **MongoDB** на порту 27017
- **Backend** на порту 5001 (хост) → 5000 (контейнер)
- **Backend-spambot** (FastAPI) на порту 8001
- **Frontend** на порту 8080 (хост) → 80 (контейнер)

### Шаг 4: Создать администратора

**Для Linux/Mac:**
```bash
chmod +x create-admin.sh
./create-admin.sh
```

**Для Windows (PowerShell):**
```powershell
.\create-admin.ps1
```

Скрипт создаст администратора:
- **Email:** `admin@example.com`
- **Password:** `admin`

### Шаг 5: Войти на сайт

Откройте браузер: **http://localhost**

Войдите с данными администратора и начните работу!

---

## 📋 Полезные команды Docker

```bash
# Проверить статус контейнеров
docker compose ps

# Посмотреть логи всех сервисов
docker compose logs -f

# Посмотреть логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb

# Остановить все сервисы
docker compose stop

# Запустить снова
docker compose start

# Перезапустить сервисы
docker compose restart

# Пересобрать и запустить (после изменения кода)
docker compose up -d --build

# Остановить и удалить контейнеры (данные сохранятся!)
docker compose down

# Удалить ВСЁ включая данные (ОСТОРОЖНО!)
docker compose down -v
```

---

## 💾 Сохранение данных

Все данные сохраняются в Docker volumes и **НЕ удаляются** при остановке контейнеров:

- `mongodb_data` - База данных (пользователи, аккаунты, сообщения)
- `mongodb_config` - Конфигурация MongoDB
- `browser_contexts` - Сессии браузера Luxee
- `playwright_data` - Кэш Playwright
- `spambot_logs` - Логи рассылок спамбота (`backend-spambot/logs`)
- mount `./backend/prompts:/app/prompts` - Промпты AI

**Данные удаляются только при:** `docker compose down -v`

---

## 🔧 Установка без Docker

### Backend

```bash
cd backend
npm install

# Создать .env файл
cat > .env << EOF
PORT=5000
MONGO_URL=mongodb://localhost:27017/luxee
JWT_ACCESS_SECRET=your_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
AI_PROVIDER=deepseek
AI_API_KEY=your_deepseek_key_here
AI_MODEL=deepseek-v4-flash
SPAMBOT_SERVICE_URL=http://localhost:8001
EOF

# Запустить
npm run dev
```

### Frontend

```bash
cd frontend
npm install

# Создать .env файл
echo "VITE_API_URL=http://localhost:5000/api" > .env

# Запустить
npm run dev
```

### Создать администратора

```bash
cd backend
node createAdmin.js
# Следуйте инструкциям в выводе
```

---

## 📚 API Документация

Подробная документация API: [docs/backend/01-api-endpoints.md](docs/backend/01-api-endpoints.md)

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
- `GET /api/luxee/messages/check-all` - Проверка новых сообщений (все аккаунты)
- `GET /api/luxee/messages/check-account?accountId=` - Проверка сообщений аккаунта
- `POST /api/luxee/messages/send` - Отправка сообщения
- `GET /api/luxee/profile-chats` - Чаты профиля
- `GET /api/luxee/chat/open` - Открытие чата
- `GET /api/ai/auto-response/accounts/:accountId/cycle-log` - Лог цикла AI
- `GET /api/ai/auto-response/accounts/:accountId/cycle-diagnostics` - Диагностика цикла

**AI управление:**
- `GET /api/ai/rules` - Получить AI правила
- `POST /api/ai/rules` - Создать AI правило
- `PUT /api/ai/rules/:id` - Обновить AI правило
- `DELETE /api/ai/rules/:id` - Удалить AI правило

---

## 📁 Структура проекта

```
.
├── backend/                    # Backend приложение
│   ├── src/
│   │   ├── controllers/        # HTTP контроллеры
│   │   ├── models/            # Mongoose модели
│   │   ├── services/          # Бизнес-логика
│   │   │   ├── luxeeApi/      # Сервисы для работы с Luxee
│   │   │   ├── aiService/     # AI сервисы
│   │   │   └── browser/       # Playwright браузер
│   │   ├── middleware/        # Middleware (auth, role, error)
│   │   ├── routes/            # API роуты
│   │   └── dtos/              # Data Transfer Objects
│   ├── Dockerfile             # Docker образ backend
│   └── package.json
│
├── frontend/                   # Frontend приложение
│   ├── src/
│   │   ├── components/        # React компоненты
│   │   ├── pages/             # Страницы
│   │   ├── stores/            # Zustand stores
│   │   └── api/               # API клиенты
│   ├── Dockerfile             # Docker образ frontend
│   └── package.json
│
├── docs/                       # Документация
│   ├── backend/               # Backend документация
│   └── frontend/              # Frontend документация
│
├── docker-compose.yml          # Docker Compose конфигурация
├── create-admin.sh            # Скрипт создания админа (Linux/Mac)
├── create-admin.ps1           # Скрипт создания админа (Windows)
├── .env.example               # Пример переменных окружения
└── README.md                  # Этот файл
```

---

## 🌐 Развертывание на сервере

### 1. Подготовка сервера

```bash
# Установить Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Клонировать репозиторий
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
```

### 2. Настроить .env

```bash
cp .env.example .env
nano .env

# Измените:
# - Все секреты на случайные строки
# - MONGO_ROOT_PASSWORD на надежный пароль
# - AI_API_KEY / NVIDIA_API_KEY на ваши ключи
# - ALLOWED_ORIGINS на ваш домен
```

### 3. Запустить

```bash
docker compose up -d
```

### 4. Создать администратора

```bash
./create-admin.sh
```

### 5. Настроить Nginx (опционально)

Если хотите использовать домен и HTTPS:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔒 Безопасность

### Рекомендации для production:

1. **Измените все пароли и секреты** в .env
2. **Используйте HTTPS** (Let's Encrypt)
3. **Настройте firewall** (только 80, 443 порты)
4. **Регулярно делайте backup** базы данных
5. **Обновляйте Docker образы** регулярно
6. **Мониторьте логи** на подозрительную активность

### Backup базы данных:

```bash
# Создать backup
docker exec luxee-mongodb mongodump -u admin -p YOUR_PASSWORD --authenticationDatabase admin --out /tmp/backup
docker cp luxee-mongodb:/tmp/backup ./mongodb-backup-$(date +%Y%m%d)

# Восстановить из backup
docker cp ./mongodb-backup luxee-mongodb:/tmp/backup
docker exec luxee-mongodb mongorestore -u admin -p YOUR_PASSWORD --authenticationDatabase admin /tmp/backup
```

---

## 🐛 Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Проверить логи
docker compose logs

# Проверить порты
netstat -tulpn | grep -E '80|5000|27017'
```

### Проблема: Не могу войти

```bash
# Пересоздать администратора
./create-admin.sh
```

### Проблема: Ошибка подключения к MongoDB

```bash
# Проверить что MongoDB запущен
docker compose ps mongodb

# Перезапустить MongoDB
docker compose restart mongodb
```

### Проблема: Playwright не находит браузер

```bash
# Пересобрать backend
docker compose up -d --build backend
```

---

## 📖 Документация

### 🚀 Быстрый старт
- **[QUICK_START.md](docs/other/QUICK_START.md)** - Запуск проекта локально для новичков
- **[QUICK_START_WINDOWS.md](docs/other/QUICK_START_WINDOWS.md)** - Запуск на Windows

### 🐳 Production деплой
- **[DOCKER_DEPLOYMENT.md](docs/other/DOCKER_DEPLOYMENT.md)** - Docker развертывание
- **[DEPLOYMENT_SUMMARY.md](docs/other/DEPLOYMENT_SUMMARY.md)** - Сводка деплоя
- **[DEVELOPMENT_ENVIRONMENTS.md](docs/other/DEVELOPMENT_ENVIRONMENTS.md)** - Настройка окружений

### 🏗️ Архитектура
- **[DEVELOPMENT_ENVIRONMENTS.md](docs/other/DEVELOPMENT_ENVIRONMENTS.md)** - Настройка окружений (дубль, см. выше)

### 🤖 AI функционал
- **[ai_settings.md](docs/other/ai_settings.md)** - Настройка AI (DeepSeek/NVIDIA)
- **[AI_PROVIDER_SWITCH.md](docs/other/AI_PROVIDER_SWITCH.md)** - Переезд с OpenAI/OpenRouter на DeepSeek/NVIDIA

### 🔌 WebSocket
- **[docs/WEBSOCKET_SYNC.md](docs/other/WEBSOCKET_SYNC.md)** - WebSocket синхронизация

### 🐳 Docker
- **[DOCKER_FILES_SUMMARY.md](docs/other/DOCKER_FILES_SUMMARY.md)** - Описание Docker файлов
- **[DOCKER_DEPLOYMENT.md](docs/other/DOCKER_DEPLOYMENT.md)** - Docker развертывание

### 🔧 Backend API
- **[docs/backend/01-api-endpoints.md](docs/backend/01-api-endpoints.md)** - API эндпоинты
- **[docs/backend/02-architecture.md](docs/backend/02-architecture.md)** - Архитектура backend
- **[docs/backend/04-ai-system.md](docs/backend/04-ai-system.md)** - AI система
- **[docs/backend/07-database-models.md](docs/backend/07-database-models.md)** - Модели БД

---

## 📝 Лицензия

ISC

## 👤 Автор

**Georgy-Ga**

GitHub: [@Georgy-Ga](https://github.com/Georgy-Ga)

---

## 🤝 Поддержка

Если у вас возникли проблемы или вопросы:

1. Проверьте [Troubleshooting](#-troubleshooting)
2. Посмотрите [Issues](https://github.com/Georgy-Ga/Luxee-website/issues)
3. Создайте новый Issue с описанием проблемы

---

**Версия:** 1.0.0  
**Дата обновления:** 16.10.2026 (актуализированы AI-провайдер, порты docker-compose, споты `check-messages/send-message`, удалены битые ссылки и устаревшие `ACTIVITY_CENTER_*` планы)
