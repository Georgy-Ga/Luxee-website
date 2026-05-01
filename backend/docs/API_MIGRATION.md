# 🔄 Миграция с HTML парсинга на JavaScript API

## 📊 Текущее состояние проекта

### Где мы используем HTML парсинг:

#### 1. **profileParserService.js** ✅ УЖЕ МИГРИРОВАН

**Что делали раньше:**
- Парсили HTML элементы `.profiles.slick-slide` (карусель профилей)
- Искали `.profile__name`, `.profile__avatar`, `.unread-count`
- Зависели от структуры HTML

**Что парсили и ЗАЧЕМ:**

##### 📋 Список профилей девушек с непрочитанными сообщениями
**Что это:** Карусель профилей на странице `/chats/` - показывает девушек с которыми есть переписка  
**Пример:** Maria (1 непрочитанное), Anna (3 непрочитанных), Sofia (0)  
**Зачем:** Чтобы знать у каких девушек есть новые сообщения от мужчин  
**Где используется:** Главный экран чатов, уведомления, приоритизация ответов  
**Проблема:** Видим только ~10 профилей в карусели, остальные скрыты

**Что делаем сейчас:**
```javascript
// Используем JavaScript API
const chatsData = await page.evaluate(() => {
    const chatsList = modelsChat.getChats.list;
    // Получаем данные напрямую из объекта
    // Проходим по всем чатам и собираем информацию
});
```

**Преимущества:**
- ✅ Получаем **ВСЕ 50 загруженных чатов** (не только видимые в карусели)
- ✅ Видим `unAnswered: true` (сообщения прочитаны но нет ответа)
- ✅ Получаем `memberUid` (UID мужчины для отправки ответа)
- ✅ Получаем `chatId` (ID чата для навигации)
- ✅ Получаем `lastMessage` (текст последнего сообщения)
- ✅ Не зависим от HTML структуры (API стабильнее)
- ✅ **В 10-50 раз быстрее** чем парсинг DOM

---

#### 2. **luxeeScraperService.js** ❌ ТРЕБУЕТ МИГРАЦИИ

**Текущий код (строки 61-92):**
```javascript
// Получаем имя пользователя
const usernameEl = document.querySelector('.profile_info h2');
if (usernameEl) {
    data.username = usernameEl.textContent.trim();
}

// Проверяем наличие профилей
const noProfilesAlert = document.querySelector('.alert.alert-info');

// Получаем навигационное меню
document.querySelectorAll('#sidebar-menu .nav.side-menu > li').forEach(item => {
    const link = item.querySelector('a');
    // ...
});
```

**Что парсим и ЗАЧЕМ:**

##### 1️⃣ Имя пользователя (`.profile_info h2`)
**Что это:** Имя агентства/мужчины который авторизован на Luxee  
**Пример:** "John's Agency" или "Mike Dating"  
**Зачем:** Чтобы показать в нашем интерфейсе от чьего имени работаем  
**Где используется:** В профиле аккаунта, в логах, для идентификации  
**Проблема:** Парсим HTML элемент, который может измениться

##### 2️⃣ Наличие профилей (`.alert.alert-info`)
**Что это:** Проверяем есть ли у агентства профили девушек  
**Пример:** Если нет профилей - показывается алерт "There are no profiles yet"  
**Зачем:** Понять может ли агентство работать с чатами (нужен хотя бы 1 профиль)  
**Где используется:** Валидация перед началом работы с сообщениями  
**Проблема:** Ищем алерт в HTML, а не проверяем реальные данные

##### 3️⃣ Навигационное меню (`#sidebar-menu`)
**Что это:** Боковое меню сайта Luxee (Profile, Chat, Settings и т.д.)  
**Пример:** `[{text: "Profile", icon: "fa-user", href: "/profile/"}]`  
**Зачем:** Чтобы знать какие разделы доступны пользователю  
**Где используется:** Для навигации, проверки прав доступа  
**Проблема:** Парсим DOM структуру меню вместо использования роутинга

**Общие проблемы:**
- ❌ Зависит от CSS классов (изменят класс - код сломается)
- ❌ Может сломаться при изменении HTML структуры
- ❌ Медленный парсинг DOM (ждём рендеринг, ищем элементы)
- ❌ Получаем только то что видно в HTML (не все данные)

---

## 🔍 Доступные JavaScript API на Luxee.io

### Исследуем консоль браузера:

#### 1. **modelsChat** - Работа с чатами
```javascript
// В консоли браузера на luxee.io/chats/
console.log(modelsChat);

// Доступные методы:
modelsChat.getChats.list          // Список всех чатов (50 шт)
modelsChat.getChats.get(chatId)   // Получить конкретный чат
modelsChat.sendMessage(...)       // Отправить сообщение
```

**Структура чата:**
```javascript
{
  id: "1389492_1772829",
  member: {
    uid: "1772829",        // UID мужчины
    username: "John",
    avatar: {...}
  },
  profile: {
    uid: "1389492",        // UID девушки
    username: "Maria",
    avatar: {...}
  },
  lastMessage: "Hello!",
  newMessages: 1,          // Количество непрочитанных
  unAnswered: true,        // Есть неотвеченные
  lastActivity: "2026-04-25T04:30:00Z"
}
```

#### 2. **modelsProfile** - Работа с профилями
```javascript
// Нужно исследовать на странице /profile/
console.log(modelsProfile);

// Возможные методы:
modelsProfile.getProfiles.list    // Список профилей девушек
modelsProfile.getCurrent()        // Текущий профиль
modelsProfile.getStats()          // Статистика профиля
```

#### 3. **modelsUser** - Данные пользователя
```javascript
console.log(modelsUser);

// Возможные данные:
modelsUser.current               // Текущий пользователь
modelsUser.getUsername()         // Имя пользователя
modelsUser.getEmail()            // Email
```

#### 4. **modelsMenu / Navigation** - Навигация
```javascript
// Вместо парсинга меню
console.log(window.navigation);
console.log(window.router);
```

---

## 🎯 План миграции

### Этап 1: Исследование API ✅ СДЕЛАТЬ СНАЧАЛА

**Задача:** Открыть luxee.io в браузере и исследовать доступные API

**Как:**
1. Запустить сервер с `BROWSER_HEADLESS=false`
2. Авторизоваться на Luxee
3. Открыть DevTools (F12) → Console
4. Выполнить команды:

```javascript
// На странице /chats/
console.log('=== CHATS API ===');
console.log(modelsChat);
console.log(modelsChat.getChats);
console.log(modelsChat.getChats.list);

// На странице /profile/
console.log('=== PROFILE API ===');
console.log(modelsProfile);
console.log(window.models);

// На любой странице
console.log('=== USER API ===');
console.log(modelsUser);
console.log(window.currentUser);

// Глобальные объекты
console.log('=== GLOBAL ===');
console.log(Object.keys(window).filter(k => k.includes('model')));
console.log(Object.keys(window).filter(k => k.includes('user')));
```

5. Скопировать результаты в документ

---

### Этап 2: Миграция luxeeScraperService

**Файл:** `backend/src/services/luxeeApi/luxeeScraperService.js`

**Что заменить:**

#### 2.1. Имя пользователя
```javascript
// СТАРЫЙ КОД (HTML парсинг)
const usernameEl = document.querySelector('.profile_info h2');
data.username = usernameEl?.textContent.trim();

// НОВЫЙ КОД (JavaScript API)
data.username = modelsUser?.current?.username || 
                window.currentUser?.username ||
                null;
```

#### 2.2. Проверка профилей
```javascript
// СТАРЫЙ КОД
const noProfilesAlert = document.querySelector('.alert.alert-info');
data.hasProfiles = !noProfilesAlert;

// НОВЫЙ КОД
const profiles = modelsProfile?.getProfiles?.list || {};
data.hasProfiles = Object.keys(profiles).length > 0;
data.profilesCount = Object.keys(profiles).length;
data.profiles = Object.values(profiles).map(p => ({
    uid: p.uid,
    username: p.username,
    avatar: p.avatar?.thumbnail || p.avatar?.src,
    age: p.age,
    country: p.country,
}));
```

#### 2.3. Навигационное меню
```javascript
// СТАРЫЙ КОД
const menuItems = [];
document.querySelectorAll('#sidebar-menu .nav.side-menu > li').forEach(item => {
    // парсинг DOM
});

// НОВЫЙ КОД (если есть API)
const menuItems = window.navigation?.menu || 
                  window.router?.routes ||
                  []; // fallback на пустой массив

// ИЛИ оставить как есть, если меню не критично
```

---

### Этап 3: Создание нового API сервиса

**Создать:** `backend/src/services/luxeeApi/luxeeApiService.js`

```javascript
// Универсальный сервис для работы с JavaScript API Luxee
const luxeeApiService = {
    // Получить данные через JavaScript API
    executeApi: async ({ page, apiCall }) => {
        try {
            const result = await page.evaluate(apiCall);
            return { success: true, data: result };
        } catch (error) {
            console.error('[Luxee API] Error:', error);
            throw error;
        }
    },

    // Получить список чатов
    getChats: async ({ page }) => {
        return await luxeeApiService.executeApi({
            page,
            apiCall: () => {
                if (!modelsChat?.getChats?.list) {
                    throw new Error('modelsChat API not available');
                }
                return Object.values(modelsChat.getChats.list);
            },
        });
    },

    // Получить профили
    getProfiles: async ({ page }) => {
        return await luxeeApiService.executeApi({
            page,
            apiCall: () => {
                if (!modelsProfile?.getProfiles?.list) {
                    throw new Error('modelsProfile API not available');
                }
                return Object.values(modelsProfile.getProfiles.list);
            },
        });
    },

    // Получить данные пользователя
    getCurrentUser: async ({ page }) => {
        return await luxeeApiService.executeApi({
            page,
            apiCall: () => {
                return modelsUser?.current || 
                       window.currentUser || 
                       null;
            },
        });
    },

    // Отправить сообщение
    sendMessage: async ({ page, chatId, message }) => {
        return await luxeeApiService.executeApi({
            page,
            apiCall: ({ chatId, message }) => {
                if (!modelsChat?.sendMessage) {
                    throw new Error('sendMessage API not available');
                }
                return modelsChat.sendMessage(chatId, message);
            },
        });
    },
};

export default luxeeApiService;
```

---

## 📋 Чеклист миграции

### Подготовка
- [ ] Запустить браузер в видимом режиме (`BROWSER_HEADLESS=false`)
- [ ] Авторизоваться на Luxee
- [ ] Открыть DevTools и исследовать доступные API
- [ ] Задокументировать найденные API в этом файле

### Исследование API
- [ ] Исследовать `modelsChat` на `/chats/`
- [ ] Исследовать `modelsProfile` на `/profile/`
- [ ] Исследовать `modelsUser` на любой странице
- [ ] Найти API для отправки сообщений
- [ ] Найти API для получения истории чата

### Миграция кода
- [x] Мигрировать `profileParserService.js` (УЖЕ СДЕЛАНО)
- [ ] Создать `luxeeApiService.js`
- [ ] Мигрировать `luxeeScraperService.js`
- [ ] Добавить метод отправки сообщений
- [ ] Добавить метод получения истории чата

### Тестирование
- [ ] Протестировать получение чатов
- [ ] Протестировать получение профилей
- [ ] Протестировать отправку сообщений
- [ ] Сравнить результаты с HTML парсингом

---

## 🎁 Преимущества JavaScript API

### Скорость
- ⚡ **В 10-100 раз быстрее** чем парсинг DOM
- Нет необходимости ждать рендеринга HTML
- Прямой доступ к данным в памяти

### Надёжность
- 🛡️ **Не сломается** при изменении CSS/HTML
- API стабильнее чем структура DOM
- Меньше ошибок парсинга

### Полнота данных
- 📊 **Больше информации** чем в HTML
- Доступ к скрытым данным
- Метаданные и статистика

### Функциональность
- 🚀 **Можем не только читать, но и писать**
- Отправка сообщений через API
- Управление профилями
- Изменение настроек

---

## 🔧 Следующие шаги

1. **Исследовать API** - открыть консоль и изучить доступные объекты
2. **Создать luxeeApiService** - универсальный сервис для работы с API
3. **Мигрировать luxeeScraperService** - заменить HTML парсинг на API
4. **Добавить новые функции** - отправка сообщений, история чата
5. **Протестировать** - убедиться что всё работает

---

## 📝 Заметки

- Все API вызовы делаются через `page.evaluate()`
- API доступны только после полной загрузки страницы
- Некоторые API могут быть доступны только на определённых страницах
- Нужно добавлять проверки на существование API перед использованием
