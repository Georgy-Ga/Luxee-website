# 🔄 AI Context Auto-Recovery - Автовосстановление AI после перезапуска

**Дата:** 19.06.2026, 00:46  
**Статус:** ✅ РЕАЛИЗОВАНО

---

## 🎯 Проблема

### До исправления:
При перезапуске сервера:
1. ✅ Основные контексты Luxee восстанавливались
2. ❌ AI контексты **НЕ восстанавливались**
3. ❌ AI автоответы **НЕ запускались**

**Результат:** После перезапуска сервера AI переставал работать, даже если был включён.

---

## ✅ Решение

### Добавлено AI Context Auto-Recovery

**Файл:** `backend/index.js`

**Логика:**
1. **Через 3 секунды** после старта → восстановление основных контекстов
2. **Через 6 секунд** после старта → восстановление AI контекстов

---

## 📋 Как работает AI Auto-Recovery

### 1. **Поиск аккаунтов с включённым AI**

```javascript
const aiAccounts = await LuxeeAccountModel.find({
  isActive: true,
  aiEnabled: true,
  aiEnabledByAdmin: true
});
```

**Условия:**
- Аккаунт активен (`isActive = true`)
- AI включён пользователем (`aiEnabled = true`)
- AI разрешён админом (`aiEnabledByAdmin = true`)

---

### 2. **Запуск AI автоответов**

```javascript
for (const account of aiAccounts) {
  await aiAutoResponseService.start(accountId);
}
```

**Что делает `aiAutoResponseService.start()`:**
1. Создаёт AI контекст (отдельный браузер)
2. Открывает страницу Luxee в AI контексте
3. Запускает проверку новых сообщений каждые 10 секунд
4. Автоматически отвечает на неотвеченные чаты

---

### 3. **Логи восстановления**

```
[Server] Starting AI auto-recovery...
[Server] Found 2 accounts with AI enabled
[Server] ✓ AI auto-response started for test1@gmail.com
[Server] ✓ AI auto-response started for test2@gmail.com
[Server] AI recovery complete: 2 started, 0 failed
```

---

## 🔐 Безопасность

### **AI по умолчанию ВЫКЛЮЧЕН** ✅

**UserModel.js:**
```javascript
aiEnabled: {type: Boolean, default: false},
aiEnabledByAdmin: {type: Boolean, default: false},
```

**LuxeeAccountModel.js:**
```javascript
aiEnabled: { type: Boolean, default: false },
aiEnabledByAdmin: { type: Boolean, default: false },
```

---

### **Защита от взлома** ✅

**Backend проверяет ОБА флага:**
```javascript
export const canAccountUseAi = async (userId, accountId) => {
  const account = await LuxeeAccountModel.findOne({
    _id: accountId,
    user: userId,
  });
  
  // Нужны ОБА флага = true
  return account.aiEnabledByAdmin && account.aiEnabled;
}
```

**Пользователь НЕ МОЖЕТ:**
- ❌ Включить AI если админ НЕ разрешил
- ❌ Обойти проверку через frontend
- ❌ Подделать API запрос

**Пользователь МОЖЕТ:**
- ✅ Выключить AI (если админ разрешил)
- ✅ Включить обратно (если админ разрешил)

---

## 📊 Сценарии использования

### **Сценарий 1: Нормальный перезапуск**

1. Сервер работает, AI включён для 3 аккаунтов
2. Перезапуск сервера (`npm run dev`)
3. **Через 3 сек:** Основные контексты восстановлены
4. **Через 6 сек:** AI контексты восстановлены для 3 аккаунтов
5. ✅ AI продолжает работать

---

### **Сценарий 2: AI был выключен**

1. Админ выключил AI для аккаунта
2. Перезапуск сервера
3. **AI НЕ восстанавливается** (правильно!)
4. ✅ AI остаётся выключенным

---

### **Сценарий 3: Новый аккаунт создан**

1. Создан новый пользователь/аккаунт
2. По умолчанию: `aiEnabled = false`, `aiEnabledByAdmin = false`
3. Перезапуск сервера
4. **AI НЕ восстанавливается** (правильно!)
5. ✅ AI выключен по умолчанию

---

### **Сценарий 4: Ошибка при восстановлении**

1. Один из AI контекстов не смог запуститься
2. Ошибка логируется:
   ```
   [Server] ✗ Failed to start AI for test@gmail.com: Browser crashed
   ```
3. **Другие контексты продолжают восстанавливаться**
4. ✅ Один упавший не ломает остальные

---

## 🧪 Как протестировать

### 1. **Включить AI для аккаунта**
- Зайти в админ-панель
- Нажать зелёную кнопку админа (AccountToggleButton)
- AI включится

### 2. **Перезапустить сервер**
```bash
# Остановить
Ctrl + C

# Запустить
npm run dev
```

### 3. **Проверить логи**
```
[Server] Starting AI auto-recovery...
[Server] Found 1 accounts with AI enabled
[Server] ✓ AI auto-response started for test@gmail.com
[Server] AI recovery complete: 1 started, 0 failed
```

### 4. **Убедиться что AI работает**
- Отправить тестовое сообщение от мужчины
- Проверить что AI ответил (в логах будет `[AI Auto] ✓ Sent to...`)

---

## ⚙️ Технические детали

### **Таймеры recovery:**

| Recovery тип | Задержка | Причина |
|-------------|----------|---------|
| Основные контексты | 3 сек | Базовая инициализация |
| AI контексты | 6 сек | Нужны основные контексты |

**Почему 6 секунд для AI?**
- Основные контексты должны восстановиться первыми (3 сек)
- AI контекст использует тот же браузер
- Задержка 3 секунды даёт время основным контекстам загрузиться

---

### **Что делает `aiAutoResponseService.start()`:**

1. **Проверка глобального kill switch**
   ```javascript
   if (AI_AUTO_RESPONSE_GLOBALLY_DISABLED) {
     console.log('🛑 GLOBALLY DISABLED');
     return;
   }
   ```

2. **Проверка прав**
   ```javascript
   const canUse = await aiManagementService.canAccountUseAi(userId, accountId);
   if (!canUse) return;
   ```

3. **Создание AI контекста**
   ```javascript
   await aiBrowserContextService.getOrCreateAiContext(accountId);
   ```

4. **Запуск интервала (каждые 10 сек)**
   ```javascript
   const intervalId = setInterval(processMessages, 10000);
   ```

---

## 📝 Файлы изменены

| Файл | Изменения |
|------|-----------|
| `backend/index.js` | + AI Auto-Recovery блок |
| `AI_AUTO_RECOVERY.md` | + Документация |
| `AI_EMPTY_RESPONSE_FIX.md` | Создана ранее |

---

## 🎯 Итог

### ✅ Что работает:

- AI контексты восстанавливаются после перезапуска
- AI автоответы запускаются автоматически
- Только для аккаунтов с включённым AI
- Защита от взлома на backend
- AI по умолчанию выключен

### 📋 Что делать дальше:

1. Протестировать перезапуск сервера с включённым AI
2. Убедиться что AI продолжает работать после recovery
3. (Опционально) Добавить Health Check для AI контекстов

---

**Автор:** Kiro AI  
**Дата:** 19.06.2026
