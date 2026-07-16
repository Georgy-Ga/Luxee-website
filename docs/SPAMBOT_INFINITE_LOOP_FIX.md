# Исправление Infinite Loop и Механизм Остановки

## Дата: 16.07.2026

## Проблема

При анализе кода были обнаружены критические баги:

### 1. **Infinite Loop Bug** 🔴
Если `filter_clients()` возвращает пустой список (все клиенты обработаны), цикл `while` продолжает работать бесконечно:
- В оригинальном spambot этот баг тоже есть, но не критичен (desktop app)
- В веб-сервисе это **критично** - бесконечный цикл блокирует ресурсы

### 2. **Отсутствие проверки stop_flag** 🔴
В `distribution_manager.py` создаётся `stop_flags[luxee_account_id]` (threading.Event), но:
- Флаг **НЕ передаётся** в Distribution
- Флаг **НЕ проверяется** внутри циклов рассылки
- Кнопка Stop не работает - рассылка продолжается

## Решение

Внесены минимальные изменения в стиле оригинального spambot:

### 1. Distribution Model (`backend-spambot/src/core/models.py`)

```python
class Distribution:
    def __init__(self, ...):
        # ...existing code...
        
        # Stop flag для graceful shutdown (опционально, устанавливается извне)
        self.stop_flag = None  # threading.Event() будет передан из distribution_manager
```

**Что сделано:**
- Добавлено поле `stop_flag` для хранения threading.Event()
- Опциональное поле - не ломает обратную совместимость

### 2. Distribution Manager (`backend-spambot/src/services/distribution_manager.py`)

```python
def _run_distribution(self, config, username, password):
    # ...
    
    # Создаем Distribution объект
    distribution = self._convert_config_to_distribution(config)
    
    # Передаём stop_flag в distribution для graceful shutdown
    distribution.stop_flag = self.stop_flags[luxee_account_id]
    
    # Создаем DistributionProcess
    process = DistributionProcess()
    # ...
```

**Что сделано:**
- После создания Distribution передаём `stop_flag` из менеджера
- Теперь Distribution может проверять флаг остановки

### 3. Luxee Browser (`backend-spambot/src/core/luxee_site/luxee_browser.py`)

#### 3.1. start_distribution()

```python
@relogin_and_retry_if_site_fail()
def start_distribution(self, distribution: Distribution):
    start_time = time.time()
    
    # Счётчик пустых страниц для предотвращения infinite loop
    empty_pages_count = 0
    max_empty_pages = 3  # Если 3 страницы подряд без отправок - выходим

    while distribution.sent_messages_count < distribution.limit:
        # ✅ Проверка флага остановки
        if distribution.stop_flag and distribution.stop_flag.is_set():
            logger.info("Stop requested by user, breaking distribution loop")
            break
        
        # ...existing time limit check...
        
        try:
            clients = self.filter_clients(distribution)
            sent_messages_on_page = 0

            for client in clients:
                # ✅ Проверка флага остановки внутри цикла клиентов
                if distribution.stop_flag and distribution.stop_flag.is_set():
                    logger.info("Stop requested by user, breaking client loop")
                    raise CompleteDestributionError("Stopped by user")
                
                # ...existing client processing...
                
                if message_sent:
                    sent_messages_on_page += 1
                    distribution.sent_messages_count += 1
                    # ...
            
            # ✅ Защита от infinite loop: проверка пустых страниц
            if sent_messages_on_page == 0:
                empty_pages_count += 1
                logger.warning(f"Empty page {empty_pages_count}/{max_empty_pages}")
                if empty_pages_count >= max_empty_pages:
                    logger.warning("All available clients processed. Stopping.")
                    break
            else:
                empty_pages_count = 0  # Сбрасываем при успешной отправке
                    
        except CompleteDestributionError:
            logger.info("Distribution completed")
            break
```

#### 3.2. start_mail_distribution()

Аналогичные изменения для mail рассылок.

**Что сделано:**
1. **Stop mechanism:**
   - Проверка `distribution.stop_flag.is_set()` в начале каждой итерации while
   - Проверка внутри цикла for клиентов
   - При установке флага - graceful выход из циклов

2. **Infinite loop protection:**
   - Счётчик `empty_pages_count` отслеживает страницы без отправок
   - Если 3 страницы подряд пустые - выход из цикла
   - Сброс счётчика при успешной отправке

## Преимущества решения

### ✅ Минимальные изменения
- Следует архитектуре оригинального spambot
- Не добавляет новых зависимостей
- Обратно совместимо

### ✅ Graceful Shutdown
- Stop работает корректно
- Рассылка останавливается между клиентами
- Финальный статус обновляется правильно

### ✅ Защита от зависания
- Автоматический выход при отсутствии клиентов
- Логирование для диагностики
- Освобождение ресурсов

## Тестирование

### Сценарий 1: Stop во время рассылки
1. Запустить рассылку
2. Нажать Stop
3. ✅ Рассылка должна остановиться после текущего клиента
4. ✅ Статус: `stopped`

### Сценарий 2: Все клиенты обработаны
1. Запустить рассылку с малым количеством клиентов
2. ✅ После обработки всех - автоматическая остановка
3. ✅ Нет бесконечного цикла
4. ✅ Статус: `completed`

### Сценарий 3: Пустые страницы
1. Запустить с фильтрами где нет подходящих клиентов
2. ✅ После 3 пустых страниц - остановка
3. ✅ Warning логи: "Empty page X/3"
4. ✅ Статус: `completed`

## Файлы изменены

1. `backend-spambot/src/core/models.py` - добавлен `stop_flag`
2. `backend-spambot/src/services/distribution_manager.py` - передача `stop_flag`
3. `backend-spambot/src/core/luxee_site/luxee_browser.py` - проверки stop и empty pages

## Связанные документы

- `SPAMBOT_INTEGRATION_PLAN.md` - исходный план
- `SPAMBOT_CRITICAL_BUGFIXES.md` - другие критичные баги
- `SPAMBOT_DEBUGGING_LOGS.md` - логирование

## Сравнение с оригинальным spambot

| Аспект | Оригинальный spambot | Наша версия |
|--------|---------------------|-------------|
| Infinite loop защита | ❌ Нет | ✅ Есть (3 пустые страницы) |
| Stop mechanism | ✅ Через tkinter close | ✅ Через threading.Event |
| Graceful shutdown | ⚠️ Частично | ✅ Полностью |
| Логирование | ✅ Базовое | ✅ Расширенное |

## Выводы

Реализовано **производственно-готовое решение**:
- Защита от infinite loop
- Работающий механизм остановки
- Корректная обработка edge cases
- Подробное логирование

Изменения минимальны и следуют архитектуре оригинального проекта.
