# Answered Chats - Сохранение отвеченных чатов

## 📋 Описание

Система сохранения отвеченных чатов в MongoDB для отображения истории переписки после перезагрузки страницы.

## 🎯 Логика работы

### 1. Отправка сообщения (`messageSendService`)

```
1. Отправляем сообщение через Luxee
2. Ждем 2 секунды (Luxee обновляет состояние)
3. Проверяем unAnswered через chatOpenService
4. Если unAnswered === false (мы ответили):
   → Сохраняем в MongoDB
   → Сохраняем lastManMessage и lastWomanMessage
   → Ограничение: макс 5 чатов на профиль
```

### 2. Загрузка чатов (`profileChatsLoadService`)

```
1. Загружаем чаты из Luxee
2. Разделяем на:
   - Неотвеченные (unAnswered: true)
   - Отвеченные (unAnswered: false)
3. Удаляем из MongoDB чаты которые стали неотвеченными
4. Загружаем отвеченные чаты из MongoDB
5. Объединяем с лимитом 5 чатов:
   - Приоритет: все неотвеченные (сколько есть)
   - Остаток: отвеченные из MongoDB (до общего лимита 5)
   - Пример: 3 неотвеченных + 2 отвеченных = 5 чатов
   - Пример: 10 неотвеченных + 0 отвеченных = 10 чатов (лимит превышен)
```

## 📊 Структура данных

### MongoDB Collection: `answeredchats`

```javascript
{
  accountId: ObjectId,           // Ссылка на аккаунт
  profileUid: Number,            // UID профиля
  chats: [                       // Массив отвеченных чатов
    {
      chatId: String,            // "1609609_2629928"
      memberUid: Number,         // UID мужчины
      memberUsername: String,    // Имя мужчины
      memberAvatar: String,      // Аватар мужчины
      lastManMessage: {          // Последнее сообщение от мужчины
        body: String,
        createdAt: String
      },
      lastWomanMessage: {        // Последнее сообщение от девушки
        body: String,
        createdAt: String
      },
      lastActivity: String,      // Timestamp
      savedAt: Date              // Когда сохранили
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔄 Сценарии использования

### Сценарий 1: Первый ответ
```
1. Мужчина написал → unAnswered: true → показываем сверху
2. Мы ответили → messageSendService
3. unAnswered → false
4. Сохраняем в MongoDB
5. Чат остается в списке (снизу)
```

### Сценарий 2: Мужчина написал снова
```
1. Чат был в MongoDB (отвеченный)
2. Мужчина написал → unAnswered: true
3. profileChatsLoadService видит его в неотвеченных
4. Удаляем из MongoDB
5. Показываем сверху как неотвеченный
```

### Сценарий 3: Больше 5 отвеченных
```
1. У нас 5 отвеченных чатов в MongoDB
2. Ответили на 6-й чат
3. Сохраняем новый
4. Удаляем самый старый (по savedAt)
5. В MongoDB остается 5 чатов
```

### Сценарий 4: Много неотвеченных
```
1. 10 мужчин написали → 10 неотвеченных
2. Все 10 показываем (лимит 5 превышен, но неотвеченные важнее)
3. Отвеченные из MongoDB не показываем (нет места)
4. В MongoDB ничего не сохраняем
```

## 📁 Файлы

- `backend/src/models/AnsweredChat.js` - MongoDB модель
- `backend/src/services/answeredChatService.js` - Сервис для работы с MongoDB
- `backend/src/services/luxeeApi/messageSendService.js` - Сохранение после отправки
- `backend/src/services/luxeeApi/profileChatsLoadService.js` - Объединение с MongoDB

## 🧪 Тестирование

1. Отправьте сообщение мужчине
2. Проверьте логи в терминале:
   ```
   [Message Send] unAnswered: false
   [Answered Chat] Saving chat...
   [Answered Chat] Saved successfully. Total chats: 1
   ```
3. Перезагрузите страницу
4. Кликните на профиль
5. Чат должен отображаться снизу (отвеченный)
6. Если мужчина напишет снова - чат переместится вверх

## 🔍 Логи

### messageSendService
```
[Message Send] Sending message...
[Message Send] Message sent successfully
[Message Send] Waiting 2s for Luxee to update state...
[Message Send] Checking unAnswered status...
[Message Send] unAnswered: false
[Message Send] Chat is answered, saving to MongoDB...
[Answered Chat] Saving chat 1609609_2629928...
[Answered Chat] Saved successfully. Total chats: 1
```

### profileChatsLoadService
```
[Profile Chats Load] Loading chats for profile 1609609...
[Profile Chats Load] Loaded 2 chats from Luxee (1 unanswered)
[Profile Chats Load] Unanswered chat IDs: ['1609609_2656743']
[Answered Chat] Removing 1 chats from profile 1609609
[Answered Chat] Found 1 answered chats for profile 1609609
[Profile Chats Load] Final result:
  - Unanswered: 1
  - Answered from MongoDB: 1
  - Total: 2
```

## ⚠️ Важно

- **Неотвеченные чаты** (`unAnswered: true`) НЕ сохраняются в MongoDB
- **Лимит 5 чатов** - общий для неотвеченных + отвеченных
- **Приоритет**: сначала показываем все неотвеченные, потом отвеченные до лимита 5
- **Если неотвеченных > 5**: показываем все неотвеченные, отвеченные не показываем
- **Автоочистка**: если чат стал неотвеченным → удаляется из MongoDB
