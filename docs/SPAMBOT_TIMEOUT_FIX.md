# Spambot Profile Loading Timeout Fix

## Проблема

При загрузке профилей через Spambot происходил timeout (30 секунд), хотя операция успешно выполнялась на Python backend.

### Ошибка
```
[Spambot] Error loading profiles: AxiosError: timeout of 30000ms exceeded
```

### Анализ логов
```
luxee-backend-spambot | 2026-07-20 07:39:55,288 - INFO [service.py:106] [Service] Found 18 profiles
```

Python service успешно загружает профили, но frontend получает timeout.

## Причина

Операция загрузки профилей включает:
1. **Login в Luxee** (10-20 секунд)
2. **Парсинг всех профилей** (5-15 секунд)
3. **Logout** (1-2 секунды)

**Итого**: 16-37 секунд на выполнение

### Проблема в timeouts:
- **Frontend** (axios.js): 30 секунд ❌
- **Backend** (SpambotService.js): 60 секунд ✅
- **Python Service**: нет timeout ✅

Frontend прерывал запрос раньше, чем операция завершалась.

## Решение

Увеличены timeouts для всех уровней до **90 секунд**, что дает достаточный запас времени для медленных соединений и больших списков профилей.

### Изменения

#### 1. Frontend (axios.js)
```javascript
// До
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000, // ❌ 30 секунд
});

// После
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 90000, // ✅ 90 секунд (загрузка профилей spambot требует больше времени)
});
```

#### 2. Backend - User Profiles (SpambotService.js:83)
```javascript
// До
const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
  params: {
    username: account.luxeeEmail,
    password: account.luxeePassword,
  },
  timeout: 60000, // ❌ 60 секунд
});

// После
const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
  params: {
    username: account.luxeeEmail,
    password: account.luxeePassword,
  },
  timeout: 90000, // ✅ 90 секунд (операция долгая - login + парсинг профилей)
});
```

#### 3. Backend - Admin Profiles (SpambotService.js:569)
```javascript
// До
const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
  params: {
    username: account.luxeeEmail,
    password: account.luxeePassword,
  },
  timeout: 60000, // ❌ 60 секунд
});

// После
const response = await axios.get(`${PYTHON_SERVICE_URL}/api/profiles`, {
  params: {
    username: account.luxeeEmail,
    password: account.luxeePassword,
  },
  timeout: 90000, // ✅ 90 секунд (операция долгая - login + парсинг профилей)
});
```

## Итоговая цепочка timeouts

```
Frontend (90s)
    ↓
Backend NodeJS (90s)
    ↓
Python Service (no timeout)
    ↓
Luxee.io
```

Все уровни теперь согласованы и дают достаточно времени для выполнения операции.

## Почему не timeout на Python Service?

Python service работает асинхронно и не устанавливает timeout для Playwright операций, так как:
- Операция может быть очень долгой (большой список профилей)
- Luxee.io может быть медленным в зависимости от нагрузки
- Playwright имеет свои встроенные таймауты для отдельных действий

## Дополнительные улучшения (будущее)

Можно добавить:

1. **Индикатор прогресса** - показывать пользователю, что происходит
2. **Кеширование профилей** - не загружать каждый раз заново
3. **Lazy loading** - загружать профили по мере необходимости
4. **Retry логика** - автоматически повторять при временных сбоях

## Тестирование

После изменений проверить:

1. ✅ Загрузка профилей в нормальных условиях (< 30 сек)
2. ✅ Загрузка профилей при медленном соединении (30-60 сек)
3. ✅ Загрузка профилей с большим списком (60-90 сек)
4. ✅ Правильная обработка ошибок при реальном timeout (> 90 сек)

## Файлы изменены

- `frontend/src/api/axios.js` - timeout 30s → 90s
- `backend/src/services/SpambotService.js` - timeout 60s → 90s (2 места)

## Дата исправления
20.07.2026
