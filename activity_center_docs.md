# Документация: Центр активности (Activity Center) luxee.io

## 1. Архитектура работы

**Центр активности** — это колокольчик в топ-навигации сайта. Он показывает действия мужчин (лайки, подписки, подмигивания) по отношению к женским профилям. 

**Связь с чатами:** клик по элементу активности → отметка "прочитано" через API → переход в чат с этим мужчиной. Это идентично тому, как если бы мы кликнули по непрочитанному чату в боковой панели чатов. Оба действия ведут в одно и то же место — на страницу чата.

---

## 2. Навигация через Playwright

### 2.1 Авторизация
Перед началом работы нужно быть авторизованным. Это делается через установку cookie и JWT-токена:

```python
page.goto("https://luxee.io/")
# Установка cookie сессии / авторизация
```

После авторизации в заголовках всех XHR-запросов будут присутствовать:
- `x-csrf-token`: значение из `<meta name="csrf-token">` или из перехваченного запроса
- `token`: JWT-токен из заголовков API-запросов

### 2.2 Открытие центра активности

```python
# 1. Перейти на страницу чатов (там гарантированно есть колокольчик)
page.goto("https://luxee.io/chats/")

# 2. Дождаться загрузки
page.wait_for_timeout(2000)

# 3. Найти и кликнуть иконку колокольчика
# Селектор: img[alt="Activity"] внутри #activity-center-btn
page.locator("img[alt=\"Activity\"]").click()
# АЛЬТЕРНАТИВА: page.locator("#activity-center-btn").click()

# 4. Дождаться появления попапа
page.wait_for_timeout(1500)
```

После клика:
- Открывается попап (выпадающий список) с элементами активности
- У колокольчика появляется CSS-класс `.has-new` (жёлтая точка/бейдж)
- Загружается первый блок активностей (14 штук, `?limit=14`)

### 2.3 Закрытие попапа
```python
# Клик вне области попапа
page.locator("body").click(position={"x": 10, "y": 10})
```

---

## 3. Получение всех пользователей (40 человек)

### Проблема
По умолчанию при открытии попапа загружается только 14 элементов (`?limit=14` — хардкод в activity.js).

### Решение: получить все 40 через API напрямую

После открытия попапа (чтобы CSRF и JWT токены были актуальны) делаем fetch-запрос через `page.evaluate`:

```python
data = page.evaluate("""
    async () => {
        // Берём токены из мета-тега и из открытой сессии
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        // JWT токен можно либо заранее сохранить, либо достать из cookies
        const token = document.cookie.match(/token=([^;]+)/)?.[1];
        
        const resp = await fetch(
            '/api/agency/activity/translator/activity?limit=40',
            {
                headers: {
                    'x-csrf-token': csrf,
                    'token': token,
                    'x-requested-with': 'XMLHttpRequest',
                    'accept': 'application/json'
                }
            }
        );
        const json = await resp.json();
        return json.data;
    }
""")

# items = data["items"]  — массив из 40 активностей
# users = data["users"]  — массив пользователей (и мужчин, и профилей)
```

### Альтернатива: через скролл попапа (если нужно именно визуально)
```python
# Скроллим попап вниз для подгрузки следующих 14
container = page.locator(".activity-center-data")
container.evaluate("el => el.scrollTop = el.scrollHeight")
page.wait_for_timeout(2000)

# Повторяем пока не загрузится всё (проверяем по наличию лоадера)
while page.locator(".activity-load-more-wrap").is_visible():
    container.evaluate("el => el.scrollTop = el.scrollHeight")
    page.wait_for_timeout(1500)
```

**Рекомендуется:** первый вариант (через API) — быстрее и надёжнее.

---

## 4. Структура данных API

### 4.1 Ответ `GET /api/agency/activity/translator/activity?limit=40`

```json
{
    "success": true,
    "data": {
        "items": [
            {
                "uid": 12387717,          // ID активности
                "user_uid": 2278833,      // ID мужчины (кто сделал действие)
                "profile_uid": 1642551,   // ID женского профиля (на кого)
                "import_uid": 608434,     // ID владельца (ownerUid)
                "status": 0,              // 0 = не прочитано, 1 = прочитано
                "type": 3,                // 1 = like, 2 = follow, 3 = wink
                "created_at": 1785388675  // unix timestamp
            }
        ],
        "users": [
            {
                "uid": 2278833,
                "username": "Hanook Masih",
                "is_online": 10,  // 10 = online, 1 = offline
                "avatar": { ... }
            }
        ],
        "token": 12234216  // последний uid для пагинации (null = всё)
    }
}
```

### 4.2 Типы действий
| type | Что означает |
|------|-------------|
| 1 | like (лайк) |
| 2 | follow (подписка / добавление в избранное) |
| 3 | wink (подмигивание) |

### 4.3 Статус активности
| status | CSS-класс | Визуал | Смысл |
|--------|-----------|--------|-------|
| 0 | `.new` | Точка/индикатор справа | Не прочитано |
| 1 | (нет) | Нет точки | Прочитано |

---

## 5. Отметка "прочитано" и переход в чат

### Как это работает

При клике по элементу активности (серверная логика из activity.js):

```javascript
// Псевдокод:
if (элемент имеет класс .new) {
    // 1. Отправляем PUT-запрос чтоб отметить прочитанным
    PUT /api/agency/activity/translator/activity/{uid}
    // 2. После успеха — переходим в чат
    goToChat(userUid, profileUid, importUid)
} else {
    // Сразу переходим в чат
    goToChat(userUid, profileUid, importUid)
}
```

**ВАЖНО:** Отметка "прочитано" срабатывает ТОЛЬКО при клике внутри попапа активности. При прямом переходе по ссылке `/chats/?ownerUid=...&profileUid=...&userUid=...` — статус НЕ меняется.

### 5.1 Playwright: клик по элементу активности

```python
# Найти элемент активности по uid (из API-ответа)
activity_uid = 12387717  # берём из data["items"][i]["uid"]
page.locator(f'[data-uid="{activity_uid}"]').click()

# После клика:
# 1. Отправляется PUT /api/agency/activity/translator/activity/{uid}
# 2. Страница переходит на /chats/?ownerUid=608434&profileUid=...&userUid=...
# 3. Можно проверить: PUT-запрос вернёт {"success":true,"data":<кол-во_оставшихся_непрочитанных>}
```

### 5.2 Селекторы элементов активности

```python
# По data-uid (самый надёжный)
page.locator('[data-uid="12387717"]')

# По классам
page.locator('.activity-center-link.new')  # все непрочитанные
page.locator('.activity-center-link.wink')  # только подмигивания
page.locator('.activity-center-link.like')  # только лайки
page.locator('.activity-center-link.favorite')  # только подписки

# По тексту (менее надёжно)
page.get_by_role("listitem").filter(has_text="Alex followed Margarita")
```

### 5.3 HTML-структура элемента активности

```html
<li data-uid="12387717"
    data-user-uid="2278833"
    data-import-uid="608434"
    data-profile-uid="1642551"
    class="activity-center-link new online wink">
    <!-- .new = не прочитано, .online = мужчина онлайн -->
    <!-- .wink = подмигивание, .like = лайк, .favorite = подписка -->
    <div>...</div>
</li>
```

---

## 6. Получение информации о пользователе

### API: детали пользователя

```http
POST /chats/user/{user_uid}/?profileUid={import_uid}
```

Заголовки:
```
x-csrf-token: ...
token: ... (JWT)
x-requested-with: XMLHttpRequest
content-type: application/x-www-form-urlencoded
accept: application/json
```

Ответ:
```json
{
    "success": true,
    "data": {
        "uid": 2278833,
        "first_name": "Hanook Masih",
        "age": 54,
        "location": "Islamabad, Pakistan",
        "city_name": "Islamabad",
        "country_id": 170,
        "birthday": "1971-10-10",
        "images": [...],
        "avatar": {...}
    }
}
```

### Пример получения через Playwright

```python
# После того как получили список всех пользователей
all_users = data["items"]  # 40 активностей

# Собираем уникальных мужчин
male_uids = set(item["user_uid"] for item in data["items"])

# Для каждого получаем возраст и локацию
user_details = page.evaluate("""
    async (uids) => {
        const results = {};
        for (const uid of uids) {
            const resp = await fetch(
                `/chats/user/${uid}/?profileUid=608434`,
                {
                    method: 'POST',
                    headers: {
                        'x-csrf-token': '...',
                        'token': '...',
                        'x-requested-with': 'XMLHttpRequest',
                        'content-type': 'application/x-www-form-urlencoded',
                        'accept': 'application/json'
                    }
                }
            );
            const json = await resp.json();
            results[uid] = {
                age: json.data.age,
                location: json.data.location,
                city: json.data.city_name
            };
        }
        return results;
    }
""", male_uids)
```

---

## 7. Полный workflow для новой фичи

### Шаг 1: Открыть колокольчик
```python
page.goto("https://luxee.io/chats/")
page.wait_for_timeout(2000)
page.locator("img[alt=\"Activity\"]").click()
page.wait_for_timeout(1500)
```

### Шаг 2: Получить все 40 активностей через API
```python
data = page.evaluate("""...fetch('/api/agency/activity/translator/activity?limit=40')...""")
items = data["items"]  # 40 штук
users = {u["uid"]: u["username"] for u in data["users"]}
```

### Шаг 3: Отфильтровать только непрочитанные
```python
new_items = [item for item in items if item["status"] == 0]
# Сгруппировать по мужчинам
from collections import defaultdict
by_user = defaultdict(list)
for item in new_items:
    by_user[item["user_uid"]].append(item)
# Отсортировать по времени (самые свежие первые)
by_user = dict(sorted(by_user.items(), key=lambda x: max(i["created_at"] for i in x[1]), reverse=True))
```

### Шаг 4: Кликнуть по каждому новому элементу
```python
for item in new_items:
    uid = item["uid"]
    user_name = users.get(item["user_uid"], "Unknown")
    action = {1: "liked", 2: "followed", 3: "winked"}[item["type"]]
    profile_name = users.get(item["profile_uid"], "Unknown")
    
    print(f"Кликаем: {user_name} {action} {profile_name}")
    
    # Клик по элементу в попапе
    page.locator(f'[data-uid="{uid}"]').click()
    
    # Ждём загрузки чата
    page.wait_for_timeout(3000)
    
    # Выполняем нужные действия в чате
    # ... (чтение сообщений, отправка ответа и т.д.)
    
    # Возвращаемся на страницу чатов
    page.goto("https://luxee.io/chats/")
    page.wait_for_timeout(2000)
    
    # Колокольчик может закрыться — открываем снова
    page.locator("img[alt=\"Activity\"]").click()
    page.wait_for_timeout(1500)
```

---

## 8. Работа с непрочитанными чатами (аналогичный подход)

Непрочитанные сообщения в боковой панели чатов работают по тому же принципу:

1. В списке чатов элементы с непрочитанными сообщениями имеют CSS-класс/индикатор (счётчик `.counter-new-chats`)
2. Клик по чату → переход в диалог
3. В диалоге сообщения с иконкой `` (прочитано/не прочитано)

**Селекторы для чатов:**
```python
# Элемент чата в боковой панели
page.locator('.chat-list-item')  # или аналогичный класс

# По имени пользователя
page.get_by_role("heading").filter(has_text="Hanook Masih").click()

# По UID (если есть data-атрибут)
page.locator('[data-user-uid="2278833"]').click()
```

---

## 9. Важные технические детали

### 9.1 Токены
- **JWT токен** — выдаётся при логине, живёт пока активна сессия. Содержит `ownerUid: 72` (наш аккаунт: `ownerUid=608434`). Передаётся в заголовке `token`.
- **CSRF токен** — в `<meta name="csrf-token">` или в первом XHR-запросе сессии. Передаётся в заголовке `x-csrf-token`.

### 9.2 WebSocket/Push
Новые активности приходят через событие `notifyNewActivity` (WebSocket или EventSource). На странице висит слушатель, который обновляет бейдж колокольчика.

### 9.3 Пагинация активности
- Первая загрузка: `?limit=14` (можно заменить на `?limit=40`)
- Загрузить ещё: `?token={последний_uid_из_предыдущего_ответа}&limit=14`
- Загрузить новые сверху: `?newbie_token={Math.max(все_текущие_uid)}&limit=14`

### 9.4 Поведение попапа
- После перехода в чат по клику на активности — попап закрывается автоматически
- При возврате на страницу чатов — попап нужно открывать заново
- После отметки "прочитано" — элемент теряет класс `.new`

---

## 10. Проверка работы через Playwright

```python
# 1. Открыть колокольчик
page.locator("img[alt=\"Activity\"]").click()
page.wait_for_timeout(1500)

# 2. Проверить что открылось
assert page.locator(".activity-center-nav.active").is_visible()

# 3. Проверить количество элементов
count = page.evaluate("document.querySelectorAll('.activity-center-link').length")
print(f"Загружено активностей: {count}")

# 4. Проверить новые (непрочитанные)
new_count = page.evaluate("document.querySelectorAll('.activity-center-link.new').length")
print(f"Новых (непрочитанных): {new_count}")

# 5. Кликнуть по первому новому
page.locator(".activity-center-link.new").first.click()
page.wait_for_timeout(3000)

# 6. Проверить что мы в чате (URL содержит /chats/)
assert "/chats/" in page.url

# 7. Проверить что PUT-запрос был отправлен (мониторинг сети)
# Через перехватчик запросов
```
