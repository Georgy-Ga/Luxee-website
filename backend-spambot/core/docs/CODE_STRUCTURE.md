# Структура кода Luxee Bot

## Модули и их назначение

### 1. main.py
**Назначение:** Точка входа в приложение

**Код:**
```python
from src.application.app import App

def main():
    app = App()
    app.mainloop()

if __name__ == "__main__":
    main()
```

**Описание:** Создает экземпляр приложения и запускает главный цикл Tkinter.

---

### 2. config.py
**Назначение:** Глобальные настройки приложения

**Параметры:**
- `SKIP_SENDING_MESSAGE` (bool) - Режим отладки, не отправляет сообщения
- `HIDDEN_BROWSER` (bool) - Запуск браузера в headless режиме
- `WAIT_MINUTES_BETWEEN_PROFILES` (int) - Задержка между рассылками от разных профилей

---

### 3. src/models.py
**Назначение:** Модели данных

#### Profile
Представляет профиль (анкету) на luxee.io
```python
class Profile:
    name: str              # Имя профиля
    age: str               # Возраст
    location: str          # Местоположение
    owner_uid: int         # Статический ID профиля (import_uid)
    image_url: str         # URL изображения профиля
    is_disabled: bool      # Активен ли профиль
    uid: int               # Динамический ID для конкретного клиента (заполняется позже)
    apps: list[str]        # Список приложений (Tinder, Badoo и т.д.)
```

#### Client
Представляет клиента (получателя сообщений)
```python
class Client:
    name: str              # Имя клиента
    age: str               # Возраст
    location: str          # Местоположение
    uid: int               # Уникальный ID клиента
    app: str               # Приложение (Tinder, Badoo и т.д.)
```

#### Message
Представляет сообщение в чат
```python
class Message:
    text: str              # Текст сообщения
    interval: int          # Интервал перед отправкой (секунды)
```

#### MailMessage
Представляет письмо (mail)
```python
class MailMessage:
    title: str             # Заголовок письма
    text: str              # Текст письма
    pictures_number: list[int]  # Номера изображений для прикрепления
```

#### Distribution
Представляет конфигурацию рассылки
```python
class Distribution:
    profile: Profile                    # Профиль для рассылки
    purchased: bool                     # Включить платных клиентов
    free: bool                          # Включить бесплатных клиентов
    only_empty_chat: bool               # Только пустые чаты
    only_not_empty_chat: bool           # Только непустые чаты
    messages: list[Message]             # Сообщения для чата (или None)
    mail_message: MailMessage           # Письмо (или None)
    exclude: list[int]                  # Список ID клиентов для исключения
    limit: int                          # Лимит отправленных сообщений
    filter_update_limit: int            # Обновление списка клиентов после N отправок
    max_time_minutes: int               # Максимальное время рассылки (минуты)
    sent_messages_count: int            # Счетчик отправленных сообщений
    skipped_clients: int                # Счетчик пропущенных клиентов
    processed_clients: list[int]        # Список обработанных клиентов
    apps: list[str]                     # Фильтр по приложениям
```

---

### 4. src/exceptions.py
**Назначение:** Пользовательские исключения

- `UserBlockedError` - Пользователь заблокировал профиль
- `CompleteDestributionError` - Рассылка завершена (достигнут лимит)
- `LuxeeLoginError` - Ошибка входа на сайт
- `StopDestributionError` - Рассылка остановлена (критическая ошибка)

---

### 5. src/logger.py
**Назначение:** Настройка логирования

**Компоненты:**
- `CustomFormatter` - Форматирование логов с цветами
- `logger` - Основной логгер
- `LastLogsHandler` - Хранит последние 20 логов для сохранения при ошибках

**Уровни логирования:**
- DEBUG - Серый
- INFO - Серый
- WARNING - Желтый
- ERROR - Красный жирный
- CRITICAL - Красный жирный

---

### 6. src/utils.py
**Назначение:** Вспомогательные функции

#### compare_strings_ignore_symbols()
Сравнивает строки, игнорируя символы и регистр
```python
def compare_strings_ignore_symbols(str1: str, str2: str) -> bool
```

#### sanitize_str() / sanitize_list()
Приводит строки к нижнему регистру и удаляет пробелы
```python
def sanitize_str(string: str) -> str
def sanitize_list(str_list: list[str]) -> list[str]
```

#### save_selenium_error()
Сохраняет информацию об ошибке Selenium
```python
def save_selenium_error(browser: Selenium, exception: Exception)
```
Создает папку в `lexee_errors/` и сохраняет:
- Скриншот страницы
- HTML код страницы
- Traceback ошибки
- Последние 20 логов

#### retry_on_exception()
Декоратор для повторных попыток при ошибках
```python
def retry_on_exception(exception_type, retries=3, delay=1)
```

#### extract_token_that_closest_to_string()
Извлекает JWT токен из HTML, ближайший к указанной строке
```python
def extract_token_that_closest_to_string(html: str, string: str) -> str | None
```

---

### 7. src/requests_class.py
**Назначение:** Обертка для HTTP запросов

**Класс Requests:**
- Управляет сессией requests
- Автоматические задержки между запросами (минимум 1 секунда)
- Автоматический сброс сессии при простое (240 секунд)
- Поддержка cookies и headers
- Автоматическая обработка JSON/text ответов

**Методы:**
- `get()` - GET запрос
- `post()` - POST запрос

---

### 8. src/credentials_manager.py
**Назначение:** Управление учетными данными

**Функции:**

#### save_user() / load_user() / clear_user()
Сохранение/загрузка/удаление зашифрованных учетных данных
```python
def save_user(username: str, password: str)
def load_user() -> dict | None
def clear_user()
```

#### is_username_available()
Проверяет доступность username через Google Sheets
```python
def is_username_available(username: str) -> bool
```
Обращается к таблице: `1fMJScBUrr67eq81XkM2daw_vd-efnDCdwqjgYF3Vq5s`

#### mark_username_as_in_use() / unmark_username_as_in_use() / is_username_in_use()
Управление блокировкой username (предотвращает одновременное использование)
```python
def mark_username_as_in_use(username: str)
def unmark_username_as_in_use(username: str)
def is_username_in_use(username: str) -> bool
```

**Шифрование:**
- Используется Fernet (симметричное шифрование)
- Ключ генерируется из SHA256 хеша строки "super_secure_key"
- Данные сохраняются в файл `luxee_bot_user_data.enc`

---

### 9. src/process.py
**Назначение:** Процессы рассылки

#### extract_profiles()
Извлекает список профилей
```python
def extract_profiles(username: str, password: str) -> list[Profile]
```

#### DistributionProcess
Управляет процессом рассылки
```python
class DistributionProcess:
    def start(distribution: Distribution, username: str, password: str)
    def finish()
```

**Методы:**
- `start()` - Запускает рассылку (чат или mail)
- `finish()` - Завершает работу (logout)

---

### 10. src/luxee_site/luxee_requests.py
**Назначение:** HTTP запросы к API luxee.io

**Класс LuxeeRequests:**

#### authorize()
Авторизация с cookies из браузера
```python
def authorize(cookies: dict[str, str])
```

#### get_profiles()
Получает HTML страницу профилей
```python
def get_profiles() -> str
```
URL: `https://luxee.io/profile`

#### get_profile_settings()
Получает HTML страницу настроек профиля
```python
def get_profile_settings(profile_uid: int) -> str
```
URL: `https://luxee.io/profile/update/{profile_uid}`

#### get_clients_list()
Получает HTML страницу списка клиентов
```python
def get_clients_list(purchased: bool = None) -> str
```
URL: `https://luxee.io/clients/list`

**Параметры фильтрации:**
- `s_gender` - Пол клиента (1=мужской, 2=женский)
- `s_prefer_gender` - Предпочитаемый пол (1=мужчины, 2=женщины, 3=все)
- `is_online` - Онлайн статус (10=онлайн, 1=оффлайн, 30=все)
- `purchased` - Платные/бесплатные (1=бесплатные, 2=платные, ""=все)

#### get_available_profiles()
Получает список доступных профилей для клиента
```python
def get_available_profiles(client_id: int) -> dict
```
URL: `https://luxee.io/api/v2/communication/available-profiles`

**Важно:** Извлекает и сохраняет JWT токен из HTML для последующих API запросов

---

### 11. src/luxee_site/luxee_browser.py
**Назначение:** Автоматизация браузера

**Класс Luxee:**

#### Инициализация и вход
```python
def __init__(username: str, password: str)
def login()
def logout()
```

#### Получение данных
```python
def get_profiles() -> list[Profile]
def filter_clients(distribution: Distribution) -> list[Client]
```

#### Навигация
```python
def visit_chat(client: Client, profile: Profile)
def visit_mail_chat(client: Client, profile: Profile)
```

#### Проверки
```python
def _is_profile_available_for_user(client_id: int, profile: Profile) -> bool
def _are_there_any_messages_in_chat() -> bool
def _are_there_any_mails() -> bool
def _check_if_messages_was_sent_recently(distribution: Distribution) -> bool
def _check_if_mail_was_sent_recently(distribution: Distribution) -> bool
```

#### Отправка сообщений
```python
def send_messages(client: Client, messages: list[Message])
def send_mail(client: Client, mail: MailMessage)
def _send_message(message_text: str)
def _send_mail(mail: MailMessage)
def _type_naturally(locator: str, text: str)
```

#### Рассылка
```python
def start_distribution(distribution: Distribution)
def start_mail_distribution(distribution: Distribution)
```

**Декоратор relogin_and_retry_if_site_fail:**
Автоматически переподключается при ошибках Selenium/HTTP (до 3 попыток)

**Особенности:**
- Естественный ввод текста (посимвольно)
- Проверка отправки сообщений (ожидание появления в чате)
- Обработка блокировок пользователей
- Случайные задержки (10-30 секунд)
- Фильтрация по приложениям (Tinder, Badoo и т.д.)

---

### 12. src/application/app.py
**Назначение:** Главное приложение Tkinter

**Класс App (наследует tk.Tk):**

#### Инициализация
```python
def __init__()
```
- Создает окно 1200x760
- Инициализирует фреймы (LoginWindow, HomeWindow)
- Загружает сохраненные учетные данные
- Настраивает поддержку русской раскладки

#### Управление окнами
```python
def load_main_window(username: str, password: str)
def load_login_window()
def show_frame(frame_name: str)
def destroy_window()
```

#### Поддержка русской раскладки
```python
def is_ru_lang_keyboard() -> bool
def ru_keys(event)
```
Обрабатывает Ctrl+C/V/X/A в русской раскладке

---

### 13. src/application/login_window.py
**Назначение:** Окно входа

**Не включен в анализ, но содержит:**
- Поля ввода username/password
- Кнопку входа
- Валидацию учетных данных
- Проверку доступности username

---

### 14. src/application/main_window.py
**Назначение:** Главное окно приложения

**Класс HomeWindow (наследует tk.Frame):**

#### Компоненты
```python
profile_frame: ProfileFrame                           # Выбор профиля
distribution_settings_frame: DistributionSettingsFrame  # Настройки рассылки
messages_frame: MessagesFrame                         # Создание сообщений
distributions_list_frame: DistributionsListFrame      # Список рассылок
```

#### Основные методы
```python
def load_profiles(username: str, password: str)
def add_distribution()
def start_distribution()
def run_distribution()
def show_processing_view()
def update_to_finished_view()
def reset_home_window()
def logout()
```

**Процесс рассылки:**
1. Показывает экран обработки
2. Запускает рассылки последовательно
3. Ждет между профилями (CONFIG.WAIT_MINUTES_BETWEEN_PROFILES)
4. Обновляет статус в реальном времени
5. Обрабатывает ошибки
6. Показывает итоговый отчет

---

### 15. src/application/profile_frame.py
**Назначение:** Фрейм выбора профиля

**Не включен в анализ, но содержит:**
- Список профилей с изображениями
- Выбор активного профиля
- Отображение информации о профиле

---

### 16. src/application/distribution_settings_frame.py
**Назначение:** Фрейм настроек рассылки

**Не включен в анализ, но содержит:**
- Чекбоксы фильтров (платные/бесплатные, пустые/непустые чаты)
- Поле исключений (список ID)
- Лимит сообщений
- Лимит обновления фильтра
- Лимит времени

---

### 17. src/application/message_frame.py
**Назначение:** Фрейм создания сообщений

**Не включен в анализ, но содержит:**
- Выбор типа (Чат/Mail)
- Для чата: список сообщений с интервалами
- Для mail: заголовок, текст, выбор изображений

---

### 18. src/application/distribution_list_frame.py
**Назначение:** Фрейм списка рассылок

**Не включен в анализ, но содержит:**
- Список добавленных рассылок
- Кнопка удаления рассылки
- Кнопка запуска всех рассылок
- Отображение параметров каждой рассылки

---

## Поток данных

```
1. Запуск приложения (main.py)
   ↓
2. Инициализация App (app.py)
   ↓
3. Загрузка учетных данных (credentials_manager.py)
   ↓
4. Вход на сайт (luxee_browser.py → login())
   ↓
5. Извлечение профилей (process.py → extract_profiles())
   ↓
6. Отображение GUI (main_window.py)
   ↓
7. Настройка рассылки (distribution_settings_frame.py, message_frame.py)
   ↓
8. Добавление рассылки (main_window.py → add_distribution())
   ↓
9. Запуск рассылки (main_window.py → start_distribution())
   ↓
10. Выполнение рассылки (process.py → DistributionProcess.start())
    ↓
11. Фильтрация клиентов (luxee_browser.py → filter_clients())
    ↓
12. Для каждого клиента:
    - Проверка доступности профиля (luxee_browser.py → _is_profile_available_for_user())
    - Переход в чат/mail (luxee_browser.py → visit_chat() / visit_mail_chat())
    - Отправка сообщений (luxee_browser.py → send_messages() / send_mail())
    - Задержка
    ↓
13. Завершение рассылки (process.py → DistributionProcess.finish())
    ↓
14. Отображение отчета (main_window.py → update_to_finished_view())
```

---

## Ключевые алгоритмы

### Алгоритм рассылки (start_distribution)
```
1. Пока не достигнут лимит:
   a. Получить список клиентов с фильтрами
   b. Для каждого клиента:
      - Проверить доступность профиля
      - Проверить исключения
      - Открыть чат
      - Проверить условия (пустой/непустой чат)
      - Проверить, не отправлялись ли сообщения ранее
      - Отправить сообщения
      - Случайная задержка (10-30 сек)
   c. Обновить список клиентов (если достигнут filter_update_limit)
2. Завершить рассылку
```

### Алгоритм естественного ввода (_type_naturally)
```
1. Кликнуть на поле ввода
2. Для каждого символа:
   - Если символ = '\n':
     - Нажать Shift+Enter
   - Иначе:
     - Ввести символ
3. Выполнить действия
```

### Алгоритм проверки отправки (_send_message)
```
1. Ввести текст сообщения
2. Нажать кнопку отправки
3. В течение 15 секунд:
   - Получить последнее сообщение в чате
   - Сравнить с отправленным (игнорируя символы)
   - Если совпадает - успех
4. Если не совпадает - ошибка
```

---

## Обработка ошибок

### Уровни обработки:

1. **Уровень функции**
   - try/except блоки
   - Логирование ошибок
   - Возврат None или raise

2. **Уровень декоратора (relogin_and_retry_if_site_fail)**
   - Перехват ошибок Selenium/HTTP
   - Автоматический logout/login
   - До 3 попыток

3. **Уровень процесса (DistributionProcess)**
   - Перехват всех ошибок
   - Сохранение скриншота и HTML
   - Остановка рассылки

4. **Уровень GUI (HomeWindow)**
   - Отображение ошибок пользователю
   - Обновление статуса
   - Возврат в главное меню

---

## Безопасность и защита

### От блокировки:
- Задержки между запросами (минимум 1 секунда)
- Случайные задержки между сообщениями (10-30 секунд)
- Задержки между профилями (настраиваемо)
- Естественный ввод текста

### От ошибок:
- Автоматический повторный вход
- Сохранение состояния при ошибках
- Проверка отправки сообщений
- Обработка блокировок пользователей

### Данных:
- Шифрование учетных данных
- Проверка доступности username
- Защита от одновременного использования
