# 🚀 Быстрый старт

## Для запуска на сервере

### 1. Подготовка сервера

Убедитесь, что на вашем Linux-сервере установлен Docker:

```bash
# Проверка установки Docker
docker --version
docker compose version

# Если Docker не установлен, выполните:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Клонирование проекта

```bash
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
```

### 3. Настройка переменных окружения

```bash
# Создайте .env файл
cp .env.example .env

# Отредактируйте .env
nano .env
```

Минимальная конфигурация `.env`:

```env
# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=ваш_надежный_пароль

# JWT (сгенерируйте случайные строки)
JWT_ACCESS_SECRET=случайная_строка_32_символа
JWT_REFRESH_SECRET=другая_случайная_строка_32

# OpenAI
OPENAI_API_KEY=sk-ваш-ключ-openai

# URL вашего сервера (замените на ваш IP или домен)
VITE_API_URL=http://ВАШ_IP:5000/api
ALLOWED_ORIGINS=http://ВАШ_IP,http://ВАШ_IP:80
```

**Генерация безопасных секретов:**
```bash
openssl rand -base64 32
```

### 4. Запуск приложения

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f
```

### 5. Создание администратора

```bash
# Войдите в контейнер backend
docker exec -it luxee-backend node createAdmin.js

# Следуйте инструкциям на экране
```

### 6. Доступ к приложению

- **Frontend**: http://ВАШ_IP
- **Backend API**: http://ВАШ_IP:5000/api

## Управление приложением

### Остановка
```bash
docker compose stop
```

### Перезапуск
```bash
docker compose restart
```

### Просмотр логов
```bash
# Все сервисы
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только frontend
docker compose logs -f frontend
```

### Обновление
```bash
git pull
docker compose up -d --build
```

### Полная остановка и удаление
```bash
# Без удаления данных
docker compose down

# С удалением всех данных (ОСТОРОЖНО!)
docker compose down -v
```

## Настройка firewall

Откройте необходимые порты:

```bash
# HTTP
sudo ufw allow 80/tcp

# Backend API
sudo ufw allow 5000/tcp

# SSH (если еще не открыт)
sudo ufw allow 22/tcp

# Включить firewall
sudo ufw enable
```

## Проверка работоспособности

```bash
# Проверка статуса контейнеров
docker compose ps

# Проверка использования ресурсов
docker stats

# Проверка подключения к MongoDB
docker exec -it luxee-mongodb mongosh -u admin -p ваш_пароль
```

## Резервное копирование

```bash
# Создание бэкапа MongoDB
mkdir -p ./backups
docker exec luxee-mongodb mongodump \
  --username admin \
  --password ваш_пароль \
  --authenticationDatabase admin \
  --out /data/backup

docker cp luxee-mongodb:/data/backup ./backups/backup-$(date +%Y%m%d-%H%M%S)
```

## Решение проблем

### Контейнер не запускается
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs mongodb
```

### Порты заняты
```bash
# Проверка занятых портов
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :5000

# Остановка процесса на порту (если нужно)
sudo kill -9 $(sudo lsof -t -i:80)
```

### Очистка Docker
```bash
# Удаление неиспользуемых образов и контейнеров
docker system prune -a
```

## Дополнительная информация

📖 Полная документация: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

🐛 Проблемы? Проверьте:
1. Логи: `docker compose logs -f`
2. Статус: `docker compose ps`
3. Переменные окружения в `.env`
4. Доступность портов 80 и 5000

---

**Готово!** Ваше приложение работает и доступно извне. 🎉
