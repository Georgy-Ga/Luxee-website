# 🔬 Анализ Luxee JavaScript API (НЕПРОВЕРЕНО)

> ⚠️ **ВНИМАНИЕ:** Эта документация создана на основе анализа исходного кода Luxee.  
> Методы НЕ ПРОТЕСТИРОВАНЫ в реальных условиях.  
> Используй с осторожностью и проверяй перед применением!

---

## 📚 Источник данных
- **Файл:** `backend/docs/extractedLuxee/chat.v2.js`
- **Размер:** 10,253 строки
- **Дата анализа:** 25.04.2026

---

## 🎯 Публичный API (modelsChat)

Найден в строках **9942-9983** - это объект который возвращается и становится `modelsChat`:

```javascript
return {
    // Навигация
    selectProfile: profiles.selectProfile,      // ✅ ИСПОЛЬЗУЕМ
    selectChat: chats.selectChat,              // ✅ ИСПОЛЬЗУЕМ
    
    // Сообщения
    sendMessage: input.sendMessage,            // 🔥 НОВОЕ - отправка сообщений
    editMessage: input.editMessage,            // 🔥 НОВОЕ - редактирование
    deleteMessage: input.deleteMessage,        // 🔥 НОВОЕ - удаление
    reSendMessage: input.reSendMessage,        // 🔥 НОВОЕ - повторная отправка
    updateMessage: input.updateMessage,        // 🔥 НОВОЕ - обновление
    clearEdit: input.clearEdit,                // Очистка редактирования
    
    // Файлы и медиа
    fileChangedHandler: input.fileChangedHandler,  // Обработка выбора файлов
    removeSelectedFiles: input.removeSelectedFiles, // Удаление выбранных файлов
    attachFiles: input.attachFiles,                // Прикрепление файлов
    deleteMedia: input.deleteMedia,                // Удаление медиа
    playVideo: input.playVideo,                    // Воспроизведение видео
    playProfileVideo: profileMedia.playProfileVideo, // Видео профиля
    openDisappearingMedia: openDisappearingMedia,  // Исчезающие медиа
    
    // Избранное и фильтры
    toggleFavorite: chats.toggleChannelFavorite,  // Добавить/убрать из избранного
    setFilter: chats.setFilter,                   // Установить фильтр
    clearFilter: chats.clearFilter,               // Очистить фильтр
    addFilter: chats.addFilter,                   // Добавить фильтр
    updateSettings: chats.updateSettings,         // Обновить настройки
    
    // Коммуникация
    selectCommunication: input.selectCommunication, // Выбор типа коммуникации
    sendWink: input.sendWink,                      // 🔥 НОВОЕ - отправка подмигивания
    
    // Навигация и создание чатов
    goToChannels: goToChannels,                    // Перейти к каналам
    getNewChatProfiles: newChat.getNewChatProfiles, // Получить профили для нового чата
    getChatWith: newChat.getChatWith,              // Создать чат с пользователем
    
    // Получение данных (объекты)
    getProfile: profiles,                          // ✅ ИСПОЛЬЗУЕМ - объект profiles
    getChats: chats,                              // ✅ ИСПОЛЬЗУЕМ - объект chats
    getChat: chat,                                // Объект chat
    getInput: input,                              // Объект input
    
    // Обновления и новые данные
    getNewbieProfileChannels: profiles.getNewbieProfileChannels,
    getUpdatedProfileChannels: profiles.getUpdatedProfileChannels,
    getNewbieChatMessages: chat.getNewbieChatMessages,
    
    // История и комментарии
    getMessageHistory: chat.getMessageHistory,     // 🔥 НОВОЕ - история сообщений
    closeMessageHistory: chat.closeMessageHistory, // Закрыть историю
    deleteComment: comments.deleteComment,         // Удалить комментарий
    
    // Утилиты
    getActiveProfile: function () {                // Получить активный профиль
        return (profiles.getActive() && profiles.getActive().inner) 
            ? profiles.getActive().inner 
            : null;
    },
    openCatchUp: profiles.openCatchUp,            // Открыть catch-up
};
```

---

## 🔥 Новые найденные методы

### 1. **sendMessage()** - Отправка сообщений

**Что делает:** Отправляет текстовое сообщение в активный чат

**Где найдено:** Строка 9945, реализация в `input.sendMessage`

**Как использовать:**
```javascript
// Предположительно нужно:
// 1. Открыть чат через selectChat()
// 2. Установить текст в поле ввода
// 3. Вызвать sendMessage()

// Возможный вариант 1: Прямой вызов
modelsChat.sendMessage();

// Возможный вариант 2: С параметрами
modelsChat.sendMessage(text, chatId);

// ⚠️ ТРЕБУЕТ ТЕСТИРОВАНИЯ!
```

**Что нужно проверить:**
- Принимает ли параметры или берёт текст из поля ввода?
- Нужно ли предварительно открыть чат?
- Возвращает ли Promise или callback?

---

### 2. **editMessage()** - Редактирование сообщения

**Что делает:** Редактирует уже отправленное сообщение

**Где найдено:** Строка 9946

**Предположительное использование:**
```javascript
modelsChat.editMessage(messageSid, newText);
```

---

### 3. **deleteMessage()** - Удаление сообщения

**Что делает:** Удаляет сообщение из чата

**Где найдено:** Строка 9949

**Предположительное использование:**
```javascript
modelsChat.deleteMessage(messageSid);
```

---

### 4. **getMessageHistory()** - История сообщений

**Что делает:** Получает историю сообщений чата

**Где найдено:** Строка 9976, реализация в `chat.getMessageHistory`

**Предположительное использование:**
```javascript
modelsChat.getMessageHistory(chatId, callback);
```

**Зачем нужно:**
- Загрузить старые сообщения
- Получить полную историю переписки
- Анализ сообщений

---

### 5. **sendWink()** - Отправка подмигивания

**Что делает:** Отправляет "подмигивание" (wink) пользователю

**Где найдено:** Строка 9975

**Предположительное использование:**
```javascript
modelsChat.sendWink(memberUid);
```

---

### 6. **toggleFavorite()** - Избранное

**Что делает:** Добавляет/убирает чат из избранного

**Где найдено:** Строка 9956

**Предположительное использование:**
```javascript
modelsChat.toggleFavorite(chatId, status); // status: true/false
```

---

### 7. **getActiveProfile()** - Активный профиль

**Что делает:** Возвращает данные текущего активного профиля

**Где найдено:** Строки 9978-9980

**Использование:**
```javascript
const activeProfile = modelsChat.getActiveProfile();
// Возвращает: { uid, username, avatar, ... } или null
```

---

## 📊 Структура объектов

### profiles (modelsChat.getProfile)

**Доступные свойства:**
```javascript
profiles.data              // ✅ ИСПОЛЬЗУЕМ - все профили
profiles.selectProfile()   // ✅ ИСПОЛЬЗУЕМ - переключение
profiles.getActive()       // Получить активный профиль
profiles.getNewbieProfileChannels()
profiles.getUpdatedProfileChannels()
profiles.openCatchUp()
```

### chats (modelsChat.getChats)

**Доступные свойства:**
```javascript
chats.list                 // ✅ ИСПОЛЬЗУЕМ - список чатов
chats.data                 // Данные чатов
chats.selectChat()         // ✅ ИСПОЛЬЗУЕМ - открыть чат
chats.getActive()          // Получить активный чат
chats.toggleChannelFavorite()
chats.setFilter()
chats.clearFilter()
chats.addFilter()
chats.updateSettings()
```

### chat (modelsChat.getChat)

**Доступные свойства:**
```javascript
chat.list                  // Список сообщений
chat.data                  // Данные сообщений
chat.getMessageHistory()   // История сообщений
chat.closeMessageHistory()
chat.getNewbieChatMessages()
```

### input (modelsChat.getInput)

**Доступные свойства:**
```javascript
input.sendMessage()        // Отправка сообщения
input.editMessage()        // Редактирование
input.deleteMessage()      // Удаление
input.reSendMessage()      // Повторная отправка
input.updateMessage()      // Обновление
input.clearEdit()          // Очистка редактирования
input.fileChangedHandler() // Обработка файлов
input.removeSelectedFiles()
input.attachFiles()
input.deleteMedia()
input.sendWink()
input.selectCommunication()
```

---

## 🎯 Приоритетные методы для тестирования

### Высокий приоритет (нужны сейчас):

1. **sendMessage()** - отправка сообщений
2. **getMessageHistory()** - получение истории
3. **getActiveProfile()** - текущий профиль

### Средний приоритет (полезны):

4. **editMessage()** - редактирование
5. **deleteMessage()** - удаление
6. **toggleFavorite()** - избранное
7. **sendWink()** - подмигивания

### Низкий приоритет (опционально):

8. **attachFiles()** - прикрепление файлов
9. **setFilter()** - фильтры
10. **openDisappearingMedia()** - исчезающие медиа

---

## 🔍 Что нужно исследовать

### 1. Отправка сообщений

**Вопросы:**
- Как правильно вызывать `sendMessage()`?
- Нужно ли устанавливать текст в DOM или передавать параметром?
- Есть ли callback для подтверждения отправки?

**Тест в консоли:**
```javascript
// Открыть чат
modelsChat.selectChat("1389492_1772829");

// Попробовать отправить
modelsChat.sendMessage("Test message");

// Или через input
modelsChat.getInput().sendMessage();
```

### 2. История сообщений

**Вопросы:**
- Какие параметры принимает?
- Возвращает массив или объект?
- Есть ли пагинация?

**Тест в консоли:**
```javascript
modelsChat.getMessageHistory(chatId, function(data, error) {
    console.log('History:', data);
});
```

### 3. Активный профиль

**Тест в консоли:**
```javascript
const profile = modelsChat.getActiveProfile();
console.log('Active profile:', profile);
```

---

## 📝 Рекомендации по интеграции

### Создать новый сервис: luxeeMessageService.js

```javascript
const luxeeMessageService = {
    // Отправить сообщение
    sendMessage: async ({ page, chatId, text }) => {
        // 1. Открыть чат
        await page.evaluate((id) => {
            modelsChat.selectChat(id);
        }, chatId);
        
        await page.waitForTimeout(1000);
        
        // 2. Отправить сообщение (нужно протестировать!)
        const result = await page.evaluate((message) => {
            // Вариант 1: Прямой вызов
            return modelsChat.sendMessage(message);
            
            // Вариант 2: Через input
            // return modelsChat.getInput().sendMessage(message);
        }, text);
        
        return result;
    },
    
    // Получить историю
    getHistory: async ({ page, chatId }) => {
        const history = await page.evaluate((id) => {
            return new Promise((resolve) => {
                modelsChat.getMessageHistory(id, (data, error) => {
                    if (error) {
                        resolve({ error });
                    } else {
                        resolve({ data });
                    }
                });
            });
        }, chatId);
        
        return history;
    },
};
```

---

## ⚠️ Важные замечания

1. **Все методы НЕПРОВЕРЕНЫ** - требуют тестирования в реальных условиях
2. **Параметры неизвестны** - нужно экспериментировать
3. **Могут быть изменения** - Luxee может обновить API
4. **Проверяй в консоли** - сначала тестируй вручную, потом автоматизируй

---

## 🚀 Следующие шаги

1. **Протестировать sendMessage()** в консоли браузера
2. **Протестировать getMessageHistory()** 
3. **Создать luxeeMessageService.js** с проверенными методами
4. **Обновить LUXEE_JS_API.md** с реальными примерами
5. **Добавить endpoint для отправки сообщений** в API

---

## 📁 Связанные файлы

- `backend/docs/LUXEE_JS_API.md` - проверенная документация
- `backend/docs/extractedLuxee/chat.v2.js` - исходный код
- `backend/docs/extractedLuxee/chat.api.js` - API сокетов
