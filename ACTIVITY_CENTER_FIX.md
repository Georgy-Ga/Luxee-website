# Activity Center Fix - Исправление отправки сообщений

## ✅ Исправления выполнены

Исправлена критическая проблема с отправкой сообщений из Activity Center (колокольчик).

---

## 🔧 Что было исправлено

### 1. **Убрана проверка истории сообщений**

**БЫЛО:**
```javascript
// Получаем сообщения из чата
const messages = await chatMessagesExtractorService.getChatMessages(page);

if (messages.length > 0) {
    // Строим промпт...
}
```

**СТАЛО:**
```javascript
// ✅ Для Activity Center история НЕ НУЖНА - это первое сообщение
utils.log('AI Auto', '📝 Building prompt for Activity Center (first message)...');

// Строим промпт сразу без проверки истории
```

**Причина:** 
- Activity Center = первое сообщение, истории нет
- Функция `getChatMessages` не существует в сервисе
- Проверка `messages.length > 0` всегда была `false`

---

### 2. **Исправлен вызов buildActivityCenterPrompt**

**БЫЛО (неправильно):**
```javascript
const prompt = await buildActivityCenterPrompt(
    messages,           // ❌ 3 отдельных параметра
    activeProfile,
    notification,
);
```

**СТАЛО (правильно):**
```javascript
const prompt = await buildActivityCenterPrompt({
    activityType: notification.activityType,  // ✅ Один объект
    manName: notification.manName,
    profile: activeProfile,
    customRules: [], // TODO: Загрузить из БД если нужно
});
```

**Причина:** Функция ожидает ОДИН объект с полями, а не 3 отдельных параметра.

---

### 3. **Добавлен ownerUid при открытии чата**

**БЫЛО:**
```javascript
const chatOpened = await activityCenterScanner.clickNotification(
    page,
    notification,
    // ❌ ownerUid не передавался
);
```

**СТАЛО:**
```javascript
const chatOpened = await activityCenterScanner.clickNotification(
    page,
    notification,
    activeProfile.uid, // ✅ Передаем ownerUid
);
```

**Причина:** Без `ownerUid` URL был неправильным: `ownerUid=undefined`, и чат не открывался.

---

### 4. **Получение профиля ДО открытия чата**

**БЫЛО:**
```javascript
const chatOpened = await activityCenterScanner.clickNotification(...);

if (chatOpened) {
    const activeProfile = await utils.getActiveProfile(page);
    // ...
}
```

**СТАЛО:**
```javascript
// Получаем активный профиль ДО открытия чата
const activeProfile = await utils.getActiveProfile(page);

if (!activeProfile) {
    utils.log('AI Auto', '❌ No active profile for Activity Center');
    await activityCenterScanner.closeActivityCenter(page);
    return { processed: false, reason: 'no_active_profile' };
}

const chatOpened = await activityCenterScanner.clickNotification(
    page,
    notification,
    activeProfile.uid,
);
```

**Причина:** `ownerUid` нужен ДО открытия чата для построения правильного URL.

---

### 5. **Передача пустой истории в processAndSendMessage**

**БЫЛО:**
```javascript
const result = await chatProcessor.processAndSendMessage(
    page,
    prompt,
    account,
    messages,  // ❌ undefined
    { type: 'activityCenter', notification },
);
```

**СТАЛО:**
```javascript
const result = await chatProcessor.processAndSendMessage(
    page,
    prompt,
    account,
    [], // ✅ Пустая история для Activity Center
    { type: 'activityCenter', notification },
);
```

**Причина:** Activity Center = первое сообщение, история должна быть пустым массивом.

---

## 📝 Логика работы Activity Center (после исправления)

1. ✅ Проверяется наличие непрочитанных уведомлений
2. ✅ Открывается Activity Center (колокольчик)
3. ✅ Получается список непрочитанных уведомлений
4. ✅ Берется ПЕРВОЕ уведомление (FIFO)
5. ✅ Получается активный профиль с полной информацией (age, country, city)
6. ✅ Открывается чат с правильным ownerUid
7. ✅ Строится промпт для первого сообщения (БЕЗ истории)
8. ✅ Генерируется и отправляется сообщение через AI
9. ✅ Возврат к чатам после отправки

---

## 🎯 Промпт для Activity Center

**Что передается в AI:**

```
System Prompt: [DEFAULT или CUSTOM для профиля]

User Message:
My profile information:
- Name: Margarita
- Age: 25                    ✅ Передается
- Country: Ukraine           ✅ Передается
- City: Kyiv                 ✅ Передается

[Custom rules if any]        ✅ Можно добавить

A man named "Frank" just liked your profile. This is his first action. 
Write a warm, flirty first message to start a conversation. 
Show you noticed and are interested. Ask a question to get him talking.

IMPORTANT: This is the FIRST message in the conversation. 
There is NO previous chat history. 
Write a complete, standalone message (1-3 sentences) as Margarita.
```

---

## 🔍 Что НЕ было изменено (и не нужно менять)

✅ `utils.getActiveProfile()` - уже возвращает age, country, city  
✅ `buildActivityCenterPrompt()` - функция работает правильно  
✅ `activityCenterScanner` - сканер уведомлений работает  
✅ `chatProcessor.processAndSendMessage()` - отправка работает  

---

## ⚠️ TODO (опционально)

1. **Загрузка customRules из БД:**
   ```javascript
   // Вместо:
   customRules: []
   
   // Можно добавить:
   customRules: await getProfileCustomRules(activeProfile.uid)
   ```

2. **Кеширование обработанных уведомлений** (чтобы не отправлять дважды)

---

## 🧪 Как протестировать

1. Запустите backend: `cd backend && npm start`
2. Включите AI Auto Response для аккаунта
3. Попросите кого-то поставить лайк/подписаться/подмигнуть
4. Проверьте логи:
   ```
   [AI Auto] 📬 Found unread notifications in Activity Center
   [Activity Center] 📋 Found X unread notifications
   [AI Auto] 🖱️  Clicking notification: NAME (like/favorite/wink)
   [Activity Center] ✅ Chat opened: XXXXX_YYYYY
   [AI Auto] 📝 Building prompt for Activity Center (first message)...
   [AI Auto] ✅ Sent message to NAME from Activity Center
   ```

5. Проверьте что сообщение отправилось в чат

---

## 📊 Статус

- ✅ Код исправлен
- ✅ Убрана проверка истории
- ✅ Исправлен вызов функции
- ✅ Добавлен ownerUid
- ✅ Передается географическая информация профиля
- ⏳ Требуется тестирование

---

## 📁 Измененные файлы

- `backend/src/services/aiAuto/index.js` (строки 661-735)

---

## 🎉 Результат

Activity Center теперь должен правильно:
1. Открывать чаты из уведомлений
2. Строить промпты с полной информацией о профиле
3. Генерировать и отправлять первые сообщения
4. Обрабатывать like, favorite, wink события

---

**Дата исправления:** 31.07.2026  
**Автор:** Kiro AI Assistant
