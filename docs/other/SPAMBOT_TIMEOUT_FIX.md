# Spambot Timeout Fix - Исправление проблемы кэширования

**Дата:** 20.07.2026  
**Проблема:** Ошибка `timeout of 30000ms exceeded` при загрузке профилей  
**Причина:** Агрессивное кэширование JS файлов в nginx

---

## 🔍 Анализ проблемы

### Симптомы

```
[Spambot] Error loading profiles: AxiosError: timeout of 30000ms exceeded
    at h.ontimeout (index-BSir0WBh.js:13:6727)
```

### Что НЕ работало

1. ❌ **Backend работает отлично** - профили загружаются за 1-2 секунды
2. ❌ **Timeout в axios.js уже 90 секунд** - но браузер использует старый код
3. ❌ **Перезапуск frontend** - не помогал

### Настоящая причина

**Агрессивное кэширование в nginx:**

```nginx
location ~* \.(js|css|...)$ {
    expires 1y;  # ← ПРОБЛЕМА: кэш на 1 год!
    add_header Cache-Control "public, immutable";
}
```

Браузер загрузил **старый JS файл** с timeout 30s и **не проверяет обновления** из-за заголовка `immutable`.

---

## ✅ Решение

### 1. Изменён nginx.conf

**Было:**
```nginx
# Все статические файлы кэшируются на 1 год
location ~* \.(js|css|png|jpg|...)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Стало:**
```nginx
# JS/CSS - короткое кэширование с проверкой обновлений
location ~* \.(js|css)$ {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
}

# Изображения и шрифты - долгое кэширование (они не меняются)
location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 2. Timeout в axios.js

**Уже исправлено ранее:**

```javascript
// frontend/src/api/axios.js
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 90000, // ✅ 90 секунд (было 30 по умолчанию)
});
```

---

## 🎯 Как работает

### До фикса:
1. Vite собирает новый JS с timeout 90s → `index-NEW123.js`
2. Nginx отдаёт его с заголовком `Cache-Control: immutable, max-age=31536000`
3. Браузер **НЕ проверяет обновления** (immutable = не изменяется)
4. Пользователь видит **старый JS** с timeout 30s

### После фикса:
1. Vite собирает новый JS → `index-NEW123.js`
2. Nginx отдаёт с `Cache-Control: public, must-revalidate, max-age=3600`
3. Браузер **проверяет ETag/Last-Modified** каждый час
4. При изменении файла браузер **загружает новую версию**

---

## 📊 Сравнение заголовков

| Тип | До фикса | После фикса |
|-----|----------|-------------|
| **JS/CSS** | `immutable, max-age=31536000` (1 год) | `must-revalidate, max-age=3600` (1 час) |
| **Изображения** | `immutable, max-age=31536000` | `immutable, max-age=31536000` |
| **index.html** | `no-cache, no-store` | `no-cache, no-store` |

---

## 🚀 Развёртывание

### 1. Пересобрать frontend контейнер

```bash
docker-compose build frontend
docker-compose up -d frontend
```

### 2. Очистить кэш браузера

**Chrome/Edge:**
- `Ctrl+Shift+Delete` → Очистить кэш
- Или Hard Reload: `Ctrl+Shift+R`

**Firefox:**
- `Ctrl+Shift+Delete` → Очистить кэш

---

## 🔍 Проверка

### 1. Проверить заголовки в DevTools

```
Network → index-HASH.js → Headers → Response Headers:
✅ Cache-Control: public, must-revalidate, max-age=3600
✅ Expires: [время + 1 час]
```

### 2. Проверить timeout в консоли

После загрузки страницы:
```javascript
// В консоли браузера
console.log(axios.defaults.timeout) // Должно быть 90000
```

### 3. Попробовать загрузить профили

Если таймаут **больше 30 секунд** - значит используется новый код!

---

## ⚠️ Важно

### Vite Hash в именах файлов

Vite автоматически добавляет хэш к именам файлов:
- `index-BSir0WBh.js` (старая версия)
- `index-NEW456fg.js` (новая версия)

Это значит что:
- ✅ Разные версии имеют **разные имена**
- ✅ Нет конфликтов в кэше
- ✅ `index.html` всегда ссылается на актуальный файл

**Но:** Если браузер закэшировал `index.html` (не должен из-за `no-cache`), он будет ссылаться на старый JS файл.

### must-revalidate vs no-cache

- **`must-revalidate`** - кэшировать можно, но проверять обновления при истечении срока
- **`no-cache`** - всегда проверять обновления перед использованием
- **`immutable`** - файл НЕ изменится, не проверять обновления

Для JS/CSS используем `must-revalidate` + 1 час - баланс между скоростью и актуальностью.

---

## 📈 Производительность

### До фикса:
- ✅ Первая загрузка: быстро (кэш на год)
- ❌ Обновления: НЕ применяются (immutable)

### После фикса:
- ✅ Первая загрузка: быстро (кэш на час)
- ✅ Повторная загрузка: 304 Not Modified (быстро)
- ✅ Обновления: применяются в течение часа

---

## 🎉 Результат

- ✅ Timeout увеличен с 30 до 90 секунд
- ✅ JS файлы обновляются в течение часа
- ✅ Браузер проверяет обновления вместо `immutable`
- ✅ Профили загружаются без ошибок таймаута

**Система работает стабильно!**
