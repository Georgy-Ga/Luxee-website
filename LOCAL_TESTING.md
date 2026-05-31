# 🖥️ Тестирование Docker на локальном ПК (Windows)

Инструкция по тестированию Docker конфигурации на вашем Windows ПК перед развертыванием на сервер.

---

## 📋 Содержание

1. [Вариант 1: С новой MongoDB в Docker](#вариант-1-с-новой-mongodb-в-docker)
2. [Вариант 2: С существующей MongoDB](#вариант-2-с-существующей-mongodb)
3. [Проверка работоспособности](#проверка-работоспособности)
4. [Остановка и очистка](#остановка-и-очистка)

---

## Вариант 1: С новой MongoDB в Docker

Самый простой способ - использовать MongoDB из docker-compose.

### Шаг 1: Подготовка

```powershell
# Убедитесь что вы в директории проекта
cd C:\Users\user\Desktop\Model-site

# Проверьте что Docker запущен
docker --version
docker compose version
```

### Шаг 2: Создание .env файла

⚠️ **ВАЖНО:** Для Docker нужен ТОЛЬКО ОДИН файл `.env` в корне проекта!

#### 2.1. Создайте файл .env

```powershell
# Скопируйте пример
copy .env.example .env
```

#### 2.2. Откройте файл для редактирования

```powershell
# Откройте в блокноте
notepad .env

# Или в VS Code
code .env
```

#### 2.3. Заполните обязательные переменные

**Файл:** `C:\Users\user\Desktop\Model-site\.env`

```env
# ============================================
# MongoDB Configuration
# ============================================
# Логин администратора MongoDB (можно оставить как есть)
MONGO_ROOT_USERNAME=admin

# Пароль для MongoDB (для теста можно простой)
MONGO_ROOT_PASSWORD=test123

# ============================================
# JWT Secrets (для авторизации пользователей)
# ============================================
# Секрет для access токенов (для теста можно простой)
JWT_ACCESS_SECRET=test_access_secret_123

# Секрет для refresh токенов (для теста можно простой)
JWT_REFRESH_SECRET=test_refresh_secret_456

# ============================================
# OpenAI Configuration
# ============================================
# ВАШ РЕАЛЬНЫЙ КЛЮЧ от OpenAI (получите на platform.openai.com)
OPENAI_API_KEY=sk-proj-ваш-настоящий-ключ-здесь

# Модель OpenAI (можно оставить как есть)
OPENAI_MODEL=gpt-4o-mini

# ============================================
# Frontend Configuration
# ============================================
# URL для подключения frontend к backend
# Для локального тестирования используйте localhost
VITE_API_URL=http://localhost:5000/api

# ============================================
# CORS Configuration
# ============================================
# Разрешенные origins для CORS
# Для локального тестирования добавьте все варианты localhost
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://localhost:5173

# ============================================
# Environment (оставьте пустым для development)
# ============================================
# NODE_ENV=development  # Браузер будет видимым
# NODE_ENV=production   # Браузер будет в headless режиме
```

#### 2.4. Сохраните файл

**Нажмите:** `Ctrl + S` или `Файл → Сохранить`

#### 2.5. Проверьте что файл создан

```powershell
# Проверьте что файл существует
dir .env

# Посмотрите содержимое
type .env
```

**✅ Готово!** Теперь у вас есть файл `.env` в корне проекта.

#### ❌ НЕ НУЖНО создавать:
- ❌ `backend/.env` - НЕ нужен для Docker
- ❌ `frontend/.env` - НЕ нужен для Docker

Docker автоматически передаст переменные из корневого `.env` в контейнеры!

### Шаг 3: Запуск

```powershell
# Запустите все сервисы
docker compose up -d

# Или с просмотром логов
docker compose up
```

**Первый запуск займет 5-10 минут** (скачивание образов и сборка).

### Шаг 4: Проверка статуса

```powershell
# Проверьте что все контейнеры запущены
docker compose ps

# Должны быть запущены:
# - luxee-mongodb
# - luxee-backend
# - luxee-frontend
```

### Шаг 5: Создание администратора

#### Способ 1: Через CLI (рекомендуется)

```powershell
# Сгенерируйте данные для админа
docker exec luxee-backend node createAdmin.js

# Скопируйте JSON из вывода и вставьте в MongoDB
docker exec luxee-mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ_ИЗ_ENV --authenticationDatabase admin luxee --eval "db.users.insertOne({email: 'admin@example.com', password: 'ХЕША_ИЗ_ВЫВОДА', role: 'admin'})"
```

**Пример:**
```powershell
# 1. Получите хеш пароля
docker exec luxee-backend node createAdmin.js

# Вывод будет примерно таким:
# === JSON для MongoDB Compass ===
# {
#   "email": "admin@example.com",
#   "password": "$2b$04$XyOmt7rICGtrgo5Sh9Td0Ot4fDcw4mRwFMlG7ajqLHRb77wAtZ3Sa",
#   "role": "admin"
# }

# 2. Вставьте админа в базу (замените пароль на свой из .env)
docker exec luxee-mongodb mongosh -u admin -p admin --authenticationDatabase admin luxee --eval "db.users.insertOne({email: 'admin@example.com', password: '\$2b\$04\$XyOmt7rICGtrgo5Sh9Td0Ot4fDcw4mRwFMlG7ajqLHRb77wAtZ3Sa', role: 'admin'})"
```

⚠️ **ВАЖНО:** Замените `admin` после `-p` на ваш `MONGO_ROOT_PASSWORD` из `.env`!

#### Способ 2: Через MongoDB Compass (GUI)

```powershell
# 1. Сгенерируйте данные
docker exec luxee-backend node createAdmin.js

# 2. Откройте MongoDB Compass
# 3. Подключитесь: mongodb://admin:password@localhost:27017
# 4. Выберите базу: luxee
# 5. Коллекция: users
# 6. Вставьте JSON из вывода команды
```

#### Способ 3: Внутри контейнера (интерактивно)

```powershell
# Войдите в контейнер backend
docker exec -it luxee-backend sh

# Внутри контейнера создайте админа
node createAdmin.js

# Выйдите из контейнера
exit
```

### Шаг 6: Тестирование

Откройте браузер:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:5000/api/health

---

## Вариант 2: С существующей MongoDB

Если у вас уже есть MongoDB в Docker контейнере, можно подключиться к ней.

### Шаг 1: Узнать параметры существующей MongoDB

```powershell
# Найдите ваш MongoDB контейнер
docker ps | findstr mongo

# Посмотрите детали контейнера
docker inspect ИМЯ_ВАШЕГО_MONGO_КОНТЕЙНЕРА
```

Вам нужно узнать:
- Имя контейнера
- Порт (обычно 27017)
- Имя сети Docker (если есть)

### Шаг 2: Изменить docker-compose.yml

Откройте `docker-compose.yml` и закомментируйте MongoDB сервис:

```yaml
services:
  # Закомментируйте MongoDB если используете существующий
  # mongodb:
  #   image: mongo:7
  #   container_name: luxee-mongodb
  #   ...

  backend:
    build: ./backend
    container_name: luxee-backend
    environment:
      # Измените MONGO_URL на ваш существующий MongoDB
      MONGO_URL: mongodb://admin:password@ИМЯ_ВАШЕГО_MONGO_КОНТЕЙНЕРА:27017/luxee?authSource=admin
    # Добавьте external_links если MongoDB в другой сети
    external_links:
      - ИМЯ_ВАШЕГО_MONGO_КОНТЕЙНЕРА:mongodb
```

### Шаг 3: Настроить .env

```env
# MongoDB Configuration (параметры вашей существующей MongoDB)
MONGO_ROOT_USERNAME=ваш_логин
MONGO_ROOT_PASSWORD=ваш_пароль

# JWT Secrets
JWT_ACCESS_SECRET=test_access_secret_123
JWT_REFRESH_SECRET=test_refresh_secret_456

# OpenAI Configuration
OPENAI_API_KEY=sk-ваш-ключ
OPENAI_MODEL=gpt-4o-mini

# Frontend API URL
VITE_API_URL=http://localhost:5000/api

# CORS Origins
ALLOWED_ORIGINS=http://localhost,http://localhost:80
```

### Шаг 4: Подключить к сети MongoDB (если нужно)

```powershell
# Узнайте имя сети вашей MongoDB
docker network ls
docker inspect ИМЯ_ВАШЕГО_MONGO_КОНТЕЙНЕРА | findstr NetworkMode

# Добавьте backend и frontend в эту сеть
# В docker-compose.yml добавьте:
```

```yaml
networks:
  default:
    external: true
    name: ИМЯ_СЕТИ_ВАШЕЙ_MONGODB
```

### Шаг 5: Запуск без MongoDB

```powershell
# Запустите только backend и frontend
docker compose up -d backend frontend
```

---

## Вариант 3: Гибридный (Docker + локальный запуск)

Можно запустить только MongoDB в Docker, а backend и frontend локально (как вы работали раньше).

### Шаг 1: Создать .env в корне для MongoDB

**Файл:** `C:\Users\user\Desktop\Model-site\.env`

```env
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=test123
```

### Шаг 2: Запустить только MongoDB

```powershell
# Запустите только MongoDB
docker compose up -d mongodb

# Проверьте что MongoDB запущена
docker compose ps mongodb
```

### Шаг 3: Создать backend/.env для локального запуска

⚠️ **ВНИМАНИЕ:** Теперь нужен отдельный файл для backend!

**Файл:** `C:\Users\user\Desktop\Model-site\backend\.env`

```env
# ============================================
# Backend Configuration (локальный запуск)
# ============================================

# Порт backend сервера
PORT=5000

# Режим разработки (браузер будет видимым)
NODE_ENV=development

# ============================================
# MongoDB Connection
# ============================================
# Подключение к MongoDB в Docker
# Используйте пароль из корневого .env
MONGO_URL=mongodb://admin:test123@localhost:27017/luxee?authSource=admin

# ============================================
# JWT Secrets
# ============================================
JWT_ACCESS_SECRET=test_access_secret_123
JWT_REFRESH_SECRET=test_refresh_secret_456

# ============================================
# OpenAI Configuration
# ============================================
# ВАШ РЕАЛЬНЫЙ КЛЮЧ
OPENAI_API_KEY=sk-proj-ваш-настоящий-ключ

# Модель
OPENAI_MODEL=gpt-4o-mini

# ============================================
# Browser Configuration
# ============================================
# Браузер будет видимым (удобно для отладки)
BROWSER_HEADLESS=false
```

### Шаг 4: Запустить backend локально

```powershell
# Откройте новый терминал PowerShell
cd C:\Users\user\Desktop\Model-site\backend

# Установите зависимости (если еще не установлены)
npm install

# Запустите backend
npm start
```

**Вы увидите:**
```
Server running on port 5000
Connected to MongoDB
```

### Шаг 5: Создать frontend/.env для локального запуска

**Файл:** `C:\Users\user\Desktop\Model-site\frontend\.env`

```env
# ============================================
# Frontend Configuration (локальный запуск)
# ============================================

# URL для подключения к backend
VITE_API_URL=http://localhost:5000/api
```

### Шаг 6: Запустить frontend локально

```powershell
# Откройте еще один терминал PowerShell
cd C:\Users\user\Desktop\Model-site\frontend

# Установите зависимости (если еще не установлены)
npm install

# Запустите frontend
npm run dev
```

**Вы увидите:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### Шаг 7: Откройте в браузере

Frontend будет доступен на: **http://localhost:5173**

### 📁 Итоговая структура файлов:

```
C:\Users\user\Desktop\Model-site\
├── .env                    ← Для Docker MongoDB
├── backend\
│   └── .env               ← Для локального backend
└── frontend\
    └── .env               ← Для локального frontend
```

---

## Проверка работоспособности

### 1. Проверка контейнеров

```powershell
# Статус всех контейнеров
docker compose ps

# Логи backend
docker compose logs -f backend

# Логи frontend
docker compose logs -f frontend

# Логи MongoDB
docker compose logs -f mongodb
```

### 2. Проверка портов

```powershell
# Проверьте что порты открыты
netstat -an | findstr "80 5000 27017"
```

Должны быть:
- `0.0.0.0:80` - Frontend
- `0.0.0.0:5000` - Backend
- `0.0.0.0:27017` - MongoDB

### 3. Проверка API

```powershell
# Проверка backend health
curl http://localhost:5000/api/health

# Или в браузере откройте:
# http://localhost:5000/api/health
```

### 4. Проверка frontend

Откройте в браузере: http://localhost

Должна открыться страница входа.

### 5. Проверка MongoDB

```powershell
# Подключитесь к MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p password

# Внутри mongosh:
show dbs
use luxee
show collections
exit
```

### 6. Проверка браузера (headless)

```powershell
# Проверьте переменные окружения backend
docker exec luxee-backend env | findstr NODE_ENV

# Если NODE_ENV=development - браузер будет видимым
# Если NODE_ENV=production - браузер в headless режиме
```

---

## Остановка и очистка

### Остановка контейнеров

```powershell
# Остановить все контейнеры
docker compose down

# Остановить и удалить volumes (ОСТОРОЖНО! Удалит данные)
docker compose down -v
```

### Перезапуск после изменений

```powershell
# Пересобрать и перезапустить
docker compose up -d --build

# Перезапустить только backend
docker compose restart backend

# Перезапустить только frontend
docker compose restart frontend
```

### Просмотр использования ресурсов

```powershell
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df
```

### Очистка Docker

```powershell
# Удалить неиспользуемые образы
docker image prune -a

# Удалить все (ОСТОРОЖНО!)
docker system prune -a --volumes
```

---

## Решение проблем

### Порт уже занят

**Проблема:** `Error: port is already allocated`

**Решение:**

```powershell
# Найдите процесс на порту 80
netstat -ano | findstr :80

# Остановите процесс (замените PID на реальный)
taskkill /PID 1234 /F

# Или измените порт в docker-compose.yml
# Например, для frontend:
ports:
  - "8080:80"  # Вместо 80:80
```

### Контейнер не запускается

**Проблема:** Контейнер постоянно перезапускается

**Решение:**

```powershell
# Посмотрите логи
docker compose logs backend

# Проверьте переменные окружения
docker exec luxee-backend env

# Пересоздайте контейнер
docker compose down
docker compose up -d --build
```

### MongoDB не подключается

**Проблема:** Backend не может подключиться к MongoDB

**Решение:**

```powershell
# Проверьте что MongoDB запущена
docker compose ps mongodb

# Проверьте логи MongoDB
docker compose logs mongodb

# Проверьте подключение вручную
docker exec -it luxee-mongodb mongosh -u admin -p password

# Проверьте MONGO_URL в .env
```

### Frontend показывает белый экран

**Проблема:** Frontend не загружается

**Решение:**

```powershell
# Проверьте логи nginx
docker compose logs frontend

# Проверьте что файлы собрались
docker exec luxee-frontend ls -la /usr/share/nginx/html

# Пересоберите frontend
docker compose up -d --build frontend
```

### Браузер открывается видимым

**Проблема:** Хотите headless режим на локальном ПК

**Решение:**

В `.env` добавьте:
```env
NODE_ENV=production
```

Или в `backend/.env`:
```env
BROWSER_HEADLESS=true
```

Затем перезапустите:
```powershell
docker compose restart backend
```

---

## Сравнение с production

| Аспект | Локальное тестирование | Production (сервер) |
|--------|----------------------|-------------------|
| **NODE_ENV** | development | production |
| **Браузер** | Видимый (удобно для отладки) | Headless (невидимый) |
| **Порты** | localhost:80, localhost:5000 | server-ip:80, server-ip:5000 |
| **CORS** | localhost разрешен | Только ваш домен |
| **Пароли** | Можно простые для теста | Обязательно сложные |
| **HTTPS** | Не нужен | Рекомендуется |

---

## 📁 Где какие .env файлы нужны

### Для Варианта 1 и 2 (полный Docker):

```
C:\Users\user\Desktop\Model-site\
└── .env                    ← ТОЛЬКО ЭТОТ ФАЙЛ!
```

**НЕ создавайте** `backend/.env` и `frontend/.env` - они не нужны!

### Для Варианта 3 (гибридный режим):

```
C:\Users\user\Desktop\Model-site\
├── .env                    ← Для MongoDB в Docker
├── backend\
│   └── .env               ← Для локального backend
└── frontend\
    └── .env               ← Для локального frontend
```

---

## 🔑 Где взять OpenAI API ключ

1. Перейдите на https://platform.openai.com
2. Войдите в аккаунт (или создайте новый)
3. Перейдите в **API Keys** (https://platform.openai.com/api-keys)
4. Нажмите **Create new secret key**
5. Скопируйте ключ (он начинается с `sk-proj-...`)
6. Вставьте в `.env` файл в строку `OPENAI_API_KEY=`

⚠️ **ВАЖНО:** Ключ показывается только один раз! Сохраните его.

---

## Чеклист перед тестированием

- [ ] Docker Desktop запущен
- [ ] Файл `.env` создан в корне проекта
- [ ] OpenAI API ключ добавлен в `.env`
- [ ] Порты 80, 5000, 27017 свободны
- [ ] Достаточно места на диске (минимум 5 GB)

---

## Чеклист успешного теста

- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] Backend отвечает на http://localhost:5000/api/health
- [ ] Frontend открывается на http://localhost
- [ ] Администратор создан
- [ ] Вход в систему работает
- [ ] Браузер работает (видимый или headless)
- [ ] Нет ошибок в логах

---

## После успешного теста

Если всё работает локально, можно смело развертывать на сервере!

Просто:
1. Скопируйте `.env` на сервер
2. Измените IP адреса на адрес сервера
3. Запустите `docker compose up -d`

**Готово!** 🎉

---

**Дата создания:** 30.05.2026  
**Версия:** 1.0
