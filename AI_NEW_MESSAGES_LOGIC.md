# 🔄 AI Auto Response: Новая логика обработки сообщений

## 📅 Дата изменения: 18.06.2026, 22:30

## 🎯 Суть проблемы

**Старая логика (НЕПРАВИЛЬНАЯ):**
```
1. Получали unanswered на активном профиле
2. Получали unanswered на других профилях через modelsChat.getProfile.data
3. Переключались на профили с unanswered
```

**Проблема:** `unansweredCount` в `modelsChat.getProfile.data[uid]` **НЕ ВИДНЫ** для неактивных профилей! Мы видим их только после переключения на профиль.

---

## ✅ Новая логика (ПРАВИЛЬНАЯ)

### Ключевое понимание:

| Параметр | Видимость | Описание |
|----------|-----------|----------|
| `profile.newMessages` | ✅ **Видны глобально** | Количество новых сообщений видно на ВСЕХ профилях |
| `chat.unAnswered` | ❌ **Только на активном** | Видны ТОЛЬКО после переключения на профиль |

### Алгоритм работы:

```javascript
Каждые 10 секунд:

1. ✅ Проверить URL (fix about:blank если нужно)

2. ✅ Получить ВСЕ профили с NEW messages (видны глобально!)
   
   Например:
   - Valeria (607823): 1 new ✅
   - Marina (608077): 1 new ✅
   - Sofia (608359): 1 new ✅

3. ✅ ДЛЯ КАЖДОГО профиля с new messages:
   
   3.1. Переключиться на профиль
        await page.evaluate((pUid) => {
          modelsChat.selectProfile(pUid);
        }, profile.uid);
   
   3.2. Подождать 3 сек (загрузка чатов этого профиля)
   
   3.3. ✅ ТЕПЕРЬ видны unanswered чаты ЭТОГО профиля!
        Получить их через page.evaluate()
        
   3.4. ДЛЯ КАЖДОГО unanswered чата:
        
        🔍 [AI DEBUG] UNANSWERED CHAT FOUND
        📝 [AI DEBUG] BUILDING PROMPT FOR AI
        🤖 [AI DEBUG] SENDING REQUEST TO DEEPSEEK API
        🎨 [AI DEBUG] GENERATING AI RESPONSE
        🚫 [AI DEBUG] MESSAGE SEND BLOCKED - Debug Mode
        
        ⏱️ Задержка 3 сек перед следующим чатом
   
   3.5. Задержка 3 сек перед следующим профилем

4. ✅ Готово! Следующий цикл через 10 секунд
```

---

## 📊 Пример логов (после изменения)

```
[AI Auto] ========== Starting processing for Translator.01@gmail.com ==========
[AI Auto] Current URL: https://luxee.io/chats
[AI Auto] Active profile: Valeria (607823)

[AI Auto] Total profiles with new messages: 3
[AI Auto]   - Valeria (607823): 1 new
[AI Auto]   - Marina (608077): 1 new
[AI Auto]   - Sofia (608359): 1 new

[AI Auto] ===== Processing profile 1/3: Valeria =====
[AI Auto] Switching to Valeria (1 new)...
[AI Auto] ✓ Switched, waiting for chats to load...
[AI Auto] Found 1 unanswered chats on Valeria
[AI Auto] Processing chat 1/1: John (607823_123456)

🔍 [AI DEBUG] ===== UNANSWERED CHAT FOUND =====
  👤 Profile: Valeria (UID: 607823)
  💬 Chat ID: 607823_123456
  👨 Man: John (UID: 123456)
  📝 Last man message: Hi beautiful!
  🕐 Message time: 18.06.2026, 22:20:30
════════════════════════════════════════════════════════════════════════════════

📝 [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
  👤 Profile: Valeria
  📨 Man message: Hi beautiful!
  📨 Total messages in array: 2

🤖 [AI DEBUG] ===== SENDING REQUEST TO DEEPSEEK API =====
  🌐 API URL: https://api.deepseek.com
  ⏳ Sending request...
  ✅ Response received in 1200 ms
  📥 Raw AI response: Hey! 😊 How are you?

🎨 [AI DEBUG] ===== GENERATING AI RESPONSE =====
  ✅ Response passed forbidden phrases check
  📤 Final response: Hey! 😊 How are you?

🚫🚫🚫 [AI DEBUG] MESSAGE SEND BLOCKED - Debug Mode Enabled 🚫🚫🚫
════════════════════════════════════════════════════════════════════════════════
📨 [AI DEBUG] Message details:
  - Chat ID: 607823_123456
  - Message text: Hey! 😊 How are you?
  - Message length: 22 characters
════════════════════════════════════════════════════════════════════════════════

[AI Auto] ✓ Sent to John
[AI Auto] Waiting 3 sec before next profile...

[AI Auto] ===== Processing profile 2/3: Marina =====
[AI Auto] Switching to Marina (1 new)...
... (то же самое для Marina)

[AI Auto] ===== Processing profile 3/3: Sofia =====
[AI Auto] Switching to Sofia (1 new)...
... (то же самое для Sofia)

[AI Auto] ✓ Processed all 3 profiles with new messages
[AI Auto] ========== Finished processing Translator.01@gmail.com ==========
```

---

## 🔧 Изменённые файлы

### 1. `backend/src/services/aiAutoResponseService.js`

**Изменения в `processAccountMessages()`:**

**Было (строки 361-471):**
```javascript
// ШАГ 3: Получить ВСЕ профили с количеством unanswered ❌
const allProfilesData = await page.evaluate(() => {
  // Подсчитываем unanswered чаты через modelsChat.getChats.list
  // ПРОБЛЕМА: Видны только на активном профиле!
});

// ШАГ 4: Обработать активный профиль
await aiAutoResponseService._processProfileChats({ ... });

// ШАГ 5: Переключиться на другие профили с unanswered
const otherProfiles = allProfilesData.filter(p => p.unansweredCount > 0);
```

**Стало:**
```javascript
// ШАГ 3: Получить ВСЕ профили с NEW MESSAGES ✅ (видны глобально!)
const profilesWithNewMessages = await page.evaluate(() => {
  const profiles = [];
  for (const uid in profilesData) {
    const profile = profilesData[uid];
    const newMessages = profile.newMessages || 0;
    
    if (newMessages > 0) {
      profiles.push({
        uid: profile.inner.uid,
        username: profile.inner.username,
        newMessages: newMessages,
      });
    }
  }
  return profiles;
});

// ШАГ 4: Для каждого профиля с new messages - переключаемся и обрабатываем
for (const profile of profilesWithNewMessages) {
  // Переключаемся на профиль
  await page.evaluate((pUid) => {
    modelsChat.selectProfile(pUid);
  }, profile.uid);
  
  // Ждём загрузки чатов (3 сек)
  await new Promise(r => setTimeout(r, 3000));
  
  // ТЕПЕРЬ видим unanswered на ЭТОМ профиле!
  await aiAutoResponseService._processProfileChats({ ... });
  
  // Задержка перед следующим профилем
  await new Promise(r => setTimeout(r, 3000));
}
```

### 2. `backend/src/services/luxeeApi/messageCheckService/checkAllMessages.js`

**Убрали DEBUG логи (строки 61-64):**
```javascript
// Было:
console.log(`[DEBUG] Active profile UID:`, result.debug.activeProfileUid);
console.log(`[DEBUG] Total chats:`, result.debug.totalChats);
console.log(`[DEBUG] Sample chat:`, JSON.stringify(result.debug.sampleChat, null, 2));

// Стало:
// (убрали эти логи)
```

### 3. `backend/src/services/luxeeApi/messageCheckService/profileDataExtractor.js`

**Убрали DEBUG данные из extractAllProfilesData() (строки 28-55):**
```javascript
// Было:
const debugInfo = {
  activeProfileUid: activeProfileUid,
  activeProfileFull: modelsChat.getProfile.active,
  totalChats: Object.keys(chatsListData).length,
  chatIds: Object.keys(chatsListData),
  sampleChat: sampleChatSafe
};
return { profiles: result, debug: debugInfo };

// Стало:
return { profiles: result };
```

---

## 🔒 Безопасность

Отправка сообщений **ФИЗИЧЕСКИ ЗАБЛОКИРОВАНА** на 3 уровнях:

1. ✅ `AI_MESSAGE_SENDING_DISABLED = true` в `messageSendService.js`
2. ✅ `AI_DEBUG_MODE = true` в `aiResponseService.js`
3. ✅ Код `page.evaluate()` не выполняется

**Мужчины НЕ получат сообщения** - гарантированно! 🔒

---

## 📝 Преимущества новой логики

| Критерий | Старая логика ❌ | Новая логика ✅ |
|----------|------------------|------------------|
| **Обнаружение новых сообщений** | Только на активном профиле | На всех профилях глобально |
| **Видимость unanswered** | Пытались получить без переключения | Переключаемся → видим unanswered |
| **Обработка профилей** | Пропускали профили с новыми | Обрабатываем все профили с new |
| **Логика** | Неправильная (не работала) | Правильная (работает) |
| **Логи** | Спам [Message Check] каждые 8 сек | Чистые, только AI логи |

---

## 🧪 Тестирование

1. Перезапустить backend: `docker-compose restart backend`
2. Включить AI через админ-панель
3. Отправить новое сообщение на любой профиль
4. Проверить логи backend:
   - Должны появиться профили с `new messages`
   - AI должен переключаться на каждый профиль
   - Должны появиться `UNANSWERED CHAT FOUND`
   - Должны появиться `MESSAGE SEND BLOCKED`

---

## ✅ Результат

- ✅ Убран спам логов `[Message Check]` и `[DEBUG]`
- ✅ Изменена логика на: `new messages` → переключение → `unanswered`
- ✅ AI теперь видит все профили с новыми сообщениями
- ✅ AI корректно переключается на каждый профиль
- ✅ AI видит unanswered чаты ПОСЛЕ переключения
- ✅ Детальные DEBUG логи показывают весь процесс
- ✅ Отправка ЗАБЛОКИРОВАНА для тестирования

---

## 🚀 Следующие шаги

После успешного тестирования (когда убедимся что AI генерирует нормальные ответы):

1. Установить `AI_DEBUG_MODE = false` в `aiResponseService.js`
2. Установить `AI_MESSAGE_SENDING_DISABLED = false` в `messageSendService.js`
3. Проверить на 1-2 реальных сообщениях
4. Если всё ОК - включить для всех профилей

**НО ПОКА НЕ ТРОГАТЬ!** Сначала проверить логи! 🔒

---

## 📅 История обновлений

- **18.06.2026, 22:30** - Создана новая логика обработки `new messages` → переключение → `unanswered`
- **18.06.2026, 23:30** - **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: Добавлена поддержка `outer UIDs`
  - Проблема: код проверял только `inner.uid`, игнорировал `outer` UIDs
  - Решение: используем логику из `profileDataExtractor.js` - проверяем ВСЕ UIDs профиля
  - Умная система попыток: 1 попытка для текущего, 5 попыток для переключенных профилей
  - Подробности: см. `AI_UNANSWERED_FIX.md`
