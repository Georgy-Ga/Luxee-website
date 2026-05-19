# FRONTEND API INTEGRATION

> **Интеграция с backend API**  
> **Обновлено:** 10.05.2026

---

## 🌐 API КЛИЕНТЫ

### axios.js
**Путь:** `frontend/src/api/axios.js`  
**Назначение:** Настроенный axios instance

**Конфигурация:**
- Base URL: `http://localhost:5000/api`
- Автоматическое добавление токенов
- Обновление токенов при 401
- Interceptors для обработки ошибок

---

### authApi.js
**Путь:** `frontend/src/api/authApi.js`  
**Назначение:** API для авторизации

**Методы:**
- `login(email, password)` - вход
- `logout()` - выход
- `refresh()` - обновление токенов
- `register(email, password)` - регистрация (admin)
- `getUsers()` - список пользователей (admin)
- `deleteUser(userId)` - удаление пользователя (admin)

---

### luxeeApi.js
**Путь:** `frontend/src/api/luxeeApi.js`  
**Назначение:** API для работы с Luxee

**Методы:**
- `loginLuxee(email, password)` - добавить аккаунт
- `getAccounts()` - список аккаунтов
- `deleteAccount(accountId)` - удалить аккаунт
- `checkAllMessages()` - проверить сообщения
- `sendMessage(accountId, profileUid, memberUid, text, chatIdentity)` - отправить сообщение
- `loadProfileChats(accountId, profileUid)` - загрузить чаты профиля
- `openChat(accountId, profileUid, chatId)` - открыть чат

---

### aiApi.js
**Путь:** `frontend/src/api/aiApi.js`  
**Назначение:** API для работы с AI

**Методы:**
- `testResponse(profile, message, history)` - тестирование AI
- `getSystemPrompt()` - получить промпт

---

**Последнее обновление:** 10.05.2026  
**Версия:** 1.0
