# 📘 Полное руководство по настройке сервера

Это подробное пошаговое руководство для развертывания проекта Luxee на Linux-сервере с использованием Docker.

---

## 📋 Содержание

1. [Подготовка сервера](#1-подготовка-сервера)
2. [Установка Docker](#2-установка-docker)
3. [Клонирование проекта](#3-клонирование-проекта)
4. [Настройка переменных окружения](#4-настройка-переменных-окружения)
5. [Запуск приложения](#5-запуск-приложения)
6. [Создание администратора](#6-создание-администратора)
7. [Настройка firewall](#7-настройка-firewall)
8. [Проверка работоспособности](#8-проверка-работоспособности)
9. [Настройка HTTPS (опционально)](#9-настройка-https-опционально)
10. [Резервное копирование](#10-резервное-копирование)
11. [Обслуживание и мониторинг](#11-обслуживание-и-мониторинг)
12. [Решение проблем](#12-решение-проблем)

---

## 1. Подготовка сервера

### 1.1 Требования к серверу

**Минимальные требования:**
- ОС: Ubuntu 20.04 / 22.04 или Debian 11/12
- RAM: 2 GB (рекомендуется 4 GB)
- CPU: 2 ядра
- Диск: 20 GB свободного места
- Доступ: SSH с правами sudo

### 1.2 Подключение к серверу

```bash
# Подключитесь к серверу по SSH
ssh username@your-server-ip

# Например:
ssh root@192.168.1.100
```

### 1.3 Обновление системы

```bash
# Обновите список пакетов
sudo apt update

# Обновите установленные пакеты
sudo apt upgrade -y

# Установите необходимые утилиты
sudo apt install -y curl wget git nano htop
```

---

## 2. Установка Docker

### 2.1 Удаление старых версий (если есть)

```bash
sudo apt remove docker docker-engine docker.io containerd runc
```

### 2.2 Установка Docker

```bash
# Установка зависимостей
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

# Добавление официального GPG ключа Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавление репозитория Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Обновление списка пакетов
sudo apt update

# Установка Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2.3 Настройка Docker

```bash
# Добавление вашего пользователя в группу docker
sudo usermod -aG docker $USER

# Применение изменений (или перезайдите в систему)
newgrp docker

# Проверка установки
docker --version
docker compose version
```

**Ожидаемый вывод:**
```
Docker version 24.0.x, build xxxxx
Docker Compose version v2.x.x
```

### 2.4 Настройка автозапуска Docker

```bash
# Включить автозапуск Docker при загрузке системы
sudo systemctl enable docker
sudo systemctl start docker

# Проверить статус
sudo systemctl status docker
```

---

## 3. Клонирование проекта

### 3.1 Создание директории для проекта

```bash
# Перейдите в домашнюю директорию
cd ~

# Или создайте отдельную директорию для проектов
mkdir -p ~/projects
cd ~/projects
```

### 3.2 Клонирование репозитория

```bash
# Клонируйте проект
git clone https://github.com/Georgy-Ga/Luxee-website.git

# Перейдите в директорию проекта
cd Luxee-website

# Проверьте содержимое
ls -la
```

**Вы должны увидеть:**
```
backend/
frontend/
docker-compose.yml
.env.example
README.md
...
```

---

## 4. Настройка переменных окружения

### 4.1 Создание файла .env

```bash
# Скопируйте пример файла
cp .env.example .env

# Откройте файл для редактирования
nano .env
```

### 4.2 Заполнение переменных окружения

Вот что нужно настроить в файле `.env`:

#### 4.2.1 MongoDB Configuration

```env
# Логин администратора MongoDB
MONGO_ROOT_USERNAME=admin

# Пароль для MongoDB (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
MONGO_ROOT_PASSWORD=ваш_очень_надежный_пароль_123
```

**💡 Совет:** Используйте сложный пароль. Можно сгенерировать:
```bash
openssl rand -base64 32
```

#### 4.2.2 JWT Secrets

```env
# Секрет для access токенов (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
JWT_ACCESS_SECRET=ваш_случайный_секрет_для_access_токенов

# Секрет для refresh токенов (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
JWT_REFRESH_SECRET=ваш_случайный_секрет_для_refresh_токенов
```

**💡 Генерация секретов:**
```bash
# Сгенерируйте два разных секрета
openssl rand -base64 32
openssl rand -base64 32
```

Скопируйте результаты в соответствующие поля.

#### 4.2.3 OpenAI Configuration

```env
# Ваш API ключ от OpenAI
OPENAI_API_KEY=sk-ваш-реальный-ключ-от-openai

# Модель для использования (можно оставить по умолчанию)
OPENAI_MODEL=gpt-4o-mini
```

**📝 Где получить OpenAI API ключ:**
1. Зайдите на https://platform.openai.com/
2. Войдите в аккаунт
3. Перейдите в API Keys
4. Создайте новый ключ
5. Скопируйте его (он показывается только один раз!)

#### 4.2.4 Frontend API URL

```env
# URL вашего сервера (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
# Замените на IP адрес или домен вашего сервера
VITE_API_URL=http://192.168.1.100:5000/api

# Или если у вас есть домен:
# VITE_API_URL=http://your-domain.com:5000/api
```

**💡 Как узнать IP адрес сервера:**
```bash
curl ifconfig.me
# или
hostname -I
```

#### 4.2.5 CORS Origins

```env
# Разрешенные домены для CORS (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
ALLOWED_ORIGINS=http://192.168.1.100,http://192.168.1.100:80

# Или если у вас есть домен:
# ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
```

### 4.3 Пример полного .env файла

```env
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=MySecurePassword123!@#

# JWT Secrets
JWT_ACCESS_SECRET=a8f5f167f44f4964e6c998dee827110c
JWT_REFRESH_SECRET=b9g6g278g55g5075f7d109eff938221d

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
OPENAI_MODEL=gpt-4o-mini

# Frontend API URL
VITE_API_URL=http://192.168.1.100:5000/api

# CORS Origins
ALLOWED_ORIGINS=http://192.168.1.100,http://192.168.1.100:80
```

### 4.4 Сохранение файла

В редакторе nano:
1. Нажмите `Ctrl + O` (сохранить)
2. Нажмите `Enter` (подтвердить имя файла)
3. Нажмите `Ctrl + X` (выйти)

### 4.5 Проверка файла

```bash
# Проверьте что файл создан
ls -la .env

# Посмотрите содержимое (убедитесь что секреты не пустые)
cat .env
```

---

## 5. Запуск приложения

### 5.1 Сборка и запуск контейнеров

```bash
# Убедитесь что вы в директории проекта
cd ~/projects/Luxee-website

# Запустите все сервисы
docker compose up -d
```

**Что происходит:**
1. Docker скачивает необходимые образы (MongoDB, Node.js, Nginx)
2. Собирает образы для backend и frontend
3. Создает сеть между контейнерами
4. Запускает все сервисы

**⏱️ Время:** Первый запуск может занять 5-10 минут.

### 5.2 Просмотр процесса сборки

```bash
# Если хотите видеть логи в реальном времени
docker compose up --build

# Для остановки нажмите Ctrl+C, затем запустите в фоне:
docker compose up -d
```

### 5.3 Проверка статуса контейнеров

```bash
# Проверьте что все контейнеры запущены
docker compose ps
```

**Ожидаемый вывод:**
```
NAME                IMAGE               STATUS
luxee-backend       luxee-backend       Up 2 minutes
luxee-frontend      luxee-frontend      Up 2 minutes
luxee-mongodb       mongo:7             Up 2 minutes (healthy)
```

Все контейнеры должны быть в статусе `Up`.

### 5.4 Просмотр логов

```bash
# Логи всех сервисов
docker compose logs -f

# Логи только backend
docker compose logs -f backend

# Логи только frontend
docker compose logs -f frontend

# Последние 100 строк логов
docker compose logs --tail=100
```

**Для выхода из просмотра логов:** нажмите `Ctrl + C`

---

## 6. Создание администратора

### 6.1 Вход в контейнер backend

```bash
# Войдите в контейнер
docker exec -it luxee-backend sh
```

Вы увидите приглашение командной строки внутри контейнера: `/app #`

### 6.2 Запуск скрипта создания администратора

```bash
# Внутри контейнера выполните:
node createAdmin.js
```

### 6.3 Следуйте инструкциям

Скрипт попросит ввести:

1. **Email администратора:**
   ```
   Enter admin email: admin@example.com
   ```

2. **Пароль:**
   ```
   Enter admin password: ********
   ```

3. **Подтверждение пароля:**
   ```
   Confirm password: ********
   ```

**💡 Требования к паролю:**
- Минимум 6 символов
- Используйте надежный пароль

### 6.4 Успешное создание

Вы увидите сообщение:
```
✅ Admin user created successfully!
Email: admin@example.com
Role: admin
```

### 6.5 Выход из контейнера

```bash
# Выйдите из контейнера
exit
```

---

## 7. Настройка firewall

### 7.1 Установка UFW (если не установлен)

```bash
sudo apt install -y ufw
```

### 7.2 Настройка правил

```bash
# Разрешить SSH (ВАЖНО! Сделайте это первым)
sudo ufw allow 22/tcp

# Разрешить HTTP (фронтенд)
sudo ufw allow 80/tcp

# Разрешить Backend API
sudo ufw allow 5000/tcp

# Если планируете HTTPS
sudo ufw allow 443/tcp
```

### 7.3 Включение firewall

```bash
# Включите firewall
sudo ufw enable

# Проверьте статус
sudo ufw status
```

**Ожидаемый вывод:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
5000/tcp                   ALLOW       Anywhere
```

---

## 8. Проверка работоспособности

### 8.1 Проверка доступности сервисов

```bash
# Проверка backend
curl http://localhost:5000/api/health

# Проверка frontend
curl http://localhost:80
```

### 8.2 Проверка из браузера

Откройте браузер на вашем компьютере и перейдите по адресам:

1. **Frontend:** `http://ВАШ_IP_СЕРВЕРА`
   - Должна открыться страница входа

2. **Backend API:** `http://ВАШ_IP_СЕРВЕРА:5000/api/health`
   - Должен вернуть JSON с информацией о здоровье сервера

### 8.3 Вход в систему

1. Откройте `http://ВАШ_IP_СЕРВЕРА`
2. Введите email и пароль администратора
3. Нажмите "Войти"

**✅ Если вы успешно вошли - всё работает!**

### 8.4 Проверка логов

```bash
# Проверьте что нет ошибок
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend
```

---

## 9. Настройка HTTPS (опционально)

### 9.1 Установка Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Получение SSL сертификата

```bash
# Замените your-domain.com на ваш домен
sudo certbot --nginx -d your-domain.com
```

### 9.3 Обновление .env

```bash
nano .env
```

Измените:
```env
VITE_API_URL=https://your-domain.com/api
ALLOWED_ORIGINS=https://your-domain.com,http://your-domain.com
```

### 9.4 Перезапуск

```bash
docker compose down
docker compose up -d --build
```

---

## 10. Резервное копирование

### 10.1 Создание директории для бэкапов

```bash
mkdir -p ~/backups
```

### 10.2 Создание бэкапа MongoDB

```bash
# Создание бэкапа
docker exec luxee-mongodb mongodump \
  --username admin \
  --password ВАШ_ПАРОЛЬ_MONGODB \
  --authenticationDatabase admin \
  --out /data/backup

# Копирование бэкапа на хост
docker cp luxee-mongodb:/data/backup ~/backups/backup-$(date +%Y%m%d-%H%M%S)
```

### 10.3 Автоматическое резервное копирование

Создайте скрипт:

```bash
nano ~/backup-luxee.sh
```

Содержимое:
```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d-%H%M%S)
MONGO_PASSWORD="ВАШ_ПАРОЛЬ_MONGODB"

# Создание бэкапа
docker exec luxee-mongodb mongodump \
  --username admin \
  --password $MONGO_PASSWORD \
  --authenticationDatabase admin \
  --out /data/backup

# Копирование на хост
docker cp luxee-mongodb:/data/backup $BACKUP_DIR/backup-$DATE

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type d -name "backup-*" -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_DIR/backup-$DATE"
```

Сделайте скрипт исполняемым:
```bash
chmod +x ~/backup-luxee.sh
```

Добавьте в cron (ежедневно в 2:00):
```bash
crontab -e
```

Добавьте строку:
```
0 2 * * * /home/your-username/backup-luxee.sh >> /home/your-username/backup.log 2>&1
```

---

## 11. Обслуживание и мониторинг

### 11.1 Просмотр использования ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df

# Использование системы
htop
```

### 11.2 Обновление приложения

```bash
cd ~/projects/Luxee-website

# Получить последние изменения
git pull

# Пересобрать и перезапустить
docker compose up -d --build
```

### 11.3 Перезапуск сервисов

```bash
# Перезапуск всех сервисов
docker compose restart

# Перезапуск только backend
docker compose restart backend

# Перезапуск только frontend
docker compose restart frontend
```

### 11.4 Очистка Docker

```bash
# Удаление неиспользуемых образов и контейнеров
docker system prune -a

# Удаление неиспользуемых volumes (ОСТОРОЖНО!)
docker volume prune
```

---

## 12. Решение проблем

### 12.1 Контейнер не запускается

**Проблема:** Контейнер постоянно перезапускается

**Решение:**
```bash
# Проверьте логи
docker compose logs backend

# Проверьте переменные окружения
docker exec luxee-backend env

# Пересоздайте контейнер
docker compose down
docker compose up -d --build
```

### 12.2 Ошибка подключения к MongoDB

**Проблема:** Backend не может подключиться к MongoDB

**Решение:**
```bash
# Проверьте что MongoDB запущен
docker compose ps mongodb

# Проверьте логи MongoDB
docker compose logs mongodb

# Проверьте подключение
docker exec -it luxee-mongodb mongosh -u admin -p ВАШ_ПАРОЛЬ
```

### 12.3 Порты заняты

**Проблема:** Ошибка "port is already allocated"

**Решение:**
```bash
# Найдите процесс на порту 80
sudo netstat -tulpn | grep :80

# Остановите процесс
sudo kill -9 PID

# Или измените порт в docker-compose.yml
```

### 12.4 Браузер не работает в headless режиме

**Проблема:** Ошибки Playwright в логах

**Решение:**
```bash
# Проверьте что Chromium установлен
docker exec -it luxee-backend chromium-browser --version

# Проверьте переменные окружения
docker exec luxee-backend env | grep NODE_ENV

# Должно быть: NODE_ENV=production
```

### 12.5 Frontend не загружается

**Проблема:** Белый экран или ошибка 404

**Решение:**
```bash
# Проверьте логи nginx
docker compose logs frontend

# Проверьте что файлы собрались
docker exec luxee-frontend ls -la /usr/share/nginx/html

# Пересоберите frontend
docker compose up -d --build frontend
```

---

## 📞 Получение помощи

Если у вас возникли проблемы:

1. **Проверьте логи:**
   ```bash
   docker compose logs -f
   ```

2. **Проверьте статус:**
   ```bash
   docker compose ps
   ```

3. **Проверьте переменные окружения:**
   ```bash
   cat .env
   ```

4. **Создайте issue на GitHub** с описанием проблемы и логами

---

## ✅ Чеклист успешной установки

- [ ] Docker установлен и работает
- [ ] Проект склонирован
- [ ] Файл .env создан и заполнен
- [ ] Все контейнеры запущены (docker compose ps)
- [ ] Администратор создан
- [ ] Firewall настроен
- [ ] Frontend доступен по http://ВАШ_IP
- [ ] Backend API отвечает на http://ВАШ_IP:5000/api
- [ ] Вход в систему работает
- [ ] Настроено резервное копирование

---

**🎉 Поздравляем! Ваш сервер настроен и готов к работе!**
