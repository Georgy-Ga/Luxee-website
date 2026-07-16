# Spambot Integration Documentation

## Обзор

Интеграция Python Spambot Service в Luxee платформу для массовых рассылок сообщений в Luxee.io.

## Архитектура

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Frontend (Vue) │ ◄─────► │ Node.js Backend  │ ◄─────► │ Python Spambot  │
│                 │  HTTP   │   + MongoDB      │  HTTP   │    Service      │
│                 │  WS     │                  │         │  (FastAPI)      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │                             │
                                    │                             │
                                    ▼                             ▼
                            Playwright Context            RPA Framework
                            (Cookies, Session)            (Automation)
```

## Компоненты

### 1. Python Service (`backend-spambot/`)

**Назначение**: Выполнение рассылок с использованием RPA Framework и Selenium

**Основные файлы**:
- `main.py` - FastAPI приложение
- `config.py` - Конфигурация
- `src/api/distribution.py` - API endpoints
- `src/services/distribution_manager.py` - Менеджер рассылок
- `src/services/auth_manager.py` - Авторизация через cookies
- `src/core/luxee_site/` - Оригинальная логика spambot

**API Endpoints**:
- `POST /api/distribution/start` - Запуск рассылки
- `POST /api/distribution/stop` - Остановка рассылки
- `GET /api/distribution/status/{account_id}` - Статус рассылки
- `DELETE /api/distribution/context/{account_id}` - Закрытие контекста
- `GET /health` - Health check

### 2. Node.js Backend Integration

**Модель MongoDB** (`backend/src/models/Distribution.js`):
- Хранит конфигурацию рассылки
- Отслеживает прогресс и статус
- Связана с User и LuxeeAccount

**Service** (`backend/src/services/SpambotService.js`):
- HTTP клиент для Python Service
- Singleton паттерн
- Обработка ошибок и статусов

**Controller** (`backend/src/controllers/distributionController.js`):
- CRUD операции для рассылок
- Валидация входных данных
- WebSocket уведомления

**Routes** (`backend/src/routes/distribution.js`):
```
POST   /api/distributions          - Создать рассылку
GET    /api/distributions          - Список рассылок
GET    /api/distributions/:id      - Детали рассылки
POST   /api/distributions/:id/start - Запустить
POST   /api/distributions/:id/stop  - Остановить
DELETE /api/distributions/:id      - Удалить
```

## Процесс рассылки

### 1. Создание рассылки

```javascript
POST /api/distributions
{
  "luxeeAccountId": "...",
  "profile": {
    "name": "Татьяна",
    "age": "25",
    "owner_uid": 12345
  },
  "purchased": true,
  "free": false,
  "messages": [
    { "text": "Привет!", "interval": 10 }
  ],
  "limit": 100
}
```

### 2. Запуск рассылки

```javascript
POST /api/distributions/:id/start
```

**Что происходит**:
1. Node.js получает cookies из Playwright контекста
2. Формирует конфигурацию для Python Service
3. Отправляет POST запрос в Python Service
4. Python Service запускает RPA automation
5. Статус обновляется в MongoDB
6. WebSocket уведомление отправляется клиенту

### 3. Мониторинг прогресса

Python Service периодически отправляет callbacks в Node.js Backend для обновления прогресса:

```javascript
// Progress update
{
  "sent_count": 45,
  "skipped_count": 5,
  "total_processed": 50,
  "current_profile": "Татьяна"
}
```

### 4. Завершение

При завершении (успешно/ошибка/остановлено):
- Статус обновляется в MongoDB
- WebSocket уведомление клиенту
- Контекст браузера закрывается (опционально)

## Статусы рассылки

- `pending` - Создана, ожидает запуска
- `running` - В процессе выполнения
- `completed` - Успешно завершена
- `stopped` - Остановлена пользователем
- `error` - Завершена с ошибкой

## Docker Deployment

### docker-compose.yml

```yaml
services:
  spambot:
    build: ./backend-spambot
    container_name: luxee-spambot
    environment:
      SPAMBOT_PORT: 8001
      NODE_BACKEND_URL: http://backend:5000
      HIDDEN_BROWSER: "true"
    ports:
      - "8001:8001"
    networks:
      - luxee-network
```

### Запуск

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов spambot
docker-compose logs -f spambot

# Перезапуск только spambot
docker-compose restart spambot
```

## Переменные окружения

### Node.js Backend (`.env`)

```bash
SPAMBOT_URL=http://luxee-spambot:8001
```

### Python Service (`.env`)

```bash
SPAMBOT_PORT=8001
SPAMBOT_HOST=0.0.0.0
NODE_BACKEND_URL=http://backend:5000
HIDDEN_BROWSER=true
SKIP_SENDING_MESSAGE=false  # для отладки
```

## WebSocket События

### Backend → Frontend

```javascript
// Рассылка запущена
socket.on('distribution:started', (data) => {
  // data: { distributionId, status: 'running' }
});

// Рассылка остановлена
socket.on('distribution:stopped', (data) => {
  // data: { distributionId }
});

// Обновление прогресса
socket.on('distribution:progress', (data) => {
  // data: { distributionId, sent_count, skipped_count, ... }
});

// Завершение
socket.on('distribution:completed', (data) => {
  // data: { distributionId, status, error? }
});
```

## Безопасность

1. **Cookies авторизации**: Передаются из Playwright контекста Node.js → Python Service
2. **Аутентификация**: Все API endpoints требуют JWT токен
3. **Изоляция**: Каждая рассылка выполняется в отдельном браузерном контексте
4. **Валидация**: Проверка владения аккаунтом и отсутствия активных рассылок

## Ограничения

- **Один аккаунт = одна активная рассылка**: Нельзя запустить несколько рассылок на одном Luxee аккаунте одновременно
- **Cookies обязательны**: Luxee аккаунт должен быть залогинен через Playwright
- **Rate limiting**: Соблюдение интервалов между сообщениями для избежания блокировок

## Отладка

### Проверка здоровья Python Service

```bash
curl http://localhost:8001/health
# {"status": "healthy", "service": "spambot"}
```

### Логи

```bash
# Node.js Backend
docker-compose logs -f backend | grep "Distribution\|Spambot"

# Python Service
docker-compose logs -f spambot
```

### Debug режим

В `.env` Python Service:
```bash
SKIP_SENDING_MESSAGE=true  # Не отправлять реальные сообщения
HIDDEN_BROWSER=false       # Показывать браузер (только локально)
```

## Известные проблемы и решения

### Проблема: Python Service не стартует

**Решение**: Проверить зависимости Chromium и xvfb в Dockerfile

### Проблема: "Context not found"

**Решение**: Убедиться что Luxee аккаунт залогинен через Playwright перед запуском рассылки

### Проблема: Медленная работа

**Решение**: Увеличить `interval` между сообщениями или `filter_update_limit`

## Дальнейшее развитие

- [ ] Frontend UI для управления рассылками
- [ ] Webhooks для интеграции с внешними системами
- [ ] Планировщик рассылок (cron-like)
- [ ] Статистика и аналитика рассылок
- [ ] Шаблоны сообщений
- [ ] A/B тестирование сообщений

## См. также

- [SPAMBOT_INTEGRATION_PLAN.md](../SPAMBOT_INTEGRATION_PLAN.md) - Оригинальный план интеграции
- [WEBSOCKET_SYNC.md](./WEBSOCKET_SYNC.md) - Документация по WebSocket
- Original spambot: [/spambot](../spambot/)
