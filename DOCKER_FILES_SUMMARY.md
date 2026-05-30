# 📦 Созданные Docker файлы - Краткое описание

## Структура файлов

```
Model-site/
├── docker-compose.yml          # Главный файл оркестрации
├── .env.example                # Пример переменных окружения
├── .gitignore                  # Игнорируемые файлы для Git
├── DOCKER_DEPLOYMENT.md        # Полная документация по развертыванию
├── QUICK_START.md              # Быстрый старт
│
├── backend/
│   ├── Dockerfile              # Docker образ для бекенда
│   ├── .dockerignore           # Игнорируемые файлы при сборке
│   └── .env.example            # Пример переменных для бекенда
│
└── frontend/
    ├── Dockerfile              # Docker образ для фронтенда
    ├── .dockerignore           # Игнорируемые файлы при сборке
    ├── .env.example            # Пример переменных для фронтенда
    └── nginx.conf              # Конфигурация Nginx
```

## Описание файлов

### 🐳 docker-compose.yml
**Назначение**: Оркестрация всех сервисов (MongoDB, Backend, Frontend)

**Что делает**:
- Запускает MongoDB с персистентным хранилищем
- Собирает и запускает Backend на порту 5000
- Собирает и запускает Frontend на порту 80
- Настраивает сеть между контейнерами
- Добавляет health checks для всех сервисов
- Создает volumes для сохранения данных

**Команды**:
```bash
docker compose up -d        # Запуск
docker compose down         # Остановка
docker compose logs -f      # Просмотр логов
```

### 📄 backend/Dockerfile
**Назначение**: Создание Docker образа для Node.js бекенда

**Особенности**:
- Базовый образ: `node:24-alpine` (легкий)
- Устанавливает Chromium для Playwright
- Настраивает переменные окружения для Playwright
- Копирует код и устанавливает зависимости
- Открывает порт 5000

### 📄 frontend/Dockerfile
**Назначение**: Создание Docker образа для React фронтенда

**Особенности**:
- Multi-stage build (сборка + production)
- Stage 1: Собирает React приложение с Vite
- Stage 2: Nginx для раздачи статики
- Поддержка переменных окружения через build args
- Открывает порт 80

### 📄 frontend/nginx.conf
**Назначение**: Конфигурация Nginx для SPA

**Что настраивает**:
- Обработка React Router (все запросы → index.html)
- Gzip сжатие для оптимизации
- Кэширование статических файлов (1 год)
- Отключение кэша для index.html
- Security headers (XSS, Frame Options)

### 📄 .env.example
**Назначение**: Шаблон переменных окружения

**Содержит**:
- Настройки MongoDB (логин/пароль)
- JWT секреты для авторизации
- OpenAI API ключ
- URL для API (VITE_API_URL)
- Разрешенные origins для CORS

### 📄 .dockerignore
**Назначение**: Исключение файлов из Docker образа

**Исключает**:
- node_modules (устанавливаются в контейнере)
- .env файлы (секреты)
- .git (история версий)
- Логи и временные файлы

## Изменения в существующих файлах

### ✏️ backend/index.js
**Изменение**: Обновлена настройка CORS

**Что добавлено**:
- Динамическое определение разрешенных origins
- Поддержка переменной окружения `ALLOWED_ORIGINS`
- Разрешение запросов без origin (для мобильных приложений)

### ✏️ frontend/src/api/axios.js
**Изменение**: Динамический API URL

**Что добавлено**:
- Использование `import.meta.env.VITE_API_URL`
- Fallback на localhost для разработки

### ✏️ README.md
**Изменение**: Добавлена секция Docker

**Что добавлено**:
- Инструкции по быстрому старту с Docker
- Ссылка на полную документацию
- Обновлен список технологий

## Как это работает

### 1. Запуск одной командой
```bash
docker compose up -d
```

Эта команда:
1. Создает Docker сеть `luxee-network`
2. Запускает MongoDB контейнер
3. Собирает Backend из `backend/Dockerfile`
4. Собирает Frontend из `frontend/Dockerfile`
5. Связывает все контейнеры в одну сеть
6. Пробрасывает порты наружу (80, 5000, 27017)

### 2. Сетевое взаимодействие

```
Внешний мир
    ↓
┌─────────────────────────────────────┐
│  Docker Host (ваш сервер)           │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ Frontend │  │ Backend  │        │
│  │  :80     │→ │  :5000   │        │
│  └──────────┘  └────┬─────┘        │
│                     ↓               │
│              ┌──────────┐           │
│              │ MongoDB  │           │
│              │  :27017  │           │
│              └──────────┘           │
│                                     │
│  luxee-network (bridge)             │
└─────────────────────────────────────┘
```

### 3. Персистентность данных

Docker volumes сохраняют данные даже после перезапуска:
- `mongodb_data` - база данных
- `mongodb_config` - конфигурация MongoDB
- `playwright_data` - кэш браузера Playwright
- `browser_contexts` - сохраненные сессии браузера

## Переменные окружения

### Обязательные
- `MONGO_ROOT_PASSWORD` - пароль MongoDB
- `JWT_ACCESS_SECRET` - секрет для access токенов
- `JWT_REFRESH_SECRET` - секрет для refresh токенов
- `OPENAI_API_KEY` - ключ OpenAI API

### Для production
- `VITE_API_URL` - URL вашего API (http://your-domain.com/api)
- `ALLOWED_ORIGINS` - разрешенные origins для CORS

### Опциональные (есть defaults)
- `MONGO_ROOT_USERNAME` - логин MongoDB (default: admin)
- `OPENAI_MODEL` - модель OpenAI (default: gpt-4o-mini)

## Порты

| Сервис   | Внутренний | Внешний | Описание                    |
|----------|------------|---------|----------------------------|
| Frontend | 80         | 80      | Веб-интерфейс              |
| Backend  | 5000       | 5000    | REST API                   |
| MongoDB  | 27017      | 27017   | База данных (опционально)  |

**Примечание**: Порт MongoDB можно закрыть для внешнего доступа в production.

## Безопасность

### ✅ Реализовано
- Секреты через переменные окружения
- .dockerignore исключает чувствительные файлы
- .gitignore предотвращает коммит секретов
- CORS настроен для конкретных origins
- Security headers в Nginx
- Минимальные Alpine образы

### 🔒 Рекомендации для production
1. Используйте HTTPS (добавьте reverse proxy)
2. Закройте порт MongoDB (27017) для внешнего доступа
3. Используйте сильные пароли (генерируйте через `openssl rand -base64 32`)
4. Настройте firewall (ufw)
5. Регулярно обновляйте Docker образы
6. Настройте автоматические бэкапы MongoDB

## Полезные команды

```bash
# Просмотр статуса
docker compose ps

# Логи в реальном времени
docker compose logs -f

# Перезапуск одного сервиса
docker compose restart backend

# Вход в контейнер
docker exec -it luxee-backend sh

# Проверка использования ресурсов
docker stats

# Очистка неиспользуемых ресурсов
docker system prune -a

# Бэкап MongoDB
docker exec luxee-mongodb mongodump --username admin --password your_pass --out /data/backup
docker cp luxee-mongodb:/data/backup ./backups/
```

## Документация

- 📖 **Полная документация**: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- 🚀 **Быстрый старт**: [QUICK_START.md](QUICK_START.md)
- 📝 **Основной README**: [README.md](README.md)

---

**Все готово для развертывания на сервере!** 🎉
