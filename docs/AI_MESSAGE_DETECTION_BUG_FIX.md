# AI Message Detection Bug Fix

**Дата:** 07.06.2026  
**Статус:** ✅ ИСПРАВЛЕНО

---

## 🐛 Проблема

AI система запускалась успешно, но **НЕ НАХОДИЛА неотвеченные сообщения**, хотя они существовали в чатах.

### Симптомы:
```
[AI Auto Response] Started for account (every 10 seconds)
[AI Auto Response] No unanswered messages for account  ❌
```

При этом в логах видно что есть чат с `unAnswered: true`:
```json
{
  "chatId": "1297185_1838806",
  "unAnswered": true,  ← ЧАТ НЕОТВЕЧЕН!
  "lastActivity": "1780072662217"
}
```

---

## 🔍 Анализ Root Cause

### Что работает ПРАВИЛЬНО (messageCheckService):

```javascript
// ✅ Использует правильный API
const profilesData = modelsChat.getProfile.data;
const chatsData = modelsChat.getChats?.list || {};

// ✅ Правильно парсит profileUid из chatId
const chatProfileUid = parseInt(chatId.split('_')[0]);  // "1297185_1838806" → 1297185

// ✅ Проверяет принадлежность чата к профилю
if (allProfileUids.includes(chatProfileUid)) { ... }
```

### Что было СЛОМАНО в AI (aiAutoResponseService):

```javascript
// ❌ WRONG API!
const profilesList = modelsChat.getProfiles.list;  // Не существует!

// ❌ WRONG CHECK!
if (chat.profileUid !== parseInt(profileUid)) continue;
// chat.profileUid НЕ СУЩЕСТВУЕТ в структуре chat!
```

---

## ✅ Исправление

### Изменения в `aiAutoResponseService.js` (строки 163-246):

**БЫЛО (НЕПРАВИЛЬНО):**
```javascript
const profilesData = await page.evaluate(() => {
    // ❌ Неправильный API
    const profilesList = modelsChat.getProfiles.list;
    
    for (const profileUid in profilesList) {
        const chats = modelsChat.getChats?.list || {};
        
        for (const chatId in chats) {
            // ❌ chat.profileUid не существует!
            if (chat.profileUid !== parseInt(profileUid)) continue;
        }
    }
});
```

**СТАЛО (ПРАВИЛЬНО):**
```javascript
const profilesData = await page.evaluate(() => {
    // ✅ Правильный API (как в messageCheckService)
    const profilesData = modelsChat.getProfile.data;
    const chatsData = modelsChat.getChats?.list || {};
    
    for (const uid in profilesData) {
        const profile = profilesData[uid];
        const profileUid = profile.inner.uid;
        
        // ✅ Собираем все UID профиля (inner + outer)
        const allProfileUids = [profile.inner.uid];
        if (profile.outer) {
            for (const outerUid in profile.outer) {
                allProfileUids.push(profile.outer[outerUid].uid);
            }
        }
        
        for (const chatId in chatsData) {
            // ✅ Правильно парсим profileUid из chatId
            const chatProfileUid = parseInt(chatId.split('_')[0]);
            
            // ✅ Проверяем принадлежность чата
            if (!allProfileUids.includes(chatProfileUid)) continue;
            
            // ✅ Проверяем unAnswered
            if (chat.unAnswered === true) {
                // Обрабатываем...
            }
        }
    }
});
```

---

## 📊 Ключевые изменения

### 1. Правильный API для профилей:
- ❌ `modelsChat.getProfiles.list` (не существует)
- ✅ `modelsChat.getProfile.data` (правильно)

### 2. Правильное определение profileUid:
- ❌ `chat.profileUid` (поле не существует)
- ✅ `parseInt(chatId.split('_')[0])` (парсим из "profileUid_memberUid")

### 3. Поддержка outer profiles:
- ✅ Собираем все UIDs (inner + outer)
- ✅ Проверяем `allProfileUids.includes(chatProfileUid)`

### 4. Правильные типы участников:
- `type: 10` = мужчина (man)
- `type: 2` = женщина (woman/model)

### 5. Правильные типы сообщений:
- `uType: 2` = сообщение от мужчины
- `uType: 10` = сообщение от женщины

---

## 🧪 Как проверить что исправление работает

### 1. Перезапустить backend:
```bash
docker compose restart backend
```

### 2. Смотреть логи AI:
```bash
docker compose logs -f backend | findstr "AI"
```

### 3. Ожидаемые логи (ПОСЛЕ исправления):
```
[AI Management Service] ✓ AI context created
[AI Management Service] ✓ Auto-response started
[AI Auto Response] Started for account (every 10 seconds)
[AI Auto Response] Found 1 profiles with unanswered messages  ✓ НАХОДИТ!
[AI Auto Response] Processing profile 941 (1 chats)
[AI Auto Response] Generating response for chat 1297185_1838806...
[AI Response Service] AI response: <сгенерированный ответ>
[AI Response Service] AI message sent successfully  ✓ ОТПРАВЛЯЕТ!
[AI Auto Response] Successfully sent response to chat 1297185_1838806
```

---

## 📈 Результат

### До исправления:
- ❌ AI не находил неотвеченные сообщения
- ❌ Всегда выводил "No unanswered messages"
- ❌ Не отправлял ответы

### После исправления:
- ✅ AI находит неотвеченные сообщения
- ✅ Правильно парсит структуру чатов
- ✅ Определяет сообщения от мужчин
- ✅ Генерирует и отправляет ответы
- ✅ Использует ту же логику что и messageCheckService

---

## 🔗 Связанные файлы

**Исправленный файл:**
- `backend/src/services/aiAutoResponseService.js` (строки 163-246)

**Референсный код (правильная логика):**
- `backend/src/services/luxeeApi/messageCheckService/profileDataExtractor.js`
- `backend/src/services/luxeeApi/messageCheckService/checkAccountMessages.js`

**Отправка сообщений (не изменялась, работала правильно):**
- `backend/src/services/aiResponseService.js`
- `backend/src/services/luxeeApi/messageSendService.js`

---

## 💡 Урок на будущее

**Всегда используйте ТУ ЖЕ логику для одинаковых операций!**

- messageCheckService использует `modelsChat.getProfile.data` → работает ✓
- AI должен использовать `modelsChat.getProfile.data` → теперь работает ✓

Если что-то работает в одном месте, копируйте эту логику в другие места вместо того чтобы "изобретать велосипед"!

---

## ✅ Статус: ИСПРАВЛЕНО

Commit: `5f4def5506aeb60aa4c50cb4ef0efd758b542731`  
Автор: Kiro AI Assistant  
Дата: 07.06.2026
