# Анализ параметров URL в Luxee Bot

## Обзор

В проекте используются URL с параметрами для навигации по чатам и письмам на платформе luxee.io. Этот документ подробно объясняет каждый параметр и откуда он берется.

## URL для чатов

### Формат URL
```
https://luxee.io/chats/?ownerUid={ownerUid}&profileUid={profileUid}&userUid={userUid}
```

### Пример
```
https://luxee.io/chats/?ownerUid=607823&profileUid=1609606&userUid=1454399
```

### Параметры

#### 1. `ownerUid` (Owner UID)
**Что это:** Уникальный идентификатор профиля в системе luxee.io (import_uid)

**Откуда берется:**
- Извлекается при парсинге списка профилей из HTML страницы `https://luxee.io/profile`
- Находится в элементе с классом `"uid"` внутри `"profile-tile-wrap-outside"`
- Сохраняется в модели `Profile` в поле `owner_uid` (тип: int)

**Код извлечения** (luxee_browser.py, строки 96-121):
```python
def __extract_profiles(self, html_page: str) -> list[Profile]:
    soup = BeautifulSoup(html_page, "html.parser")
    profiles: list[Profile] = []
    for profile_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
        name = profile_wrapper.find("div", {"class": "username"}).text.strip()
        location = profile_wrapper.find("div", {"class": "location"}).text.strip()
        age = profile_wrapper.find("div", {"class": "age"}).text.strip()
        uid_text = profile_wrapper.find("div", {"class": "uid"}).text.strip()
        try:
            uid = re.search(r"\d+", uid_text).group()  # <-- ЭТО ownerUid
        except AttributeError:
            logger.warning(f"Could not extract UID from {uid_text} for profile '{name}'")
            continue
        # ...
        profiles.append(Profile(name, age, location, uid, url, is_disabled))
    return profiles
```

**В модели Profile** (models.py, строки 1-9):
```python
class Profile:
    def __init__(self, name: str, age: str, location: str, uid: str, image_url: str, is_disabled: bool):
        self.name: str = name
        self.age: str = age
        self.location: str = location
        self.owner_uid: int = int(uid)  # <-- Сохраняется как owner_uid
        self.image_url: str = image_url
        self.is_disabled: bool = is_disabled
        self.uid: int = None  # <-- Это будет profileUid (заполняется позже)
```

**Назначение:** Идентифицирует конкретный профиль (анкету) на платформе luxee.io

---

#### 2. `profileUid` (Profile UID)
**Что это:** Внутренний идентификатор профиля для конкретного клиента (динамический)

**Откуда берется:**
- Получается через API запрос к `https://luxee.io/api/v2/communication/available-profiles`
- Запрашивается для каждого клиента отдельно
- Возвращается в JSON ответе в поле `"uid"`
- Сохраняется в модели `Profile` в поле `uid` (тип: int)

**Код получения** (luxee_browser.py, строки 174-181):
```python
def _is_profile_available_for_user(self, client_id: int, profile: Profile) -> bool:
    result = self.requests.get_available_profiles(client_id)
    for profile_json in result["data"]:
        if profile_json["import_uid"] == profile.owner_uid:
            profile.uid = profile_json["uid"]  # <-- ЭТО profileUid
            return True
    else:
        return False
```

**API запрос** (luxee_requests.py, строки 81-92):
```python
@retry_on_exception(exception_type=retry_exceptions, delay=10, retries=10)
def get_available_profiles(self, client_id: int) -> dict:
    params = {
        "user_uid": client_id,
        "_": str(int(time.time() * 1000)),
    }
    headers = {
        "Token": self._clients_list_page_available_profiles_token,
    }
    return self._requests.get(
        "https://luxee.io/api/v2/communication/available-profiles", headers=headers, params=params
    )
```

**Назначение:** Связывает профиль с конкретным клиентом в системе коммуникации. Это динамический ID, который может отличаться для разных клиентов.

---

#### 3. `userUid` (User UID)
**Что это:** Уникальный идентификатор клиента (пользователя), которому отправляется сообщение

**Откуда берется:**
- Извлекается при парсинге списка клиентов из HTML страницы `https://luxee.io/clients/list`
- Находится в атрибуте `data-key` элемента `"profile-tile-wrap-outside"`
- Сохраняется в модели `Client` в поле `uid` (тип: int)

**Код извлечения** (luxee_browser.py, строки 148-159):
```python
def __extract_clients(self, html_page: str) -> list[Client]:
    soup = BeautifulSoup(html_page, "html.parser")
    clients = []
    for client_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
        name = client_wrapper.find("div", {"class": "username"}).text.strip()
        age = client_wrapper.find("div", {"class": "age"}).text.strip()
        location = client_wrapper.find("div", {"class": "location"}).text.strip()
        uid = client_wrapper["data-key"].strip()  # <-- ЭТО userUid
        app = client_wrapper.find("span", {"class": "application-wrap"}).text.strip()
        
        clients.append(Client(name, age, location, uid, app))
    return clients
```

**В модели Client** (models.py, строки 21-27):
```python
class Client:
    def __init__(self, name: str, age: str, location: str, uid: str, app: str):
        self.name = name
        self.age = age
        self.location = location
        self.uid: int = int(uid)  # <-- Сохраняется как uid
        self.app = app
```

**Назначение:** Идентифицирует клиента (получателя сообщения)

---

## URL для писем (Mail)

### Формат URL
```
https://luxee.io/communication/mail/?ownerUid={ownerUid}&userUid={userUid}
```

### Пример
```
https://luxee.io/communication/mail/?ownerUid=607823&userUid=1454399
```

### Параметры

#### 1. `ownerUid`
Тот же самый параметр, что и для чатов (см. выше)

#### 2. `userUid`
Тот же самый параметр, что и для чатов (см. выше)

**Примечание:** Для писем не используется `profileUid`, так как система mail работает напрямую с ownerUid.

---

## Использование в коде

### Переход в чат (luxee_browser.py, строки 183-196)
```python
def visit_chat(self, client: Client, profile: Profile):
    self.browser.go_to(
        f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
    )
    
    # Wait until user is loaded
    self.browser.wait_until_element_is_enabled(
        f'//div[@id="chat_title-opponent"]//*[@data-member-uid="{client.uid}"]', timeout=30
    )
    # Wait until chat messages are loaded
    try:
        self.browser.wait_until_element_is_enabled('//div[@id="message-main-wrap"]/div')
    except AssertionError:
        logger.warning("Chat messages are not loaded.")
```

### Переход в mail (luxee_browser.py, строки 198-216)
```python
def visit_mail_chat(self, client: Client, profile: Profile):
    self.browser.go_to(
        f"https://luxee.io/communication/mail/?ownerUid={profile.owner_uid}&userUid={client.uid}"
    )
    
    # Wait until user is loaded
    self.browser.wait_until_element_is_enabled(
        f'//div[@id="mail-info-container"]//li//p[strong[contains(text(), "ID")] and contains(normalize-space(.), "{client.uid}")]',
        timeout=30
    )
    
    # Wait until message input field is loaded
    self.browser.wait_until_element_is_enabled('//input[@id="message-title-area"]')
    
    # Wait until chat messages are loaded
    try:
        self.browser.wait_until_element_is_enabled('//div[@id="mailsContainer"]/ul/li', timeout=2)
    except AssertionError:
        pass  # It means no messages exist
```

---

## Схема потока данных

```
1. Загрузка профилей
   ↓
   HTML: https://luxee.io/profile
   ↓
   Парсинг: извлечение ownerUid из <div class="uid">
   ↓
   Сохранение: Profile.owner_uid

2. Загрузка клиентов
   ↓
   HTML: https://luxee.io/clients/list
   ↓
   Парсинг: извлечение userUid из data-key
   ↓
   Сохранение: Client.uid

3. Проверка доступности профиля для клиента
   ↓
   API: https://luxee.io/api/v2/communication/available-profiles?user_uid={Client.uid}
   ↓
   JSON ответ: поиск profile с import_uid == Profile.owner_uid
   ↓
   Извлечение: profileUid из JSON["data"][i]["uid"]
   ↓
   Сохранение: Profile.uid

4. Формирование URL и переход
   ↓
   Чат: https://luxee.io/chats/?ownerUid={Profile.owner_uid}&profileUid={Profile.uid}&userUid={Client.uid}
   или
   Mail: https://luxee.io/communication/mail/?ownerUid={Profile.owner_uid}&userUid={Client.uid}
```

---

## Важные замечания

1. **ownerUid** - это статический идентификатор профиля, который не меняется
2. **profileUid** - это динамический идентификатор, который получается для каждого клиента отдельно через API
3. **userUid** - это идентификатор клиента из списка клиентов
4. Перед отправкой сообщения обязательно проверяется доступность профиля для клиента через `_is_profile_available_for_user()`
5. Если профиль недоступен для клиента, он пропускается
6. В модели `Profile` есть два поля:
   - `owner_uid` (int) - это ownerUid (статический)
   - `uid` (int) - это profileUid (динамический, заполняется при проверке доступности)

---

## Пример полного цикла

```python
# 1. Получаем профиль (ownerUid = 607823)
profile = Profile(name="Anna", age="25", location="Kyiv", uid="607823", ...)
# profile.owner_uid = 607823
# profile.uid = None (пока не заполнен)

# 2. Получаем клиента (userUid = 1454399)
client = Client(name="John", age="30", location="Lviv", uid="1454399", app="Tinder")
# client.uid = 1454399

# 3. Проверяем доступность профиля для клиента
available = _is_profile_available_for_user(client.uid=1454399, profile)
# API запрос: GET /api/v2/communication/available-profiles?user_uid=1454399
# Ответ: {"data": [{"import_uid": 607823, "uid": 1609606, ...}, ...]}
# Находим профиль с import_uid == 607823
# Сохраняем: profile.uid = 1609606

# 4. Переходим в чат
visit_chat(client, profile)
# URL: https://luxee.io/chats/?ownerUid=607823&profileUid=1609606&userUid=1454399
```

---

## Резюме

| Параметр | Что это | Откуда берется | Где хранится |
|----------|---------|----------------|--------------|
| **ownerUid** | Статический ID профиля (анкеты) | HTML страница профилей, элемент `<div class="uid">` | `Profile.owner_uid` |
| **profileUid** | Динамический ID профиля для клиента | API `/api/v2/communication/available-profiles`, поле `"uid"` в JSON | `Profile.uid` |
| **userUid** | ID клиента (получателя) | HTML страница клиентов, атрибут `data-key` | `Client.uid` |
