# 🤖 Настройка Omniroute для AI

Это руководство поможет настроить Omniroute для работы с Docker контейнерами.

---

## 📋 Что такое Omniroute?

**Omniroute** - это локальная программа-прокси для AI API, которая позволяет:
- Использовать различные AI модели через единый интерфейс
- Экономить на API запросах
- Работать с несколькими провайдерами AI

---

## 🔧 Проблема с Docker

По умолчанию Omniroute запускается на `localhost:20128`, но:
- В Docker контейнере `localhost` = сам контейнер, а не хост-машина
- Backend в Docker не может обратиться к Omniroute на хосте

**Решение:** Использовать специальный адрес для доступа к хосту из Docker.

---

## ⚙️ Настройка для Windows/Mac

### Шаг 1: Запустить Omniroute на хосте

1. Запустите Omniroute на вашем компьютере
2. Убедитесь что он работает на `http://localhost:20128`
3. Получите API ключ и модель из настроек Omniroute

### Шаг 2: Настроить .env

Откройте `.env` и убедитесь что указано:

```env
AI_API_URL=http://host.docker.internal:20128/v1
AI_API_KEY=ваш_ключ_из_omniroute
AI_MODEL=cx/gpt-5.2
```

**Важно:** `host.docker.internal` - это специальный DNS имя в Docker, которое указывает на хост-машину.

### Шаг 3: Перезапустить Docker

```bash
docker compose down
docker compose up -d --build backend
```

### Шаг 4: Проверить логи

```bash
docker compose logs backend | grep "AI Config"
```

Вы должны увидеть:
```
[AI Config] AI_API_URL: http://host.docker.internal:20128/v1
[AI Config] AI_MODEL: cx/gpt-5.2
```

---

## 🐧 Настройка для Linux

На Linux `host.docker.internal` не работает по умолчанию. Есть 2 варианта:

### Вариант 1: Использовать IP хоста (Рекомендуется)

1. Узнать IP хоста:
```bash
ip addr show docker0 | grep inet | awk '{print $2}' | cut -d/ -f1
```

Обычно это `172.17.0.1`

2. Изменить `.env`:
```env
AI_API_URL=http://172.17.0.1:20128/v1
```

3. Перезапустить:
```bash
docker compose down
docker compose up -d --build backend
```

### Вариант 2: Добавить host.docker.internal в docker-compose.yml

Добавьте в секцию `backend`:

```yaml
backend:
  # ... остальные настройки
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

Тогда можно использовать `http://host.docker.internal:20128/v1` как на Windows/Mac.

---

## 🔍 Проверка работы

### 1. Проверить что Omniroute доступен из контейнера

```bash
# Войти в контейнер
docker exec -it luxee-backend sh

# Попробовать подключиться к Omniroute
wget -O- http://host.docker.internal:20128/v1/models
# или для Linux:
wget -O- http://172.17.0.1:20128/v1/models

# Выйти
exit
```

Если видите JSON с моделями - всё работает!

### 2. Протестировать AI через /ai-test

1. Откройте http://localhost/ai-test
2. Введите тестовое сообщение
3. Нажмите "Generate Response"
4. Если получили ответ - AI работает!

### 3. Проверить логи backend

```bash
docker compose logs backend -f
```

При запросе к AI вы должны увидеть:
```
[AI Service] Sending request to AI API...
[AI Service] AI Response (raw): ...
```

---

## ❌ Troubleshooting

### Ошибка: "connect ECONNREFUSED"

**Проблема:** Backend не может подключиться к Omniroute.

**Решения:**

1. **Проверьте что Omniroute запущен:**
   - Откройте http://localhost:20128 в браузере на хосте
   - Должна открыться страница Omniroute

2. **Для Windows/Mac:**
   ```env
   AI_API_URL=http://host.docker.internal:20128/v1
   ```

3. **Для Linux:**
   ```bash
   # Узнать IP
   ip addr show docker0 | grep inet
   
   # Использовать в .env
   AI_API_URL=http://172.17.0.1:20128/v1
   ```

4. **Проверить firewall:**
   - Убедитесь что порт 20128 не заблокирован
   - На Linux может потребоваться разрешить Docker сети

### Ошибка: "Invalid API key"

**Проблема:** Неверный API ключ.

**Решение:**
1. Откройте Omniroute
2. Скопируйте API ключ из настроек
3. Вставьте в `.env`:
   ```env
   AI_API_KEY=ваш_правильный_ключ
   ```
4. Перезапустите:
   ```bash
   docker compose restart backend
   ```

### Ошибка: "Model not found"

**Проблема:** Указанная модель не существует в Omniroute.

**Решение:**
1. Откройте Omniroute
2. Посмотрите доступные модели
3. Укажите правильную модель в `.env`:
   ```env
   AI_MODEL=cx/gpt-5.2
   ```

### AI не отвечает автоматически

**Проблема:** AI настроена, но не отвечает на сообщения автоматически.

**Причина:** Функционал автоответа пока не реализован. Сейчас AI работает только:
- На странице `/ai-test` (ручное тестирование)
- Через API эндпоинт `/api/ai/generate` (ручной вызов)

**Что работает:**
- ✅ Проверка новых сообщений каждые 8 секунд
- ✅ Отображение непрочитанных сообщений
- ✅ Ручная отправка сообщений через интерфейс
- ✅ AI генерация ответов (ручная)

**Что нужно добавить:**
- [ ] Автоматический вызов AI при получении нового сообщения
- [ ] Автоматическая отправка сгенерированного ответа
- [ ] Настройка задержки перед ответом
- [ ] Фильтрация чатов для автоответа

---

## 🔄 Альтернатива: OpenAI напрямую

Если Omniroute не работает, можно использовать OpenAI напрямую:

1. Получите API ключ на https://platform.openai.com
2. Измените `.env`:
   ```env
   AI_API_URL=https://api.openai.com/v1
   AI_API_KEY=sk-ваш_openai_ключ
   AI_MODEL=gpt-4o-mini
   ```
3. Перезапустите:
   ```bash
   docker compose restart backend
   ```

**Плюсы:**
- ✅ Работает из коробки
- ✅ Не нужно запускать Omniroute
- ✅ Стабильно

**Минусы:**
- ❌ Платно (но недорого)
- ❌ Нужен интернет

---

## 📊 Сравнение вариантов

| Вариант | Стоимость | Сложность | Стабильность |
|---------|-----------|-----------|--------------|
| **Omniroute** | Бесплатно* | Средняя | Зависит от настройки |
| **OpenAI** | ~$0.15/1M токенов | Простая | Высокая |
| **LiteLLM** | Бесплатно | Средняя | Высокая |
| **OpenRouter** | От $0.06/1M токенов | Простая | Высокая |

*Omniroute может использовать бесплатные или платные провайдеры

---

## 🚀 Рекомендации для production

1. **Для разработки:** Используйте Omniroute на localhost
2. **Для production на сервере:**
   - Вариант 1: OpenAI напрямую (проще, надежнее)
   - Вариант 2: Omniroute в отдельном контейнере (если есть способ авторизации без GUI)
   - Вариант 3: LiteLLM в Docker контейнере

3. **Мониторинг:**
   - Следите за логами AI запросов
   - Настройте алерты на ошибки
   - Контролируйте расходы на API

---

## 📝 Полезные команды

```bash
# Проверить переменные окружения в контейнере
docker exec luxee-backend env | grep AI

# Проверить доступность Omniroute из контейнера
docker exec luxee-backend wget -O- http://host.docker.internal:20128/v1/models

# Посмотреть логи AI запросов
docker compose logs backend | grep "AI Service"

# Перезапустить только backend
docker compose restart backend

# Пересобрать backend с новыми настройками
docker compose up -d --build backend
```

---

**Дата создания:** 30.05.2026  
**Версия:** 1.0
