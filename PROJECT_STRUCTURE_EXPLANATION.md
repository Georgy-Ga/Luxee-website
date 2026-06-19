# 📂 Объяснение структуры проекта

**Дата:** 19.06.2026  
**Статус:** ✅ Документация

---

## ❓ Ваши вопросы

### 1. Зачем корневые `node_modules` и `package.json`?
### 2. Почему не всё в `backend/` и `frontend/`?
### 3. MongoDB в Docker - автоматически поднимется?

---

## 📦 Корневые node_modules и package.json

### Что это?

В корне проекта у вас есть:
```
c:/Users/user/Desktop/Model-site/
├── package.json          ← Корневой
├── package-lock.json     ← Корневой
├── node_modules/         ← Корневая папка
│   └── axios/
├── backend/
│   ├── package.json      ← Backend зависимости
│   └── node_modules/     ← Backend зависимости
└── frontend/
    ├── package.json      ← Frontend зависимости
    └── node_modules/     ← Frontend зависимости
```

### Зачем они нужны?

**Корневой `package.json` содержит:**
```json
{
  "dependencies": {
    "axios": "^1.16.0"
  }
}
```

Это **общие зависимости**, которые могут использоваться в:
- Скриптах автоматизации
- Утилитах для тестирования
- CI/CD конфигурации
- Миграциях базы данных
- Общих инструментах

### Пример: зачем axios в корне?

Возможно использовался для:
```javascript
// scripts/test-api.js (гипотетический скрипт в корне)
const axios = require('axios');

// Тестирование API после деплоя
axios.get('http://localhost:5000/api/health')
  .then(res => console.log('✅ API работает'))
  .catch(err => console.error('❌ API не отвечает'));
```

### Нужно ли это?

**Вариант 1: Оставить (если используется)**
- Если есть скрипты в корне проекта
- Если есть общие утилиты
- ✅ Не мешает работе

**Вариант 2: Удалить (если не используется)**
```bash
# Если axios нигде не используется в корневых скриптах
rm -rf node_modules
rm package.json package-lock.json
```

**Рекомендация:** 
- Проверьте есть ли в корне `.js` файлы которые импортируют `axios`
- Если нет - можете безопасно удалить
- Если есть - оставьте

---

## 🏗️ Почему структура именно такая?

### Монорепозиторий (Monorepo)

Ваш проект использует **монорепозиторий** подход:

```
Model-site/                    ← Корневая папка проекта
├── 📝 Документация (.md)      ← Общая для всего проекта
├── 🐳 docker-compose.yml      ← Оркестрация всех сервисов
├── 📦 package.json            ← Общие зависимости (опционально)
├── backend/                   ← Backend приложение
│   ├── package.json           ← Backend зависимости
│   ├── Dockerfile             ← Backend контейнер
│   └── src/                   ← Backend код
├── frontend/                  ← Frontend приложение
│   ├── package.json           ← Frontend зависимости
│   ├── Dockerfile             ← Frontend контейнер
│   └── src/                   ← Frontend код
└── spambot/                   ← Отдельная утилита (Python)
    ├── requirements.txt       ← Python зависимости
    └── src/                   ← Python код
```

### Преимущества такой структуры:

✅ **Единый Git репозиторий**
- Все изменения в одном месте
- Легко синхронизировать версии backend/frontend
- Общая история коммитов

✅ **Единый Docker Compose**
- Одной командой запускаются все сервисы
- Общая сеть для контейнеров
- Централизованная конфигурация

✅ **Общая документация**
- Все `.md` файлы в одном месте
- Легко найти информацию
- Единый README.md

✅ **Изолированные зависимости**
- Backend имеет свои `node_modules`
- Frontend имеет свои `node_modules`
- Нет конфликтов версий

---

## 🐳 MongoDB в Docker - автоматически поднимется?

### ✅ ДА! Полностью автоматически

Когда вы на сервере выполните:
```bash
docker compose up -d
```

### Что произойдёт:

```
1️⃣ Docker прочитает docker-compose.yml
   ↓
2️⃣ Запустит 3 контейнера одновременно:
   
   📦 mongodb (контейнер базы данных)
   - Образ: mongo:7.0
   - Порт: 27017 (внутри Docker сети)
   - Volume: mongodb_data (для сохранения данных)
   - Автоматически создаёт:
     * Пользователя admin
     * Пароль из .env
     * База данных luxee
   
   📦 backend (контейнер Node.js)
   - Образ: собирается из backend/Dockerfile
   - Порт: 5000 (доступен извне)
   - Автоматически подключается к mongodb
   - Ждёт пока MongoDB запустится (healthcheck)
   
   📦 frontend (контейнер Nginx)
   - Образ: собирается из frontend/Dockerfile
   - Порт: 80 (доступен извне)
   - Раздаёт статику React
   ↓
3️⃣ Все контейнеры подключены к общей сети
   backend ←→ mongodb (по имени "mongodb")
   frontend ←→ backend (через reverse proxy)
```

### Конфигурация MongoDB в docker-compose.yml:

```yaml
mongodb:
  image: mongo:7.0
  container_name: luxee-mongodb
  environment:
    MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME:-admin}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-changeme}
    MONGO_INITDB_DATABASE: luxee
  ports:
    - "27017:27017"  # Проброс порта (опционально)
  volumes:
    - mongodb_data:/data/db  # ✅ Данные сохраняются!
  networks:
    - luxee-network
  restart: unless-stopped
```

### ✅ Преимущества:

1. **Автоматический запуск**
   - Не нужно устанавливать MongoDB вручную
   - Не нужно настраивать
   - Всё работает из коробки

2. **Изоляция**
   - MongoDB внутри Docker сети
   - Безопасность: доступен только backend контейнеру
   - Порт 27017 не торчит наружу (можно закрыть)

3. **Сохранение данных**
   - Volume `mongodb_data` хранит данные
   - При перезапуске контейнера данные НЕ пропадают
   - При `docker compose down` данные сохраняются
   - **Важно:** При `docker compose down -v` данные УДАЛЯЮТСЯ!

4. **Автоматическое восстановление**
   - `restart: unless-stopped` - автоматический перезапуск при сбое
   - При перезагрузке сервера - автоматически стартует

---

## 🔧 Что происходит на сервере

### Шаг 1: Клонирование репозитория
```bash
git clone https://github.com/Georgy-Ga/Luxee-website.git
cd Luxee-website
```

### Шаг 2: Настройка .env
```bash
cp .env.example .env
nano .env
```

Заполнить:
```env
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=super_strong_password_123
JWT_ACCESS_SECRET=generated_secret_here
JWT_REFRESH_SECRET=another_generated_secret
AI_API_KEY=your-deepseek-api-key
VITE_API_URL=http://YOUR_SERVER_IP:5000/api
```

### Шаг 3: Запуск (одна команда!)
```bash
docker compose up -d --build
```

**Что произойдёт:**
```
[+] Building backend (5s)
[+] Building frontend (3s)
[+] Running 4/4
 ✔ Network luxee-network    Created
 ✔ Container luxee-mongodb  Started  ← ✅ MongoDB запущен!
 ✔ Container luxee-backend  Started  ← Ждал пока MongoDB готов
 ✔ Container luxee-frontend Started
```

### Шаг 4: Создание администратора
```bash
# Войти в backend контейнер
docker compose exec backend sh

# Запустить скрипт
node createAdmin.js
# Ввести: email, password, name

# Выйти
exit
```

### Шаг 5: Готово! 🎉
```
✅ MongoDB работает (внутри Docker)
✅ Backend подключён к MongoDB
✅ Frontend раздаётся через Nginx
✅ Все данные сохраняются в volume
```

---

## 📊 Проверка MongoDB на сервере

### Проверить что MongoDB запущен:
```bash
docker compose ps mongodb
```

Вывод:
```
NAME            STATUS          PORTS
luxee-mongodb   Up 2 minutes    0.0.0.0:27017->27017/tcp
```

### Подключиться к MongoDB:
```bash
docker compose exec mongodb mongosh -u admin -p your_password
```

### Посмотреть базы данных:
```javascript
show dbs
use luxee
show collections
```

### Посмотреть логи MongoDB:
```bash
docker compose logs mongodb
```

---

## 🔍 Volumes - сохранение данных

### Где хранятся данные MongoDB?

```bash
# Посмотреть volumes
docker volume ls

# Вывод:
DRIVER    VOLUME NAME
local     model-site_mongodb_data  ← Здесь хранится база данных!
```

### Физическое расположение:
```
Linux: /var/lib/docker/volumes/model-site_mongodb_data/_data
Windows: \\wsl$\docker-desktop-data\data\docker\volumes\model-site_mongodb_data\_data
```

### Бэкап базы данных:
```bash
# Создать бэкап
docker compose exec mongodb mongodump \
  --username admin \
  --password your_password \
  --authenticationDatabase admin \
  --out /data/backup

# Скопировать на хост
docker cp luxee-mongodb:/data/backup ./backup-$(date +%Y%m%d)

# Восстановить из бэкапа
docker cp ./backup-20260619 luxee-mongodb:/data/restore
docker compose exec mongodb mongorestore \
  --username admin \
  --password your_password \
  --authenticationDatabase admin \
  /data/restore
```

---

## ⚠️ Важные моменты

### 1. Удаление данных
```bash
# ✅ БЕЗОПАСНО - останавливает, но сохраняет данные
docker compose down

# ❌ ОПАСНО - удаляет ВСЕ данные MongoDB!
docker compose down -v

# ⚠️ ИСПОЛЬЗУЙТЕ С ОСТОРОЖНОСТЬЮ!
```

### 2. Первый запуск
- База данных **пустая**
- **Обязательно** создайте администратора: `node createAdmin.js`
- Без администратора не сможете войти в систему

### 3. Порты
- **27017** - MongoDB (можно закрыть в docker-compose.yml для безопасности)
- **5000** - Backend API (должен быть открыт)
- **80** - Frontend (должен быть открыт)

### 4. Безопасность
- Используйте **сильные пароли** для MongoDB
- Генерируйте **уникальные JWT секреты**
- Настройте **firewall** на сервере
- Используйте **HTTPS** на production

---

## 🎯 Итоги

### Корневые node_modules:
- ✅ Могут быть для общих скриптов
- ✅ Не мешают работе backend/frontend
- ✅ Добавлены в .gitignore
- ⚠️ Можно удалить если не используются

### Структура проекта:
- ✅ Монорепозиторий (всё в одном Git)
- ✅ Изолированные зависимости (backend/frontend отдельно)
- ✅ Общая документация и Docker Compose
- ✅ Правильная архитектура

### MongoDB в Docker:
- ✅ **Автоматически** запускается при `docker compose up -d`
- ✅ **Автоматически** создаёт пользователя и базу данных
- ✅ **Автоматически** сохраняет данные в volume
- ✅ **Автоматически** восстанавливается при сбоях
- ✅ **НЕ требует** ручной установки MongoDB

### Spambot:
- ✅ Добавлен в `.gitignore`
- ✅ НЕ будет загружаться на GitHub
- ✅ Остаётся локально для вашего использования

---

## 📝 Следующие шаги

1. ✅ Проверьте что изменения применились: `git status`
2. ✅ Закоммитьте обновлённый `.gitignore`: 
   ```bash
   git add .gitignore
   git commit -m "Add spambot to .gitignore"
   git push origin main
   ```
3. ✅ При деплое на сервер MongoDB запустится автоматически
4. ✅ Не забудьте создать первого администратора после запуска

**Всё готово для деплоя!** 🚀
