# 📚 ДОКУМЕНТАЦИЯ ПРОЕКТА MODEL-SITE

> **Навигация по документации проекта**  
> **Обновлено:** 04.05.2026

---

## 🗺️ СТРУКТУРА ДОКУМЕНТАЦИИ

### 📍 Этот файл (main.md)
**Назначение:** Навигация и быстрый доступ ко всей документации

### 📁 `/docs/api/`
**Что здесь:** Документация API и внешних интеграций
- `luxee-api.md` - Luxee JavaScript API (modelsChat)
- `backend-api.md` - REST API нашего backend

### 📁 `/docs/architecture/`
**Что здесь:** Архитектура системы и структура проекта
- `project-structure.md` - Полная структура файлов проекта
- `message-flow.md` - Как работает проверка и отправка сообщений
- `chat-identity.md` - Система идентификации чатов (ВАЖНО!)

### 📁 `/docs/backend/`
**Что здесь:** Backend документация
- `services.md` - Описание всех сервисов
- `controllers.md` - Контроллеры и роуты
- `models.md` - Модели данных

### 📁 `/docs/frontend/`
**Что здесь:** Frontend документация
- `components.md` - React компоненты
- `stores.md` - Zustand stores
- `api-integration.md` - Интеграция с backend

---

## 🚀 БЫСТРЫЙ СТАРТ

### Для AI (меня):
1. **Начни с:** `architecture/project-structure.md` - полная карта проекта
2. **Затем:** `api/luxee-api.md` - как работает Luxee API
3. **Важно:** `architecture/chat-identity.md` - система chatId

### Для разработчиков Backend:
1. `architecture/project-structure.md` - структура проекта
2. `backend/services.md` - все сервисы
3. `api/backend-api.md` - REST API эндпоинты

### Для разработчиков Frontend:
1. `frontend/components.md` - компоненты
2. `frontend/stores.md` - управление состоянием
3. `frontend/api-integration.md` - работа с API

---

## 📊 КЛЮЧЕВЫЕ КОНЦЕПЦИИ

### 🔑 Chat Identity System
**Файл:** `architecture/chat-identity.md`  
**Суть:** `chatId` = `"profileUid_memberUid"` (НЕ просто memberUid!)

### 🔄 Message Flow
**Файл:** `architecture/message-flow.md`  
**Суть:** Проверка БЕЗ очереди, отправка В очереди

### 🏗️ Project Structure
**Файл:** `architecture/project-structure.md`  
**Суть:** Где что лежит и кто кого использует

---

## 🔍 ПОИСК ИНФОРМАЦИИ

### Нужно понять как работает проверка сообщений?
→ `architecture/message-flow.md` → раздел "Проверка сообщений"

### Нужно понять структуру Luxee API?
→ `api/luxee-api.md` → `modelsChat.getProfile.data` и `modelsChat.getChats.list`

### Нужно найти конкретный файл?
→ `architecture/project-structure.md` → Ctrl+F по имени файла

### Нужно понять какой сервис за что отвечает?
→ `backend/services.md` → список всех сервисов с описанием

### Нужно понять компоненты фронтенда?
→ `frontend/components.md` → описание всех компонентов

---

## 📝 АКТУАЛЬНОСТЬ ДОКУМЕНТАЦИИ

### ✅ Актуальные документы:
- `api/luxee-api.md` - обновлено 04.05.2026
- `architecture/project-structure.md` - обновлено 04.05.2026
- `architecture/chat-identity.md` - обновлено 04.05.2026
- `architecture/message-flow.md` - обновлено 04.05.2026

### ⚠️ Устаревшие концепции (НЕ используются):
- ❌ Отдельные вкладки для проверки сообщений (старая архитектура)
- ❌ MessageCheckerTab / MessageCheckerManager (удалены)
- ❌ Переключение профилей при проверке (теперь читаем API напрямую)

---

## 🎯 ПРИНЦИПЫ ДОКУМЕНТАЦИИ

### Для AI (меня):
- **Минимум текста, максимум структуры** - быстро найти нужное
- **Ссылки между документами** - легко переходить
- **Примеры кода** - понять как использовать
- **Актуальность** - только то что работает СЕЙЧАС

### Что НЕ документируем:
- ❌ Устаревшие подходы (только если нужно объяснить почему не так)
- ❌ Планы на будущее (только текущее состояние)
- ❌ Очевидные вещи (не нужно объяснять что такое React)

---

## 📂 ФАЙЛОВАЯ СТРУКТУРА

```
docs/
├── main.md                          # ← ВЫ ЗДЕСЬ (навигация)
│
├── api/                             # API документация
│   ├── luxee-api.md                 # Luxee JavaScript API
│   └── backend-api.md               # Наш REST API
│
├── architecture/                    # Архитектура
│   ├── project-structure.md         # Структура проекта
│   ├── message-flow.md              # Поток сообщений
│   └── chat-identity.md             # Система chatId
│
├── backend/                         # Backend
│   ├── services.md                  # Все сервисы
│   ├── controllers.md               # Контроллеры
│   └── models.md                    # Модели
│
└── frontend/                        # Frontend
    ├── components.md                # Компоненты
    ├── stores.md                    # Stores
    └── api-integration.md           # API интеграция
```

---

## 🔧 ТЕХНОЛОГИИ

### Backend:
- Node.js + Express
- Playwright (браузерная автоматизация)
- MongoDB (база данных)
- JWT (авторизация)

### Frontend:
- React + Vite
- TailwindCSS
- Zustand (state management)
- Axios (HTTP клиент)

---

**Версия документации:** 2.0  
**Дата:** 04.05.2026  
**Статус:** ✅ Актуально
