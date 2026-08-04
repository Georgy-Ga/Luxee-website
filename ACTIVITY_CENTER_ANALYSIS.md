# Анализ проблемы Activity Center

## 🔴 Обнаруженные проблемы

### 1. **КРИТИЧЕСКАЯ ОШИБКА: Неправильный вызов функции**

**Файл:** `backend/src/services/aiAuto/index.js` (строки 684-698)

```javascript
// Получаем сообщения из чата
const messages = await chatMessagesExtractorService.getChatMessages(
    page,
);
```

**ПРОБЛЕМА:** 
- Вызывается функция `getChatMessages()`, но в `chatMessagesExtractorService` такой функции НЕТ!
- Сервис экспортирует только `getChatHistory`, а не `getChatMessages`
- Функция вызывается **БЕЗ ИСТОРИИ СООБЩЕНИЙ**, поэтому `messages.length` всегда будет 0 или undefined

---

### 2. **Неправильная сигнатура функции buildActivityCenterPrompt**

**Файл:** `backend/src/services/aiService/promptBuilder.js` (строки 149-154)

```javascript
export const buildActivityCenterPrompt = async ({
    activityType,
    manName,
    profile,
    customRules,
}) => {
```

**НО в коде вызывается так (index.js, строки 694-698):**

```javascript
const prompt = await buildActivityCenterPrompt(
    messages,           // ❌ Первый параметр - это messages (не объект!)
    activeProfile,      // ❌ Второй параметр - profile
    notification,       // ❌ Третий параметр - notification
);
```

**ПРОБЛЕМА:**
- Функция ожидает ОДИН объект с полями `{ activityType, manName, profile, customRules }`
- Но вызывается с ТРЕМЯ отдельными параметрами: `(messages, activeProfile, notification)`
- Это приводит к тому, что все параметры будут `undefined` внутри функции

---

### 3. **Отсутствует извлечение истории чата для Activity Center**

**Проблема:** После открытия чата из Activity Center код пытается получить историю сообщений, но:

1. Вызывается несуществующая функция `getChatMessages(page)`
2. Даже если бы она существовала, она вызывается БЕЗ параметров
3. Нужная функция - это `getChatHistory(page, limit)` из того же сервиса

---

### 4. **Не передается информация о профиле девушки**

**В функции `buildActivityCenterPrompt` отсутствуют следующие данные:**

❌ `profile.age` - возраст девушки  
❌ `profile.country` - страна  
❌ `profile.city` - город  
❌ `customRules` - кастомные правила для профиля  

**Текущий код передает только:**
- `profile.username` - имя профиля
- `profile.uid` - ID профиля

**НО НЕ ПЕРЕДАЕТ географическую информацию и правила!**

---

### 5. **Отсутствует проверка наличия истории перед построением промпта**

**Код (index.js, строки 688-698):**

```javascript
if (messages.length > 0) {
    // Получаем активный профиль
    const activeProfile = await utils.getActiveProfile(page);
    
    if (activeProfile) {
        // Построить промпт для Activity Center
        const prompt = await buildActivityCenterPrompt(
            messages,
            activeProfile,
            notification,
        );
```

**ПРОБЛЕМА:**
- Проверяется `messages.length > 0`
- Но `messages` возвращается из несуществующей функции, поэтому будет `undefined`
- `undefined.length > 0` вызовет ошибку или будет `false`
- Промпт никогда не построится

---

## 📊 Что происходит в логах?

Из логов видно:

```
[12:52:52.271] [AI Auto] 📬 Found unread notifications in Activity Center
[12:52:53.892] [Activity Center] 📋 Found 3 unread notifications
[12:52:54.053] [AI Auto] 🖱️  Clicking notification: Frank (like)
[12:52:57.679] [Activity Center] ❌ Chat did not open: expected 2060261_2814785, got 1642551_2278833
[12:52:57.705] [AI Auto] ✅ Finished cycle - no messages sent (7s)
```

**Анализ:**
1. ✅ Activity Center успешно открывается
2. ✅ Уведомления успешно находятся (3 шт.)
3. ✅ Первое уведомление кликается (Frank)
4. ❌ **Чат НЕ открывается** - открывается неправильный чат!
   - Ожидается: `2060261_2814785` (Frank)
   - Получен: `1642551_2278833` (другой чат)

---

## 🔍 Дополнительные проблемы

### 6. **Неправильная навигация к чату из Activity Center**

**Файл:** `backend/src/services/aiAuto/activityCenterScanner.js` (строки 176-188)

```javascript
const url = `https://luxee.io/chats/?ownerUid=${ownerUid}&profileUid=${profileUid}&userUid=${userUid}`;
```

**НО:** `ownerUid` передается как параметр функции `clickNotification`, но при вызове (index.js, строка 670):

```javascript
const chatOpened = await activityCenterScanner.clickNotification(
    page,
    notification,
);
```

**ПРОБЛЕМА:** Третий параметр `ownerUid` НЕ ПЕРЕДАЕТСЯ! Поэтому в URL будет `ownerUid=undefined`

---

### 7. **Отсутствует получение полной информации о профиле**

В Activity Center мы получаем только:
- `notification.manName` - имя мужчины
- `notification.activityType` - тип действия (like/favorite/wink)
- `notification.profileUid` - UID профиля девушки
- `notification.userUid` - UID мужчины

**НО НЕ ПОЛУЧАЕМ:**
- Возраст девушки
- Страну проживания
- Город проживания
- Кастомные правила

Эта информация должна извлекаться из `activeProfile` через `utils.getActiveProfile(page)`, но профиль нужно **дополнить географической информацией**.

---

## ✅ Что нужно исправить?

### 1. Исправить вызов функции извлечения сообщений

**Заменить:**
```javascript
const messages = await chatMessagesExtractorService.getChatMessages(page);
```

**На:**
```javascript
const history = await chatMessagesExtractorService.getChatHistory(page, 10);
```

---

### 2. Исправить вызов buildActivityCenterPrompt

**Заменить:**
```javascript
const prompt = await buildActivityCenterPrompt(
    messages,
    activeProfile,
    notification,
);
```

**На:**
```javascript
const prompt = await buildActivityCenterPrompt({
    activityType: notification.activityType,
    manName: notification.manName,
    profile: activeProfile,
    customRules: [], // Нужно получить из БД
});
```

---

### 3. Получать полную информацию о профиле

**Нужно расширить `utils.getActiveProfile()` чтобы она возвращала:**
- `age`
- `country`
- `city`

Или получать эту информацию отдельно через API страницы.

---

### 4. Передавать ownerUid в clickNotification

**Исправить вызов:**
```javascript
const chatOpened = await activityCenterScanner.clickNotification(
    page,
    notification,
    activeProfile.uid, // ✅ Добавить ownerUid
);
```

---

### 5. Убрать проверку на messages.length

Поскольку в Activity Center **НЕТ ИСТОРИИ** (это первое сообщение), проверка не нужна.

**Заменить:**
```javascript
if (messages.length > 0) {
    // ...
}
```

**На:**
```javascript
// Для Activity Center история не нужна - это первое сообщение
const activeProfile = await utils.getActiveProfile(page);
// ...
```

---

### 6. Получать customRules из БД

Нужно загружать кастомные правила для профиля из базы данных:

```javascript
const customRules = await getProfileCustomRules(activeProfile.uid);
```

---

## 📝 Краткое резюме

| Проблема | Описание | Критичность |
|----------|----------|-------------|
| 1. Неправильный вызов функции | `getChatMessages` не существует | 🔴 КРИТИЧНО |
| 2. Неправильная сигнатура | Передаются 3 параметра вместо 1 объекта | 🔴 КРИТИЧНО |
| 3. Нет извлечения истории | История не извлекается (хотя не нужна для AC) | 🟡 СРЕДНЕ |
| 4. Нет географической информации | Не передается country/city/age | 🔴 КРИТИЧНО |
| 5. Нет проверки истории | Проверяется несуществующая переменная | 🔴 КРИТИЧНО |
| 6. Нет ownerUid | Навигация к чату не работает | 🔴 КРИТИЧНО |
| 7. Нет customRules | Не загружаются правила профиля | 🟡 СРЕДНЕ |

---

## 🎯 Используемый промпт для Activity Center

**Текущий промпт (если бы работал):**

```
System Prompt: [DEFAULT или CUSTOM для профиля]

User Message:
My profile information:
- Name: Margarita

[NO AGE/COUNTRY/CITY! ❌]

A man named "Frank" just liked your profile. This is his first action. 
Write a warm, flirty first message to start a conversation. 
Show you noticed and are interested. Ask a question to get him talking.

IMPORTANT: This is the FIRST message in the conversation. 
There is NO previous chat history. 
Write a complete, standalone message (1-3 sentences) as Margarita.
```

**ПРОБЛЕМА:** Отсутствует информация о возрасте, стране, городе девушки!

---

## 🔍 Где живет информация о профиле?

Нужно проверить, извлекает ли `utils.getActiveProfile()` полную информацию, включая:
- `age`
- `country` 
- `city`

Если нет - нужно добавить извлечение этих данных из DOM или API.
