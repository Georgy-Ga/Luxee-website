# Playwright Docker Configuration Fix

**Дата:** 19.06.2026  
**Статус:** ✅ Завершено

## Проблема

При запуске в Docker контейнере возникали ошибки Playwright:
```
browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome
```

## Причина

1. Playwright пытался использовать предустановленный браузер вместо системного Chromium
2. Не были установлены необходимые шрифты (включая emoji)
3. Не была установлена переменная окружения для принудительного headless режима

## Решение

### 1. Обновлён Dockerfile

**Файл:** `backend/Dockerfile`

Добавлен пакет `font-noto-emoji` для поддержки emoji в браузере:

```dockerfile
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji
```

### 2. Обновлён browserConfig.js

**Файл:** `backend/src/config/browserConfig.js`

Добавлена проверка переменной окружения `DOCKER` для автоматического включения headless режима:

```javascript
const browserConfig = {
	// В production и Docker всегда headless режим
	headless: process.env.BROWSER_HEADLESS === 'true' 
		|| process.env.NODE_ENV === 'production' 
		|| process.env.DOCKER === 'true'
		|| false,
	
	// В production и Docker отключаем замедление
	slowMo: (process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true')
		? 0 
		: (parseInt(process.env.BROWSER_SLOW_MO) || 150),
	
	// В Docker DevTools не нужны
	devtools: (process.env.DOCKER !== 'true' && process.env.BROWSER_DEVTOOLS === 'true') || false,
};
```

### 3. Обновлён docker-compose.yml

**Файл:** `docker-compose.yml`

Добавлена переменная окружения `DOCKER=true` в секцию backend:

```yaml
backend:
  environment:
    NODE_ENV: production
    PORT: 5000
    DOCKER: "true"
    # ... остальные переменные
```

## Технические детали

### Переменные окружения Playwright

Используются в `backend/Dockerfile`:

```dockerfile
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` - не скачивать браузер при установке
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` - использовать системный Chromium

### Аргументы запуска браузера

Используются в `backend/src/services/browser/browserService.js`:

```javascript
const launchOptions = {
    headless,
    slowMo,
    devtools: browserConfig.devtools,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Для Docker
        '--disable-gpu', // Для headless режима
        '--start-maximized',
    ],
};

// В Docker используем системный Chromium
if (process.env.DOCKER === 'true') {
    launchOptions.executablePath = '/usr/bin/chromium-browser';
    console.log('[Browser Service] Using system Chromium in Docker');
}
```

**Важно:** `executablePath` устанавливается только в Docker окружении, что позволяет локальной разработке использовать стандартные браузеры Playwright.

## Тестирование

После применения изменений необходимо:

1. **Пересобрать backend контейнер:**
   ```bash
   docker-compose build backend
   ```

2. **Перезапустить контейнеры:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Проверить логи:**
   ```bash
   docker-compose logs -f backend
   ```

4. **Проверить работу браузера:**
   - Попробовать добавить аккаунт Luxee
   - Проверить автоматические ответы AI
   - Убедиться что нет ошибок Playwright

## Преимущества решения

✅ Браузер работает в headless режиме в Docker  
✅ Используется легковесный системный Chromium  
✅ Поддержка emoji и специальных символов  
✅ Автоматическая настройка для Docker окружения  
✅ Нет лишних DevTools в production  
✅ Оптимизированная производительность (slowMo = 0)

## Связанные файлы

- `backend/Dockerfile` - конфигурация Docker образа
- `backend/src/config/browserConfig.js` - конфигурация браузера
- `backend/src/services/browser/browserService.js` - сервис управления браузером
- `docker-compose.yml` - оркестрация контейнеров

## Дополнительная информация

### Volumes для Playwright

В `docker-compose.yml` настроены volumes для сохранения данных браузера:

```yaml
volumes:
  - playwright_data:/app/.playwright
  - browser_contexts:/app/browser-contexts
```

Это позволяет:
- Сохранять кэш браузера между перезапусками
- Хранить контексты браузера (cookies, storage)
- Ускорить последующие запуски

### Healthcheck

Для backend настроен healthcheck:

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Заметки

- Изменения применяются автоматически при указании `DOCKER=true`
- В локальной разработке браузер может работать в видимом режиме
- Шрифты необходимы для корректного отображения emoji в сообщениях
