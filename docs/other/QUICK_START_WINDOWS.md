# ⚡ Quick Start для Windows + Cloudflare

## 🎯 Цель: Показать сайт заказчику за 20 минут

---

## 📋 Checklist (отмечай выполненное)

### Подготовка (5 минут)
- [ ] nginx скачан и распакован в `C:\nginx`
- [ ] cloudflared установлен (`winget install --id Cloudflare.cloudflared`)
- [ ] Docker Desktop запущен
- [ ] Файлы `.env` настроены (уже готовы!)

### Настройка nginx (3 минуты)
- [ ] Создан `C:\nginx\conf\luxee.conf` (смотри WINDOWS_CLOUDFLARE_DEPLOYMENT.md)
- [ ] Отредактирован `C:\nginx\conf\nginx.conf` (добавлен `include luxee.conf;`)
- [ ] Проверен конфиг: `nginx -t`
- [ ] Запущен nginx: `cd C:\nginx && start nginx`

### Настройка Cloudflare (7 минут)
- [ ] Авторизован: `cloudflared tunnel login`
- [ ] Создан туннель: `cloudflared tunnel create luxee-demo`
- [ ] Создан `C:\Users\user\.cloudflared\config.yml` (укажи TUNNEL_ID!)
- [ ] Настроен DNS: `cloudflared tunnel route dns luxee-demo SUBDOMAIN.DOMAIN.COM`

### Запуск проекта (3 минуты)
- [ ] Запущен Docker: `docker compose up -d`
- [ ] Проверен статус: `docker compose ps` (все running)
- [ ] Создан админ: `node backend/createAdmin.js` → скопировать хеш → добавить в MongoDB

### Финал (2 минуты)
- [ ] Запущен туннель: `cloudflared tunnel run luxee-demo`
- [ ] Открыт сайт в браузере: `https://SUBDOMAIN.DOMAIN.COM`
- [ ] Проверен вход под админом
- [ ] ✅ Готово! Даёшь ссылку заказчику!

---

## ⚡ Команды по порядку

```powershell
# 1. Проверить что Docker запущен
docker --version

# 2. Запустить nginx (если ещё не запущен)
cd C:\nginx
start nginx

# 3. Авторизоваться в Cloudflare (один раз)
cloudflared tunnel login

# 4. Создать туннель (один раз)
cloudflared tunnel create luxee-demo
# Запомни TUNNEL_ID из вывода!

# 5. Настроить DNS (один раз)
cloudflared tunnel route dns luxee-demo YOUR-SUBDOMAIN.YOUR-DOMAIN.COM

# 6. Запустить проект
cd C:\Users\user\Desktop\Model-site
docker compose up -d

# 7. Проверить что всё работает
docker compose ps
curl http://localhost:80

# 8. Создать админа (если ещё не создан)
node backend/createAdmin.js
# Скопируй JSON и добавь в MongoDB через MongoDB Compass или команду

# 9. Запустить туннель
cloudflared tunnel run luxee-demo

# 10. Открыть в браузере
start https://YOUR-SUBDOMAIN.YOUR-DOMAIN.COM
```

---

## 🔧 Если что-то пошло не так

### nginx не запускается
```powershell
# Убить процесс на порту 80
netstat -ano | findstr :80
taskkill /PID <PID> /F

# Проверить конфиг
nginx -t

# Запустить заново
cd C:\nginx
start nginx
```

### Docker контейнеры не запускаются
```powershell
# Посмотреть логи
docker compose logs -f

# Перезапустить
docker compose down
docker compose up -d --build
```

### Cloudflare Tunnel не работает
```powershell
# Проверить статус
cloudflared tunnel info luxee-demo

# Проверить config.yml
notepad C:\Users\user\.cloudflared\config.yml

# Перезапустить
# Ctrl+C чтобы остановить
cloudflared tunnel run luxee-demo
```

### MongoDB не работает
```powershell
# Подключиться к MongoDB контейнеру
docker exec -it luxee-mongodb mongo -u admin -p passwordbasedb --authenticationDatabase admin

# Проверить базу
use luxee
show collections
db.users.find()
```

---

## 📝 Создание админа

### Вариант 1: Через скрипт (РЕКОМЕНДУЮ)
```powershell
cd C:\Users\user\Desktop\Model-site\backend
node createAdmin.js
```
Скопируй JSON из вывода и используй его для MongoDB!

### Вариант 2: Вручную через MongoDB
```powershell
# Подключиться
docker exec -it luxee-mongodb mongo -u admin -p passwordbasedb --authenticationDatabase admin luxee

# Создать админа
db.users.insertOne({
  email: "admin@example.com",
  password: "$2b$03$...",  # хеш из createAdmin.js
  role: "admin"
})

# Проверить
db.users.findOne({email: "admin@example.com"})
```

---

## 🎯 Что показать заказчику

1. **Вход в систему** - https://YOUR-SUBDOMAIN.YOUR-DOMAIN.COM/login
2. **Dashboard** - главная страница после входа
3. **Функционал AI** - автоответы, управление
4. **Админ панель** - управление пользователями

---

## 💡 После демо

### Остановить всё
```powershell
# Остановить туннель
Ctrl+C в окне cloudflared

# Остановить Docker
docker compose down

# Остановить nginx
nginx -s stop
```

### Запустить заново
```powershell
cd C:\Users\user\Desktop\Model-site
docker compose up -d
cd C:\nginx
start nginx
cloudflared tunnel run luxee-demo
```

---

## 📊 Полезные команды

```powershell
# Логи backend
docker compose logs -f backend

# Логи frontend
docker compose logs -f frontend

# Логи MongoDB
docker compose logs -f mongodb

# Статус nginx
netstat -ano | findstr :80

# Статус туннеля
cloudflared tunnel info luxee-demo

# Список туннелей
cloudflared tunnel list
```

---

## ⚠️ Важно!

1. **Не выключай компьютер** пока идёт демо!
2. **Не закрывай окно с cloudflared** - иначе туннель упадёт
3. **Интернет должен работать** - туннель через него
4. **Docker Desktop должен быть запущен**

---

## 🚀 Следующие шаги после оплаты

1. Восстановить сервер или взять новый VPS
2. Перенести на production
3. Настроить SSL
4. Настроить backup MongoDB
5. Отключить Cloudflare Tunnel

Подробнее в WINDOWS_CLOUDFLARE_DEPLOYMENT.md → Раздел 5
