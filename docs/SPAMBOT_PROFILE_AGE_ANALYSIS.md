# Spambot Profile Age Analysis - Полный путь данных

## 🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ПУТИ ДАННЫХ ПРОФИЛЯ

### Весь путь от Python до Frontend:

```
1. HTML Luxee.io (исходные данные)
   ↓
2. Python: luxee_browser.py __extract_profiles() - парсинг HTML
   ↓
3. Python: models.py Profile class - хранение age как string
   ↓
4. Python: service.py get_profiles() - конвертация в Pydantic
   ↓
5. Python: models.py ProfileInfo - age как int
   ↓
6. HTTP Response → Node.js
   ↓
7. Node.js: SpambotService.getProfiles() - передача как есть
   ↓
8. HTTP Response → Frontend
   ↓
9. Frontend: ProfileSelector.jsx - отображение
```

---

## 📊 ДЕТАЛЬНЫЙ РАЗБОР КАЖДОГО ЭТАПА

### 1️⃣ HTML Luxee.io (Исходные данные)

```html
<div class="profile-tile-wrap-outside">
    <div class="username">Margarita</div>
    <div class="age">0</div>  <!-- ← Сайт возвращает "0" если возраст не указан -->
    <div class="location">Ukraine</div>
    <div class="uid">609024</div>
</div>
```

**Ключевой момент:** Luxee.io возвращает `"0"` в HTML если возраст профиля **не задан или скрыт**.

---

### 2️⃣ Python: luxee_browser.py (Парсинг HTML)

```python
# backend-spambot/core/src/luxee_site/luxee_browser.py:94-122

def __extract_profiles(self, html_page: str) -> list[Profile]:
    soup = BeautifulSoup(html_page, "html.parser")
    profiles = []
    
    for profile_wrapper in soup.find_all("div", {"class": "profile-tile-wrap-outside"}):
        try:
            name = profile_wrapper.find("div", {"class": "username"}).text.strip()
            
            # ❌ ПРОБЛЕМА: Берем age напрямую из HTML как string
            age = profile_wrapper.find("div", {"class": "age"}).text.strip()  # "0"
            
            location = profile_wrapper.find("div", {"class": "location"}).text.strip()
            uid_text = profile_wrapper.find("div", {"class": "uid"}).text.strip()
            # ...
            
            # Создаем Profile с age="0"
            profiles.append(Profile(name, age, location, uid, url, is_disabled))
```

**Результат:** `age = "0"` (string)

---

### 3️⃣ Python: models.py Profile class

```python
# backend-spambot/core/src/models.py:1-19

class Profile:
    def __init__(self, name: str, age: str, location: str, uid: str, image_url: str, is_disabled: bool):
        self.name: str = name
        self.age: str = age  # ✅ Хранится как string
        self.location: str = location
        self.owner_uid: int = int(uid)
        # ...
    
    def display_name(self):
        return f"{self.name} ({self.owner_uid})"  # "Margarita (609024)"
```

**Результат:** `profile.age = "0"` (string)

---

### 4️⃣ Python: service.py get_profiles() - Конвертация в Pydantic

```python
# backend-spambot/api/service.py:60-70

profile_list = [
    ProfileInfo(
        uid=str(p.uid) if p.uid else str(p.owner_uid),
        owner_uid=str(p.owner_uid),
        name=p.name,
        
        # ✅ ВАЖНО: Конвертация age в int
        age=int(p.age) if p.age.isdigit() else 0,  # "0" → 0
        
        location=p.location,
        image_url=p.image_url
    )
    for p in profiles
]
```

**Логика:**
- Если `p.age.isdigit()` (т.е. "0", "25", "30") → конвертируем в `int`
- Если не число (пусто, "-", "N/A") → `0`

**Результат:** `age = 0` (int)

---

### 5️⃣ Python: models.py ProfileInfo (Pydantic)

```python
# backend-spambot/api/models.py:104-114

class ProfileInfo(BaseModel):
    uid: str = Field(..., description="Profile UID")
    owner_uid: str = Field(..., description="Owner UID")
    name: str = Field(..., description="Profile name")
    
    age: int = Field(..., description="Profile age")  # ← int тип
    
    location: str = Field(..., description="Profile location")
    image_url: str = Field(..., description="Profile image URL")
```

**HTTP Response:**
```json
{
    "profiles": [
        {
            "uid": "609024",
            "owner_uid": "609024",
            "name": "Margarita",
            "age": 0,  // ← int: 0
            "location": "Ukraine",
            "image_url": "https://..."
        }
    ]
}
```

---

### 6️⃣ Node.js: SpambotService.getProfiles()

```javascript
// backend/src/services/SpambotService.js:74-84

const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
    params: {
        username: account.luxeeEmail,
        password: account.luxeePassword
    }
});

return response.data.profiles;  // Передаем как есть
```

**Результат:** 
```javascript
[
    {
        uid: "609024",
        name: "Margarita",
        age: 0,  // ← int: 0
        location: "Ukraine",
        image_url: "https://..."
    }
]
```

---

### 7️⃣ Frontend: ProfileSelector.jsx (Отображение)

```jsx
// frontend/src/components/Spambot/ProfileSelector.jsx:60-67

<div className="flex-1 min-w-0">
    <div className="font-medium text-gray-900 dark:text-white truncate">
        {profile.name}  {/* "Margarita" */}
    </div>
    <div className="text-sm text-gray-600 dark:text-gray-400">
        {profile.age && `${profile.age} лет`}  {/* ❌ ПРОБЛЕМА: 0 is truthy! */}
        {profile.location && ` • ${profile.location}`}
    </div>
</div>
```

**Проблема:** 
```javascript
profile.age = 0
profile.age && `${profile.age} лет`  // true → "0 лет" ❌
```

В JavaScript `0` это **falsy**, но `profile.age` это number `0`, который проверяется как **truthy** в условии `profile.age &&`.

**Результат UI:** `"0 • Ukraine"`

---

## 🔴 ПРОБЛЕМЫ

### Проблема 1: Отображение "0 лет"
```jsx
// ❌ Неправильно:
{profile.age && `${profile.age} лет`}

// ✅ Правильно:
{profile.age > 0 && `${profile.age} лет`}
```

### Проблема 2: Luxee.io не предоставляет реальный возраст
HTML сайта luxee.io:
```html
<div class="age">0</div>  <!-- Всегда 0 если не указан -->
```

**Возможные причины:**
1. Модель не указала возраст при создании профиля
2. Luxee.io скрывает возраст для конфиденциальности
3. Возраст доступен только в другом месте сайта (настройки профиля?)

---

## 🔎 ПРОВЕРКА: Как было раньше в spambot?

### Desktop приложение (spambot/):

```python
# spambot/src/application/profile_frame.py:32
self.profile_info_label.configure(text=f"{profile.name}\n{profile.location}, {profile.age}")
```

**Desktop показывал:** `"Margarita\nUkraine, 0"`

То есть **РАНЬШЕ ТОЖЕ БЫЛО "0"!** Это не баг нашей реализации, а данные от Luxee.io.

---

## ✅ РЕШЕНИЕ

### Вариант 1: Скрыть возраст если 0 (Рекомендуется)

```jsx
// frontend/src/components/Spambot/ProfileSelector.jsx

<div className="text-sm text-gray-600 dark:text-gray-400">
    {profile.age > 0 && `${profile.age} лет`}
    {profile.age > 0 && profile.location && ' • '}
    {profile.location}
</div>
```

**Результат:** `"Ukraine"` (без возраста)

### Вариант 2: Показать "Возраст не указан"

```jsx
<div className="text-sm text-gray-600 dark:text-gray-400">
    {profile.age > 0 ? `${profile.age} лет` : 'Возраст не указан'}
    {profile.location && ` • ${profile.location}`}
</div>
```

**Результат:** `"Возраст не указан • Ukraine"`

### Вариант 3: Убрать возраст полностью

```jsx
<div className="text-sm text-gray-600 dark:text-gray-400">
    {profile.location}
</div>
```

**Результат:** `"Ukraine"`

---

## 📋 ЧТО НУЖНО ИСПРАВИТЬ

### 1. Frontend: ProfileSelector.jsx
```jsx
// Строка 64-67
<div className="text-sm text-gray-600 dark:text-gray-400">
    {profile.age > 0 && `${profile.age} лет`}
    {profile.age > 0 && profile.location && ' • '}
    {profile.location}
</div>
```

### 2. Frontend: DistributionHistory.jsx
```jsx
// Где показывается имя профиля
{dist.profileName}  // Сейчас: "Margarita, 0"
```

**Проблема:** Похоже что ", 0" добавляется где-то при создании рассылки.

Проверить:
- `SpambotDistributionModel` - поле `profileName`
- Как формируется это значение при создании рассылки

---

## 🎯 ВЫВОД

1. ✅ **"0" - это НЕ БАГ**, а реальные данные от Luxee.io
2. ✅ **Раньше тоже было "0"** в desktop приложении
3. ❌ **Frontend неправильно проверяет** `profile.age && ...` вместо `profile.age > 0`
4. ❌ **", 0" в имени профиля** - нужно найти где это формируется

**Следующий шаг:** Найти где создается строка `"Margarita, 0"` для рассылки.
