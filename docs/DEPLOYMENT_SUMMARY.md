# 🚀 Краткое резюме: Развертывание проекта

Быстрая справка по развертыванию проекта Luxee на сервере.

---

## ✅ Что было сделано

### 1. Docker конфигурация
- ✅ Создан `docker-compose.yml` для оркестрации всех сервисов
- ✅ Dockerfile для backend (Node.js + Playwright)
- ✅ Dockerfile для frontend (React + Nginx)
- ✅ Настроена сеть между контейнерами
- ✅ Добавлены health checks и автоматический перезапуск

### 2. Headless режим браузера
- ✅ Браузер автоматически запускается в headless режиме когда `NODE_ENV=production`
- ✅ В режиме разработки браузер остается видимым для отладки
- ✅ Можно принудительно включить через `BROWSER_HEADLESS=true`
- ✅ Отключено замедление (slowMo) в production для производительности

### 3. Документация
- ✅ `SERVER_SETUP_GUIDE.md` - подробное руководство для новичков (12 разделов)
- ✅ `DOCKER_DEPLOYMENT.md` - полная документация по Docker
- ✅ `QUICK_START.md` - быстрый старт за 5 минут
- ✅ `DOCKER_FILES_SUMMARY.md` - описание всех созданных файлов
- ✅ `VERSION_ROLLBACK.md` - как вернуться к версии без Docker
- ✅ Обновлен `README.md` с инструкциями по Docker

### 4. Переменные окружения
- ✅ `.env.example` с подробными комментариями
- ✅ `backend/.env.example` для backend
- ✅ `frontend/.env.example` для frontend
- ✅ Добавлена поддержка `ALLOWED_ORIGINS` для CORS

### 5. Git коммит
- ✅ Создан коммит `0e84c57` с описанием всех изменений
- ✅ Предыдущая версия сохранена в коммите `a9e4538`

---

## 🎯 Быстрый старт на сервере

### Минимальная команда для запуска:

```bash
# 1. Клонировать проект
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website

# 2. Настроить переменные
cp .env.example .env
nano .env  # Заполните ОБЯЗАТЕЛЬНЫЕ переменные

# 3. Запустить всё
docker compose up -d

# 4. Создать администратора
docker exec -it luxee-backend node createAdmin.js
```

**Готово!** Приложение доступно на `http://ваш-сервер-ip`

---

## 📝 Обязательные переменные окружения

Минимум что нужно настроить в `.env`:

```env
# MongoDB пароль (сгенерируйте: openssl rand -base64 32)
MONGO_ROOT_PASSWORD=ваш_надежный_пароль

# JWT секреты (сгенерируйте два разных: openssl rand -base64 32)
JWT_ACCESS_SECRET=первый_секрет
JWT_REFRESH_SECRET=второй_секрет

# OpenAI ключ (получите на platform.openai.com)
OPENAI_API_KEY=sk-ваш-ключ

# URL вашего сервера
VITE_API_URL=http://192.168.1.100:5000/api

# CORS origins
ALLOWED_ORIGINS=http://192.168.1.100,http://192.168.1.100:80
```

---

## 📚 Документация

| Файл | Описание | Для кого |
|------|----------|----------|
| **QUICK_START.md** | Быстрый старт за 5 минут | Опытные пользователи |
| **SERVER_SETUP_GUIDE.md** | Подробное руководство | Новички |
| **DOCKER_DEPLOYMENT.md** | Полная документация | Все |
| **VERSION_ROLLBACK.md** | Возврат к старой версии | При проблемах |
| **DOCKER_FILES_SUMMARY.md** | Описание файлов | Разработчики |

---

## 🔧 Полезные команды

```bash
# Просмотр статуса
docker compose ps

# Логи в реальном времени
docker compose logs -f

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Обновление
git pull && docker compose up -d --build

# Бэкап MongoDB
docker exec luxee-mongodb mongodump --username admin --password ПАРОЛЬ --out /data/backup
docker cp luxee-mongodb:/data/backup ./backup-$(date +%Y%m%d)
```

---

## 🌐 Доступ к сервисам

После запуска:

- **Frontend:** http://ваш-сервер-ip (порт 80)
- **Backend API:** http://ваш-сервер-ip:5000/api
- **MongoDB:** mongodb://admin:пароль@ваш-сервер-ip:27017 (порт 27017)

---

## 🔄 Возврат к старой версии (без Docker)

Если нужно вернуться к версии без Docker:

```bash
# Временный возврат (для тестирования)
git checkout a9e4538

# Полный откат (удаление Docker)
git reset --hard a9e4538

# Создание отдельной ветки
git checkout a9e4538 -b no-docker-version
```

Подробнее в `VERSION_ROLLBACK.md`

---

## 🎨 Особенности браузера

### В production (на сервере):
- ✅ Браузер работает в **headless режиме** (невидимый)
- ✅ Без замедления (slowMo = 0)
- ✅ Оптимизирован для производительности

### В development (локально):
- 👁️ Браузер **видимый** для отладки
- 🐌 С замедлением (slowMo = 150ms)
- 🔧 Удобно для разработки

### Принудительный headless:
```env
# В .env добавьте:
BROWSER_HEADLESS=true
```

---

## 🔒 Безопасность

### Реализовано:
- ✅ Секреты через переменные окружения
- ✅ .gitignore для .env файлов
- ✅ CORS настроен для конкретных origins
- ✅ Security headers в Nginx
- ✅ Минимальные Alpine образы

### Рекомендуется:
- 🔐 Используйте HTTPS (настройте reverse proxy)
- 🔐 Закройте порт MongoDB (27017) для внешнего доступа
- 🔐 Используйте сильные пароли
- 🔐 Настройте firewall (ufw)
- 🔐 Регулярно обновляйте Docker образы

---

## 📊 Структура проекта

```
Luxee-website/
├── docker-compose.yml          # Оркестрация сервисов
├── .env.example                # Пример переменных
│
├── backend/
│   ├── Dockerfile              # Backend образ
│   ├── .dockerignore
│   └── .env.example
│
├── frontend/
│   ├── Dockerfile              # Frontend образ
│   ├── nginx.conf              # Nginx конфигурация
│   ├── .dockerignore
│   └── .env.example
│
└── docs/
    ├── SERVER_SETUP_GUIDE.md   # Подробное руководство
    ├── DOCKER_DEPLOYMENT.md    # Docker документация
    ├── QUICK_START.md          # Быстрый старт
    ├── VERSION_ROLLBACK.md     # Откат версии
    └── DOCKER_FILES_SUMMARY.md # Описание файлов
```

---

## 🆘 Решение проблем

### Контейнер не запускается
```bash
docker compose logs backend
docker compose down
docker compose up -d --build
```

### Ошибка подключения к MongoDB
```bash
docker compose logs mongodb
docker exec -it luxee-mongodb mongosh -u admin -p ПАРОЛЬ
```

### Браузер не работает
```bash
docker exec luxee-backend env | grep NODE_ENV
# Должно быть: NODE_ENV=production
```

### Frontend не загружается
```bash
docker compose logs frontend
docker exec luxee-frontend ls -la /usr/share/nginx/html
```

Подробнее в разделе 12 файла `SERVER_SETUP_GUIDE.md`

---

## 📞 Поддержка

- 📖 Читайте документацию в папке проекта
- 🐛 Создавайте issue на GitHub
- 💬 Проверяйте логи: `docker compose logs -f`

---

## ✅ Чеклист успешного развертывания

- [ ] Docker установлен на сервере
- [ ] Проект склонирован
- [ ] Файл .env создан и заполнен
- [ ] Все контейнеры запущены (`docker compose ps`)
- [ ] Администратор создан
- [ ] Firewall настроен
- [ ] Frontend доступен по http://IP
- [ ] Backend API отвечает
- [ ] Вход в систему работает
- [ ] Браузер работает в headless режиме
- [ ] Настроено резервное копирование

---

## 🎉 Готово!

Ваш проект упакован в Docker и готов к развертыванию на сервере!

**Коммит с Docker:** `0e84c57`  
**Коммит без Docker:** `a9e4538`

**Дата создания:** 30.05.2026  
**Версия:** 1.0
