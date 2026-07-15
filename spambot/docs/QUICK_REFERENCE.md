# Быстрая справка - URL параметры

## Краткий ответ на ваш вопрос

### URL пример:
```
https://luxee.io/chats/?ownerUid=607823&profileUid=1609606&userUid=1454399
```

### Откуда берутся параметры:

| Параметр | Что это | Откуда | Где в коде |
|----------|---------|--------|------------|
| **ownerUid** | Статический ID профиля (анкеты) | HTML страница `/profile`, элемент `<div class="uid">` | `Profile.owner_uid` |
| **profileUid** | Динамический ID профиля для клиента | API `/api/v2/communication/available-profiles`, поле `"uid"` | `Profile.uid` |
| **userUid** | ID клиента (получателя) | HTML страница `/clients/list`, атрибут `data-key` | `Client.uid` |

---

## Детальное объяснение

### 1. ownerUid (607823)
**Это ID анкеты профиля**

```python
# Извлекается из HTML при загрузке профилей
# Файл: src/luxee_site/luxee_browser.py, метод __extract_profiles()

uid_text = profile_wrapper.find("div", {"class": "uid"}).text.strip()
uid = re.search(r"\d+", uid_text).group()  # Например: "607823"

# Сохраняется в модели Profile
profile.owner_uid = int(uid)  # 607823
```

**Характеристики:**
- ✅ Статический (не меняется)
- ✅ Уникальный для каждого профиля
- ✅ Это import_uid в системе luxee.io
- ✅ Берется из HTML страницы профилей

---

### 2. profileUid (1609606)
**Это динамический ID связи профиля с клиентом**

```python
# Получается через API для каждого клиента отдельно
# Файл: src/luxee_site/luxee_browser.py, метод _is_profile_available_for_user()

result = self.requests.get_available_profiles(client_id)
# API запрос: GET /api/v2/communication/available-profiles?user_uid=1454399

# Ответ API:
# {
#   "data": [
#     {"import_uid": 607823, "uid": 1609606, ...},
#     ...
#   ]
# }

# Находим профиль с import_uid == profile.owner_uid
for profile_json in result["data"]:
    if profile_json["import_uid"] == profile.owner_uid:  # 607823
        profile.uid = profile_json["uid"]  # 1609606
```

**Характеристики:**
- ⚠️ Динамический (разный для разных клиентов)
- ⚠️ Получается через API запрос
- ⚠️ Заполняется только при проверке доступности профиля для клиента
- ⚠️ Изначально `Profile.uid = None`

---

### 3. userUid (1454399)
**Это ID клиента (получателя сообщения)**

```python
# Извлекается из HTML при загрузке списка клиентов
# Файл: src/luxee_site/luxee_browser.py, метод __extract_clients()

uid = client_wrapper["data-key"].strip()  # Например: "1454399"

# Сохраняется в модели Client
client.uid = int(uid)  # 1454399
```

**Характеристики:**
- ✅ Статический (не меняется)
- ✅ Уникальный для каждого клиента
- ✅ Берется из HTML страницы клиентов
- ✅ Используется для идентификации получателя

---

## Процесс формирования URL

### Шаг 1: Загрузка профиля
```python
# Получаем HTML страницу профилей
html = requests.get("https://luxee.io/profile")

# Парсим и извлекаем ownerUid
profile = Profile(...)
profile.owner_uid = 607823  # ← ownerUid
profile.uid = None          # ← profileUid (пока не заполнен)
```

### Шаг 2: Загрузка клиента
```python
# Получаем HTML страницу клиентов
html = requests.get("https://luxee.io/clients/list")

# Парсим и извлекаем userUid
client = Client(...)
client.uid = 1454399  # ← userUid
```

### Шаг 3: Проверка доступности профиля для клиента
```python
# API запрос для получения profileUid
response = requests.get(
    "https://luxee.io/api/v2/communication/available-profiles",
    params={"user_uid": client.uid}  # 1454399
)

# Ответ: {"data": [{"import_uid": 607823, "uid": 1609606}, ...]}
# Находим профиль с import_uid == profile.owner_uid
profile.uid = 1609606  # ← profileUid (теперь заполнен!)
```

### Шаг 4: Формирование URL и переход
```python
# Теперь у нас есть все параметры:
# - profile.owner_uid = 607823  (ownerUid)
# - profile.uid = 1609606       (profileUid)
# - client.uid = 1454399        (userUid)

url = f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
# Результат: https://luxee.io/chats/?ownerUid=607823&profileUid=1609606&userUid=1454399

browser.go_to(url)
```

---

## Важно понимать!

### ⚠️ Критическая разница между ownerUid и profileUid

```python
# НЕПРАВИЛЬНО ❌
url = f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.owner_uid}&userUid={client.uid}"
# Это не сработает! profileUid ≠ ownerUid

# ПРАВИЛЬНО ✅
# Сначала получаем profileUid через API
_is_profile_available_for_user(client.uid, profile)  # Заполняет profile.uid
url = f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
```

### Почему два разных ID для профиля?

1. **ownerUid (owner_uid)** - это "внешний" ID профиля
   - Используется для идентификации профиля в системе
   - Виден в интерфейсе
   - Не меняется

2. **profileUid (uid)** - это "внутренний" ID связи
   - Используется для коммуникации между профилем и клиентом
   - Создается динамически для каждой пары профиль-клиент
   - Может отличаться для разных клиентов

---

## Код в проекте

### Где используются параметры:

#### Переход в чат (luxee_browser.py:183-186)
```python
def visit_chat(self, client: Client, profile: Profile):
    self.browser.go_to(
        f"https://luxee.io/chats/?ownerUid={profile.owner_uid}&profileUid={profile.uid}&userUid={client.uid}"
    )
```

#### Переход в mail (luxee_browser.py:198-201)
```python
def visit_mail_chat(self, client: Client, profile: Profile):
    self.browser.go_to(
        f"https://luxee.io/communication/mail/?ownerUid={profile.owner_uid}&userUid={client.uid}"
    )
```

**Обратите внимание:** Для mail не используется profileUid!

---

## Модель Profile - два поля uid

```python
class Profile:
    def __init__(self, name: str, age: str, location: str, uid: str, image_url: str, is_disabled: bool):
        self.name: str = name
        self.age: str = age
        self.location: str = location
        self.owner_uid: int = int(uid)  # ← Это ownerUid (статический)
        self.image_url: str = image_url
        self.is_disabled: bool = is_disabled
        self.uid: int = None            # ← Это profileUid (динамический, заполняется позже)
```

**Важно:**
- `owner_uid` - заполняется при создании профиля
- `uid` - заполняется при проверке доступности для клиента

---

## Резюме

### Для чатов:
```
https://luxee.io/chats/?ownerUid={ownerUid}&profileUid={profileUid}&userUid={userUid}
                                  ↓              ↓                ↓
                          Profile.owner_uid  Profile.uid    Client.uid
                          (статический)      (динамический) (статический)
                          из HTML            из API         из HTML
```

### Для писем:
```
https://luxee.io/communication/mail/?ownerUid={ownerUid}&userUid={userUid}
                                              ↓                ↓
                                      Profile.owner_uid    Client.uid
                                      (статический)        (статический)
                                      из HTML              из HTML
```

---

## Дополнительная информация

Для более подробного анализа смотрите:
- [URL_PARAMETERS_ANALYSIS.md](URL_PARAMETERS_ANALYSIS.md) - полный анализ с примерами кода
- [CODE_STRUCTURE.md](CODE_STRUCTURE.md) - структура всего проекта
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - общий обзор проекта
