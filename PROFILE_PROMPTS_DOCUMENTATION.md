# 🎭 Документация: Кастомные промпты для профилей

## 📋 Оглавление
- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Установка и использование](#установка-и-использование)
- [Формат JSON](#формат-json)
- [API и сервисы](#api-и-сервисы)
- [Тестирование](#тестирование)

---

## 🎯 Обзор

Система кастомных промптов позволяет настраивать уникальную личность и стиль общения для каждого профиля на Luxee.

### Основные особенности:

✅ **Индивидуальные промпты** - каждый профиль (по UID) может иметь свой промпт
✅ **Независимость от аккаунта** - промпт привязан к profileUid, не к аккаунту
✅ **Автозагрузка** - промпты загружаются автоматически при старте сервера
✅ **Fallback** - если промпта нет, используется дефолтный SYSTEM_PROMPT
✅ **Hot reload** - изменения в JSON применяются после перезапуска/перезагрузки
✅ **Docker-ready** - работает через volume mounting

---

## 🏗️ Архитектура

### Компоненты системы:

```
📁 backend/
├── 📁 src/
│   ├── 📁 models/
│   │   └── ProfilePrompt.js          # Mongoose модель
│   ├── 📁 services/
│   │   ├── profilePromptService.js   # Сервис для работы с промптами
│   │   └── 📁 aiService/
│   │       ├── promptBuilder.js      # ✅ Обновлён: использует getProfilePrompt()
│   │       └── responseGenerator.js  # ✅ Обновлён: await buildMessages()
│   └── index.js                      # ✅ Обновлён: автозагрузка при старте
├── 📁 prompts/
│   └── profiles.json                 # ✅ JSON с промптами
└── loadPrompts.js                    # ✅ Скрипт для ручной загрузки
```

### База данных:

```javascript
// Коллекция: profileprompts
{
  _id: ObjectId,
  profileUid: 608895,              // UID профиля (уникальный)
  profileName: "Mary",             // Имя для удобства
  customPrompt: "...",             // Полный промпт (заменяет SYSTEM_PROMPT)
  metadata: {                      // Дополнительные данные
    dateOfBirth: "August 16, 1987",
    zodiacSign: "Leo",
    // ...
  },
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Установка и использование

### Способ 1: Автозагрузка при старте (рекомендуется)

1. Создайте/отредактируйте файл `backend/prompts/profiles.json`
2. Перезапустите сервер:

```bash
# Локально
npm run dev

# Docker
docker-compose restart backend
```

Промпты будут загружены автоматически при старте.

### Способ 2: Ручная загрузка скриптом

```bash
# Локально
cd backend
node loadPrompts.js

# Docker
docker exec -it luxee-backend node loadPrompts.js
```

### Способ 3: Через код (программно)

```javascript
import { saveProfilePrompt } from './src/services/profilePromptService.js';

await saveProfilePrompt({
  profileUid: 608895,
  profileName: "Mary",
  customPrompt: "Your custom prompt here...",
  metadata: {
    dateOfBirth: "August 16, 1987",
    zodiacSign: "Leo"
  }
});
```

---

## 📄 Формат JSON

### Структура файла `backend/prompts/profiles.json`:

```json
{
  "profiles": [
    {
      "profileUid": 608895,
      "profileName": "Mary",
      "customPrompt": "## Role\nYou are playing the role of a woman...",
      "metadata": {
        "dateOfBirth": "August 16, 1987",
        "zodiacSign": "Leo",
        "height": "172 cm",
        "weight": "57 kg",
        "bodyType": "Slim",
        "occupation": "Chef",
        "interests": ["Fitness", "Music", "Cars"]
      }
    }
  ]
}
```

### Обязательные поля:

- `profileUid` (number) - UID профиля из Luxee (`profile.inner.uid`)
- `profileName` (string) - Имя профиля (для удобства)
- `customPrompt` (string) - Полный текст промпта (минимум 50 символов)

### Опциональные поля:

- `metadata` (object) - Дополнительная информация о профиле

---

## 🔧 API и сервисы

### profilePromptService

#### `getProfilePrompt(profileUid)`

Получает промпт для профиля. Возвращает кастомный или дефолтный.

```javascript
import { getProfilePrompt } from './services/profilePromptService.js';

const prompt = await getProfilePrompt(608895);
// Возвращает: кастомный промпт или SYSTEM_PROMPT
```

#### `saveProfilePrompt(data)`

Сохраняет/обновляет промпт для профиля.

```javascript
await saveProfilePrompt({
  profileUid: 608895,
  profileName: "Mary",
  customPrompt: "Your prompt...",
  metadata: {}
});
```

#### `loadPromptsFromJson(filePath)`

Загружает промпты из JSON файла.

```javascript
import { loadPromptsFromJson } from './services/profilePromptService.js';

const stats = await loadPromptsFromJson('./prompts/profiles.json');
console.log(stats);
// { total: 1, loaded: 1, errors: 0, skipped: 0 }
```

#### `getAllPrompts()`

Получает все активные промпты.

```javascript
const prompts = await getAllPrompts();
// [{ profileUid: 608895, profileName: "Mary", ... }]
```

#### `deleteProfilePrompt(profileUid)`

Удаляет промпт (мягкое удаление, isActive = false).

```javascript
await deleteProfilePrompt(608895);
```

#### `hasCustomPrompt(profileUid)`

Проверяет наличие кастомного промпта.

```javascript
const hasCustom = await hasCustomPrompt(608895);
// true или false
```

---

## 🔍 Как работает система

### 1. При генерации ответа AI:

```javascript
// aiService/responseGenerator.js
const messages = await buildMessages({
  profile: { uid: 608895, username: "Mary", ... },
  manMessage: "Hello!",
  // ...
});
```

### 2. promptBuilder получает промпт:

```javascript
// aiService/promptBuilder.js
const systemPrompt = await getProfilePrompt(profile?.uid);
// Если есть кастомный для 608895 - используется он
// Если нет - используется SYSTEM_PROMPT

messages.push({
  role: 'system',
  content: systemPrompt  // ← Кастомный или дефолтный
});
```

### 3. Логи показывают какой промпт используется:

```
📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Mary
  🆔 Profile UID: 608895
  🎯 System prompt type: CUSTOM    ← Используется кастомный!
```

---

## 🧪 Тестирование

### Проверка загрузки промптов:

1. Запустите сервер и проверьте логи:

```
[Server] ✓ MongoDB connected
[Server] Loading profile prompts from JSON...
[Profile Prompt] 📂 Loading prompts from: /app/prompts/profiles.json
[Profile Prompt] 📋 Found 1 profile(s) in JSON
[Profile Prompt] ✅ Saved prompt for profile 608895 (Mary)
[Profile Prompt] ✅ Load complete: { total: 1, loaded: 1, errors: 0, skipped: 0 }
[Server] ✓ Profile prompts loaded: 1/1 (0 errors, 0 skipped)
```

### Проверка использования промпта:

2. Отправьте сообщение от профиля Mary (UID 608895):

```
📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Mary
  🆔 Profile UID: 608895
  🎯 System prompt type: CUSTOM    ← Должно быть CUSTOM!
```

Если видите `DEFAULT` - промпт не загружен или UID не совпадает.

### Проверка через MongoDB:

```bash
# Локально
mongosh luxee

# Docker
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee

# Запросы
db.profileprompts.find()
db.profileprompts.findOne({ profileUid: 608895 })
db.profileprompts.countDocuments({ isActive: true })
```

---

## 📝 Добавление нового профиля

### Шаг 1: Определите UID профиля

UID берётся из Luxee:
- Смотрите список профилей слева на странице чатов
- Или через `modelsChat.getProfile.data[uid].inner.uid`
- **ВАЖНО:** Используйте `inner.uid`, не `outer[...].uid`!

### Шаг 2: Создайте промпт

Скопируйте шаблон из `profiles.json` и адаптируйте под новый профиль:

```json
{
  "profileUid": 123456,           // ← Ваш UID
  "profileName": "Oksana",        // ← Имя профиля
  "customPrompt": "## Role\n...", // ← Ваш промпт
  "metadata": { ... }
}
```

### Шаг 3: Добавьте в profiles.json

```json
{
  "profiles": [
    { /* Mary */ },
    { /* Oksana - новый профиль */ }
  ]
}
```

### Шаг 4: Загрузите промпты

```bash
# Вариант 1: Перезапуск
docker-compose restart backend

# Вариант 2: Ручная загрузка
docker exec -it luxee-backend node loadPrompts.js
```

---

## ⚠️ Важные замечания

### UID профиля

**ПРАВИЛЬНО:**
```javascript
const profileUid = profile.inner.uid;  // ← 608895
```

**НЕПРАВИЛЬНО:**
```javascript
const profileUid = profile.uid;        // ← Может быть outer UID!
const profileUid = profile.outer[...].uid;  // ← Это другой UID!
```

### Размер промпта

- Минимум: 50 символов (валидация в модели)
- Рекомендуется: 500-5000 символов
- Максимум: нет ограничения, но учитывайте лимиты AI API

### Производительность

- Промпты кешируются в БД (быстрая загрузка)
- Автозагрузка при старте не замедляет запуск
- `getProfilePrompt()` - быстрая операция (индекс по profileUid)

---

## 🐛 Troubleshooting

### Промпт не применяется

**Проблема:** В логах `System prompt type: DEFAULT` вместо `CUSTOM`

**Решения:**
1. Проверьте UID профиля - используете `inner.uid`?
2. Проверьте загрузку промптов в логах при старте сервера
3. Проверьте БД: `db.profileprompts.findOne({ profileUid: 608895 })`
4. Убедитесь что `isActive: true`

### JSON не загружается

**Проблема:** `No profile prompts JSON file found`

**Решения:**
1. Проверьте путь: `backend/prompts/profiles.json`
2. В Docker проверьте volume mounting в `docker-compose.yml`
3. Права доступа к файлу

### Ошибка валидации

**Проблема:** `customPrompt is required` или `minlength`

**Решения:**
1. Промпт должен быть минимум 50 символов
2. Проверьте все обязательные поля: `profileUid`, `profileName`, `customPrompt`

---

## 📚 Дополнительные ресурсы

- **Модель:** `backend/src/models/ProfilePrompt.js`
- **Сервис:** `backend/src/services/profilePromptService.js`
- **Пример JSON:** `backend/prompts/profiles.json`
- **Скрипт загрузки:** `backend/loadPrompts.js`

---

## ✅ Чек-лист внедрения

- [x] Создана модель ProfilePrompt
- [x] Создан сервис profilePromptService
- [x] Обновлён promptBuilder.js
- [x] Обновлён responseGenerator.js
- [x] Создан JSON с промптом Mary
- [x] Создан скрипт loadPrompts.js
- [x] Добавлена автозагрузка в index.js
- [x] Обновлён docker-compose.yml (volume mounting)
- [x] Создана документация

---

**Версия:** 1.0  
**Дата:** 04.07.2026  
**Автор:** Kiro AI
