# 🔧 AI Unanswered Chats Detection - Исправление

## 🐛 Проблема

AI контекст **НЕ находил unanswered чаты**, хотя они были видны на странице.

### Причина:
Код проверял только `profile.inner.uid`, но **игнорировал `profile.outer` UIDs**!

```javascript
// ❌ СТАРЫЙ КОД (НЕ работал)
const chatProfileUid = parseInt(chatId.split('_')[0]);
if (chatProfileUid !== pUid) continue; // Пропускал чаты с outer UIDs!
```

В Luxee профили могут иметь:
- **inner.uid** - основной UID профиля
- **outer UIDs** - дополнительные UIDs (могут быть у нескольких профилей)

Чаты могут быть привязаны к ЛЮБОМУ из этих UIDs!

---

## ✅ Решение

### 1️⃣ Использовать логику из `profileDataExtractor.js`

Скопировали **правильную логику** из рабочего кода:

```javascript
// ✅ НОВЫЙ КОД (работает)
// Получаем ВСЕ UIDs профиля (inner + outer)
const profileData = await page.evaluate((pUid) => {
  const profile = modelsChat.getProfile.data?.[pUid];
  if (!profile) return null;

  // Собираем ВСЕ UIDs профиля
  const allUids = [profile.inner.uid];
  if (profile.outer) {
    for (const outerUid in profile.outer) {
      allUids.push(profile.outer[outerUid].uid);
    }
  }

  return {
    allUids: allUids,
    hasOuter: profile.outer ? Object.keys(profile.outer).length : 0,
  };
}, profile.uid);

// Проверяем что чат принадлежит ЛЮБОМУ из UIDs
if (!allUids.includes(chatProfileUid)) continue;
```

### 2️⃣ Умная система попыток

Как предложил пользователь:

**Текущий активный профиль:**
- ✅ **1 попытка** - он уже активен, чаты загружены
- Нет смысла делать 5 попыток если мы никуда не переключались

**После переключения на другой профиль:**
- ✅ **5 попыток с задержкой 3 сек** - сайт может тупить при загрузке чатов
- Гарантирует что не пропустим unanswered

---

## 📋 Изменения в коде

### Функция `_processProfileWithRetries`

```javascript
_processProfileWithRetries: async ({ accountId, userId, page, profile, maxAttempts = 5 }) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[AI Auto] 🔄 Attempt ${attempt}/${maxAttempts}...`);

    // ✅ Получаем ВСЕ UIDs (inner + outer)
    const profileData = await page.evaluate((pUid) => {
      const profile = modelsChat.getProfile.data?.[pUid];
      const allUids = [profile.inner.uid];
      if (profile.outer) {
        for (const outerUid in profile.outer) {
          allUids.push(profile.outer[outerUid].uid);
        }
      }
      return { allUids, hasOuter: profile.outer ? Object.keys(profile.outer).length : 0 };
    }, profile.uid);

    console.log(`Profile ${profile.username} has ${profileData.allUids.length} UIDs (${profileData.hasOuter} outer)`);

    // ✅ Ищем unanswered используя ВСЕ UIDs
    const unansweredChats = await page.evaluate((allUids) => {
      const chats = modelsChat.getChats.list || {};
      const result = [];

      for (const chatId in chats) {
        const chat = chats[chatId];
        const chatProfileUid = parseInt(chatId.split('_')[0]);

        // ✅ Проверяем ЛЮБОЙ из UIDs
        if (!allUids.includes(chatProfileUid)) continue;

        if (chat.unAnswered === true) {
          // ...собираем данные
        }
      }

      return result;
    }, profileData.allUids);

    // Если нашли - обрабатываем и выходим
    if (unansweredChats.length > 0) {
      // Обрабатываем чаты...
      return;
    }

    // Если не нашли и не последняя попытка - ждём
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
```

### Основная логика в `processAccountMessages`

```javascript
// ШАГ 3: Обработать ТЕКУЩИЙ активный профиль
await _processProfileWithRetries({
  accountId,
  userId,
  page,
  profile: activeProfileData,
  maxAttempts: 1, // ← 1 попытка для текущего профиля
});

// ШАГ 5: Для каждого другого профиля с new messages
for (const profile of otherProfiles) {
  // Переключаемся
  await page.evaluate((pUid) => {
    modelsChat.selectProfile(pUid);
  }, profile.uid);

  await sleep(3000);

  // 5 попыток для переключенного
  await _processProfileWithRetries({
    accountId,
    userId,
    page,
    profile,
    maxAttempts: 5, // ← 5 попыток после переключения
  });
}
```

---

## 🔍 Что покажут логи

### Успешный случай (нашли outer UIDs):
```
[AI Auto] Profile Anastasia has 3 UIDs (2 outer)
[AI Auto] ✅ Found 2 unanswered chats on Anastasia (attempt 1)
```

### Если outer UIDs нет:
```
[AI Auto] Profile Maria has 1 UIDs (0 outer)
[AI Auto] ✅ Found 1 unanswered chats on Maria (attempt 1)
```

### После переключения профиля (сайт тупит):
```
[AI Auto] 🔄 Attempt 1/5 to find unanswered chats on Sofia...
[AI Auto] ⏳ No unanswered found, waiting 3 sec before retry...
[AI Auto] 🔄 Attempt 2/5 to find unanswered chats on Sofia...
[AI Auto] ✅ Found 3 unanswered chats on Sofia (attempt 2)
```

---

## 📊 Результат

✅ **Правильная логика с outer UIDs** - как в `profileDataExtractor.js`
✅ **Умные попытки** - 1 для текущего, 5 для переключенных
✅ **Детальные логи** - видно сколько UIDs у профиля
✅ **Оптимизация** - не тратим время на лишние попытки

---

## 🧪 Тестирование

1. Включите AI автоответы для аккаунта
2. Переключитесь на профиль с unanswered чатами
3. Проверьте логи:
   - Должно показать `Profile X has N UIDs (M outer)`
   - Должно найти unanswered чаты
   - Для текущего профиля: 1 попытка
   - После переключения: до 5 попыток с задержками

---

## 📅 Дата исправления
18.06.2026, 23:30
