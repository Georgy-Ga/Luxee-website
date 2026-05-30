# 🐳 Развертывание проекта с Docker

Это руководство поможет вам развернуть проект Luxee на сервере с использованием Docker.

## 📋 Предварительные требования

На вашем Linux-сервере должны быть установлены:
- Docker (версия 20.10 или выше)
- Docker Compose (версия 2.0 или выше)
- Git

### Установка Docker на Ubuntu/Debian

```bash
# Обновление пакетов
sudo apt update

# Установка зависимостей
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Добавление официального GPG ключа Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавление репозитория Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перезагрузка для применения изменений
newgrp docker
```

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-username/luxee-website.git
cd luxee-website
```

### 2. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
nano .env
```

Заполните необходимые переменные:

```env
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password_123

# JWT Secrets (сгенерируйте случайные строки)
JWT_ACCESS_SECRET=your_random_jwt_access_secret_here
JWT_REFRESH_SECRET=your_random_jwt_refresh_secret_here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Frontend API URL (укажите IP или домен вашего сервера)
VITE_API_URL=http://your-server-ip:5000/api
```

**Важно:** Для генерации безопасных секретов используйте:
```bash
# Генерация случайной строки для JWT секретов
openssl rand -base64 32
```

### 3. Запуск приложения

```bash
# Сборка и запуск всех контейнеров
docker compose up -d

# Просмотр логов
docker compose logs -f

# Проверка статуса контейнеров
docker compose ps
```

### 4. Создание администратора

После запуска контейнеров создайте первого администратора:

```bash
# Войдите в контейнер бекенда
docker exec -it luxee-backend sh

# Запустите скрипт создания администратора
node createAdmin.js

# Выйдите из контейнера
exit
```

## 🌐 Доступ к приложению

После успешного запуска:
- **Frontend**: http://your-server-ip (порт 80)
- **Backend API**: http://your-server-ip:5000/api
- **MongoDB**: localhost:27017 (доступен только внутри Docker сети)

## 🔧 Управление контейнерами

### Остановка приложения
```bash
docker compose stop
```

### Перезапуск приложения
```bash
docker compose restart
```

### Остановка и удаление контейнеров
```bash
docker compose down
```

### Остановка и удаление контейнеров с данными
```bash
# ВНИМАНИЕ: Это удалит все данные MongoDB!
docker compose down -v
```

### Просмотр логов
```bash
# Все сервисы
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только frontend
docker compose logs -f frontend

# Только MongoDB
docker compose logs -f mongodb
```

### Обновление приложения
```bash
# Получение последних изменений
git pull

# Пересборка и перезапуск контейнеров
docker compose up -d --build
```

## 🔒 Настройка для production

### 1. Настройка HTTPS с Nginx

Для production рекомендуется использовать Nginx как reverse proxy с SSL сертификатом.

Создайте файл `nginx-proxy.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Настройка firewall

```bash
# Разрешить HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить SSH (если еще не разрешен)
sudo ufw allow 22/tcp

# Включить firewall
sudo ufw enable
```

### 3. Обновление переменных окружения для production

В файле `.env` обновите:

```env
# Используйте ваш домен
VITE_API_URL=https://your-domain.com/api

# Добавьте разрешенные origins для CORS
ALLOWED_ORIGINS=https://your-domain.com,http://your-domain.com
```

Обновите `docker-compose.yml`, добавив переменную окружения для backend:

```yaml
backend:
  environment:
    # ... другие переменные
    ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost:5173,http://localhost:5174}
```

## 📊 Мониторинг

### Проверка использования ресурсов
```bash
docker stats
```

### Проверка дискового пространства
```bash
docker system df
```

### Очистка неиспользуемых ресурсов
```bash
docker system prune -a
```

## 🔄 Резервное копирование

### Создание бэкапа MongoDB
```bash
# Создание директории для бэкапов
mkdir -p ./backups

# Создание бэкапа
docker exec luxee-mongodb mongodump --username admin --password your_password --authenticationDatabase admin --out /data/backup

# Копирование бэкапа на хост
docker cp luxee-mongodb:/data/backup ./backups/backup-$(date +%Y%m%d-%H%M%S)
```

### Восстановление из бэкапа
```bash
# Копирование бэкапа в контейнер
docker cp ./backups/backup-20260530-120000 luxee-mongodb:/data/restore

# Восстановление
docker exec luxee-mongodb mongorestore --username admin --password your_password --authenticationDatabase admin /data/restore
```

## 🐛 Решение проблем

### Контейнер не запускается
```bash
# Проверьте логи
docker compose logs backend
docker compose logs frontend
docker compose logs mongodb

# Проверьте статус
docker compose ps
```

### Проблемы с подключением к MongoDB
```bash
# Проверьте, что MongoDB запущен
docker compose ps mongodb

# Проверьте логи MongoDB
docker compose logs mongodb

# Проверьте подключение
docker exec -it luxee-mongodb mongosh -u admin -p your_password
```

### Playwright не работает
```bash
# Убедитесь, что Chromium установлен в контейнере
docker exec -it luxee-backend chromium-browser --version

# Проверьте логи backend
docker compose logs backend
```

### Очистка и перезапуск
```bash
# Остановка всех контейнеров
docker compose down

# Удаление образов
docker compose down --rmi all

# Пересборка с нуля
docker compose build --no-cache
docker compose up -d
```

## 📝 Дополнительные команды

### Вход в контейнер
```bash
# Backend
docker exec -it luxee-backend sh

# Frontend (nginx)
docker exec -it luxee-frontend sh

# MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p your_password
```

### Просмотр переменных окружения
```bash
docker exec luxee-backend env
```

### Обновление только одного сервиса
```bash
# Только backend
docker compose up -d --build backend

# Только frontend
docker compose up -d --build frontend
```

## 🎯 Рекомендации

1. **Регулярно создавайте бэкапы** базы данных
2. **Используйте HTTPS** в production
3. **Мониторьте логи** на наличие ошибок
4. **Обновляйте Docker образы** для безопасности
5. **Ограничьте доступ** к MongoDB (не открывайте порт 27017 наружу)
6. **Используйте сильные пароли** для всех сервисов
7. **Настройте автоматические обновления** системы безопасности

## 📞 Поддержка

Если у вас возникли проблемы:
1. Проверьте логи: `docker compose logs -f`
2. Проверьте статус: `docker compose ps`
3. Проверьте переменные окружения в `.env`
4. Убедитесь, что все порты доступны

---

**Готово!** Ваше приложение должно быть доступно по адресу вашего сервера. 🎉
