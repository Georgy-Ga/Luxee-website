# Неиспользуемые файлы

После рефакторинга следующие файлы больше не используются и могут быть удалены:

## ❌ Устаревшие файлы

### 1. `src/services/luxeeApi/browserManager.js`
**Причина:** Заменён на `src/services/browser/browserService.js`

**Что изменилось:**
- Старый: Браузер для каждого пользователя (userId)
- Новый: Один браузер с контекстами для каждого аккаунта (accountId)

**Можно удалить:** ✅

---

### 2. `delete`
**Причина:** Временный файл, содержит только слово "MongoDB"

**Можно удалить:** ✅

---

## ⚠️ Временные файлы (если были созданы ранее)

Эти файлы могли быть созданы во время тестирования:

- `testApi.js` - старый тест API (заменён на `testRefactored.js`)
- `testLuxee.js` - старый тест Luxee (заменён на `testRefactored.js`)
- `installBrowsers.js` - скрипт установки браузеров (больше не нужен)
- `installPlaywright.bat` - bat файл установки (больше не нужен)

**Проверьте наличие и удалите если есть:** ⚠️

---

## ✅ Используемые файлы

Эти файлы **НЕ УДАЛЯТЬ**:

### Корневые файлы
- ✅ `index.js` - точка входа сервера
- ✅ `package.json` - зависимости проекта
- ✅ `package-lock.json` - lock файл npm
- ✅ `.env` - переменные окружения
- ✅ `createAdmin.js` - скрипт создания админа
- ✅ `testRefactored.js` - новый тестовый скрипт

### Папки
- ✅ `src/` - исходный код
- ✅ `docs/` - документация
- ✅ `node_modules/` - зависимости

---

## 🗑️ Команды для удаления

### Windows PowerShell:
```powershell
# Удалить устаревший browserManager
Remove-Item backend\src\services\luxeeApi\browserManager.js

# Удалить временный файл
Remove-Item backend\delete

# Удалить старые тесты (если есть)
Remove-Item backend\testApi.js -ErrorAction SilentlyContinue
Remove-Item backend\testLuxee.js -ErrorAction SilentlyContinue
Remove-Item backend\installBrowsers.js -ErrorAction SilentlyContinue
Remove-Item backend\installPlaywright.bat -ErrorAction SilentlyContinue
```

### Linux/Mac:
```bash
# Удалить устаревший browserManager
rm backend/src/services/luxeeApi/browserManager.js

# Удалить временный файл
rm backend/delete

# Удалить старые тесты (если есть)
rm -f backend/testApi.js
rm -f backend/testLuxee.js
rm -f backend/installBrowsers.js
rm -f backend/installPlaywright.bat
```

---

## 📊 Итого

**Обязательно удалить:**
- `src/services/luxeeApi/browserManager.js` (заменён)
- `delete` (мусор)

**Проверить и удалить если есть:**
- Старые тестовые файлы
- Временные скрипты установки

**После удаления:**
- Перезапустите сервер
- Запустите тесты: `node backend/testRefactored.js`
- Убедитесь что всё работает
