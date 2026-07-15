# 🚀 План интеграции Spambot в веб-приложение Luxee

**Дата создания:** 15.07.2026  
**Статус:** 📋 В планировании

---

## 📊 Обзор задачи

### Цель
Перенести функционал standalone Python приложения **spambot** в веб-приложение Luxee с разделением на:
- **Python Backend Service** (Docker контейнер) - вся логика рассылки
- **Node.js API** - связующее звено между frontend и Python service
- **React Frontend** - UI для управления рассылками

### Текущее состояние spambot
- **Технологии:** Python 3.x, Tkinter GUI, Selenium/RPA Framework
- **Функционал:** 
  - Массовая рассылка сообщений в чаты
  - Массовая рассылка писем (mail)
  - Фильтрация по типу пользователей (платные/бесплатные)
  - Фильтрация по статусу чата (пустой/непустой)
  - Исключение пользователей по ID
  - Отправка конкретным пользователям
  - Лимиты на рассылку
  - Защита от блокировки (задержки)

---

## ✅ Что уже есть в проекте

### Backend Infrastructure
- ✅ Browser Service с Playwright
- ✅ Context Management (создание/восстановление контекстов)
- ✅ Luxee API интеграция (вход, профили, сообщения)
- ✅ User/Account management
- ✅ Role-based access (user/admin)
- ✅ MongoDB для хранения данных
- ✅ Docker infrastructure

### Frontend Infrastructure
- ✅ React + Vite
- ✅ Authentication
- ✅ Account management UI
- ✅ API integration

---

## 🎯 Требования к реализации

### UI/UX Navigation (как AI Test)
1. **Основной dashboard:** `http://148.251.233.7/dashboard`
2. **Кнопка:** "Рассылка" (заменяет "AI Test", функционал AI Test сохраняется без кнопки)
3. **При клике:** Переход на `/spambot` (аналогично `/ai-test`)
4. **На странице `/spambot`:**
   - Единый интерфейс для User и Admin
   - Автоматическое определение прав доступа
   - Выбор luxee-аккаунта внутри страницы

### Единый интерфейс для User и Admin

**Одинаковый функционал:**
- Выбор luxee-аккаунта (dropdown)
- Все настройки рассылки из spambot GUI
- Добавление/удаление сообщений ⭐
- Управление рассылками (запуск/остановка/закрытие контекста)
- Статусы с цветными индикаторами (🔴🔵🟢)
- Просмотр истории рассылок

**Разница только в доступных аккаунтах:**
- **User:** Видит только свои luxee-аккаунты
- **Admin:** Видит ВСЕ luxee-аккаунты всех пользователей

### Автоматическая авторизация
- ✅ Использовать существующие авторизованные luxee-аккаунты
- ✅ Брать cookies/session из уже авторизованных контекстов
- ✅ Не требовать повторного ввода логина/пароля
- ✅ Автоматически авторизовывать при запуске рассылки

---

## 🏗️ Архитектура решения

### Компоненты системы

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React)                          │
│  Route: /spambot (аналогично /ai-test)                     │
│  - SpambotPage (единый для User/Admin)                     │
│  - AccountSelector (фильтрация по роли)                    │
│  - DistributionSettings (все настройки из GUI)             │
│  - MessageManager (добавление/удаление)                     │
│  - StatusMonitor (🔴🔵🟢 индикаторы)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────────────────────┐
│              NODE.JS BACKEND (Express)                      │
│  - SpambotController (API + проксирование)                 │
│  - Интеграция с существующими luxee-accounts               │
│  - Автоматическая передача cookies/session                 │
│  - WebSocket broadcasting статусов                         │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP API + Session Data
┌────────────────────▼────────────────────────────────────────┐
│    PYTHON SERVICE (оригинальный spambot + FastAPI)         │
│  - FastAPI обертка над существующим кодом                  │
│  - Минимальные изменения в spambot логике                  │
│  - Удален только Tkinter GUI                               │
│  - Вся логика рассылки БЕЗ ИЗМЕНЕНИЙ                       │
│  - Selenium/RPA Framework остается как есть                │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ ВАЖНО: Минимальные изменения в Python коде
- **НЕ переписываем на Playwright** - оставляем RPA Framework/Selenium как есть
- **НЕ меняем логику** - сохраняем всю работу с браузером и рассылкой
- **Только удаляем:** Tkinter GUI компоненты
- **Только добавляем:** FastAPI слой для HTTP API
- **Цель:** Обернуть существующий код в API, не трогая внутреннюю логику

### Docker контейнеры
1. **luxee-frontend** (существующий)
2. **luxee-backend** (существующий)
3. **luxee-spambot** ⭐ (новый) - Python service
4. **luxee-mongodb** (существующий)

---

## 📝 Детальный план реализации

## ЭТАП 1: Подготовка Python Service (Spambot Backend)

### 1.1 Создание FastAPI приложения
- [ ] Структура проекта `backend-spambot/`
- [ ] Dockerfile для Python service
- [ ] requirements.txt (FastAPI, Playwright, etc.)
- [ ] Конфигурация для работы в Docker

### 1.2 Адаптация кода spambot (МИНИМАЛЬНЫЕ ИЗМЕНЕНИЯ)
- [ ] Удалить только Tkinter GUI зависимости (`src/application/` папку)
- [ ] Создать FastAPI обертку над существующим кодом
- [ ] Создать API endpoints вызывающие существующие классы
- [ ] **НЕ ТРОГАТЬ:** `luxee_browser.py`, `luxee_requests.py`, `process.py`
- [ ] **НЕ МЕНЯТЬ:** RPA Framework/Selenium - оставить как есть
- [ ] **Сохранить 100%:** Всю бизнес-логику рассылки

### 1.3 API Endpoints для Python Service
```python
POST   /api/distribution/start      - Запуск рассылки
POST   /api/distribution/stop       - Остановка рассылки
GET    /api/distribution/status     - Статус рассылки
GET    /api/distribution/history    - История рассылок
DELETE /api/distribution/context    - Закрыть browser context
```

### 1.4 Модели данных
- [ ] DistributionConfig (настройки рассылки)
- [ ] DistributionStatus (статус выполнения)
- [ ] DistributionResult (результаты)

---

## ЭТАП 2: Интеграция с Node.js Backend

### 2.1 Создание моделей MongoDB
- [ ] `SpambotDistribution` - конфигурации рассылок
- [ ] `SpambotHistory` - история выполнения
- [ ] `SpambotMessage` - сообщения для рассылки

### 2.2 Создание SpambotController
- [ ] Проксирование запросов к Python service
- [ ] Валидация прав доступа (user/admin)
- [ ] Сохранение конфигураций в MongoDB

### 2.3 Новые API endpoints
```javascript
// User endpoints
POST   /api/spambot/distributions           - Создать конфигурацию
GET    /api/spambot/distributions           - Получить конфигурации
PUT    /api/spambot/distributions/:id       - Обновить конфигурацию
DELETE /api/spambot/distributions/:id       - Удалить конфигурацию
POST   /api/spambot/distributions/:id/start - Запустить
POST   /api/spambot/distributions/:id/stop  - Остановить
GET    /api/spambot/distributions/:id/status - Статус
POST   /api/spambot/messages                - Добавить сообщение
DELETE /api/spambot/messages/:id            - Удалить сообщение

// Admin endpoints
GET    /api/spambot/admin/users             - Все пользователи + статусы
GET    /api/spambot/admin/distributions     - Все рассылки
POST   /api/spambot/admin/distributions/:id/stop - Остановить любую рассылку
```

### 2.4 WebSocket события
- [ ] `spambot:status` - обновление статуса рассылки
- [ ] `spambot:progress` - прогресс выполнения
- [ ] `spambot:complete` - завершение рассылки
- [ ] `spambot:error` - ошибки

---

## ЭТАП 3: Frontend разработка

### 3.1 Компоненты для User
- [ ] `SpambotButton` - кнопка "Рассылка" (заменяет AI Test)
- [ ] `AccountSelector` - выбор luxee-аккаунта
- [ ] `DistributionSettings` - настройки рассылки (адаптация из spambot GUI)
- [ ] `MessageList` - список сообщений с удалением ⭐
- [ ] `DistributionStatus` - текущий статус
- [ ] `DistributionControls` - кнопки управления

### 3.2 Компоненты для Admin
- [ ] `AdminSpambotDashboard` - главная панель
- [ ] `UserDistributionsList` - список всех пользователей
- [ ] `DistributionStatusIndicator` - цветные индикаторы (🔴🔵🟢)
- [ ] `AdminControls` - управление рассылками

### 3.3 API интеграция
- [ ] Создать `spambotApi.js` для всех запросов
- [ ] WebSocket подписки на события
- [ ] Real-time обновление статусов

---

## ЭТАП 4: Docker и деплой

### 4.1 Конфигурация
- [ ] Dockerfile для `luxee-spambot`
- [ ] Обновить `docker-compose.yml`
- [ ] Network настройки между контейнерами
- [ ] Environment variables

### 4.2 Volumes и данные
- [ ] Volume для browser contexts spambot
- [ ] Персистентность данных MongoDB

---

## 📋 Чеклист задач

### Python Service (backend-spambot/)
- [ ] Создать структуру проекта
- [ ] Настроить FastAPI
- [ ] Портировать luxee_browser.py на Playwright
- [ ] Портировать luxee_requests.py
- [ ] Портировать models.py
- [ ] Портировать process.py (логика рассылки)
- [ ] Создать API endpoints
- [ ] Создать Dockerfile
- [ ] Тестирование базового функционала

### Node.js Backend
- [ ] Создать MongoDB модели
- [ ] Создать SpambotController
- [ ] Создать SpambotService
- [ ] Добавить routes в index.js
- [ ] Интегрировать WebSocket события
- [ ] Добавить middleware для прав доступа
- [ ] Тестирование API

### Frontend
- [ ] Удалить кнопку "AI Test" (сохранить функционал)
- [ ] Создать SpambotManagement page
- [ ] Создать компоненты настроек
- [ ] Создать компоненты управления сообщениями
- [ ] Создать Admin dashboard
- [ ] Интегрировать WebSocket
- [ ] Стилизация компонентов
- [ ] Тестирование UI

### Docker & DevOps
- [ ] Создать Dockerfile для spambot service
- [ ] Обновить docker-compose.yml
- [ ] Настроить network между контейнерами
- [ ] Настроить environment variables
- [ ] Тестирование в Docker
- [ ] Обновить документацию деплоя

---

## ⚠️ Потенциальные сложности и решения

### 1. Playwright в Docker
**Проблема:** Playwright требует специальной настройки в Docker  
**Решение:** Использовать официальный образ `mcr.microsoft.com/playwright/python` (уже используется в основном backend)

### 2. Совместное использование Browser Contexts
**Проблема:** Конфликт между основным backend и spambot service  
**Решение:** Создавать полностью независимые контексты для spambot (отдельный контейнер, отдельные volume)

### 3. Real-time статусы
**Проблема:** Как передавать прогресс рассылки в реальном времени  
**Решение:** WebSocket из Python service → Node.js → Frontend

### 4. Масштабируемость
**Проблема:** Множественные одновременные рассылки  
**Решение:** Queue system (можно использовать Bull/BullMQ с Redis в будущем)

### 5. Удаление сообщений из рассылки
**Проблема:** В оригинальном spambot нет функции удаления  
**Решение:** Добавить новую функцию управления списком сообщений

---

## 🔧 Технологический стек

### Python Service
- **FastAPI** - современный async web framework
- **RPA Framework/Selenium** - browser automation (БЕЗ ИЗМЕНЕНИЙ из spambot)
- **Pydantic** - валидация данных
- **httpx** - async HTTP клиент (если потребуется)
- **python-dotenv** - environment variables

### Node.js Backend (дополнения)
- **axios** - HTTP клиент для Python service
- **socket.io** - WebSocket для real-time updates

### Frontend (дополнения)
- **react-query** - управление состоянием API
- **socket.io-client** - WebSocket клиент

---

## 📅 Оценка времени

| Этап | Время | Приоритет |
|------|-------|-----------|
| Python Service базовая структура | 2-3 дня | 🔴 Высокий |
| Портирование логики spambot | 3-4 дня | 🔴 Высокий |
| Node.js API integration | 2 дня | 🔴 Высокий |
| Frontend User компоненты | 2-3 дня | 🔴 Высокий |
| Frontend Admin dashboard | 1-2 дня | 🟡 Средний |
| Docker setup & testing | 1 день | 🔴 Высокий |
| Тестирование и баг-фиксы | 2-3 дня | 🔴 Высокий |
| **ИТОГО** | **13-18 дней** | |

---

## 🎯 MVP (Minimum Viable Product)

Для быстрого запуска можно реализовать MVP:

### MVP Scope
1. ✅ Python service с базовой рассылкой в чат
2. ✅ Node.js API для создания/запуска рассылки
3. ✅ Frontend для User (без Admin dashboard)
4. ✅ Базовые фильтры (платные/бесплатные)
5. ✅ Добавление/удаление сообщений

### MVP исключает
- ❌ Mail рассылка (только chat)
- ❌ Admin dashboard (добавится позже)
- ❌ Advanced фильтры
- ❌ История рассылок

**MVP время:** 7-10 дней

---

## 📌 Следующие шаги

1. **Подтверждение архитектуры** - убедиться что подход правильный
2. **Вопросы и уточнения** - обсудить неясные моменты
3. **Выбор стратегии** - MVP или полная реализация
4. **Начало разработки** - с Python service

---

## ✅ Ответы на вопросы (получены от клиента)

1. **Приоритет функционала:**
   - ✅ **Полная реализация** (chat + mail + admin) сразу
   - ✅ Mail рассылка критична - нужна с первой версии

2. **Admin функционал:**
   - ✅ Полный контроль админа нужен сразу
   - ✅ **Единый интерфейс** для User и Admin (отличие только в доступных аккаунтах)

3. **UI/UX:**
   - ✅ **Отдельная страница** `/spambot` (как `/ai-test`)
   - ✅ Единый интерфейс с выбором luxee-аккаунта внутри страницы
   - ✅ Цветные индикаторы статуса (🔴🔵🟢)

4. **Автоматическая авторизация:**
   - ✅ Использовать существующие авторизованные luxee-аккаунты
   - ✅ Не требовать повторного ввода логина/пароля
   - ✅ Автоматически брать cookies/session

5. **Python код:**
   - ✅ **Минимальные изменения** - не переписывать на Playwright
   - ✅ Только удалить Tkinter GUI
   - ✅ Добавить FastAPI обертку
   - ✅ Сохранить RPA Framework/Selenium как есть

---

## ✅ Финальные ответы на дополнительные вопросы

1. **Приоритет запуска рассылок:**
   - ✅ **1 активная рассылка на 1 luxee-аккаунт**
   - ✅ Если рассылка запущена → пользователь может только смотреть статус или остановить
   - ✅ **ВАЖНО:** Внутри рассылки может быть **очередь распределений** для разных профилей девушек
   - ✅ Пользователь может добавлять несколько распределений на разные профили в одну рассылку

2. **История рассылок:**
   - ✅ **НЕ хранить историю** в БД
   - ✅ Логирование только в консоль контейнера для отладки
   - ✅ В UI показывать только текущий статус (время выполнения + кружок 🔴🔵🟢)
   - ✅ Реализация как в оригинальном spambot

3. **Уведомления:**
   - ✅ **Желтая точка** возле кнопки при завершении рассылки (in-app notification)
   - ✅ Для админа то же самое (визуальный индикатор)
   - ✅ **БЕЗ звука**

4. **Ограничения безопасности:**
   - ✅ **НЕ добавлять** новые ограничения
   - ✅ Использовать защиту как в оригинальном spambot
   - ✅ Лимиты сообщений - как есть в spambot

5. **Сохранение конфигураций:**
   - ✅ **НЕ сохранять** шаблоны/presets
   - ✅ При выборе другого профиля - **настройки НЕ сбрасываются** (исправление бага exe приложения)
   - ✅ При первом запуске страницы - настройки по умолчанию

---

**Статус документа:** 📋 Готов к обсуждению  
**Автор:** AI Assistant  
**Версия:** 1.0
