# 🔧 Руководство по локальному дебагу на Windows

**Для разработки и отладки AI системы с видимыми браузерными контекстами**

---

## 📋 Содержание

1. [Подготовка окружения](#подготовка-окружения)
2. [Запуск проекта локально](#запуск-проекта-локально)
3. [Включение видимых контекстов](#включение-видимых-контекстов)
4. [Создание тестового пользователя](#создание-тестового-пользователя)
5. [Мониторинг логов](#мониторинг-логов)
6. [Отладка через DevTools](#отладка-через-devtools)
7. [Полезные команды](#полезные-команды)

---

## 1. Подготовка окружения

### Требования:
- **Node.js** 18+ 
- **Docker Desktop** для Windows
- **MongoDB** (через Docker)
- **Git**

### Проверка установленных компонентов:

```powershell
# PowerShell
node --version   # v18.x.x или выше
npm --version    # 9.x.x или выше
docker --version # 24.x.x или выше
git --version    # 2.x.x
```

---

## 2. Запуск проекта локально

### Шаг 1: Клонирование (если ещё не сделано)

```powershell
cd C:\Users\user\Desktop
git clone https://github.com/Georgy-Ga/Luxee-website.git Model-site
cd Model-site
```

### Шаг 2: Установка зависимостей

```powershell
# Backend
cd backend
npm install

# Frontend (в новом окне PowerShell)
cd C:\Users\user\Desktop\Model-site\frontend
npm install
```

### Шаг 3: Запуск MongoDB через Docker

```powershell
# В корне проекта
cd C:\Users\user\Desktop\Model-site

# Запустить только MongoDB
docker-compose up -d mongodb
```

Проверка:
```powershell
docker ps
# Должен быть запущен контейнер: luxee-mongodb
```

### Шаг 4: Настройка .env файлов

**Backend: `backend/.env`**
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/luxee

# JWT
JWT_SECRET=your-secret-key-here

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Anthropic (Claude)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Server
PORT=5000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Admin credentials
ADMIN_EMAIL=admin@luxee.com
ADMIN_PASSWORD=admin123

# 🔧 РЕЖИМ РАЗРАБОТКИ - Видимые браузерные контексты
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_DEVTOOLS=true
PLAYWRIGHT_SLOW_MO=100

# 🐛 DEBUG MODE - Блокировка отправки сообщений
AI_DEBUG_MODE=true
```

**Frontend: `frontend/.env`**
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

---

## 3. Включение видимых контекстов

### ✅ Уже настроено в backend/.env:

```env
# 🔧 РЕЖИМ РАЗРАБОТКИ
PLAYWRIGHT_HEADLESS=false    # Браузер будет видимым
PLAYWRIGHT_DEVTOOLS=true     # Откроет DevTools
PLAYWRIGHT_SLOW_MO=100       # Замедление действий (100ms)
```

### Дополнительно: Настройка в browserConfig.js

**Файл:** `backend/src/config/browserConfig.js`

```javascript
const browserConfig = {
  // ... 
  
  // 🔧 Для дебага - увеличьте slowMo
  slowMo: process.env.NODE_ENV === 'development' ? 500 : 0, // 500ms для дебага
  
  // ... остальные настройки
};
```

### Что это даёт:

- ✅ **Видимые браузерные окна** - вы видите что делает AI
- ✅ **DevTools открыты** - можно смотреть консоль, Network, Elements
- ✅ **Замедленные действия** - видно каждое действие AI
- ✅ **Доступ к `window.modelsChat`** - можно тестировать в консоли

---

## 4. Создание тестового пользователя

### Вариант 1: Через скрипт PowerShell

**Файл:** `create-admin.ps1` (уже есть в проекте)

```powershell
# В корне проекта
cd C:\Users\user\Desktop\Model-site

# Запустить скрипт
.\create-admin.ps1

# Следуйте инструкциям:
# Email: test@test.com
# Password: test123
```

### Вариант 2: Через Node.js скрипт

**Создать файл:** `backend/createTestUser.js`

```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import UserModel from './src/models/UserModel.js';
import dotenv from 'dotenv';

dotenv.config();

const createTestUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'test@test.com';
    const password = 'test123';
    
    // Проверяем существование
    const existing = await UserModel.findOne({ email });
    if (existing) {
      console.log('User already exists!');
      console.log('Email:', email);
      console.log('Password:', password);
      process.exit(0);
    }

    // Создаём пользователя
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      email,
      password: hashedPassword,
      isAdmin: false,
      createdAt: new Date(),
    });

    console.log('✅ Test user created!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', user._id);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createTestUser();
```

Запуск:
```powershell
cd backend
node createTestUser.js
```

### Вариант 3: Через API после запуска

```powershell
# После запуска backend (см. шаг 5)
curl -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"test123"}'
```

---

## 5. Запуск проекта

### Терминал 1: Backend

```powershell
cd C:\Users\user\Desktop\Model-site\backend
npm run dev
```

**Ожидаемый вывод:**
```
[INFO] Connected to MongoDB
[INFO] Server running on port 5000
[INFO] WebSocket server ready
```

### Терминал 2: Frontend

```powershell
cd C:\Users\user\Desktop\Model-site\frontend
npm run dev
```

**Ожидаемый вывод:**
```
VITE v4.x.x  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Проверка:

1. Откройте: http://localhost:5173
2. Войдите: `test@test.com` / `test123`
3. Добавьте Luxee аккаунт
4. Включите AI для аккаунта

---

## 6. Мониторинг логов

### Основные логи (в терминале backend):

```
[AI Auto] ========== Starting processing for translator.30@gmail.com ==========
[AI Auto] Current URL: https://luxee.io/chats/...
[AI Auto] Active profile: Mary (608895)
[AI Auto] Found 2 unanswered chats on Mary
[Pending] 📅 Scheduling response for Bigdockdaddy in 12 seconds...
[Pending] ⏰ Time's up! Executing scheduled response...
[Pending] 🌐 Navigating to: https://luxee.io/chats/?ownerUid=608895&profileUid=2400232&userUid=2797375
[Pending] ✅ Successfully navigated to chat 2400232_2797375
[Pending] 📜 Checking unAnswered status...
[Pending] 📊 Chat status: { identity: '2400232_2797375', unAnswered: false }
[Pending] 🔍 Check result: SKIP ❌
[Pending] 📝 Reason: unAnswered is false - already replied
```

### Фильтрация логов:

```powershell
# Только AI логи
npm run dev | Select-String "AI Auto"

# Только Pending логи
npm run dev | Select-String "Pending"

# Ошибки
npm run dev | Select-String "ERROR|Error|❌"
```

---

## 7. Отладка через DevTools

### Когда браузерные окна открыты (PLAYWRIGHT_HEADLESS=false):

1. **Откроется окно браузера** с Luxee.io
2. **DevTools уже открыты** (если PLAYWRIGHT_DEVTOOLS=true)
3. **Вкладка Console** - видны все логи

### Полезные команды в Console:

```javascript
// 1. Проверить активный профиль
window.modelsChat.getProfile.active
// → { inner: { uid: 608895, username: "Mary", ... }, ... }

// 2. Проверить активный чат
window.modelsChat.getChats.active
// → { identity: "2400232_2797375", unAnswered: false, members: [...], ... }

// 3. Получить историю активного чата
const chatId = window.modelsChat.getChats.active.identity;
window.modelsChat.getChat.list[chatId]
// → [ { body: "...", author: { gender: 1, ... }, ... }, ... ]

// 4. Проверить все профили
window.modelsChat.getProfile.data
// → { 608895: { inner: {...}, outer: {...}, newMessages: 2 }, ... }

// 5. Проверить все чаты текущего профиля
window.modelsChat.getChats.list
// → { "2400232_2797375": { unAnswered: false, members: [...], ... }, ... }

// 6. Количество unread
window.modelsChat.getProfile.active.newMessages
// → 5

// 7. Последнее сообщение в активном чате
const msgs = window.modelsChat.getChat.list[chatId];
const last = msgs[msgs.length - 1];
console.log('Last:', last.author.first_name, '-', last.body);
console.log('Gender:', last.author.gender); // 1=male, 2=female
```

### Отладка навигации:

```javascript
// Текущий URL
window.location.href

// Перейти к чату вручную
const targetUrl = 'https://luxee.io/chats/?ownerUid=608895&profileUid=2400232&userUid=2797375';
window.location.href = targetUrl;

// Проверить после загрузки
window.modelsChat.getChats.active.identity
// → "2400232_2797375"
```

---

## 8. Полезные команды

### Docker команды:

```powershell
# Посмотреть запущенные контейнеры
docker ps

# Посмотреть логи MongoDB
docker logs luxee-mongodb

# Перезапустить MongoDB
docker-compose restart mongodb

# Остановить всё
docker-compose down

# Очистить всё (включая volumes)
docker-compose down -v
```

### MongoDB команды:

```powershell
# Подключиться к MongoDB
docker exec -it luxee-mongodb mongosh

# В mongosh:
use luxee
db.users.find()                    # Все пользователи
db.luxeeaccounts.find()            # Все аккаунты
db.luxeeaccounts.find({aiEnabled: true})  # Аккаунты с AI

# Включить AI для аккаунта
db.luxeeaccounts.updateOne(
  { luxeeEmail: "translator.30@gmail.com" },
  { $set: { aiEnabled: true, aiEnabledByAdmin: true } }
)

# Выход
exit
```

### Git команды:

```powershell
# Текущий статус
git status

# Посмотреть изменения
git diff backend/src/services/aiAutoResponseService.js

# Откатить изменения (ОСТОРОЖНО!)
git checkout backend/src/services/aiAutoResponseService.js

# Создать коммит
git add .
git commit -m "Fix: AI pending infinite loop"
git push origin main
```

---

## 9. Тестовый сценарий

### Полный цикл тестирования:

1. **Запустить проект:**
   ```powershell
   # Терминал 1
   cd backend
   npm run dev
   
   # Терминал 2
   cd frontend
   npm run dev
   ```

2. **Войти в систему:**
   - http://localhost:5173
   - Email: `test@test.com`
   - Password: `test123`

3. **Добавить Luxee аккаунт:**
   - Settings → Add Account
   - Email: ваш Luxee email
   - Пароль: ваш Luxee пароль
   - Сохранить

4. **Включить AI:**
   - Нажать "Enable AI" для аккаунта
   - AI статус: ✅ Enabled

5. **Наблюдать в терминале:**
   ```
   [AI Auto Response] Starting for account...
   [AI Auto Response] AI context ready...
   [AI Auto] ========== Starting processing...
   ```

6. **Откроется браузерное окно:**
   - Видно как AI логинится
   - Переходит к чатам
   - Ищет unanswered сообщения

7. **В DevTools Console:**
   ```javascript
   // Проверить что видит AI
   window.modelsChat.getChats.list
   window.modelsChat.getProfile.active
   ```

8. **Мониторить pending responses:**
   ```
   [Pending] 📅 Scheduling response for John in 12 seconds...
   [Pending] ⏰ Time's up! Executing...
   [Pending] 🌐 Navigating to: https://luxee.io/chats/...
   [Pending] ✅ Successfully navigated
   [Pending] 📜 Checking unAnswered status...
   [Pending] 📊 Chat status: { unAnswered: true }
   [Pending] 📜 Extracting chat history...
   [Pending] ✅ Last message from man (gender=1)
   [Pending] 💬 Generating AI response...
   ```

9. **Проверить отправку:**
   - В DevTools видно Network request к `/chats/sendMessage`
   - В логах: `[Pending] ✅ Successfully sent AI response`

---

## 10. Отключение функций для тестирования

### Отключить отправку сообщений (только генерация):

**backend/.env:**
```env
AI_DEBUG_MODE=true
```

**Что делает:**
- AI будет находить чаты
- Генерировать ответы
- НО НЕ отправлять их
- Логи: `🐛 [DEBUG MODE] Would send message: "..."`

### Отключить AI полностью:

**backend/src/services/aiAutoResponseService.js:**
```javascript
const AI_AUTO_RESPONSE_GLOBALLY_DISABLED = true; // было false
```

### Изменить задержку pending responses:

**backend/src/services/aiAutoResponseService.js:**
```javascript
// Строка ~669
const randomDelay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 10000;
// Изменить на:
const randomDelay = 5000; // 5 секунд для быстрого тестирования
```

---

## 11. Частые проблемы

### Проблема: Браузер не открывается

**Решение:**
```env
# backend/.env
PLAYWRIGHT_HEADLESS=false
```

Перезапустить backend.

### Проблема: DevTools не открываются

**Решение:**
```env
# backend/.env
PLAYWRIGHT_DEVTOOLS=true
```

### Проблема: MongoDB не подключается

**Решение:**
```powershell
# Проверить статус
docker ps

# Если нет luxee-mongodb:
docker-compose up -d mongodb

# Проверить логи
docker logs luxee-mongodb
```

### Проблема: AI не находит чаты

**Решение:**
1. Открыть DevTools в браузере AI
2. В Console проверить:
   ```javascript
   window.modelsChat.getChats.list
   // Должен быть объект с чатами
   ```
3. Если пустой - подождать загрузки (3-5 секунд)

### Проблема: "unAnswered is false" но чат требует ответа

**Решение:**
Это нормально! Значит:
- Сообщение УЖЕ было отправлено
- Luxee API ещё не обновил статус
- Проверка работает правильно - пропускаем дубликаты

---

## 12. Полезные ссылки

- **MongoDB Compass:** https://www.mongodb.com/try/download/compass
  - Графический интерфейс для MongoDB
  - Connection string: `mongodb://localhost:27017/luxee`

- **Postman/Insomnia:** Для тестирования API
  - Base URL: `http://localhost:5000`

- **VS Code Extensions:**
  - MongoDB for VS Code
  - Docker
  - REST Client

---

## Чек-лист перед дебагом

- [ ] MongoDB запущен (`docker ps`)
- [ ] Backend запущен (`npm run dev` в backend)
- [ ] Frontend запущен (`npm run dev` в frontend)
- [ ] `.env` файлы настроены
- [ ] `PLAYWRIGHT_HEADLESS=false` в backend/.env
- [ ] `AI_DEBUG_MODE=true` для безопасного тестирования
- [ ] Тестовый пользователь создан
- [ ] Luxee аккаунт добавлен
- [ ] AI включен для аккаунта

---

**Готово! Теперь вы можете:**
- ✅ Видеть все браузерные контексты AI
- ✅ Отлаживать через DevTools
- ✅ Мониторить логи в реальном времени
- ✅ Тестировать без отправки сообщений
- ✅ Быстро создавать тестовых пользователей

**Удачной отладки! 🚀**
