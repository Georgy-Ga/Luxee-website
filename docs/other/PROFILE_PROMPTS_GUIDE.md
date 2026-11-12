# 🎭 Руководство: Кастомные промпты для профилей - Как использовать

## 🎯 Что это даёт?

Теперь **каждый профиль может иметь свою уникальную личность**:
- Mary (UID 608895) - Chef, элегантная, сенсуальная
- Yana (UID 605196) - использует стандартный промпт
- Oksana (любой другой UID) - использует стандартный промпт

**Система автоматически выбирает** нужный промпт при генерации ответа.

---

## 🚀 Быстрый старт на сервере

### Шаг 1: Запустить/перезапустить сервер

```bash
# Перезапустить backend контейнер
docker-compose restart backend

# Или полный перезапуск
docker-compose down
docker-compose up -d
```

### Шаг 2: Проверить логи

```bash
# Смотреть логи backend
docker-compose logs -f backend
```

Ищем в логах:
```
[Server] ✓ MongoDB connected
[Server] Loading profile prompts from JSON...
[Profile Prompt] 📂 Loading prompts from: /app/prompts/profiles.json
[Profile Prompt] 📋 Found 1 profile(s) in JSON
[Profile Prompt] ✅ Saved prompt for profile 608895 (Mary)
[Profile Prompt] ✅ Load complete: { total: 1, loaded: 1, errors: 0, skipped: 0 }
[Server] ✓ Profile prompts loaded: 1/1 (0 errors, 0 skipped)
```

✅ Если видишь это - промпты загружены!

### Шаг 3: Тестируем!

Отправь сообщение от любого мужчины профилю Mary. В логах увидишь:

```
📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Mary
  🆔 Profile UID: 608895
  🎯 System prompt type: CUSTOM    ← Видишь CUSTOM? Работает!
```

Если видишь `DEFAULT` - значит промпт не загрузился (см. Troubleshooting).

---

## 📂 Структура файлов

```
backend/
├── prompts/
│   └── profiles.json          ← Тут все промпты (редактируешь ТУТ)
├── src/
│   ├── models/
│   │   └── ProfilePrompt.js   ← Модель БД
│   └── services/
│       ├── profilePromptService.js  ← Логика работы
│       └── aiService/
│           └── promptBuilder.js     ← Использует промпты
└── loadPrompts.js             ← Скрипт загрузки
```

**ВАЖНО:** Редактируешь `backend/prompts/profiles.json` на ХОСТЕ (не в контейнере)!

---

## 🔧 Как работает система?

### 1. При старте сервера:

```
1. Сервер запускается
2. Подключается к MongoDB
3. Читает backend/prompts/profiles.json
4. Загружает все промпты в БД
5. Логирует результат
```

### 2. При генерации ответа AI:

```
Мужчина отправляет сообщение профилю Mary
  ↓
aiAutoResponseService обрабатывает
  ↓
aiResponseService.generateResponse()
  ↓
aiService.generateResponse()
  ↓
await buildMessages()  ← ТУТ магия!
  ↓
await getProfilePrompt(608895)  ← Запрос к БД
  ↓
Проверяет: есть ли в БД промпт для UID 608895?
  ├─ ✅ ДА → возвращает КАСТОМНЫЙ промпт Mary
  └─ ❌ НЕТ → возвращает ДЕФОЛТНЫЙ SYSTEM_PROMPT
  ↓
Отправляет к AI API с нужным промптом
  ↓
AI отвечает в стиле Mary (или стандартно)
```

### 3. Логирование:

Каждый раз при генерации ответа видишь:
```
📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Mary
  🆔 Profile UID: 608895
  🎯 System prompt type: CUSTOM или DEFAULT
```

---

## ✏️ Как добавить новый профиль?

### Пример: Добавить промпт для Oksana (UID 605210)

#### Шаг 1: Узнать UID профиля

Смотришь в Luxee на список профилей слева. Нужен **inner.uid**!

Или в логах найди:
```
[AI Auto] Active profile: Oksana (605210)
```

#### Шаг 2: Отредактировать JSON

```bash
# На хосте (НЕ в контейнере!)
nano backend/prompts/profiles.json
```

Добавляешь новый профиль:

```json
{
  "profiles": [
    {
      "profileUid": 608895,
      "profileName": "Mary",
      "customPrompt": "...",
      "metadata": { ... }
    },
    {
      "profileUid": 605210,
      "profileName": "Oksana",
      "customPrompt": "## Role\nYou are Oksana, a 32-year-old photographer...",
      "metadata": {
        "age": 32,
        "occupation": "Photographer",
        "city": "Lviv"
      }
    }
  ]
}
```

#### Шаг 3: Перезагрузить промпты

**Вариант А: Перезапуск контейнера (рекомендуется)**
```bash
docker-compose restart backend
```

**Вариант Б: Ручная загрузка (без перезапуска)**
```bash
docker exec -it luxee-backend node loadPrompts.js
```

#### Шаг 4: Проверить логи

```bash
docker-compose logs backend | grep "Profile Prompt"
```

Должно быть:
```
[Profile Prompt] ✅ Saved prompt for profile 605210 (Oksana)
```

#### Шаг 5: Тест

Отправь сообщение Oksana и проверь в логах:
```
🎯 System prompt type: CUSTOM
```

---

## 🔄 Как обновить существующий промпт?

### Например, изменить промпт Mary:

1. **Редактируешь** `backend/prompts/profiles.json`
2. **Перезапускаешь:** `docker-compose restart backend`
3. **Готово!** Новый промпт применится

**ВАЖНО:** При перезагрузке система ПЕРЕЗАПИСЫВАЕТ промпты в БД.

---

## 🗑️ Как удалить промпт?

### Вариант 1: Убрать из JSON и перезапустить

1. Удали профиль из `profiles.json`
2. Перезапусти: `docker-compose restart backend`
3. Старый промпт останется в БД, но не будет обновляться

### Вариант 2: Удалить из БД напрямую

```bash
# Зайти в MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee

# Удалить промпт
db.profileprompts.updateOne(
  { profileUid: 608895 },
  { $set: { isActive: false } }
)
```

---

## 🔍 Как проверить что в БД?

### Посмотреть все промпты:

```bash
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee

# Список всех активных промптов
db.profileprompts.find({ isActive: true }).pretty()

# Конкретный промпт
db.profileprompts.findOne({ profileUid: 608895 })

# Количество промптов
db.profileprompts.countDocuments({ isActive: true })
```

---

## 🐛 Troubleshooting

### Проблема: "System prompt type: DEFAULT" вместо CUSTOM

**Причины:**

1. **Промпт не загрузился**
   ```bash
   # Проверь логи при старте
   docker-compose logs backend | grep "Profile Prompt"
   ```
   
   Решение: Перезапусти `docker-compose restart backend`

2. **Неправильный UID**
   ```bash
   # Проверь какой UID использует AI
   docker-compose logs backend | grep "Profile UID"
   ```
   
   Решение: Убедись что UID в JSON совпадает с real UID профиля

3. **Промпт неактивен в БД**
   ```bash
   # Проверь БД
   docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee
   db.profileprompts.findOne({ profileUid: 608895 })
   ```
   
   Решение: Установи `isActive: true`

### Проблема: "No profile prompts JSON file found"

**Причина:** Файл не найден или volume не примонтирован

**Решение:**
```bash
# Проверь что файл существует
ls -la backend/prompts/profiles.json

# Проверь volume в docker-compose.yml
cat docker-compose.yml | grep prompts

# Должно быть:
# - ./backend/prompts:/app/prompts
```

### Проблема: Промпт не обновляется после изменения

**Решение:**
```bash
# Обязательно перезапустить backend!
docker-compose restart backend

# Или загрузить вручную
docker exec -it luxee-backend node loadPrompts.js
```

---

## 📊 Мониторинг

### Проверить работает ли система:

```bash
# 1. Проверить загрузку при старте
docker-compose logs backend | grep "Profile prompts loaded"

# 2. Проверить использование при генерации
docker-compose logs backend | grep "System prompt type"

# 3. Проверить БД
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee
db.profileprompts.countDocuments({ isActive: true })
```

### Логи в реальном времени:

```bash
# Следить за AI логами
docker-compose logs -f backend | grep "AI DEBUG"

# Следить за промптами
docker-compose logs -f backend | grep "Profile Prompt"
```

---

## 💡 Полезные команды

```bash
# Перезапустить backend
docker-compose restart backend

# Загрузить промпты вручную
docker exec -it luxee-backend node loadPrompts.js

# Посмотреть логи
docker-compose logs -f backend

# Войти в контейнер
docker exec -it luxee-backend sh

# Войти в MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee

# Посмотреть все промпты в БД
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee --eval "db.profileprompts.find().pretty()"

# Очистить все промпты (осторожно!)
docker exec -it luxee-mongodb mongosh -u admin -p changeme --authenticationDatabase admin luxee --eval "db.profileprompts.deleteMany({})"
```

---

## ✅ Чек-лист после деплоя

- [ ] Файл `backend/prompts/profiles.json` существует
- [ ] Volume `./backend/prompts:/app/prompts` в docker-compose.yml
- [ ] Backend контейнер перезапущен
- [ ] В логах видно "Profile prompts loaded: 1/1"
- [ ] При генерации ответа видно "System prompt type: CUSTOM"
- [ ] Mary отвечает в своём стиле (Chef, Forest Fairy)
- [ ] Другие профили используют DEFAULT промпт

---

## 🎓 Примеры использования

### Сценарий 1: Первый деплой

```bash
# 1. Убедись что файл есть
ls backend/prompts/profiles.json

# 2. Запусти систему
docker-compose up -d

# 3. Проверь логи
docker-compose logs backend | grep "Profile prompts loaded"

# 4. Тестируй - отправь сообщение Mary
```

### Сценарий 2: Добавление нового профиля

```bash
# 1. Отредактируй JSON
nano backend/prompts/profiles.json

# 2. Добавь новый профиль в массив "profiles"

# 3. Перезапусти
docker-compose restart backend

# 4. Проверь логи
docker-compose logs backend | tail -50

# 5. Тестируй новый профиль
```

### Сценарий 3: Обновление промпта Mary

```bash
# 1. Отредактируй JSON
nano backend/prompts/profiles.json

# 2. Измени customPrompt для Mary

# 3. Перезапусти
docker-compose restart backend

# 4. Готово! Новый промпт применён
```

---

## 🎯 Итоги

**Что делает система:**
- ✅ Автоматически загружает промпты при старте
- ✅ Выбирает нужный промпт для каждого профиля
- ✅ Fallback на дефолтный если промпта нет
- ✅ Логирует всё что происходит
- ✅ Работает без изменения кода

**Что нужно делать:**
1. Редактировать `backend/prompts/profiles.json`
2. Перезапускать backend: `docker-compose restart backend`
3. Проверять логи
4. Тестировать

**Всё!** Система работает автоматически! 🎉

---

**Версия:** 1.0  
**Дата:** 04.07.2026  
**Автор:** Kiro AI
