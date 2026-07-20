# AI Schedule Feature - Интервалы работы/отдыха ИИ

## 📋 Описание

Функционал автоматического управления интервалами работы и отдыха ИИ для каждого пользователя.

### Основная задача
Позволить администратору настраивать автоматическое включение/выключение ИИ для пользователя по заданному расписанию вместо постоянной работы 24/7.

### Пример использования
Админ настраивает:
- **Работа**: 16 часов
- **Отдых**: 8 часов

Результат:
1. ИИ автоматически работает 16 часов
2. Затем автоматически выключается на 8 часов
3. После отдыха снова включается на 16 часов
4. Цикл повторяется

Админ может в любой момент:
- Включить режим 24/7 (постоянная работа)
- Изменить интервалы
- Посмотреть текущий статус (работает/отдыхает)
- Увидеть время следующего переключения

---

## 🏗️ Архитектура

### Backend

#### 1. **UserModel** (`backend/src/models/UserModel.js`)
Добавлено поле `aiSchedule`:
```javascript
aiSchedule: {
  enabled: Boolean,        // Включен ли режим интервалов
  workMinutes: Number,     // Минут работы (по умолчанию 960 = 16ч)
  restMinutes: Number,     // Минут отдыха (по умолчанию 480 = 8ч)
  currentState: String,    // 'disabled' | 'working' | 'resting'
  lastToggleTime: Date,    // Время последнего переключения
  nextToggleTime: Date     // Время следующего переключения
}
```

#### 2. **aiScheduleService** (`backend/src/services/aiScheduleService.js`)
Основной сервис для управления расписанием:

**Методы:**
- `getScheduleStatus(userId)` - Получить текущий статус расписания
- `updateScheduleSettings(userId, settings)` - Обновить настройки
- `resetSchedule(userId)` - Сбросить расписание (при выключении ИИ)
- `checkAndToggleIfNeeded(userId)` - Проверить и переключить состояние при необходимости
- `shouldAiWorkNow(userId)` - Проверить, должен ли ИИ работать сейчас

**Логика работы:**
1. При включении расписания (`enabled: true`):
   - Устанавливается `currentState: 'working'`
   - Рассчитывается `nextToggleTime` = сейчас + workMinutes
   
2. При проверке (`checkAndToggleIfNeeded`):
   - Если `nextToggleTime` прошло:
     - `working` → `resting` (следующее = сейчас + restMinutes)
     - `resting` → `working` (следующее = сейчас + workMinutes)
   - Отправляется WebSocket событие всем клиентам

3. При выключении расписания (`enabled: false`):
   - `currentState: 'disabled'`
   - `nextToggleTime: null`

#### 3. **aiAuto Integration** (`backend/src/services/aiAuto/index.js`)
Интегрирован вызов `aiScheduleService.checkAndToggleIfNeeded()` в основной цикл:

```javascript
async processAccount(accountId) {
  // ...
  
  // Проверяем расписание перед обработкой
  await aiScheduleService.checkAndToggleIfNeeded(account.userId);
  const shouldWork = await aiScheduleService.shouldAiWorkNow(account.userId);
  
  if (!shouldWork) {
    console.log('[AI Auto] Account in rest period, skipping');
    return;
  }
  
  // Продолжаем обработку...
}
```

#### 4. **WebSocket Events** (`backend/src/config/socket.js`, `backend/src/services/socketService.js`)
Добавлено событие `AI_SCHEDULE_CHANGED`:

```javascript
// Отправка события при изменении расписания
socket.emitAIScheduleChanged(userId, {
  enabled: true,
  workMinutes: 960,
  restMinutes: 480
}, 'working', nextToggleTime);

// Структура события:
{
  userId: string,
  settings: {
    enabled: boolean,
    workMinutes: number,
    restMinutes: number
  },
  currentState: 'disabled' | 'working' | 'resting',
  nextToggleTime: Date | null
}
```

#### 5. **REST API Routes** (`backend/src/routes/index.js`, `backend/src/controllers/aiScheduleController.js`)

**Endpoints:**
- `GET /api/ai/schedule/me` - Получить своё расписание (для пользователя)
- `GET /api/ai/schedule/:userId` - Получить расписание пользователя (admin)
- `POST /api/ai/schedule/:userId` - Обновить расписание (admin)
- `DELETE /api/ai/schedule/:userId` - Сбросить расписание (admin)

---

### Frontend

#### 1. **AiScheduleSettings Component** (`frontend/src/components/AiSchedule/AiScheduleSettings.jsx`)

Компактный UI компонент для настройки интервалов.

**Внешний вид:**
```
┌─────────────────────────────────────┐
│  [🕐] 24/7 [⚙️]  │ ← Кнопка-индикатор
└─────────────────────────────────────┘
        ↓ При клике открывается popup
┌───────────────────────────────────────┐
│  Интервалы работы ИИ                  │
│  user@example.com                     │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Режим 24/7          [Toggle Off]│ │
│  │ ИИ работает постоянно            │ │
│  └─────────────────────────────────┘ │
│                                       │
│  💡 В режиме 24/7 ИИ работает...     │
└───────────────────────────────────────┘
```

**Или при включённом расписании:**
```
┌─────────────────────────────────────┐
│  [🕐] Работает [⚙️]  │ ← Пульсирует
└─────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Интервалы работы ИИ                  │
│  user@example.com                     │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ По расписанию       [Toggle On] │ │
│  │ 16ч работы, 8ч отдыха            │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Работа (часов)                       │
│  [16          ]                       │
│                                       │
│  Отдых (часов)                        │
│  [8           ]                       │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Следующее переключение           │ │
│  │ 19.07 23:45                      │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [      Применить      ]              │
└───────────────────────────────────────┘
```

**Функции:**
- Отображение текущего состояния (24/7 / Работает / Отдых)
- Переключатель режима
- Настройка времени работы/отдыха
- Отображение следующего переключения
- WebSocket real-time обновления

**Props:**
```javascript
{
  userId: string,      // ID пользователя
  userEmail: string    // Email для отображения
}
```

#### 2. **Интеграция в Admin Panel** (`frontend/src/components/AdminModal/AiTab/UserAiCard.jsx`)

Компонент добавлен рядом с кнопкой управления ИИ:

```jsx
<AiScheduleSettings userId={user._id} userEmail={user.email} />
<AccountToggleButton userId={user._id} />
```

#### 3. **WebSocket Integration**

Компонент подписывается на событие `ai:schedule:changed`:

```javascript
useEffect(() => {
  if (!socket) return;

  const handleScheduleChanged = (data) => {
    if (data.userId === userId) {
      setSchedule({
        enabled: data.settings?.enabled,
        workMinutes: data.settings?.workMinutes,
        restMinutes: data.settings?.restMinutes,
        currentState: data.currentState,
        nextToggleTime: data.nextToggleTime
      });
    }
  };

  socket.on('ai:schedule:changed', handleScheduleChanged);
  return () => socket.off('ai:schedule:changed', handleScheduleChanged);
}, [socket, userId]);
```

---

## 🔄 Workflow

### Сценарий 1: Включение расписания

1. **Админ** открывает настройки интервалов для пользователя
2. Включает переключатель "По расписанию"
3. Устанавливает: Работа 16ч, Отдых 8ч
4. Нажимает "Применить"

**Backend:**
```
POST /api/ai/schedule/:userId
→ aiScheduleService.updateScheduleSettings()
  → Сохраняет settings в UserModel
  → Устанавливает currentState: 'working'
  → Рассчитывает nextToggleTime = now + 16h
  → Отправляет WebSocket событие всем клиентам
```

**Frontend:**
```
WebSocket: ai:schedule:changed
→ Все открытые админ-панели обновляют UI
→ Показывают "Работает" + время следующего переключения
```

### Сценарий 2: Автоматическое переключение

1. **AI Auto** обрабатывает чаты каждого аккаунта
2. Перед обработкой вызывает `checkAndToggleIfNeeded()`

**Backend:**
```javascript
// В aiAuto/index.js
await aiScheduleService.checkAndToggleIfNeeded(userId);

// В aiScheduleService.js
if (now >= user.aiSchedule.nextToggleTime) {
  if (currentState === 'working') {
    // Переходим в отдых
    user.aiSchedule.currentState = 'resting';
    user.aiSchedule.nextToggleTime = now + restMinutes;
    
    socketService.emitAIScheduleChanged(...);
  } else if (currentState === 'resting') {
    // Переходим к работе
    user.aiSchedule.currentState = 'working';
    user.aiSchedule.nextToggleTime = now + workMinutes;
    
    socketService.emitAIScheduleChanged(...);
  }
}
```

3. Проверяет `shouldAiWorkNow()`
```javascript
if (currentState === 'resting') {
  console.log('[AI Auto] In rest period, skipping');
  return; // Пропускаем обработку
}
```

**Frontend:**
```
WebSocket: ai:schedule:changed
→ UI обновляется автоматически:
  - "Работает" → "Отдых"
  - Иконка меняет цвет (зелёный → оранжевый)
  - Обновляется время следующего переключения
```

### Сценарий 3: Выключение расписания (возврат к 24/7)

1. **Админ** выключает переключатель "По расписанию"

**Backend:**
```
POST /api/ai/schedule/:userId { enabled: false }
→ aiScheduleService.updateScheduleSettings()
  → Устанавливает currentState: 'disabled'
  → Очищает nextToggleTime: null
  → WebSocket событие
```

**Frontend:**
```
WebSocket: ai:schedule:changed
→ UI показывает "24/7"
→ Скрываются настройки времени
```

---

## 🎨 UI/UX Детали

### Индикаторы состояния

| Состояние | Иконка | Цвет | Анимация | Текст |
|-----------|--------|------|----------|-------|
| 24/7 (disabled) | ⚡ Power | Серый | - | "24/7" |
| Работает | 🕐 Clock | Зелёный | Пульсация | "Работает" |
| Отдых | 🕐 Clock | Оранжевый | - | "Отдых" |

### Размещение
Компонент размещён **между** счётчиком аккаунтов и кнопкой вкл/выкл ИИ:

```
[user@example.com] [ADMIN]   Аккаунтов: 3   [🕐 24/7 ⚙️]   [Включить ИИ]
```

Компактный размер: ~120px ширина, не занимает много места.

### Popup
- Открывается **справа** от кнопки (справа-налево UI)
- Закрывается при клике вне
- Ширина: 320px
- Адаптивный: скрывает/показывает поля в зависимости от режима

---

## 🔧 Настройка и использование

### Для администратора

1. Откройте **Admin Modal** → вкладка **AI Management**
2. Найдите пользователя в списке
3. Рядом с кнопкой управления ИИ увидите компонент интервалов
4. Кликните на него для настройки

### Значения по умолчанию
- **Работа**: 16 часов (960 минут)
- **Отдых**: 8 часов (480 минут)
- **Режим**: 24/7 (интервалы выключены)

### Ограничения
- Минимальное время работы/отдыха: **1 час**
- Максимальное время работы/отдыха: **24 часа**
- Настройки в часах (без минут для простоты)

---

## 📊 Логирование

### Backend
```
[AI Schedule Service] User <userId> schedule updated: enabled=true, work=960, rest=480
[AI Schedule Service] Toggled <userId> from working to resting, next at <time>
[AI Auto] Account in rest period, skipping
```

### Frontend
```
[AI Schedule] WebSocket update: { userId, currentState: 'resting', nextToggleTime: ... }
```

---

## 🐛 Troubleshooting

### Проблема: ИИ не переключается автоматически
**Причина**: AI Auto может быть выключен или не обрабатывает аккаунты.

**Решение**: 
- Проверьте, что AI Auto включён для пользователя
- Проверьте логи: `[AI Schedule Service] Toggled...`

### Проблема: UI не обновляется при переключении
**Причина**: WebSocket может быть отключен.

**Решение**:
- Проверьте WebSocket соединение в DevTools
- Обновите страницу

### Проблема: Расписание сбрасывается при перезапуске
**Причина**: MongoDB не сохраняет данные.

**Решение**:
- Проверьте подключение к БД
- Убедитесь, что поля `aiSchedule` сохраняются в UserModel

---

## 🚀 Будущие улучшения

### Возможные доработки:
1. **Минутная точность** - настройка не только часов, но и минут
2. **Множественные интервалы** - несколько циклов в день
3. **Расписание по дням недели** - разные настройки для разных дней
4. **История переключений** - логирование всех изменений состояния
5. **Уведомления** - оповещения при переключении
6. **Статистика** - сколько времени ИИ работал/отдыхал

---

## 📝 Checklist реализации

- [x] Backend: UserModel (aiSchedule field)
- [x] Backend: aiScheduleService
- [x] Backend: aiScheduleController
- [x] Backend: REST API routes
- [x] Backend: WebSocket события
- [x] Backend: Интеграция в AI Auto
- [x] Frontend: AiScheduleSettings компонент
- [x] Frontend: Интеграция в UserAiCard
- [x] Frontend: WebSocket обработка
- [x] Документация

---

## 📚 Связанные файлы

### Backend
- `backend/src/models/UserModel.js` - Модель данных
- `backend/src/services/aiScheduleService.js` - Бизнес-логика
- `backend/src/controllers/aiScheduleController.js` - HTTP контроллер
- `backend/src/routes/index.js` - API маршруты
- `backend/src/config/socket.js` - WebSocket события
- `backend/src/services/socketService.js` - WebSocket эмиттеры
- `backend/src/services/aiAuto/index.js` - Интеграция проверки

### Frontend
- `frontend/src/components/AiSchedule/AiScheduleSettings.jsx` - UI компонент
- `frontend/src/components/AdminModal/AiTab/UserAiCard.jsx` - Интеграция
- `frontend/src/contexts/SocketContext.jsx` - WebSocket контекст

---

**Дата создания**: 19.07.2026  

