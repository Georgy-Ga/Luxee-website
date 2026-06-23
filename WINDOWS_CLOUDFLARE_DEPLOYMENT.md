# 🚀 Windows Deployment с Cloudflare Tunnel

## Оглавление
1. [Установка nginx на Windows](#1-установка-nginx-на-windows)
2. [Настройка проекта](#2-настройка-проекта)
3. [Cloudflare Tunnel Setup](#3-cloudflare-tunnel-setup)
4. [Запуск и проверка](#4-запуск-и-проверка)
5. [Переключение режимов](#5-переключение-режимов)

---

## 1. Установка nginx на Windows

### Скачать и установить
```powershell
# Вариант 1: Скачать вручную
# https://nginx.org/en/download.html → nginx/Windows-1.25.3
# Распаковать в C:\nginx

# Вариант 2: Через Chocolatey (если установлен)
choco install nginx
```

### Структура после установки
```
C:\nginx\
├── conf\
│   └── nginx.conf
├── logs\
├── html\
└── nginx.exe
```

### Базовые команды
```powershell
# Запуск
cd C:\nginx
start nginx

# Остановка
nginx -s stop

# Перезагрузка конфига
nginx -s reload

# Проверка конфига
nginx -t
```

---

## 2. Настройка проекта

### 2.1 Конфигурация nginx

Создать `C:\nginx\conf\luxee.conf`:

```nginx
# Luxee Project Configuration
# Поддерживает 2 режима: Cloudflare Tunnel и Direct Access

upstream backend {
    server 127.0.0.1:5001;
}

upstream frontend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    # Для Cloudflare Tunnel: server_name не важен (cloudflared обращается по localhost)
    # Для Direct Access: укажи свой домен или IP
    server_name localhost 127.0.0.1;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket для Socket.io
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 2.2 Подключить конфиг

Отредактировать `C:\nginx\conf\nginx.conf`:

```nginx
# В конце файла, перед последней закрывающей скобкой }
http {
    # ... существующие настройки ...
    
    # Подключаем наш конфиг
    include luxee.conf;
}
```

### 2.3 Frontend Environment

`.env` или `frontend/.env`:

```env
# Режим 1: Cloudflare Tunnel (автоопределение)
# VITE_API_URL не указывать! Будет автоматически определяться

# Режим 2: Direct Access (с конкретным доменом)
# VITE_API_URL=http://your-domain.com/api

# Для локальной разработки
# VITE_API_URL=http://localhost:5000/api
```

**Важно:** Frontend уже настроен на автоопределение:
- Если `VITE_API_URL` не указан → определяется по `window.location.hostname`
- Cloudflare: `your-tunnel.trycloudflare.com` → `http://your-tunnel.trycloudflare.com/api`
- Localhost: `localhost` → `http://localhost:5000/api`

### 2.4 Backend Environment

`backend/.env`:

```env
NODE_ENV=production
PORT=5001

# MongoDB (локальный или облачный)
MONGODB_URI=mongodb://admin:passwordbasedb@localhost:27017/luxee?authSource=admin

# Session Secret
SESSION_SECRET=your-super-secret-key-change-in-production

# Luxee API (твои реальные данные)
LUXEE_API_BASE_URL=https://luxee-prod.com/api
LUXEE_API_TOKEN=your_luxee_token

# AI Settings
AI_API_URL=https://api.openai.com/v1
AI_API_KEY=your_openai_api_key
AI_MODEL=gpt-4
```

---

## 3. Cloudflare Tunnel Setup

### 3.1 Установка cloudflared

```powershell
# Скачать: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
# Или через winget:
winget install --id Cloudflare.cloudflared

# Проверка
cloudflared --version
```

### 3.2 Авторизация

```powershell
cloudflared tunnel login
```
Откроется браузер → авторизуйся → выбери домен

### 3.3 Создание туннеля

```powershell
# Создать туннель
cloudflared tunnel create luxee-demo

# Запомни TUNNEL_ID из вывода!
```

### 3.4 Конфигурация туннеля

Создать `C:\Users\user\.cloudflared\config.yml`:

```yaml
# Укажи свой TUNNEL_ID
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: C:\Users\user\.cloudflared\YOUR_TUNNEL_ID_HERE.json

ingress:
  # Cloudflare → nginx → Docker
  - hostname: luxee-demo.your-domain.com
    service: http://localhost:80
  
  # Fallback
  - service: http_status:404
```

### 3.5 DNS маршрутизация

```powershell
# Привязать домен к туннелю
cloudflared tunnel route dns luxee-demo luxee-demo.your-domain.com
```

### 3.6 Запуск туннеля

```powershell
# Запуск в фоне
cloudflared tunnel run luxee-demo

# Или через службу Windows (постоянно работает)
cloudflared service install
cloudflared service start
```

---

## 4. Запуск и проверка

### 4.1 Полный запуск

```powershell
# 1. Запустить MongoDB (если локальный)
docker run -d -p 27017:27017 --name mongodb mongo

# 2. Запустить проект
cd C:\Users\user\Desktop\Model-site
docker compose up -d

# 3. Запустить nginx
cd C:\nginx
start nginx

# 4. Запустить Cloudflare Tunnel
cloudflared tunnel run luxee-demo
```

### 4.2 Проверка работы

```powershell
# Проверить Docker
docker compose ps

# Проверить nginx
curl http://localhost:80

# Проверить Cloudflare
# Открой https://luxee-demo.your-domain.com в браузере
```

### 4.3 Создание админа

```powershell
# Если MongoDB в Docker
docker exec -it luxee-mongodb mongo -u admin -p passwordbasedb --authenticationDatabase admin luxee

# Создать админа
db.users.insertOne({
  email: "admin@example.com",
  password: "$2b$03$...",  # используй createAdmin.js для генерации хеша
  role: "admin"
})
```

---

## 5. Переключение режимов

### 📋 Режим 1: Cloudflare Tunnel (текущий)

**Конфигурация:**
- `frontend/.env` → **НЕ указывать** `VITE_API_URL`
- nginx слушает `localhost:80`
- cloudflared пробрасывает домен на `localhost:80`

**Запуск:**
```powershell
docker compose up -d
start nginx
cloudflared tunnel run luxee-demo
```

**URL:** `https://luxee-demo.your-domain.com`

---

### 🌐 Режим 2: Direct Access (статический IP/домен)

**Когда использовать:**
- Получил статический IP
- Настроил проброс портов на роутере
- Есть свой домен с A-записью

**Изменения:**

1. **Frontend `.env`:**
```env
VITE_API_URL=http://your-domain.com/api
# или
VITE_API_URL=http://123.456.789.0/api
```

2. **nginx config (`C:\nginx\conf\luxee.conf`):**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # укажи реальный домен
    # ... остальное без изменений
}
```

3. **Пересобрать frontend:**
```powershell
docker compose build --no-cache frontend
docker compose up -d
```

4. **Перезагрузить nginx:**
```powershell
nginx -s reload
```

5. **Остановить cloudflared:**
```powershell
# Если запущен как служба
cloudflared service stop

# Если вручную - просто Ctrl+C
```

**URL:** `http://your-domain.com` или `http://your-ip`

---

### 🏠 Режим 3: Локальная разработка

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000/api
```

**Запуск без nginx:**
```powershell
docker compose up -d
# Frontend на http://localhost:8080
# Backend на http://localhost:5001
```

**URL:** `http://localhost:8080`

---

## 🔧 Troubleshooting

### nginx не запускается
```powershell
# Проверить конфиг
nginx -t

# Убить процесс на порту 80
netstat -ano | findstr :80
taskkill /PID <PID> /F
```

### Cloudflare Tunnel не работает
```powershell
# Проверить логи
cloudflared tunnel info luxee-demo

# Пересоздать туннель
cloudflared tunnel delete luxee-demo
cloudflared tunnel create luxee-demo
```

### Docker не работает
```powershell
# Проверить логи
docker compose logs -f

# Перезапустить
docker compose down
docker compose up -d --build
```

---

## 📊 Сравнение режимов

| Параметр | Cloudflare Tunnel | Direct Access | Local Dev |
|----------|------------------|---------------|-----------|
| **Динамический IP** | ✅ Работает | ❌ Не работает | ✅ Работает |
| **Проброс портов** | ❌ Не нужен | ✅ Требуется | ❌ Не нужен |
| **HTTPS** | ✅ Автоматически | ⚠️ Настроить вручную | ❌ Нет |
| **Скорость** | ⚠️ Через CDN | ✅ Прямое подключение | ✅ Максимальная |
| **Стоимость** | ✅ Бесплатно | ✅ Бесплатно | ✅ Бесплатно |

---

## ✅ Quick Start Checklist

- [ ] Установить nginx на Windows
- [ ] Создать `C:\nginx\conf\luxee.conf`
- [ ] Настроить `frontend/.env` (пустой для автоопределения)
- [ ] Настроить `backend/.env`
- [ ] Установить cloudflared
- [ ] Создать Cloudflare Tunnel
- [ ] Настроить `config.yml`
- [ ] Запустить docker compose
- [ ] Запустить nginx
- [ ] Запустить cloudflared
- [ ] Создать админа
- [ ] Дать ссылку заказчику
- [ ] Получить оплату! 💰

---

## 🎯 Для демо заказчику

**Самый быстрый путь:**

1. Cloudflare Tunnel (20 минут)
2. Пока показываешь заказчику - решаешь вопрос с хостингом
3. После оплаты - переключаешься на нормальный сервер

**URL для заказчика:** `https://luxee-demo.your-domain.com`

**Важно:** Оставляй Windows включенным пока идёт демо!
