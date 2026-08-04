# Catch Up & Activity Center Fix Plan

## 🎯 ПРОБЛЕМА

### Catch Up:
- После проверки всех чатов (если все в blacklist) мы ОСТАЕМСЯ в Catch Up overlay
- Нужно: `page.reload()` чтобы выйти

### Activity Center:
- После проверки всех notifications (если все в blacklist) колокольчик остается открытым
- Нужно: закрыть через `closeActivityCenter(page)`

---

## ✅ РЕШЕНИЕ

### 1. Catch Up - добавить reload после цикла unprocessedChats

**Место:** После `for (const item of unprocessedChats)` loop

**Логика:**
```javascript
// ПОСЛЕ цикла unprocessedChats
if (!messageSent) {
    // Ничего не отправили - перезагружаем страницу
    console.log('[🚦 NAVIGATION] ⚠️  No messages sent from Catch Up, reloading...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await utils.sleep(2000);
    console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
}
```

### 2. Catch Up - заменить goto на reload в "all cached"

**Место:** Блок `else { "All Catch Up chats already processed (in cache)" }`

**Логика:**
```javascript
} else {
    utils.log('AI Auto', '✅ All Catch Up chats already processed (in cache)');
    
    // Перезагружаем страницу для выхода
    console.log('[🚦 NAVIGATION] 🔄 Reloading page to exit Catch Up (all cached)...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await utils.sleep(2000);
    console.log('[🚦 NAVIGATION] ✅ Page reloaded, exited from Catch Up');
}
```

### 3. Activity Center - закрыть если все в blacklist

**Место:** После проверки первой notification в blacklist

**Логика:**
```javascript
// 🚫 ПРОВЕРКА ЧЕРНОГО СПИСКА (Activity Center)
if (await isUserBlacklisted(accountId, notification.userUid, 'activityCenter')) {
    utils.log('AI Auto', `🚫 Skipping Activity Center notification from ${notification.manName} (blacklisted)`);
    
    // ✅ ЗАКРЫВАЕМ Activity Center
    await activityCenterScanner.closeActivityCenter(page);
    
    return { processed: false, reason: 'activity_center_blacklisted' };
}
```

---

## 📝 ВАЖНЫЕ ДЕТАЛИ

1. **`page.reload()`** ждет полной перезагрузки (`waitUntil: 'domcontentloaded'`)
2. **`utils.sleep(2000)`** дает время на загрузку API
3. **`closeActivityCenter()`** кликает на `.activity-center-close`
4. Не трогаем остальную логику - только добавляем выходы

---

## 🔄 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

- `backend/src/services/aiAuto/index.js` - строки ~760-795 (Catch Up)
- `backend/src/services/aiAuto/index.js` - строки ~837-850 (Activity Center)
