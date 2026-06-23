# ⚡ QUICK DEPLOY - Быстрый старт

**Краткая инструкция для опытных разработчиков**

## 🚀 За 5 минут

### 1. Подготовка сервера (Ubuntu 22.04)

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Firewall
ufw allow 22,80,443,5000/tcp
ufw enable

# Swap (если RAM < 8GB)
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 2. Клонирование проекта

```bash
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
git checkout refactoring/frontend-components
```

### 3. Настройка .env

```bash
cp .env.example .env
nano .env
```

**Минимальная конфигурация:**
```ini
# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)

# JWT
JWT_ACCESS_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# AI (DeepSeek)
AI_API_URL=https://api.deepseek.com
AI_API_KEY=ваш_ключ
AI_MODEL=deepseek-v4-flash

# Frontend
VITE_API_URL=http://ВАШ_IP:5000/api

# CORS
ALLOWED_ORIGINS=http://ВАШ_IP,http://ВАШ_IP:80
```

### 4. Запуск

```bash
docker compose up -d --build
```

**Ждите 5-10 минут первый раз.**

### 5. Создание админа

```bash
# Создать JSON для админа
docker compose exec backend node createAdmin.js

# Вставить в MongoDB
docker compose exec mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ
> use luxee
> db.users.insertOne({...JSON_ИЗ_ПРЕДЫДУЩЕЙ_КОМАНДЫ...})
```

### 6. Проверка

```bash
curl http://localhost:5000/api/health
# {"status":"ok"}
```

Откройте `http://ВАШ_IP` в браузере!

---

## 📋 Checklist

- [ ] Docker установлен
- [ ] Firewall настроен
- [ ] .env заполнен (IP адрес, пароли, AI ключ)
- [ ] `docker compose up -d --build` выполнен
- [ ] Все 3 контейнера в статусе "Up"
- [ ] Администратор создан и вставлен в MongoDB
- [ ] Можно войти через веб-интерфейс

---

## 🔧 Основные команды

```bash
# Статус
docker compose ps

# Логи
docker compose logs -f backend

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Обновление после git pull
docker compose up -d --build
```

---

## ⚠️ Частые проблемы

**Контейнеры не запускаются:**
```bash
docker compose logs backend
docker compose down && docker compose up -d --build
```

**Frontend не подключается к backend:**
- Проверьте `VITE_API_URL` в `.env`
- Пересоберите frontend: `docker compose up -d --build frontend`

**Playwright не работает:**
```bash
docker compose exec backend npx playwright install chromium --with-deps
docker compose restart backend
```

---

## 📚 Полная документация

См. **PRODUCTION_DEPLOYMENT_GUIDE.md** для детальных инструкций по:
- HTTPS настройке
- Мониторингу и логам
- Автоматическим бэкапам
- Troubleshooting

---

**Готово!** 🎉
