# 🚀 Локальная разработка с видимым браузером

## 🎯 Цель
Запустить проект локально (БЕЗ Docker) чтобы:
- Видеть браузер Playwright в реальном времени
- Тестировать AI отправку сообщений
- Работать с админ панелью
- Видеть все логи в консоли

---

## ✅ Текущая конфигурация (уже настроена!)

### Backend `.env`:
```bash
NODE_ENV=development
BROWSER_HEADLESS=false     # ✅ Браузер будет ВИДИМЫМ
BROWSER_SLOW_MO=150        # ✅ Замедление для наблюдения
BROWSER_DEVTOOLS=false     # Можно true для DevTools
```

### Frontend `.env`:
```bash
# Пусто = автоопределение
# Для локальной разработки раскомментируй:
VITE_API_URL=http://localhost:5000/api
```

---

## 📋 Шаги для запуска

### Шаг 1: Запустить MongoDB
```powershell
# Вариант 1: Через Docker (проще)
docker run -d \
  --name luxee-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=passwordbasedb \
  mongo:latest

# Вариант 2: Локальный MongoDB (если установлен)
# mongod --dbpath C:\data\db
```

### Шаг 2: Настроить Frontend `.env`
```powershell
# Открыть файл
notepad frontend\.env
```

**Раскомментировать строку:**
```bash
VITE_API_URL=http://localhost:5000/api
```

### Шаг 3: Установить зависимости (если ещё не установлены)
```powershell
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install
```

### Шаг 4: Создать админ пользователя
```powershell
# В корне проекта
cd C:\Users\user\Desktop\Model-site

# Запустить скрипт
node backend/createAdmin.js

# Скопировать вывод (JSON с хешем пароля)
```

**Пример вывода:**
```json
{
  "email": "admin@luxee.io",
  "passwordHash": "$2b$10$...",
  "role": "admin",
  "createdAt": "2026-06-27T01:10:00.000Z"
}
```

### Шаг 5: Добавить админа в MongoDB

**Вариант A: MongoDB Compass (графический интерфейс)**
```
1. Открыть MongoDB Compass
2. Connect to: mongodb://admin:passwordbasedb@localhost:27017
3. Database: luxee
4. Collection: users
5. Insert Document → вставить JSON из шага 4
```

**Вариант B: Через командную строку**
```powershell
# Подключиться к MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p passwordbasedb --authenticationDatabase admin

# Переключиться на базу luxee
use luxee

# Вставить пользователя
db.users.insertOne({
  email: "admin@luxee.io",
  passwordHash: "$2b$10$...",  // ВАШ ХЕШ СЮДА!
  role: "admin",
  createdAt: new Date()
})

# Проверить
db.users.find({email: "admin@luxee.io"})

# Выйти
exit
```

### Шаг 6: Запустить Backend (в отдельном терминале)
```powershell
cd C:\Users\user\Desktop\Model-site\backend
npm run dev
```

**Ожидаемый вывод:**
```
[Server] Starting server...
[MongoDB] Connected to MongoDB
[Server] Server started on port 5000
[Browser Service] Initializing browser pool...
[Browser Service] Browser pool ready (headless: false)
```

### Шаг 7: Запустить Frontend (в другом терминале)
```powershell
cd C:\Users\user\Desktop\Model-site\frontend
npm run dev
```

**Ожидаемый вывод:**
```
VITE v5.x.x  ready in X ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Шаг 8: Открыть сайт
```powershell
# Автоматически откроет браузер
start http://localhost:5173
```

---

## 🔐 Вход в систему

1. Открыть `http://localhost:5173`
2. Нажать "Login"
3. Ввести:
   - **Email:** `admin@luxee.io`
   - **Password:** `admin123` (или тот что вы указали в createAdmin.js)
4. Нажать "Sign In"

---

## 🎭 Как увидеть браузер Playwright

### 1. Добавить Luxee аккаунт
```
1. Войти как админ
2. Перейти в Admin Panel
3. Add Luxee Account
4. Ввести email/password Luxee
5. Save
```

### 2. Включить AI для аккаунта
```
1. В списке аккаунтов найти нужный
2. Нажать кнопку AI (должна стать зелёной)
3. Подождать 2-3 секунды
```

### 3. Наблюдать за браузером
```
✅ Должно появиться окно браузера Chromium
✅ Браузер откроет luxee.io
✅ Выполнит автологин с вашими credentials
✅ Вы увидите все действия в реальном времени!
```

---

## 📊 Логи в консоли Backend

После включения AI вы увидите:
```
[Browser Service] 🌐 Creating AI context for account: 6a3...
[Browser Service] 🚀 Launching browser (headless: false)...
[Browser Service] ✅ Browser launched
[Luxee Login] 🔐 Logging into Luxee...
[Luxee Login] ✅ Login successful
[AI Auto] ========== Starting processing for email@example.com ==========
[AI Auto] Current URL: https://luxee.io/chats/...
[AI Auto] Active profile: Mary (608895)
```

---

## 🐛 Тестирование новых изменений

### Когда придёт новое сообщение:
```
[AI Auto] ✅ Found 1 unanswered chats on Mary
[AI Response Service] 📤 Starting message send with delivery verification...
[AI Response Service] 🔄 Send attempt 1/3...
[AI Response] 📍 Current chat BEFORE navigation: 2400232_2799389
[AI Response] 💬 Opening chat 2400232_2797375...
[AI Response] 📍 Current chat AFTER navigation: 2400232_2797375
[AI Response] ✅ Successfully navigated to chat 2400232_2797375
[AI Response] 📊 unAnswered BEFORE send: true
[AI Response] 📤 Calling modelsChat.sendMessage()... (attempt 1)
[AI Response] ⏳ Waiting 300ms for WebSocket update...
[AI Response] 📊 unAnswered AFTER send: false
[AI Response] ✅ Message delivered successfully (unAnswered=false)
[AI Response Service] ✅ Message delivered on attempt 1
```

**Вы увидите в браузере:**
1. Переход в чат
2. Печатание сообщения
3. Отправку
4. Обновление статуса unAnswered

---

## 🔧 Полезные настройки для разработки

### Ещё больше замедлить браузер (для детального наблюдения):
```bash
# backend/.env
BROWSER_SLOW_MO=500  # Было 150, стало 500ms
```

### Открыть DevTools автоматически:
```bash
# backend/.env
BROWSER_DEVTOOLS=true
```

### Отключить видимость браузера (вернуться к headless):
```bash
# backend/.env
BROWSER_HEADLESS=true
```

---

## 🎯 Workflow разработки

```powershell
# Terminal 1 - MongoDB
docker start luxee-mongodb

# Terminal 2 - Backend
cd backend
npm run dev

# Terminal 3 - Frontend
cd frontend
npm run dev

# Браузер
start http://localhost:5173
```

**Теперь:**
- ✅ Видите браузер в реальном времени
- ✅ Видите все логи
- ✅ Можете тестировать изменения
- ✅ Можете отлаживать проблемы

---

## 🚨 Troubleshooting

### MongoDB не подключается
```powershell
# Проверить что контейнер запущен
docker ps | findstr mongo

# Если нет - запустить
docker start luxee-mongodb

# Или создать новый
docker run -d --name luxee-mongodb -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=passwordbasedb \
  mongo:latest
```

### Frontend не видит Backend
```bash
# Проверить что раскомментирована строка в frontend/.env:
VITE_API_URL=http://localhost:5000/api

# Перезапустить frontend
# Ctrl+C в терминале
npm run dev
```

### Браузер не появляется
```bash
# Проверить backend/.env:
BROWSER_HEADLESS=false  # Должно быть false!

# Проверить логи backend
# Должно быть: "Browser launched (headless: false)"
```

### AI не включается
```bash
# Проверить что у вас установлен AI сервер
# Или измените в backend/.env на OpenAI:

AI_API_URL=https://api.openai.com/v1
AI_API_KEY=sk-proj-...
AI_MODEL=gpt-4o-mini
```

---

## ✅ Готово!

Теперь у вас полноценная локальная разработка с видимым браузером! 🎉
