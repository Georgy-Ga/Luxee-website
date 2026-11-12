# 🎯 Spambot - Правильный План Реализации

**Дата:** 17.07.2026  
**Статус:** Корректировка после обнаружения проблем

---

## 🚨 **ПРОБЛЕМЫ В ТЕКУЩЕЙ РЕАЛИЗАЦИИ:**

### **1. Глобальный BROWSER - Race Condition**
```python
# backend-spambot/core/src/luxee_site/luxee_browser.py:21
BROWSER = Selenium()  # ← Все процессы используют ОДИН браузер!
```

**Проблема:** 10 пользователей → 10 рассылок → 1 браузер → КОНФЛИКТ

**Решение:** Каждый `Luxee()` создаёт СВОЙ `Selenium()`

### **2. credentials_manager - Не нужен для API**
```python
# backend-spambot/core/src/credentials_manager.py
# Файловые блокировки, сохранение в файлы
```

**Проблема:** Это для GUI desktop приложения

**Решение:** MongoDB хранит всё, файлы не нужны

### **3. Credentials передаются напрямую - Небезопасно**
```python
# Текущая реализация
config = {
    "username": "model@luxee.com",  # ← Передаётся из frontend
    "password": "password123"        # ← Небезопасно!
}
```

**Решение:** Frontend передаёт только `accountId`, Node.js достаёт credentials

---

## ✅ **ПРАВИЛЬНАЯ АРХИТЕКТУРА:**

### **Flow рассылки:**

```
1. Frontend
   ↓ (отправляет accountId + конфигурацию)
   
2. Node.js Backend
   ↓ (достаёт credentials из MongoDB)
   const account = await LuxeeAccountModel.findById(accountId);
   ↓ (отправляет в Python Service)
   
3. Python Service (FastAPI)
   ↓ (создаёт ОТДЕЛЬНЫЙ Selenium() для этого аккаунта)
   
4. Core Spambot
   ↓ (запускает рассылку в своём браузере)
```

---

## 🔧 **ЧТО НУЖНО ИСПРАВИТЬ:**

### **ЭТАП 1: Изолировать браузеры (КРИТИЧНО!)**

**Файл:** `backend-spambot/core/src/luxee_site/luxee_browser.py`

**Было:**
```python
BROWSER = Selenium()  # Глобальный

class Luxee:
    def __init__(self, username: str, password: str):
        self.browser = BROWSER  # ← Все используют один
```

**Нужно:**
```python
# УБРАТЬ глобальный BROWSER

class Luxee:
    def __init__(self, username: str, password: str):
        self.browser = Selenium()  # ← Создаём СВОЙ для каждого
```

**⚠️ ВАЖНО:** Также нужно убрать `from luxee_browser import BROWSER` в других файлах!

---

### **ЭТАП 2: Убрать зависимость от credentials_manager**

**Файл:** `backend-spambot/core/src/application/app.py`

Импорты `credentials_manager` используются только в GUI. В API не нужны.

**Решение:** Просто не импортировать и не использовать в API режиме.

---

### **ЭТАП 3: Правильная авторизация через MongoDB**

#### **3.1. Изменить Pydantic модель**

**Файл:** `backend-spambot/api/models.py`

**Было:**
```python
class DistributionConfig(BaseModel):
    username: str  # ❌
    password: str  # ❌
```

**Нужно:**
```python
class DistributionConfig(BaseModel):
    # Credentials НЕ НУЖНЫ в API модели!
    # Их передаёт Node.js backend внутренне
    
    # Profile selection
    profile_uid: str
    profile_name: str
    
    # ... остальные поля без username/password
```

#### **3.2. Node.js Controller получает credentials из MongoDB**

**Файл:** `backend/src/controllers/spambotController.js`

```javascript
async startDistribution(req, res) {
    const { accountId, config } = req.body;
    const userId = req.user.id;
    
    // 1. Получить аккаунт из MongoDB
    const account = await LuxeeAccountModel.findById(accountId);
    
    // 2. Проверить права
    if (account.userId.toString() !== userId) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    // 3. Добавить credentials к конфигу (внутренне)
    const fullConfig = {
        ...config,
        username: account.luxeeEmail,
        password: decrypt(account.luxeePassword)  // ← Расшифровать!
    };
    
    // 4. Отправить в Python Service
    const response = await axios.post(
        'http://python-service:8000/api/distribution/start',
        fullConfig
    );
}
```

#### **3.3. Python Service принимает credentials**

**Файл:** `backend-spambot/api/models.py`

```python
class DistributionConfigInternal(BaseModel):
    """Internal model with credentials (from Node.js only)"""
    username: str  # ← Приходит от Node.js, НЕ от frontend
    password: str
    
    profile_uid: str
    # ... остальные поля
```

---

## 📊 **ENDPOINTS (обновлённые):**

### **Frontend → Node.js:**

```javascript
POST /api/spambot/distributions/start
Body: {
    accountId: "507f1f77bcf86cd799439011",  // ← Только ID!
    config: {
        profileUid: "123456",
        distributionType: "chat",
        messages: [...],
        limit: 50,
        // ... БЕЗ username/password
    }
}
```

### **Node.js → Python Service:**

```python
POST http://python-service:8000/api/distribution/start
Body: {
    username: "model@luxee.com",  # ← Добавлено Node.js
    password: "decrypted_pass",    # ← Добавлено Node.js
    profile_uid: "123456",
    // ... остальное от frontend
}
```

---

## 🔒 **БЕЗОПАСНОСТЬ:**

1. ✅ Frontend НЕ знает пароли
2. ✅ Python Service изолирован (internal network)
3. ✅ Каждый аккаунт = отдельный браузер
4. ✅ MongoDB как единый источник данных

---

## 📝 **ПЛАН ДЕЙСТВИЙ:**

### **Шаг 1: Исправить core (КРИТИЧНО!)**
- [ ] Убрать глобальный `BROWSER = Selenium()`
- [ ] В `Luxee.__init__()` создавать `self.browser = Selenium()`
- [ ] Проверить что нигде не используется глобальный BROWSER

### **Шаг 2: Обновить API модели**
- [ ] Убрать `username/password` из `DistributionConfig` (public)
- [ ] Создать `DistributionConfigInternal` с credentials (internal)
- [ ] Обновить routes для использования internal модели

### **Шаг 3: Node.js Integration**
- [ ] Создать MongoDB модель `SpambotDistribution`
- [ ] Controller достаёт credentials из `LuxeeAccount`
- [ ] Расшифровка пароля (если зашифрован)
- [ ] Проксирование к Python Service

### **Шаг 4: Тестирование параллельности**
- [ ] Запустить 2 рассылки одновременно (разные аккаунты)
- [ ] Проверить что создаются 2 браузера
- [ ] Проверить что нет конфликтов

---

## ⚠️ **ВАЖНО:**

**НЕ ТРОГАЕМ:**
- ✅ Логику рассылки в `core/src/process.py`
- ✅ Логику браузера в `core/src/luxee_site/luxee_browser.py` (кроме BROWSER)
- ✅ Модели в `core/src/models.py`

**МЕНЯЕМ:**
- 🔧 Создание браузера (singleton → instance)
- 🔧 API модели (убрать credentials из публичных)
- 🔧 Добавить Node.js proxy с MongoDB

---

**Время на исправления:** 1-2 часа
**Приоритет:** КРИТИЧЕСКИЙ (без этого не будет работать для нескольких пользователей)
