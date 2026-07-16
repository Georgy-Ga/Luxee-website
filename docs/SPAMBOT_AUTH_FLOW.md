# Spambot Authentication Flow

## 📋 Обзор

Документация описывает новый flow аутентификации Luxee аккаунтов в spambot service для получения профилей и последующей рассылки.

**Дата создания:** 16.07.2026  
**Статус:** ✅ Полностью реализовано и готово к тестированию

---

## 🎯 Проблема

**Старый подход (ПРОБЛЕМА):**
- Профили загружались через Node.js backend используя Playwright контекст
- Node.js backend хранил браузерные контексты для каждого Luxee аккаунта
- При создании рассылки профили запрашивались из Node.js backend
- **Проблема:** Python spambot НЕ имел доступа к профилям, т.к. они были только в Node.js

**Почему это было плохо:**
1. Рассылка запускалась БЕЗ авторизации в spambot
2. Python spambot должен был авторизоваться заново при старте рассылки
3. Дублирование логики авторизации
4. Невозможно получить профили ДО создания рассылки

---

## ✅ Решение

**Новый подход:**
- Spambot service имеет свой отдельный ContextManager для управления браузерными контекстами
- При выборе Luxee аккаунта происходит автоматическая аутентификация в spambot
- Spambot сразу загружает профили и держит контекст открытым
- При запуске рассылки контекст уже авторизован и готов

**Преимущества:**
1. ✅ Профили загружаются сразу при выборе аккаунта
2. ✅ Spambot уже авторизован к моменту запуска рассылки
3. ✅ Нет дублирования авторизации
4. ✅ Быстрый старт рассылки (контекст уже готов)
5. ✅ Централизованное управление контекстами в spambot

---

## 🏗️ Архитектура

### Компоненты

```
Frontend (React)
    ↓
    | POST /api/distributions/authenticate/:accountId
    ↓
Node.js Backend
    ↓
    | POST http://luxee-spambot:8001/api/spambot/auth
    ↓
Python Spambot Service (ContextManager)
    ↓
    | Создаёт BrowserContext в Playwright
    | Авторизуется на luxee.com
    | Загружает профили
    ↓
    | GET /api/spambot/profiles/:accountId
    ↓
Frontend получает профили
```

---

## 📁 Созданные файлы

### Python Spambot Service

#### 1. `backend-spambot/src/services/context_manager.py`
**Описание:** Менеджер браузерных контекстов для Luxee аккаунтов

**Ключевые методы:**
- `authenticate(luxee_account_id, username, password)` - Авторизация и создание контекста
- `get_profiles(luxee_account_id)` - Получение профилей для авторизованного аккаунта
- `is_authenticated(luxee_account_id)` - Проверка статуса авторизации
- `close_context(luxee_account_id)` - Закрытие контекста

**Особенности:**
- Каждый аккаунт имеет отдельный BrowserContext
- Контексты хранятся в памяти до закрытия
- Автоматическое переиспользование существующих контекстов
- Используется `LuxeeBrowser` для авторизации

#### 2. `backend-spambot/src/api/auth.py`
**Описание:** FastAPI роуты для аутентификации

**Endpoints:**
- `POST /api/spambot/auth` - Авторизация аккаунта
- `GET /api/spambot/profiles/{luxee_account_id}` - Получение профилей
- `GET /api/spambot/status/{luxee_account_id}` - Статус контекста
- `DELETE /api/spambot/context/{luxee_account_id}` - Закрытие контекста

#### 3. Схемы данных в `backend-spambot/src/schemas/`
- `AuthRequest` - Запрос на авторизацию
- `AuthResponse` - Ответ авторизации
- `ProfilesResponse` - Список профилей
- `ContextStatusResponse` - Статус контекста

---

### Node.js Backend

#### 1. Обновлённая модель `LuxeeAccountModel.js`
Добавлено поле:
```javascript
spambotAuthenticated: { type: Boolean, default: false }
```

#### 2. Новые endpoints в `distributionController.js`
- `authenticateAccount(accountId)` - Авторизация в spambot
- `getAccountProfiles(accountId)` - Получение профилей

#### 3. Новые методы в `SpambotService.js`
- `authenticateAccount(data)` - Вызов spambot API для авторизации
- `getAccountProfiles(accountId)` - Получение профилей из spambot
- `getContextStatus(accountId)` - Проверка статуса контекста
- `closeContext(accountId)` - Закрытие контекста

#### 4. Роуты в `backend/src/routes/distribution.js`
```javascript
POST /api/distributions/authenticate/:accountId
GET /api/distributions/profiles/:accountId
```

---

### Frontend

#### 1. API функции в `distributionApi.js`
```javascript
authenticateAccount: async (accountId)
getAccountProfiles: async (accountId)
```

#### 2. Обновлённый `DistributionForm.jsx`

**Новая логика:**
1. При выборе аккаунта проверяется localStorage
2. Если не авторизован - запускается автоаутентификация
3. После успешной аутентификации загружаются профили
4. Статус сохраняется в localStorage для быстрого доступа

**UI индикаторы:**
- 🔐 Фиолетовый баннер: "Авторизация аккаунта в spambot..."
- ✅ Зелёный баннер: "Аккаунт авторизован (найдено профилей: X)"
- ❌ Красный баннер: "Ошибка аутентификации" + кнопка "Повторить"
- ⏳ Ожидание: "Ожидание аутентификации..."

**LocalStorage:**
```javascript
{
  "luxee_auth_status": {
    "account_id_1": "authenticated",
    "account_id_2": "authenticated"
  }
}
```

---

## 🔄 Flow работы

### 1. Пользователь выбирает Luxee аккаунт

```javascript
// Frontend: DistributionForm.jsx
useEffect(() => {
  // Проверяем localStorage
  const savedStatuses = JSON.parse(localStorage.getItem('luxee_auth_status') || '{}');
  if (savedStatuses[accountId] === 'authenticated') {
    setAuthStatus('authenticated');
  } else {
    // Запускаем автоаутентификацию
    setAuthStatus('authenticating');
    authenticateMutation.mutate();
  }
}, [accountId]);
```

### 2. Аутентификация в spambot

```
Frontend
  ↓ POST /api/distributions/authenticate/:accountId
Node.js Backend (distributionController.js)
  ↓ spambotService.authenticateAccount()
  ↓ POST http://luxee-spambot:8001/api/spambot/auth
Python Spambot (auth.py)
  ↓ context_manager.authenticate()
  ↓ LuxeeBrowser.login()
  ↓ Создание BrowserContext в Playwright
  ↓ Загрузка профилей
  ↓ Возврат {success: true, profiles_count: X}
Node.js Backend
  ↓ Обновление LuxeeAccount.spambotAuthenticated = true
  ↓ Сохранение в MongoDB
Frontend
  ↓ Сохранение в localStorage
  ↓ Показ зелёного баннера
```

### 3. Загрузка профилей

```
Frontend
  ↓ GET /api/distributions/profiles/:accountId
Node.js Backend
  ↓ Проверка LuxeeAccount.spambotAuthenticated
  ↓ spambotService.getAccountProfiles()
  ↓ GET http://luxee-spambot:8001/api/spambot/profiles/:accountId
Python Spambot
  ↓ context_manager.get_profiles()
  ↓ Возврат профилей из контекста
Frontend
  ↓ Отображение профилей в select
```

### 4. Запуск рассылки (БЕЗ ПОВТОРНОЙ АВТОРИЗАЦИИ!)

```
Frontend
  ↓ POST /api/distributions/:id/start
Node.js Backend
  ↓ spambotService.startDistribution()
  ↓ POST http://luxee-spambot:8001/api/distribution/start
Python Spambot
  ↓ Контекст УЖЕ АВТОРИЗОВАН!
  ↓ Сразу начинает рассылку
  ↓ НЕТ задержки на авторизацию
```

---

## 🔒 Обработка ошибок

### Случай 1: Контекст закрыт/устарел

```javascript
// Frontend получает ошибку с needsAuthentication: true
if (error.response?.data?.needsAuthentication) {
  // Сбрасываем статус
  setAuthStatus(null);
  // Удаляем из localStorage
  delete savedStatuses[accountId];
  // Пользователь может повторить авторизацию
}
```

### Случай 2: Ошибка авторизации

```javascript
// Показываем красный баннер с кнопкой "Повторить"
<Button onClick={() => {
  setAuthStatus('authenticating');
  authenticateMutation.mutate();
}}>
  Повторить
</Button>
```

### Случай 3: Spambot service недоступен

```javascript
// Node.js Backend
if (!authResult.success) {
  return res.status(500).json({
    success: false,
    error: authResult.error || 'Failed to authenticate'
  });
}
```

---

## 📊 Формат данных

### AuthRequest (Python)
```python
{
    "luxee_account_id": "507f1f77bcf86cd799439011",
    "username": "user@example.com",
    "password": "password123"
}
```

### AuthResponse (Python)
```python
{
    "success": true,
    "luxee_account_id": "507f1f77bcf86cd799439011",
    "status": "authenticated",
    "profiles_count": 5
}
```

### ProfilesResponse (Python)
```python
{
    "success": true,
    "luxee_account_id": "507f1f77bcf86cd799439011",
    "profiles": [
        {
            "uid": "profile_123",
            "name": "Anna",
            "age": 25,
            "location": "Moscow",
            "image_url": "https://...",
            "owner_uid": "owner_123",
            "apps": ["tinder", "bumble"],
            "is_disabled": false
        }
    ]
}
```

---

## 🧪 Тестирование

### Сценарии для проверки:

1. **Первая авторизация**
   - [ ] Выбрать аккаунт
   - [ ] Увидеть фиолетовый баннер "Авторизация..."
   - [ ] Увидеть зелёный баннер "Аккаунт авторизован"
   - [ ] Профили загрузились и отображаются

2. **Повторный выбор того же аккаунта**
   - [ ] Профили загружаются сразу (из localStorage)
   - [ ] Нет фиолетового баннера авторизации

3. **Ошибка авторизации**
   - [ ] Красный баннер с текстом ошибки
   - [ ] Кнопка "Повторить" работает
   - [ ] При повторе снова показывается фиолетовый баннер

4. **Устаревший контекст**
   - [ ] При запросе профилей получаем needsAuthentication
   - [ ] Статус сбрасывается
   - [ ] Предлагается повторная авторизация

5. **Запуск рассылки**
   - [ ] Рассылка запускается БЕЗ повторной авторизации
   - [ ] Быстрый старт (контекст уже готов)

---

## 🚀 Развёртывание

### Требования:
1. Docker Compose с `luxee-spambot` контейнером
2. MongoDB с обновлённой схемой LuxeeAccount
3. Node.js backend с новыми endpoints
4. Frontend с обновлённым DistributionForm

### Команды:
```bash
# Пересобрать spambot service
docker-compose build luxee-spambot

# Перезапустить все сервисы
docker-compose down
docker-compose up -d

# Проверить логи spambot
docker-compose logs -f luxee-spambot
```

---

## 📝 Важные замечания

1. **Контексты живут в памяти** - При перезапуске spambot контейнера все контексты будут потеряны
2. **LocalStorage используется для UX** - Реальный статус хранится в MongoDB
3. **Каждый аккаунт = отдельный контекст** - Контексты изолированы друг от друга
4. **Playwright headless** - Браузер работает в фоне, без GUI
5. **Xvfb для Docker** - Виртуальный display для Playwright в контейнере

---

## ✅ Статус реализации

- [x] 🐍 Python: ContextManager
- [x] 🐍 Python: API endpoints для auth
- [x] 🐍 Python: Схемы данных
- [x] 🐍 Python: Подключение роутов
- [x] 🟢 Node.js: Поле spambotAuthenticated в модели
- [x] 🟢 Node.js: Controllers для auth
- [x] 🟢 Node.js: Методы в SpambotService
- [x] 🟢 Node.js: Роуты
- [x] 🎨 Frontend: API функции
- [x] 🎨 Frontend: Логика аутентификации
- [x] 🎨 Frontend: UI индикаторы
- [x] 🎨 Frontend: LocalStorage
- [x] 📝 Документация

**Готово на 100%! 🎉**

---

## 🔗 Связанные документы

- [SPAMBOT_INTEGRATION_PLAN.md](./SPAMBOT_INTEGRATION_PLAN.md) - Общий план интеграции
- [SPAMBOT_INTEGRATION.md](./SPAMBOT_INTEGRATION.md) - Детальная документация
- [SPAMBOT_BACKEND_STATUS.md](./SPAMBOT_BACKEND_STATUS.md) - Статус backend
- [SPAMBOT_FRONTEND_COMPLETE.md](./SPAMBOT_FRONTEND_COMPLETE.md) - Статус frontend

---

**Автор:** Kiro AI  
**Дата последнего обновления:** 16.07.2026, 04:47 AM
