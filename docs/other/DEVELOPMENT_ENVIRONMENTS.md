# Development Environments Configuration

**Дата:** 19.06.2026  
**Статус:** ✅ Настроено

## Обзор

Проект поддерживает два режима работы:
1. **Локальная разработка** - `npm run dev` с видимыми браузерами
2. **Docker production** - полностью изолированная среда с headless браузерами

## Локальная разработка (npm run dev)

### Запуск

```bash
# Backend
cd backend
npm run dev

# Frontend (в другом терминале)
cd frontend
npm run dev
```

### Конфигурация браузера

- **Режим:** видимый браузер (headless = false)
- **Замедление:** 150ms (можно настроить через `BROWSER_SLOW_MO`)
- **DevTools:** опционально (через `BROWSER_DEVTOOLS=true`)
- **Браузер:** стандартный Playwright Chromium

### Переменные окружения

**Backend** (`backend/.env`):
```env
NODE_ENV=development
PORT=5000
MONGO_URL=mongodb://localhost:27017/luxee
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-key

# Опциональные настройки браузера
BROWSER_HEADLESS=false
BROWSER_SLOW_MO=150
BROWSER_DEVTOOLS=false

# AI Configuration
AI_API_URL=http://localhost:20128/v1
AI_API_KEY=your-api-key
AI_MODEL=gemini-cli/gemini-2.5-flash
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

### База данных

Для локальной разработки можно использовать MongoDB из Docker:

```bash
# Запустить только MongoDB
docker-compose up mongodb -d

# Или установить MongoDB локально
```

### Преимущества

✅ Видимый браузер для отладки  
✅ Быстрая перезагрузка с hot-reload  
✅ DevTools браузера доступны  
✅ Можно видеть действия в реальном времени  
✅ Легко отлаживать проблемы

## Docker Production

### Запуск

```bash
# Полная сборка и запуск
docker-compose up -d --build

# Или только пересборка backend
docker-compose build backend
docker-compose up -d
```

### Конфигурация браузера

- **Режим:** headless (скрытый браузер)
- **Замедление:** 0ms (максимальная производительность)
- **DevTools:** отключены
- **Браузер:** системный Chromium из Alpine Linux
- **executablePath:** `/usr/bin/chromium-browser`

### Переменные окружения

Настраиваются в `.env` в корне проекта:

```env
# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=changeme

# JWT
JWT_ACCESS_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-production-refresh-secret

# AI Configuration
AI_API_URL=http://host.docker.internal:20128/v1
AI_API_KEY=your-api-key
AI_MODEL=gemini-cli/gemini-2.5-flash

# Frontend
VITE_API_URL=http://localhost:5000/api

# Allowed Origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:80,http://localhost
```

### Автоматические настройки

Docker контейнер автоматически:
- Устанавливает `DOCKER=true`
- Включает headless режим
- Отключает замедление
- Использует системный Chromium
- Отключает DevTools

### Логи и отладка

```bash
# Посмотреть логи всех сервисов
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только frontend
docker-compose logs -f frontend

# Последние 100 строк
docker-compose logs backend --tail=100
```

### Преимущества

✅ Полная изоляция окружения  
✅ Одинаковое окружение на всех серверах  
✅ Оптимизированная производительность  
✅ Легкий деплой на production  
✅ Автоматическое управление зависимостями

## Технические детали

### Определение окружения

Код автоматически определяет окружение через переменную `DOCKER`:

```javascript
// backend/src/config/browserConfig.js
const browserConfig = {
    headless: process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production',
    slowMo: process.env.DOCKER === 'true' ? 0 : 150,
    devtools: process.env.DOCKER !== 'true' && process.env.BROWSER_DEVTOOLS === 'true',
};
```

```javascript
// backend/src/services/browser/browserService.js
const launchOptions = { /* ... */ };

if (process.env.DOCKER === 'true') {
    launchOptions.executablePath = '/usr/bin/chromium-browser';
}
```

### Playwright в разных окружениях

| Параметр | Локальная разработка | Docker Production |
|----------|---------------------|-------------------|
| Browser | Playwright Chromium | System Chromium |
| Headless | false | true |
| SlowMo | 150ms | 0ms |
| DevTools | опционально | false |
| executablePath | не установлен | /usr/bin/chromium-browser |

## Миграция на production

### 1. Настроить .env файл

Скопировать `.env.example` в `.env` и заполнить production значения:

```bash
cp .env.example .env
nano .env
```

### 2. Собрать контейнеры

```bash
docker-compose build
```

### 3. Запустить

```bash
docker-compose up -d
```

### 4. Проверить

```bash
# Проверить статус
docker-compose ps

# Проверить логи
docker-compose logs -f

# Проверить healthcheck
docker-compose ps backend
```

### 5. Создать admin пользователя

```bash
docker-compose exec backend node createAdmin.js
```

## Troubleshooting

### Проблема: Playwright не находит браузер в Docker

**Решение:** Убедитесь что:
- Переменная `DOCKER=true` установлена в `docker-compose.yml`
- Backend контейнер пересобран после изменений
- `executablePath` указывает на `/usr/bin/chromium-browser`

```bash
docker-compose build backend
docker-compose up -d backend
```

### Проблема: Браузер не открывается локально

**Решение:** Проверьте что:
- `BROWSER_HEADLESS=false` в `backend/.env`
- `DOCKER` переменная не установлена
- Playwright браузеры установлены: `npx playwright install chromium`

### Проблема: Медленная работа в Docker

**Решение:**
- Убедитесь что `slowMo` = 0 в Docker (автоматически при `DOCKER=true`)
- Проверьте ресурсы Docker Desktop (CPU/RAM)
- Очистите неиспользуемые Docker данные: `docker system prune -a`

## Best Practices

### Локальная разработка

1. Используйте видимый браузер для отладки
2. Устанавливайте `slowMo` для комфортного просмотра (100-200ms)
3. Включайте DevTools при необходимости
4. Используйте hot-reload для быстрой разработки

### Docker Production

1. Всегда используйте headless режим
2. Отключайте замедление для производительности
3. Используйте volumes для сохранения данных
4. Настройте healthchecks для мониторинга
5. Регулярно проверяйте логи

### Безопасность

1. Не коммитьте `.env` файлы с секретами
2. Используйте сильные пароли для MongoDB
3. Генерируйте уникальные JWT секреты для production
4. Настройте ALLOWED_ORIGINS правильно
5. Используйте HTTPS на production сервере

## Связанные файлы

- `backend/src/config/browserConfig.js` - конфигурация браузера
- `backend/src/services/browser/browserService.js` - управление браузером
- `docker-compose.yml` - Docker оркестрация
- `backend/Dockerfile` - backend образ
- `frontend/Dockerfile` - frontend образ
- `.env.example` - пример переменных окружения

## Дополнительные команды

### Docker

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить volumes
docker-compose down -v

# Пересобрать без кеша
docker-compose build --no-cache

# Посмотреть ресурсы
docker stats

# Войти в контейнер
docker-compose exec backend sh
```

### NPM

```bash
# Установить зависимости
npm install

# Обновить зависимости
npm update

# Проверить устаревшие пакеты
npm outdated

# Очистить node_modules и переустановить
rm -rf node_modules package-lock.json
npm install
```
