# 🐛 Критические исправления Spambot интеграции

**Дата:** 16.07.2026, 5:23 AM  
**Статус:** ✅ Исправлено

## 🔴 Найденные критические проблемы

### Проблема #1: Недостающие поля в API профилей

**Файл:** `backend-spambot/src/api/auth.py`  
**Строки:** 123-133

#### Описание
В эндпоинте `GET /profiles/{luxee_account_id}` возвращались не все поля объекта Profile, которые необходимы фронтенду и backend для создания рассылок.

#### Что было
```python
profiles_data.append({
    "uid": profile.uid,
    "name": profile.name,
    "age": profile.age,
    "location": profile.location,
    "image_url": profile.image_url,
    "is_online": profile.is_online  # ❌ Это поле вообще не существует!
})
```

#### Проблемы
1. ❌ Отсутствовало поле `owner_uid` - **критично** для работы рассылок
2. ❌ Отсутствовало поле `apps` - список приложений профиля
3. ❌ Отсутствовало поле `is_disabled` - статус профиля
4. ❌ Поле `is_online` не существует в модели Profile
5. ❌ Поле `uid` было `None` (не заполняется в Profile)

#### Что стало
```python
profiles_data.append({
    "uid": str(profile.owner_uid),  # ✅ Используем owner_uid как строку
    "name": profile.name,
    "age": profile.age,
    "location": profile.location,
    "image_url": profile.image_url,
    "owner_uid": profile.owner_uid,  # ✅ Добавлено
    "apps": profile.apps,            # ✅ Добавлено
    "is_disabled": profile.is_disabled  # ✅ Добавлено
})
```

#### Последствия
- **Критично:** Без `owner_uid` невозможно было создать рассылку - процесс падал с ошибкой
- Без `apps` фронтенд не мог показать на каких приложениях активен профиль
- Без `is_disabled` нельзя было отфильтровать заблокированные профили

---

### Проблема #2: Конфликт роутов в Express

**Файл:** `backend/src/routes/distribution.js`  
**Строки:** 18-79

#### Описание
Роуты были расположены в неправильном порядке, что вызывало конфликты при обработке запросов.

#### Что было
```javascript
router.get('/', distributionController.getDistributions);
router.get('/:id', distributionController.getDistribution);  // ⚠️
router.post('/:id/start', distributionController.startDistribution);
router.post('/:id/stop', distributionController.stopDistribution);
router.delete('/:id', distributionController.deleteDistribution);
router.post('/authenticate/:accountId', distributionController.authenticateAccount);  // ❌
router.get('/profiles/:accountId', distributionController.getAccountProfiles);  // ❌
```

#### Проблема
Express обрабатывает роуты **по порядку их регистрации**:
- Запрос `GET /api/distributions/authenticate/123` перехватывался роутом `/:id`
- Express думал что `id = 'authenticate'` и пытался найти рассылку с таким ID
- Запрос `GET /api/distributions/profiles/123` аналогично перехватывался `/:id`

#### Что стало
```javascript
// ✅ Специфичные роуты ПЕРЕД параметризованными
router.post('/authenticate/:accountId', distributionController.authenticateAccount);
router.get('/profiles/:accountId', distributionController.getAccountProfiles);

router.post('/', distributionController.createDistribution);
router.get('/', distributionController.getDistributions);

// Параметризованные роуты в конце
router.post('/:id/start', distributionController.startDistribution);
router.post('/:id/stop', distributionController.stopDistribution);
router.get('/:id', distributionController.getDistribution);
router.delete('/:id', distributionController.deleteDistribution);
```

#### Последствия
- **Критично:** Аутентификация аккаунтов была полностью нерабочей
- **Критично:** Получение списка профилей возвращало 404
- Запросы возвращали ошибки "Distribution not found"

---

## 📋 Как это работало в оригинальном spambot

В оригинальном приложении (`spambot/src/luxee_site/luxee_browser.py`):

```python
def get_profiles(self) -> list[Profile]:
    try:
        profiles_html = self.requests.get_profiles()
        profiles = self.__extract_profiles(profiles_html)
        for profile in profiles:
            settings_str = self.requests.get_profile_settings(profile.owner_uid)
            profile.apps = self.__extract_profile_apps_from_settings_page(settings_str)
        return profiles
```

### Модель Profile (`spambot/src/models.py`):
```python
class Profile:
    def __init__(self, name: str, age: str, location: str, uid: str, image_url: str, is_disabled: bool):
        self.name: str = name
        self.age: str = age
        self.location: str = location
        self.owner_uid: int = int(uid)  # ← Это ID профиля!
        self.image_url: str = image_url
        self.is_disabled: bool = is_disabled
        self.uid: int = None  # ← Это остаётся None
        self.apps: list[str] = []  # ← Заполняется в get_profiles()
```

**Важно:** 
- `owner_uid` - это **основной** идентификатор профиля (передаётся в конструктор как `uid`)
- `uid` - остаётся `None` (не используется)
- `apps` - заполняется отдельным запросом в `get_profiles()`

---

## ✅ Итоговые изменения

### 1. `backend-spambot/src/api/auth.py`
- ✅ Добавлено поле `owner_uid`
- ✅ Добавлено поле `apps`
- ✅ Добавлено поле `is_disabled`
- ✅ Убрано несуществующее поле `is_online`
- ✅ Исправлено `uid` - теперь возвращает `owner_uid` как строку

### 2. `backend/src/routes/distribution.js`
- ✅ Переупорядочены роуты - специфичные перед параметризованными
- ✅ Добавлен комментарий-предупреждение о порядке роутов

---

## 🧪 Как протестировать

1. **Перезапустить backend-spambot:**
   ```bash
   docker-compose restart backend-spambot
   ```

2. **Перезапустить backend:**
   ```bash
   docker-compose restart backend
   ```

3. **Тест аутентификации:**
   - Открыть страницу Distributions
   - Выбрать Luxee аккаунт
   - Нажать "Authenticate" ✅
   - Должен появиться список профилей с полями:
     - ✅ uid (строка)
     - ✅ name
     - ✅ age
     - ✅ location
     - ✅ image_url
     - ✅ owner_uid
     - ✅ apps (массив)
     - ✅ is_disabled

4. **Тест создания рассылки:**
   - Выбрать профиль из списка ✅
   - Заполнить параметры рассылки
   - Создать рассылку
   - Должна создаться без ошибок ✅

---

## 🔍 Логи для отладки

### Backend-spambot логи:
```bash
docker-compose logs -f backend-spambot | grep "Auth API"
```

Должно быть:
```
[Auth API] Get profiles request for account 123
[Auth API] Found 5 profiles for account 123
```

### Backend логи:
```bash
docker-compose logs -f backend | grep "DistributionController"
```

Должно быть:
```
[DistributionController] Getting profiles for account 123
[DistributionController] Found 5 profiles for account 123
```

---

## 📚 Связанные файлы

- `backend-spambot/src/api/auth.py` - API аутентификации
- `backend-spambot/src/core/models.py` - модель Profile
- `backend-spambot/src/core/luxee_site/luxee_browser.py` - парсинг профилей
- `backend/src/routes/distribution.js` - роуты
- `backend/src/controllers/distributionController.js` - контроллер

---

## 🎯 Выводы

Обе проблемы были **критическими** и полностью блокировали работу функционала рассылок:

1. ❌ Невозможно было аутентифицироваться (конфликт роутов)
2. ❌ Невозможно было получить профили (конфликт роутов)
3. ❌ Невозможно было создать рассылку (недостающие поля)

После исправления весь флоу должен работать:
✅ Аутентификация → ✅ Получение профилей → ✅ Создание рассылки → ✅ Запуск
