# 🚀 PRODUCTION DEPLOYMENT GUIDE

**Полное руководство по развёртыванию Luxee Website на production сервере**

**Дата:** 19.06.2026  
**Версия:** 1.0  
**Ветка:** `refactoring/frontend-components`

---

## 📋 Содержание

1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Клонирование проекта](#клонирование-проекта)
4. [Настройка окружения](#настройка-окружения)
5. [Настройка публичного доступа](#настройка-публичного-доступа)
6. [Запуск приложения](#запуск-приложения)
7. [Создание администратора](#создание-администратора)
8. [Настройка HTTPS](#настройка-https)
9. [Проверка работоспособности](#проверка-работоспособности)
10. [Мониторинг и логи](#мониторинг-и-логи)
11. [Бэкапы](#бэкапы)
12. [Troubleshooting](#troubleshooting)

---

## ⚙️ Требования к серверу

### Минимальные требования

| Компонент | Минимум       | Рекомендуется        | Примечание                   |
| --------- | ------------- | -------------------- | ---------------------------- |
| **CPU**   | 2 ядра        | 4 ядра               | Для Playwright браузера      |
| **RAM**   | 4 GB          | 8 GB                 | MongoDB + Node.js + Chromium |
| **Диск**  | 20 GB SSD     | 50 GB SSD            | Для логов и базы данных      |
| **ОС**    | Ubuntu 20.04+ | Ubuntu 22.04 LTS     | Или Debian 11+               |
| **Сеть**  | 100 Mbps      | 1 Gbps               | Для AI API запросов          |
| **IP**    | Любой         | Статический белый IP | Для домена и SSL             |

### Порты которые нужно открыть

| Порт     | Протокол | Назначение       | Обязательно      |
| -------- | -------- | ---------------- | ---------------- |
| **22**   | TCP      | SSH доступ       | ✅ Да            |
| **80**   | TCP      | HTTP (Frontend)  | ✅ Да            |
| **443**  | TCP      | HTTPS (Frontend) | ✅ Да (для SSL)  |
| **5000** | TCP      | Backend API      | ⚠️ Опционально\* |

\*Порт 5000 можно закрыть если используете Nginx reverse proxy

### Провайдеры серверов (примеры)

- ✅ **DigitalOcean** - Droplet от $12/месяц (2 CPU, 4GB RAM)
- ✅ **Hetzner** - CX31 от €8/месяц (2 vCPU, 8GB RAM)
- ✅ **AWS EC2** - t3.medium от $30/месяц
- ✅ **Google Cloud** - e2-medium от $25/месяц
- ✅ **Vultr** - High Frequency от $12/месяц

---

## 🔧 Подготовка сервера

### Шаг 1: Подключение к серверу

```bash
# Подключение по SSH
ssh root@YOUR_SERVER_IP

# Или если используете ключ
ssh -i ~/.ssh/your_key.pem root@YOUR_SERVER_IP
```

### Шаг 2: Обновление системы

```bash
# Обновить список пакетов
apt update

# Обновить установленные пакеты
apt upgrade -y

# Установить необходимые утилиты
apt install -y curl wget git nano ufw
```

### Шаг 3: Установка Docker

```bash
# Удалить старые версии (если есть)
apt remove docker docker-engine docker.io containerd runc

# Установить зависимости
apt install -y ca-certificates curl gnupg lsb-release

# Добавить официальный GPG ключ Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавить репозиторий Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установить Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Проверить установку
docker --version
docker compose version
```

**Ожидаемый вывод:**

```
Docker version 25.0.0, build abc123
Docker Compose version v2.24.0
```

### Шаг 4: Настройка Firewall (UFW)

```bash
# Разрешить SSH (ВАЖНО! Сделайте это первым!)
ufw allow 22/tcp

# Разрешить HTTP и HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Опционально: разрешить прямой доступ к backend API
ufw allow 5000/tcp

# Включить firewall
ufw --force enable

# Проверить статус
ufw status
```

**Ожидаемый вывод:**

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
5000/tcp                   ALLOW       Anywhere
```

### Шаг 5: Создание пользователя для приложения (рекомендуется)

```bash
# Создать пользователя
useradd -m -s /bin/bash luxee

# Добавить в группу docker
usermod -aG docker luxee

# Создать директорию для приложения
mkdir -p /home/luxee/app
chown -R luxee:luxee /home/luxee/app
```

### Шаг 6: Настройка swap (для серверов с малой RAM)

```bash
# Проверить есть ли swap
swapon --show

# Если нет - создать 4GB swap
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Сделать постоянным
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Проверить
free -h
```

### Шаг 7: Установка дополнительных зависимостей для Playwright

```bash
# Playwright требует дополнительные библиотеки
apt install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

### ✅ Проверка готовности сервера

```bash
# Проверить Docker
docker run hello-world

# Проверить Docker Compose
docker compose version

# Проверить firewall
ufw status

# Проверить swap
free -h

# Проверить место на диске
df -h
```

**Если все команды выполнились успешно - сервер готов!**

---

## 📦 Клонирование проекта

### Шаг 1: Переключиться на пользователя luxee (если создали)

```bash
su - luxee
cd /home/luxee/app
```

Или остаться root:

```bash
cd /root
```

### Шаг 2: Клонировать репозиторий

```bash
# Клонировать проект
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
```

### Шаг 3: Переключиться на ветку refactoring/frontend-components

⚠️ **ВАЖНО:** Ваш проект на ветке `refactoring/frontend-components`, а не на `main`!

```bash
# Проверить текущую ветку
git branch -a

# Переключиться на рабочую ветку
git checkout refactoring/frontend-components

# Проверить что переключились
git branch
# Должна быть звёздочка: * refactoring/frontend-components
```

### Шаг 4: Проверить структуру проекта

```bash
# Посмотреть структуру
ls -la

# Должно быть:
# backend/
# frontend/
# docker-compose.yml
# .env.example
# и другие файлы
```

### ✅ Проверка

```bash
# Проверить что файлы на месте
ls -la backend/
ls -la frontend/
ls -la docker-compose.yml

# Посмотреть последний коммит
git log --oneline -1
```

---

## 🔐 Настройка окружения

### Шаг 1: Создать .env файл из примера

```bash
# Скопировать пример
cp .env.example .env
```

### Шаг 2: Сгенерировать сильные секреты

```bash
# Генерация случайных строк для секретов
# MongoDB password (32 символа)
openssl rand -base64 32

# JWT Access Secret (64 символа)
openssl rand -base64 64

# JWT Refresh Secret (64 символа)
openssl rand -base64 64
```

**Сохраните эти значения!** Они понадобятся в следующем шаге.

### Шаг 3: Отредактировать .env файл

```bash
nano .env
```

**Заполните следующие параметры:**

```ini
# ============================================
# MongoDB Configuration
# ============================================
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=ВАШ_СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ_1

# ============================================
# JWT Secrets
# ============================================
JWT_ACCESS_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_СЕКРЕТ_2
JWT_REFRESH_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_СЕКРЕТ_3

# ============================================
# AI Configuration (DeepSeek или Omniroute)
# ============================================
# Вариант 1: DeepSeek напрямую
AI_API_URL=https://api.deepseek.com
AI_API_KEY=ваш_ключ_deepseek
AI_MODEL=deepseek-v4-flash

# Вариант 2: Omniroute (если используете локальный)
# AI_API_URL=http://host.docker.internal:20128/v1
# AI_API_KEY=любая_строка
# AI_MODEL=gemini-cli/gemini-2.5-flash

# ============================================
# Frontend Configuration
# ============================================
# ВАЖНО! Замените на ваш публичный IP или домен
VITE_API_URL=http://ВАШ_IP_ИЛИ_ДОМЕН:5000/api

# Примеры:
# VITE_API_URL=http://123.45.67.89:5000/api
# VITE_API_URL=http://yourdomain.com:5000/api
# VITE_API_URL=https://yourdomain.com/api  (если настроите HTTPS)

# ============================================
# CORS Configuration
# ============================================
# Разрешенные origins (замените на ваш домен/IP)
ALLOWED_ORIGINS=http://ВАШ_IP_ИЛИ_ДОМЕН,http://ВАШ_IP_ИЛИ_ДОМЕН:80,https://ВАШ_IP_ИЛИ_ДОМЕН

# Пример:
# ALLOWED_ORIGINS=http://123.45.67.89,http://yourdomain.com,https://yourdomain.com
```

**Сохранить:** `Ctrl+O`, `Enter`, `Ctrl+X`

### Шаг 4: Проверить .env файл

```bash
# Посмотреть содержимое (БЕЗ вывода в терминал - безопасность!)
cat .env | grep -v "PASSWORD\|SECRET\|KEY"

# Проверить что все переменные заполнены
grep "your_" .env
grep "ВАШ_" .env
```

**Если команды выше что-то вывели - значит вы забыли заполнить переменные!**

### Шаг 5: Пример заполненного .env

```ini
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=xK9mP2vQ8nL5wR7tY4hJ6fD3sA1gH0zX

# JWT Secrets
JWT_ACCESS_SECRET=aB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1uV3wX5yZ7aB9cD1eF3gH5iJ7kL9mN1oP3qR5sT7uV9wX
JWT_REFRESH_SECRET=zY8xW6vU4tS2rQ0pO8nM6lK4jI2hG0fE8dC6bA4zY2xW0vU8tS6rQ4pO2nM0lK8jI6hG4fE2dC

# AI Configuration
AI_API_URL=https://api.deepseek.com
AI_API_KEY=sk-abc123def456ghi789
AI_MODEL=deepseek-v4-flash

# Frontend Configuration
VITE_API_URL=http://123.45.67.89:5000/api

# CORS Configuration
ALLOWED_ORIGINS=http://123.45.67.89,http://123.45.67.89:80,https://123.45.67.89
```

### ⚠️ ВАЖНЫЕ МОМЕНТЫ

1. **MONGO_ROOT_PASSWORD** - используйте сгенерированный пароль, НЕ "changeme"
2. **JWT секреты** - должны быть разные для ACCESS и REFRESH
3. **AI_API_KEY** - получите на https://platform.deepseek.com
4. **VITE_API_URL** - замените на ВАШ IP адрес или домен
5. **ALLOWED_ORIGINS** - добавьте все варианты доступа к вашему сайту

### Шаг 6: Установить правильные права доступа

```bash
# Только владелец может читать .env (безопасность!)
chmod 600 .env

# Проверить
ls -la .env
# Должно быть: -rw------- (только владелец может читать/писать)
```

### ✅ Проверка

```bash
# Проверить что файл существует
test -f .env && echo "✅ .env файл существует" || echo "❌ .env файл НЕ найден"

# Проверить что права правильные
stat -c "%a %n" .env | grep "600" && echo "✅ Права доступа правильные" || echo "⚠️ Установите chmod 600 .env"
```

---

## 🌐 Настройка публичного доступа

### Определить ваш публичный IP адрес

```bash
# Узнать публичный IP сервера
curl ifconfig.me
# или
curl ipinfo.io/ip
```

**Сохраните этот IP!** Он понадобится для настройки.

### Вариант A: Доступ по IP адресу (быстрый старт)

**Преимущества:**

- ✅ Работает сразу
- ✅ Не требует домена
- ✅ Бесплатно

**Недостатки:**

- ❌ Нет HTTPS (небезопасно)
- ❌ Сложно запомнить
- ❌ Может измениться при перезагрузке

**Настройка:**

Ваш `.env` файл должен содержать:

```ini
VITE_API_URL=http://123.45.67.89:5000/api  # ВАШ IP
ALLOWED_ORIGINS=http://123.45.67.89,http://123.45.67.89:80
```

Доступ к сайту: `http://123.45.67.89`

### Вариант B: Домен (рекомендуется)

**Преимущества:**

- ✅ HTTPS (безопасно)
- ✅ Легко запомнить
- ✅ Профессионально

**Шаги:**

1. **Купить домен** (например на NameCheap, GoDaddy)

2. **Настроить DNS записи:**

   ```
   Type: A
   Name: @
   Value: ВАШ_IP_СЕРВЕРА
   TTL: 300

   Type: A
   Name: www
   Value: ВАШ_IP_СЕРВЕРА
   TTL: 300
   ```

3. **Дождаться распространения DNS** (5-30 минут)

   ```bash
   # Проверить DNS
   nslookup yourdomain.com
   ```

4. **Обновить .env:**
   ```ini
   VITE_API_URL=https://yourdomain.com/api  # После настройки HTTPS!
   ALLOWED_ORIGINS=http://yourdomain.com,https://yourdomain.com
   ```

### Вариант C: Cloudflare Tunnel (без белого IP)

Если у вас динамический IP или нет прямого доступа к серверу.

**Установка:**

```bash
# Скачать cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Авторизация
cloudflared tunnel login

# Создать тоннель
cloudflared tunnel create luxee

# Настроить маршрутизацию
cloudflared tunnel route dns luxee yourdomain.com
```

Подробнее: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

### ✅ Проверка доступности

```bash
# Проверить что порт 80 доступен снаружи
nc -zv YOUR_SERVER_IP 80

# Или через curl
curl -I http://YOUR_SERVER_IP
```

---

## ▶️ Запуск приложения

### Шаг 1: Убедиться что .env настроен правильно

```bash
# Проверить что .env существует
ls -la .env

# Проверить IP адрес
grep "VITE_API_URL" .env
grep "ALLOWED_ORIGINS" .env
```

### Шаг 2: Запустить Docker Compose

```bash
# Запустить в фоновом режиме с пересборкой
docker compose up -d --build
```

**Это займёт 5-10 минут при первом запуске!**

**Что произойдёт:**

1. ⏳ Сборка backend Docker образа (~3 мин)
2. ⏳ Установка зависимостей backend
3. ⏳ Установка Playwright браузера
4. ⏳ Сборка frontend Docker образа (~2 мин)
5. ⏳ Build React приложения
6. 🚀 Запуск MongoDB контейнера
7. 🚀 Запуск backend контейнера
8. 🚀 Запуск frontend контейнера

### Шаг 3: Наблюдать за процессом

```bash
# Посмотреть логи в реальном времени
docker compose logs -f

# Или отдельно по контейнерам
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

**Нажмите `Ctrl+C` чтобы выйти из просмотра логов (контейнеры продолжат работать)**

### Шаг 4: Проверить статус контейнеров

```bash
# Посмотреть запущенные контейнеры
docker compose ps
```

**Ожидаемый вывод:**

```
NAME              IMAGE                  STATUS         PORTS
luxee-backend     luxee-backend:latest   Up 2 minutes   0.0.0.0:5000->5000/tcp
luxee-frontend    luxee-frontend:latest  Up 2 minutes   0.0.0.0:80->80/tcp
luxee-mongodb     mongo:7                Up 2 minutes   0.0.0.0:27017->27017/tcp
```

**Все контейнеры должны быть в статусе "Up"!**

### Шаг 5: Проверить health checks

```bash
# Backend health check
curl http://localhost:5000/api/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2026-06-19T..."}
```

### ⚠️ Если контейнеры не запускаются

```bash
# Посмотреть ошибки
docker compose logs backend
docker compose logs frontend

# Остановить и удалить контейнеры
docker compose down

# Пересобрать с нуля
docker compose build --no-cache
docker compose up -d
```

### Шаг 6: Проверить доступность с вашего компьютера

Откройте в браузере:

```
http://ВАШ_SERVER_IP
```

**Вы должны увидеть:**

- ✅ Страницу входа Luxee Website
- ✅ Форму авторизации
- ❌ НЕ должно быть ошибок подключения

**Если видите ошибку:**

- Проверьте firewall: `ufw status`
- Проверьте что контейнеры запущены: `docker compose ps`
- Проверьте логи: `docker compose logs frontend`

### ✅ Проверка успешного запуска

```bash
# Все 3 контейнера работают
docker compose ps | grep "Up"

# Backend отвечает
curl -s http://localhost:5000/api/health | grep "ok"

# Frontend раздаётся
curl -I http://localhost:80 | grep "200 OK"

# MongoDB работает
docker compose exec mongodb mongosh --eval "db.runCommand('ping')" --quiet
```

**Если все команды вернули успех - приложение запущено!** 🎉

---

## 👤 Создание администратора

⚠️ **ВАЖНО:** Без администратора вы не сможете войти в систему!

### Шаг 1: Войти в backend контейнер

```bash
# Войти в контейнер backend
docker compose exec backend sh
```

**Вы должны увидеть приглашение:** `/app #`

### Шаг 2: Запустить скрипт создания администратора

```bash
# Запустить скрипт
node createAdmin.js
```

### Шаг 3: Следовать инструкциям

Скрипт спросит:

```
Enter admin email:
```

Введите email (например: `admin@luxee.com`)

```
Enter admin password:
```

Введите пароль (например: `Admin123!`)

```
Enter admin name:
```

Введите имя (например: `Admin`)

### Шаг 4: Скопировать данные для MongoDB

Скрипт выведет JSON для вставки в MongoDB:

```json
{
	"email": "admin@luxee.com",
	"password": "$2b$10$abc123...",
	"name": "Admin",
	"role": "admin",
	"createdAt": "2026-06-19T14:50:00.000Z"
}
```

**Скопируйте этот JSON!**

### Шаг 5: Вставить администратора в MongoDB

#### Вариант A: Через mongosh (в терминале)

```bash
# Выйти из backend контейнера
exit

# Войти в MongoDB контейнер
docker compose exec mongodb mongosh -u admin -p ВАШ_MONGO_PASSWORD

# Переключиться на базу luxee
use luxee

# Вставить администратора (замените на ваш JSON из Шага 4)
db.users.insertOne({
  "email": "admin@luxee.com",
  "password": "$2b$10$abc123...",
  "name": "Admin",
  "role": "admin"
})

# Проверить что создался
db.users.find({email: "admin@luxee.com"})

# Выйти
exit
```

#### Вариант B: Через MongoDB Compass (GUI)

1. Установите MongoDB Compass на вашем компьютере
2. Подключитесь к: `mongodb://admin:ВАШ_ПАРОЛЬ@ВАШ_IP:27017/luxee?authSource=admin`
3. Откройте коллекцию `users`
4. Нажмите "Add Data" → "Insert Document"
5. Вставьте JSON из Шага 4
6. Нажмите "Insert"

### Шаг 6: Проверить вход

1. Откройте в браузере: `http://ВАШ_SERVER_IP`
2. Введите email и пароль администратора
3. Нажмите "Войти"

**Вы должны успешно войти в систему!** ✅

### ⚠️ Если не можете войти

```bash
# Проверить что администратор создался
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ

use luxee
db.users.find({email: "admin@luxee.com"})

# Должен вывести документ с вашим админом
```

**Если документа нет - повторите Шаг 5!**

### Альтернативный способ: Автоматический скрипт

Создайте скрипт для автоматического создания:

```bash
# Создать скрипт на сервере
nano create-first-admin.sh
```

Вставьте:

```bash
#!/bin/bash
echo "Creating first admin user..."
docker compose exec -T backend node createAdmin.js
echo "Admin created! Use the JSON above to insert into MongoDB."
```

Сохраните и запустите:

```bash
chmod +x create-first-admin.sh
./create-first-admin.sh
```

---

## 🔒 Настройка HTTPS

⚠️ **Требуется домен!** HTTPS не работает с IP адресами.

### Шаг 1: Установить Certbot

```bash
# Установить Certbot и Nginx plugin
apt install -y certbot python3-certbot-nginx nginx
```

### Шаг 2: Остановить frontend контейнер (временно)

```bash
# Certbot нужен порт 80
docker compose stop frontend
```

### Шаг 3: Получить SSL сертификат

```bash
# Получить сертификат для вашего домена
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Следовать инструкциям:
# - Введите email
# - Согласитесь с ToS
# - Выберите Yes/No для рассылки
```

**Сертификаты будут сохранены в:**

```
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Шаг 4: Настроить Nginx как reverse proxy

```bash
# Создать конфигурацию Nginx
nano /etc/nginx/sites-available/luxee
```

Вставьте:

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend (статика из Docker)
    location / {
        proxy_pass http://localhost:8080;  # Frontend контейнер на порту 8080
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Шаг 5: Активировать конфигурацию

```bash
# Создать символическую ссылку
ln -s /etc/nginx/sites-available/luxee /etc/nginx/sites-enabled/

# Удалить default конфигурацию
rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
```

### Шаг 6: Обновить docker-compose.yml

```bash
nano docker-compose.yml
```

Измените порт frontend с `80:80` на `8080:80`:

```yaml
frontend:
  ports:
    - '8080:80' # Изменить с 80:80
```

### Шаг 7: Обновить .env для HTTPS

```bash
nano .env
```

Изменить URL на HTTPS:

```ini
VITE_API_URL=https://yourdomain.com/api
ALLOWED_ORIGINS=https://yourdomain.com,http://yourdomain.com
```

### Шаг 8: Пересобрать и запустить

```bash
# Пересобрать frontend с новым URL
docker compose up -d --build frontend

# Запустить все контейнеры
docker compose up -d
```

### Шаг 9: Автоматическое обновление сертификатов

```bash
# Тестировать обновление
certbot renew --dry-run

# Настроить автоматическое обновление (уже настроено в Ubuntu)
systemctl status certbot.timer
```

### ✅ Проверка HTTPS

Откройте в браузере: `https://yourdomain.com`

Должны увидеть:

- ✅ Зелёный замочек в адресной строке
- ✅ Сайт работает через HTTPS
- ✅ HTTP автоматически перенаправляется на HTTPS

---

## ✅ Проверка работоспособности

### 1. Frontend (React приложение)

```bash
# Проверить что frontend раздаётся
curl -I http://localhost:80

# Должен вернуть: HTTP/1.1 200 OK
```

**В браузере:** Откройте `http://ВАШ_IP` и проверьте:

- ✅ Страница загружается
- ✅ Нет ошибок в консоли (`F12` → Console)
- ✅ Форма входа отображается

### 2. Backend API

```bash
# Health check
curl http://localhost:5000/api/health

# Должен вернуть: {"status":"ok","timestamp":"..."}

# Проверить routes
curl http://localhost:5000/api/
```

### 3. MongoDB

```bash
# Проверить подключение
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "db.runCommand('ping')"

# Должен вернуть: { ok: 1 }

# Проверить базу luxee
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "use luxee; db.stats()"
```

### 4. WebSocket соединения

**В браузере:**

1. Откройте сайт
2. Нажмите `F12` → Network → WS (WebSocket)
3. Войдите в систему
4. Должны увидеть активное WebSocket соединение

### 5. AI функционал

1. Войдите как администратор
2. Откройте панель управления AI
3. Включите AI для аккаунта
4. Проверьте что AI отвечает на сообщения

### 6. Playwright браузер

```bash
# Проверить что Playwright установлен
docker compose exec backend sh -c "ls -la /app/.playwright"

# Проверить логи браузера
docker compose logs backend | grep "playwright"
```

### Полный checklist

- [ ] Frontend доступен по IP/домену
- [ ] Backend API отвечает (`/api/health`)
- [ ] MongoDB подключен и работает
- [ ] Можно войти как администратор
- [ ] WebSocket соединения активны
- [ ] AI функционал работает
- [ ] Браузер Playwright запускается
- [ ] Логи не содержат критических ошибок
- [ ] HTTPS работает (если настроен)

---

## 📊 Мониторинг и логи

### Просмотр логов контейнеров

```bash
# Все логи
docker compose logs

# Логи в реальном времени
docker compose logs -f

# Логи конкретного контейнера
docker compose logs backend
docker compose logs frontend
docker compose logs mongodb

# Последние 100 строк
docker compose logs --tail=100 backend
```

### Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
df -h
du -sh /var/lib/docker/volumes/*

# Использование RAM и CPU
free -h
top
htop  # если установлен
```

### Проверка здоровья контейнеров

```bash
# Статус всех контейнеров
docker compose ps

# Детальная информация
docker inspect luxee-backend
docker inspect luxee-frontend
docker inspect luxee-mongodb
```

### Логи Nginx (если используете HTTPS)

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

### Мониторинг MongoDB

```bash
# Статистика базы данных
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "
use luxee;
db.stats();
"

# Размер коллекций
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "
use luxee;
db.users.stats();
db.chats.stats();
"

# Текущие операции
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "db.currentOp()"
```

### Настройка автоматических уведомлений

Создайте скрипт мониторинга:

```bash
nano /root/check-health.sh
```

Вставьте:

```bash
#!/bin/bash
# Проверка здоровья приложения

WEBHOOK_URL="YOUR_DISCORD_OR_SLACK_WEBHOOK"

# Проверить backend
if ! curl -s http://localhost:5000/api/health | grep -q "ok"; then
    echo "⚠️ Backend не отвечает!" | curl -X POST $WEBHOOK_URL -d '{"content":"⚠️ Luxee Backend DOWN!"}'
fi

# Проверить frontend
if ! curl -s -I http://localhost:80 | grep -q "200 OK"; then
    echo "⚠️ Frontend не доступен!" | curl -X POST $WEBHOOK_URL -d '{"content":"⚠️ Luxee Frontend DOWN!"}'
fi

# Проверить MongoDB
if ! docker compose exec -T mongodb mongosh --quiet --eval "db.runCommand('ping').ok" | grep -q "1"; then
    echo "⚠️ MongoDB не отвечает!" | curl -X POST $WEBHOOK_URL -d '{"content":"⚠️ MongoDB DOWN!"}'
fi
```

Настройте cron:

```bash
chmod +x /root/check-health.sh
crontab -e

# Добавьте строку (проверка каждые 5 минут):
*/5 * * * * /root/check-health.sh
```

---

## 💾 Бэкапы

### Автоматический бэкап MongoDB

Создайте скрипт бэкапа:

```bash
nano /root/backup-mongodb.sh
```

Вставьте:

```bash
#!/bin/bash
# Автоматический бэкап MongoDB

BACKUP_DIR="/root/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_PASSWORD="ВАШ_MONGO_PASSWORD"

# Создать директорию для бэкапов
mkdir -p $BACKUP_DIR

# Создать бэкап
docker compose exec -T mongodb mongodump \
  --username admin \
  --password $MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db luxee \
  --archive > $BACKUP_DIR/luxee_$DATE.archive

# Сжать бэкап
gzip $BACKUP_DIR/luxee_$DATE.archive

# Удалить бэкапы старше 7 дней
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "✅ Backup completed: luxee_$DATE.archive.gz"
```

Сделать исполняемым:

```bash
chmod +x /root/backup-mongodb.sh
```

### Настроить автоматические бэкапы

```bash
crontab -e

# Добавить строку (бэкап каждый день в 3:00 AM):
0 3 * * * /root/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### Восстановление из бэкапа

```bash
# Распаковать бэкап
gunzip /root/backups/mongodb/luxee_20260619_030000.archive.gz

# Восстановить
docker compose exec -T mongodb mongorestore \
  --username admin \
  --password ВАШ_ПАРОЛЬ \
  --authenticationDatabase admin \
  --db luxee \
  --archive < /root/backups/mongodb/luxee_20260619_030000.archive

echo "✅ Database restored from backup"
```

### Бэкап .env файлов

```bash
# Создать защищённую копию
cp .env .env.backup
chmod 600 .env.backup

# Сохранить в зашифрованном виде
gpg -c .env
# Введите пароль для шифрования
```

### Бэкап на внешнее хранилище (опционально)

**AWS S3:**

```bash
apt install -y awscli
aws configure  # Ввести credentials

# Загрузить бэкап
aws s3 cp /root/backups/mongodb/luxee_$DATE.archive.gz s3://your-bucket/backups/
```

**Google Drive (rclone):**

```bash
curl https://rclone.org/install.sh | sudo bash
rclone config  # Настроить Google Drive

# Загрузить бэкап
rclone copy /root/backups/mongodb/ gdrive:luxee-backups/
```

---

## 🔧 Troubleshooting

### Проблема: Контейнеры не запускаются

**Симптомы:**

```bash
docker compose ps
# STATUS: Exit 1 или Restarting
```

**Решение:**

```bash
# Посмотреть логи
docker compose logs backend
docker compose logs frontend

# Пересобрать без кеша
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Проблема: Backend не подключается к MongoDB

**Симптомы:** `MongoServerError: Authentication failed`

**Решение:**

```bash
# Проверить .env
cat .env | grep MONGO

# Проверить что MongoDB запущен
docker compose ps mongodb

# Проверить пароль
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ

# Если пароль неверный - пересоздать MongoDB
docker compose down -v  # ⚠️ УДАЛИТ ВСЕ ДАННЫЕ!
docker compose up -d mongodb
```

### Проблема: Frontend показывает ошибку подключения

**Симптомы:** `ERR_CONNECTION_REFUSED` или `Network Error`

**Решение:**

```bash
# Проверить VITE_API_URL в .env
grep VITE_API_URL .env

# Должно быть: http://ВАШ_IP:5000/api

# Пересобрать frontend
docker compose up -d --build frontend

# Проверить firewall
ufw status | grep 5000

# Проверить CORS
docker compose logs backend | grep CORS
```

### Проблема: Playwright браузер не запускается

**Симптомы:** `browserType.launch: Executable doesn't exist`

**Решение:**

```bash
# Войти в контейнер
docker compose exec backend sh

# Переустановить Playwright
npx playwright install chromium --with-deps

# Выйти
exit

# Перезапустить backend
docker compose restart backend
```

### Проблема: MongoDB занимает слишком много места

**Решение:**

```bash
# Проверить размер
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "
use luxee;
db.stats();
"

# Удалить старые логи/данные
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "
use luxee;
db.chats.deleteMany({createdAt: {\$lt: new Date(Date.now() - 30*24*60*60*1000)}});
"

# Компактировать базу
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ --eval "
use luxee;
db.runCommand({compact: 'chats'});
"
```

### Проблема: Сайт медленно работает

**Диагностика:**

```bash
# Проверить использование ресурсов
docker stats

# Проверить нагрузку на сервер
top
free -h
df -h

# Проверить логи на ошибки
docker compose logs backend | grep ERROR
docker compose logs frontend | grep ERROR
```

**Решение:**

- Увеличьте RAM сервера (минимум 8GB)
- Добавьте swap если RAM < 8GB
- Оптимизируйте MongoDB (индексы)
- Настройте CDN для статики

### Проблема: SSL сертификат не работает

**Решение:**

```bash
# Проверить сертификат
certbot certificates

# Обновить сертификат
certbot renew

# Проверить Nginx конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
```

### Проблема: Docker занимает много места

**Решение:**

```bash
# Посмотреть использование
docker system df

# Удалить неиспользуемые образы и контейнеры
docker system prune -a

# Удалить неиспользуемые volumes (⚠️ ОСТОРОЖНО!)
docker volume prune
```

### Получить помощь

Если проблема не решается:

1. **Соберите логи:**

   ```bash
   docker compose logs > logs.txt
   docker stats --no-stream > stats.txt
   df -h > disk.txt
   free -h > memory.txt
   ```

2. **Проверьте документацию в репозитории**

3. **Создайте Issue на GitHub** с логами и описанием проблемы

---

## 🎉 Готово!

Ваше Luxee Website приложение развёрнуто и готово к использованию!

### Быстрая справка команд

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Логи
docker compose logs -f

# Статус
docker compose ps

# Обновление (после git pull)
docker compose up -d --build

# Бэкап
/root/backup-mongodb.sh

# Проверка здоровья
curl http://localhost:5000/api/health
```

### Полезные ссылки

- **Сайт:** http://ВАШ_IP или https://yourdomain.com
- **Backend API:** http://ВАШ_IP:5000/api
- **MongoDB:** mongodb://admin:ПАРОЛЬ@ВАШ_IP:27017/luxee
- **GitHub:** https://github.com/Georgy-Ga/Luxee-website

**Удачного деплоя!** 🚀
