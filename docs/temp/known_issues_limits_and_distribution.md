# Известные проблемы: лимиты профилей и рассылка

## Дата анализа
2026-11-12

## Источники
- Логи сервера: `backend_18h.log`, `backend-spambot_18h.log`
- Локальный запуск `python .\main.py` в `backend-spambot`
- Прямая проверка в браузере на `https://luxee.io/clients/list/` (авторизован как Translator.09)

---

## Проблема 1: Лимиты профилей не подгружаются

### Симптом
На фронтенде в карточках анкет отображается:
- `chat: no information`
- `mail: no information`

### Что происходит в коде
Цепочка вызовов (`backend-spambot/core/src/luxee_site/luxee_browser.py`):

1. `get_profiles()` (строка 195) — заходит на `https://luxee.io/profile`, парсит HTML, извлекает анкеты. **Работает.**
2. `_attach_profiles_limits()` (строка 280) — обогащает анкеты лимитами через 2 прохода `get_profiles_limits()`.
3. `get_profiles_limits()` (строка 208):
   - Ходит на `https://luxee.io/clients/list` — извлекает JWT-токен из HTML через `extract_token_that_closest_to_string()` (`core/src/utils.py:93`).
   - Для каждого клиента (до 15-20 штук) делает запрос:
     ```
     GET https://luxee.io/api/v2/communication/available-profiles/
       ?user_uid=<client_id>&_=<timestamp>
       Headers: Token: <jwt_token>
     ```
   - Из ответа берёт `data[].import_uid` и `data[].limits` (chat/mail).
4. Если все запросы возвращают 500 → лимитов ноль → анкеты помечаются `{"no_information": True}`.

### Что показывают логи (сервер и локально)
Каждые ~30 секунд повторяется:
```
[WARNING] [luxee_browser.py:250 - get_profiles_limits()] - [Limits] Failed for client 3160487 (non-fatal): 500 Server Error
url: https://luxee.io/api/v2/communication/available-profiles/?user_uid=3160487&_=1794469060986
```
Итог каждого прохода:
```
[Limits] Collected limits for 0 profiles (20 clients scanned)
[Limits] Attached limits to 0/22 profiles
```
или
```
[Limits] Attached limits to 0/9 profiles
```

### Прямая проверка в браузере
- Страница `https://luxee.io/clients/list/` загружена, авторизован как `Translator.09`.
- В HTML найден токен: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0aW1lc3RhbXAiOiIxNzk0NDY5NTY2IiwidWlkIjoxMTV9.cuECdl9YAkaAWoCMeob3ci_Wxtf7gi-dVl8TguLYCzw` (ближайший к строке `available-profiles`).
- Прямой запрос `fetch('https://luxee.io/api/v2/communication/available-profiles/?user_uid=3160487&_=...', headers: { Token: <jwt> })` возвращает **HTTP 500** `An internal server error occurred.`
- То же самое без заголовка `Token` — 500.
- С другими JWT-токенами со страницы — 500.
- Консоль браузера показывает **Mixed Content**: запрос блокируется, так как страница HTTPS, а API пытается вызваться по HTTP (`http://luxee.io/api/...`).
- Альтернативный путь `/clients/available-profiles/` (указан в JS конфиге страницы) возвращает **400 Bad Request**.

---

## Проблема 2: Рассылка не отправляет сообщения

### Симптом
Платные рассылки не уходят ни одному клиенту. В логах сервера за 18 часов зафиксирована только одна завершённая рассылка (`sent: 9, skipped: 143`), больше нет ни новых запусков, ни ошибок отправки.

### Что происходит в коде
Во время рассылки (`luxee_browser.py`, `_is_profile_available_for_user`, строка 363):
```python
def _is_profile_available_for_user(self, client_id: int, profile: Profile) -> bool:
    result = self.requests.get_available_profiles(client_id)  # luxee_requests.py:82
    for profile_json in result["data"]:
        if profile_json["import_uid"] == profile.owner_uid:
            profile.uid = profile_json["uid"]
            return True
    return False
```
Этот метод вызывает тот же API `https://luxee.io/api/v2/communication/available-profiles/` с тем же токеном. При 500:
- Иск-ие ловится в цикле отправки (`luxee_browser.py:789-796`), клиент пропускается как `skipped`.
- Все клиенты помечаются как «недоступные» → ни одного сообщения не отправляется.

### Связь с проблемой 1
Обе проблемы вызваны одним неработающим эндпоинтом: `https://luxee.io/api/v2/communication/available-profiles/`.

---

## Неработающие эндпоинты

| Эндпоинт | Статус | Описание |
|----------|--------|----------|
| `https://luxee.io/api/v2/communication/available-profiles/?user_uid=<id>` | **HTTP 500** | Основной API для получения лимитов и проверки доступности профиля. Не работает ни с токеном, ни без, ни из скрипта, ни из браузера. |
| `https://luxee.io/clients/available-profiles/` | **HTTP 400** | Альтернативный путь из JS-конфига страницы. Требует другие параметры, неясен формат запроса. |
| `https://luxee.io/profile` | **HTTP 200** | Работает. Анкеты подгружаются нормально. |
| `https://luxee.io/clients/list` | **HTTP 200** | Работает. Страница клиентов загружается, токен извлекается. |

---

## Корневая причина

API эндпоинт `https://luxee.io/api/v2/communication/available-profiles/` возвращает **HTTP 500 Internal Server Error** на стороне `luxee.io`. Это не проблема кода сайта Model-site — сервер luxee.io не обрабатывает запрос корректно.

Возможные причины на стороне luxee.io:
- Изменение контракта API (требуются новые заголовки/параметры).
- Блокировка по IP или User-Agent.
- Временная неисправность сервера.

---

## Рекомендации по дальнейшим действиям

1. **Обратиться в поддержку luxee.io** — сообщить, что эндпоинт `https://luxee.io/api/v2/communication/available-profiles/` возвращает 500 для авторизованных запросов.
2. **Временно отключить жёсткую зависимость от лимитов** — при 500 от API не блокировать рассылку, а помечать лимиты как неизвестные и允许 отправку继续.
3. **Исследовать альтернативный эндпоинт** `/clients/available-profiles/` — вернул 400, возможно с другими query-параметрами заработает. Нужно изучить JS-файлы страницы `clients/list`, чтобы понять, какой именно запрос с этой страницы уходит на этот эндпоинт.
4. **Снять логи в момент запуска платной рассылки** — в текущих 18-часовых логах нет активных рассылок, кроме одной завершённой. Чтобы найти дополнительные ошибки, нужно запустить платную рассылку и снимать логи в реальном времени.

---

## Файлы кода, задействованные в цепочке

- `backend-spambot/core/src/luxee_site/luxee_browser.py` — `get_profiles_limits()` (стр. 208), `_attach_profiles_limits()` (стр. 280), `_is_profile_available_for_user()` (стр. 363), `start_distribution()` (стр. 707)
- `backend-spambot/core/src/luxee_site/luxee_requests.py` — `get_available_profiles()` (стр. 82), `get_available_profiles_once()` (стр. 129), `get_clients_list_once()` (стр. 102)
- `backend-spambot/core/src/utils.py` — `extract_token_that_closest_to_string()` (стр. 93)
- `backend-spambot/api/service.py` — `start_distribution()` (стр. 196), `_run_distribution()` (стр. 236)
