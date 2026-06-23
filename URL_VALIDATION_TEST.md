# URL Validation Test - Проверка логики определения URL

## 1. axios.js - функция getApiUrl()

```javascript
const getApiUrl = () => {
  // Если задан в .env - используем его
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Иначе определяем автоматически по hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;  // http: или https:

  // Если локальная разработка - используем :5000
  if (hostname === 'localhost' || hostname.startsWith('192.168')) {
    return `${protocol}//${hostname}:5000/api`;
  }

  // Production - используем nginx (без порта)
  return `${protocol}//${hostname}/api`;
};
```

### Тестовые сценарии:

| VITE_API_URL | window.location.hostname | Результат |
|--------------|--------------------------|-----------|
| undefined    | localhost                | `http://localhost:5000/api` ✅ |
| undefined    | 192.168.0.41             | `http://192.168.0.41:5000/api` ✅ |
| undefined    | 148.251.233.7            | `http://148.251.233.7/api` ✅ |
| undefined    | diamond-agencystudio.com | `http://diamond-agencystudio.com/api` ✅ |
| ""           | 148.251.233.7            | `http://148.251.233.7/api` ✅ (пустая строка = falsy) |
| "http://custom.com/api" | любой     | `http://custom.com/api` ✅ |

## 2. SocketContext.jsx - функция getSocketUrl()

```javascript
const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Локальная разработка
  if (hostname === 'localhost' || hostname.startsWith('192.168')) {
    return `${protocol}//${hostname}:5000`;
  }
  
  // Production
  return `${protocol}//${hostname}`;
};
```

### Тестовые сценарии:

| VITE_API_URL | window.location.hostname | Результат |
|--------------|--------------------------|-----------|
| undefined    | localhost                | `http://localhost:5000` ✅ |
| undefined    | 192.168.0.41             | `http://192.168.0.41:5000` ✅ |
| undefined    | 148.251.233.7            | `http://148.251.233.7` ✅ |
| undefined    | diamond-agencystudio.com | `http://diamond-agencystudio.com` ✅ |
| ""           | 148.251.233.7            | `http://148.251.233.7` ✅ |
| "http://custom.com/api" | любой     | `http://custom.com` ✅ |

## 3. Проверка fallback значений

### В JavaScript:
```javascript
if (import.meta.env.VITE_API_URL)
```

Эта проверка вернёт **false** для:
- `undefined` ✅
- `null` ✅
- `""` (пустая строка) ✅
- `0` ✅
- `false` ✅

Вернёт **true** для:
- Любой непустой строки ✅
- Любое число кроме 0 ✅
- Объекты и массивы ✅

## 4. Проверка docker-compose.yml

```yaml
VITE_API_URL: ${VITE_API_URL:-}
```

Означает:
- Если переменная `VITE_API_URL` задана в `.env` → использовать её значение
- Если НЕ задана → использовать пустую строку `""`
- Пустая строка = falsy в JavaScript = сработает автоопределение ✅

## 5. Проверка .env файлов

### Корневой .env:
```bash
# VITE_API_URL=  # ❌ ПЛОХО - задана как пустая строка
# Правильно:
# VITE_API_URL=  # ✅ ХОРОШО - закомментирована
```

### frontend/.env:
```bash
# Все строки закомментированы ✅
```

## ✅ ИТОГОВАЯ ВАЛИДАЦИЯ:

### Сценарий 1: Production (сервер)
1. `.env` - `VITE_API_URL` закомментирована
2. `docker-compose.yml` - передаёт `""`
3. Vite при сборке: `import.meta.env.VITE_API_URL` = `undefined` или `""`
4. В runtime: проверка `if (import.meta.env.VITE_API_URL)` = **false**
5. Срабатывает: `return ${protocol}//${hostname}/api`
6. Результат: `http://148.251.233.7/api` ✅

### Сценарий 2: Локальная разработка
1. Frontend запускается через `npm run dev`
2. `.env` - `VITE_API_URL` не задана
3. `window.location.hostname` = `localhost`
4. Результат: `http://localhost:5000/api` ✅

### Сценарий 3: С явным URL
1. `.env` - `VITE_API_URL=http://custom.com/api`
2. Проверка = **true**
3. Результат: `http://custom.com/api` ✅

## 🎯 ВЫВОД:

**ВСЕ СЦЕНАРИИ ПОКРЫТЫ!** Логика правильная, fallback работает корректно.

**Единственное условие:** Frontend ДОЛЖЕН быть пересобран после изменений!
