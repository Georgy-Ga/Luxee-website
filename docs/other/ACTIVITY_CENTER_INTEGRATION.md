# Activity Center Integration - Интеграция центра уведомлений

## 📋 Обзор

Добавлен новый приоритет обработки сообщений в AI Auto: **Activity Center** (Центр уведомлений).

Теперь система проверяет уведомления из колокольчика на сайте luxee.io и отвечает на них **после Catch-up, но перед завершением цикла**.

---

## 🔄 Новый порядок обработки

```
1. New Messages (новые сообщения)
2. Unanswered (неотвеченные сообщения)
3. Catch-up (старые сообщения)
4. 🔔 Activity Center (уведомления) ← НОВОЕ
5. Завершение цикла
```

---

## 📂 Структура файлов

### 1. **activityCenterScanner.js**
Файл: `backend/src/services/aiAuto/activityCenterScanner.js`

Основная функция: `scanActivityCenter(page)`

**Что делает:**
- Открывает Activity Center (колокольчик)
- Фильтрует уведомления с классом `.new` (непрочитанные)
- Извлекает данные пользователя из каждого уведомления:
  - `data-user-uid` - ID пользователя
  - Имя пользователя из `<strong>` тега
  - Тип активности: `favorite`, `like`, `wink`

**Возвращает:**
```javascript
{
  users: [
    {
      userId: '2887629',
      userName: 'Andy',
      activityType: 'favorite' // или 'like' или 'wink'
    }
  ]
}
```

---

### 2. **index.js (AI Auto)**
Файл: `backend/src/services/aiAuto/index.js`

**Интеграция в основной цикл:**

Строки 634-738: Activity Center обработка

```javascript
// 🔔 4️⃣ ACTIVITY CENTER
utils.log('AI Auto', '🔔 Checking Activity Center...');
const activityResult = await activityCenterScanner.scanActivityCenter(page);

if (activityResult.users && activityResult.users.length > 0) {
  const user = activityResult.users[0]; // Берем первого пользователя
  
  // Открываем чат с пользователем
  await page.click(`li[data-user-uid="${user.userId}"]`);
  
  // Генерируем ответ через AI
  const prompt = await promptBuilder.buildActivityCenterPrompt({
    activityType: user.activityType,
    userName: user.userName,
    profileName: profile.profileName,
    profileBio: profile.bio || '',
  });
  
  // Отправляем сообщение
  const result = await chatProcessor.processAndSendMessage({
    page,
    messages: [],
    prompt,
    accountId,
    userName: user.userName,
  });
  
  if (result.success) {
    // Закрываем Activity Center
    await page.goto('https://luxee.io/chats/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    
    return { processed: true, reason: 'activity_center' };
  }
}
```

---

### 3. **promptBuilder.js**
Файл: `backend/src/services/aiService/promptBuilder.js`

Функция: `buildActivityCenterPrompt()`

**Генерирует промпт для AI на основе типа активности:**
- `favorite` → "пользователь добавил тебя в избранное"
- `like` → "пользователь лайкнул твой профиль"
- `wink` → "пользователь подмигнул тебе"

---

## 🎯 Как это работает

### Шаг 1: Открытие Activity Center
```javascript
await page.click('#activity-center-btn'); // Клик по колокольчику
await page.waitForSelector('.activity-center-data', { timeout: 5000 });
```

### Шаг 2: Парсинг уведомлений
```javascript
const notifications = await page.$$eval(
  'li.activity-center-link.new',
  elements => elements.map(el => ({
    userId: el.getAttribute('data-user-uid'),
    userName: el.querySelector('.activity-center-data-title strong')?.innerText?.trim(),
    activityType: el.classList.contains('favorite') ? 'favorite' :
                  el.classList.contains('like') ? 'like' :
                  el.classList.contains('wink') ? 'wink' : 'unknown'
  }))
);
```

### Шаг 3: Открытие чата
```javascript
// Клик по уведомлению с нужным data-user-uid
await page.click(`li[data-user-uid="${user.userId}"]`);
await page.waitForSelector('.chat-msg-form', { timeout: 10000 });
```

### Шаг 4: Отправка сообщения
AI генерирует персонализированный ответ на основе:
- Типа активности (favorite/like/wink)
- Имени пользователя
- Имени и био профиля

### Шаг 5: Закрытие Activity Center
```javascript
await page.goto('https://luxee.io/chats/', { 
  waitUntil: 'domcontentloaded', 
  timeout: 10000 
});
```

---

## ⚠️ Важные моменты

### 1. **Приоритет обработки**
Activity Center обрабатывается **после Catch-up**, но **перед завершением цикла**.

### 2. **Обработка только новых уведомлений**
Система обрабатывает только уведомления с классом `.new` (непрочитанные).

### 3. **Обработка по одному**
За один цикл обрабатывается **только одно уведомление** (первое в списке).

### 4. **Закрытие Activity Center**
После отправки сообщения система **обязательно закрывает** Activity Center, возвращаясь на `/chats/`.

### 5. **Типы активностей**
Поддерживаются 3 типа:
- `favorite` - добавление в избранное
- `like` - лайк профиля
- `wink` - подмигивание

---

## 🔍 HTML структура Activity Center

### Колокольчик
```html
<a href="javascript:;" id="activity-center-btn" class="user-activity has-new">
  <img src="/images/ic_bell.svg" alt="Activity">
</a>
```

### Список уведомлений
```html
<li class="activity-center-link new favorite" 
    data-uid="12372850" 
    data-user-uid="2887629" 
    data-profile-uid="2060261">
  <div class="activity-center-data-avatar">...</div>
  <div class="activity-center-data-main">
    <div class="activity-center-data-title">
      <strong>Andy</strong> followed <strong>Victoria</strong>
    </div>
    <div class="activity-center-data-time">17 hours ago</div>
  </div>
</li>
```

### Важные атрибуты
- `data-user-uid` - ID пользователя, который совершил действие
- `class="new"` - непрочитанное уведомление
- `class="favorite"` / `class="like"` / `class="wink"` - тип действия

---

## 📊 Логирование

### Успешная обработка
```
[AI Auto] 🔔 Checking Activity Center...
[AI Auto] 🔔 Found 15 users in Activity Center
[AI Auto] 🔔 Processing user Andy (favorite)
[AI Auto] ✅ Sent message to Andy from Activity Center
[🚦 NAVIGATION] 🔄 Closing Activity Center...
[🚦 NAVIGATION] ✅ Returned to /chats/, Activity Center closed
[AI Auto] ✅ Finished cycle - message sent (45s)
```

### Нет уведомлений
```
[AI Auto] 🔔 Checking Activity Center...
[AI Auto] 📭 No users in Activity Center
[AI Auto] ✅ Finished cycle - no messages sent (12s)
```

---

## 🧪 Тестирование

### 1. Проверка сканирования
```javascript
const result = await activityCenterScanner.scanActivityCenter(page);
console.log(result); // { users: [...] }
```

### 2. Проверка типов активностей
Убедитесь, что система корректно определяет:
- `favorite` (follow)
- `like`
- `wink`

### 3. Проверка навигации
- Activity Center открывается
- Чат открывается при клике на уведомление
- Activity Center закрывается после отправки

---

## ✅ Статус интеграции

- [x] Создан файл `activityCenterScanner.js`
- [x] Добавлена функция `scanActivityCenter`
- [x] Интегрировано в основной цикл `index.js`
- [x] Добавлена функция `buildActivityCenterPrompt` в `promptBuilder.js`
- [x] Добавлено логирование
- [x] Добавлена обработка ошибок
- [x] Добавлено автоматическое закрытие Activity Center

---

## 🎉 Готово!

Activity Center полностью интегрирован в AI Auto систему. Теперь бот будет автоматически отвечать на уведомления из колокольчика!
