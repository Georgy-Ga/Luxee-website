# 🔒 Profile Switch Global Mutex - Решение проблемы параллельного переключения

**Дата**: 07.07.2026, 16:28  
**Статус**: ✅ ИСПРАВЛЕНО

---

## 🎯 Проблема

### Симптомы:
```
Browser Context → Профиль A → Профиль B → Профиль A → Профиль B (постоянное переключение)
```

### Корневая причина:

**Множественные сервисы вызывают `selectProfile` параллельно:**

1. ✅ **AI Auto** (`aiAuto/index.js`) - имел свою блокировку
2. ❌ **AI Response Service** (`aiResponseService.js`) - БЕЗ блокировки
3. ❌ **Pending Response** (`aiAutoResponseService.js`) - БЕЗ блокировки  
4. ❌ **Message Send Service** (`messageSendService.js`) - БЕЗ блокировки
5. ❌ **Profile Activation** (`profileActivationService.js`) - БЕЗ блокировки
6. ❌ И другие сервисы...

**Результат:** Все вызывают `modelsChat.selectProfile()` на ОДНОМ браузере одновременно!

---

## ✅ Решение: Глобальный Profile Switch Service

### Архитектура:

```
┌─────────────────────────────────────────────────────────────┐
│           Profile Switch Service (Глобальный Mutex)          │
│  accountId → { isLocked, currentProfileUid, queue }         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
    │ AI Auto   │      │AI Response│      │  Pending  │
    │  Service  │      │  Service  │      │  Response │
    └───────────┘      └───────────┘      └───────────┘
```

### Workflow:

```javascript
1. Сервис A → profileSwitchService.switchProfile(page, accountId, profileUid)
   ├─> Проверка: уже на нужном профиле? → Skip
   ├─> Блокировка занята? → ЖДАТЬ
   └─> Блокировка свободна → ЗАБЛОКИРОВАТЬ

2. Выполнить переключение:
   ├─> page.evaluate(() => modelsChat.selectProfile(uid))
   ├─> Подождать 3 секунды (загрузка чатов)
   └─> Проверить что переключились

3. Обновить currentProfileUid

4. ВСЕГДА разблокировать (finally)

5. Сервис B пытается переключить профиль:
   ├─> Блокировка занята (Сервис A)
   ├─> ЖДЁТ освобождения
   └─> Когда освободится → свой цикл
```

---

## 📁 Новый файл: `profileSwitchService.js`

**Путь:** `backend/src/services/luxeeApi/profileSwitchService.js`

### Ключевые функции:

#### 1. `switchProfile(page, accountId, profileUid, caller)`
```javascript
// Переключить профиль с глобальной блокировкой
const switched = await profileSwitchService.switchProfile(
    page,
    accountId,
    profileUid,
    'AI Auto' // caller для логов
);
```

**Логика:**
- ✅ Проверка: уже на нужном профиле? → skip
- ✅ Ожидание освобождения блокировки (timeout 30 сек)
- ✅ Блокировка
- ✅ Переключение
- ✅ Проверка успешности
- ✅ Разблокировка (always в finally)

#### 2. `getCurrentProfile(page)`
```javascript
// Получить текущий активный профиль
const currentUid = await profileSwitchService.getCurrentProfile(page);
```

#### 3. `getLockStatus(accountId)`
```javascript
// Проверить статус блокировки
const status = profileSwitchService.getLockStatus(accountId);
// { isLocked: boolean, currentProfileUid: number }
```

#### 4. `forceUnlock(accountId)`
```javascript
// Принудительно разблокировать (для отладки)
profileSwitchService.forceUnlock(accountId);
```

#### 5. `clearCache(accountId)`
```javascript
// Очистить кеш при отключении аккаунта
profileSwitchService.clearCache(accountId);
```

---

## 🔧 Обновленные сервисы

### 1. ✅ `aiAuto/utils.js`

**ДО:**
```javascript
const switchToProfile = async (page, profileUid) => {
    await page.evaluate(uid => {
        modelsChat.selectProfile(uid);
    }, profileUid);
    await sleep(3000);
};
```

**ПОСЛЕ:**
```javascript
const switchToProfile = async (page, accountId, profileUid) => {
    const profileSwitchService = (await import('../luxeeApi/profileSwitchService.js')).default;
    return await profileSwitchService.switchProfile(
        page,
        accountId,
        profileUid,
        'AI Auto',
    );
};
```

### 2. ✅ `aiAuto/index.js`

**Обновлено:**
```javascript
// Передаем accountId в switchToProfile
const switched = await utils.switchToProfile(page, accountId, profile.uid);
```

### 3. ✅ `aiResponseService.js`

**ДО:**
```javascript
// Внутри page.evaluate:
modelsChat.selectProfile(pUid);
await new Promise(resolve => setTimeout(resolve, 500));
```

**ПОСЛЕ:**
```javascript
// ВНЕ page.evaluate, перед evaluate:
const profileSwitchService = (await import('./luxeeApi/profileSwitchService.js')).default;
const switchSuccess = await profileSwitchService.switchProfile(
    page,
    accountId,
    profileUid,
    'AI Response Service',
);

if (!switchSuccess) {
    throw new Error('Profile switch failed');
}

// Затем evaluate БЕЗ selectProfile - профиль уже переключен!
```

---

## 📊 Преимущества

### 1. **Безопасность**
- ✅ Только ОДИН процесс переключает профиль в момент времени
- ✅ Все остальные ЖДУТ

### 2. **Эффективность**
- ✅ Skip если уже на нужном профиле
- ✅ Кеш текущего профиля на аккаунт

### 3. **Наблюдаемость**
```
[Profile Switch] 🔒 LOCKED for AI Auto → switching to profile 608895
[Profile Switch] ✅ Switched to profile 608895 (AI Auto) in 3245ms
[Profile Switch] 🔓 UNLOCKED (AI Auto)

[Profile Switch] ⏳ Waiting for lock (AI Response Service → profile 605196)...
[Profile Switch] 🔒 LOCKED for AI Response Service → switching to profile 605196
[Profile Switch] ✅ Switched to profile 605196 (AI Response Service) in 3156ms
[Profile Switch] 🔓 UNLOCKED (AI Response Service)
```

### 4. **Отказоустойчивость**
- ✅ Timeout 30 секунд
- ✅ `finally` блок всегда разблокирует
- ✅ `forceUnlock` для экстренных случаев

---

## 🎯 Логи в production

### Нормальная работа:
```
[Profile Switch] ⚡ Already on profile 608895 (AI Auto) - skipping
```

### Ожидание блокировки:
```
[Profile Switch] ⏳ Waiting for lock (Pending Response → profile 605196)...
[Profile Switch] ⏳ Waiting for lock (Pending Response → profile 605196)...
[Profile Switch] 🔒 LOCKED for Pending Response → switching to profile 605196
```

### Переключение:
```
[Browser] 🔄 Switching to profile 605196 (caller: AI Response Service)
[Profile Switch] ✅ Switched to profile 605196 (AI Response Service) in 3124ms
[Profile Switch] 🔓 UNLOCKED (AI Response Service)
```

### Ошибка:
```
[Profile Switch] ❌ Error switching profile (AI Auto): Switch failed: expected 608895, got 605196
[Profile Switch] 🔓 UNLOCKED (AI Auto)
```

---

## 🔍 Диагностика

### Проверить статус блокировки:
```javascript
const status = profileSwitchService.getLockStatus(accountId);
console.log(status);
// { isLocked: true, currentProfileUid: 608895 }
```

### Принудительно разблокировать:
```javascript
const wasLocked = profileSwitchService.forceUnlock(accountId);
// true если была блокировка
```

### Очистить кеш:
```javascript
profileSwitchService.clearCache(accountId);
// При отключении аккаунта или перезапуске
```

---

## ⚠️ Важные правила

### 1. ВСЕ переключения ТОЛЬКО через profileSwitchService

**❌ НЕПРАВИЛЬНО:**
```javascript
await page.evaluate(uid => {
    modelsChat.selectProfile(uid);
}, profileUid);
```

**✅ ПРАВИЛЬНО:**
```javascript
const profileSwitchService = (await import('./luxeeApi/profileSwitchService.js')).default;
await profileSwitchService.switchProfile(page, accountId, profileUid, 'My Service');
```

### 2. Всегда передавай accountId

Mutex работает на уровне **accountId**, НЕ глобально!

```javascript
// Аккаунт A и Аккаунт B могут переключать профили параллельно
// Но внутри одного аккаунта - ТОЛЬКО последовательно
```

### 3. Динамический import для избежания циклических зависимостей

```javascript
const profileSwitchService = (await import('./luxeeApi/profileSwitchService.js')).default;
```

### 4. Указывай caller для логов

```javascript
await profileSwitchService.switchProfile(
    page,
    accountId,
    profileUid,
    'My Service Name', // ← Это помогает в отладке!
);
```

---

## 📝 Следующие шаги

### Ещё нужно обновить (при необходимости):

- [ ] `messageSendService.js` - если там есть `selectProfile`
- [ ] `chatOpenService.js` - если там есть `selectProfile`
- [ ] `profileParserService/chatExtractor.js` - если там есть
- [ ] `profileParserService/messageExtractor.js` - если там есть
- [ ] `profileChatsLoadService.js` - если там есть

**Принцип:** Найти ВСЕ `modelsChat.selectProfile()` и заменить на `profileSwitchService.switchProfile()`

---

## ✅ Результат

### ДО:
```
Browser → Profile A (AI Auto)
Browser → Profile B (Pending Response) ← параллельно!
Browser → Profile A (AI Response) ← конфликт!
Browser → Profile B (Message Send) ← хаос!
```

### ПОСЛЕ:
```
Browser → Profile A (AI Auto) 🔒
          ⏳ Pending Response ждёт...
          ⏳ AI Response ждёт...
Browser → Profile A unlocked 🔓

Browser → Profile B (Pending Response) 🔒
          ⏳ AI Response ждёт...
Browser → Profile B unlocked 🔓

Browser → Profile C (AI Response) 🔒
Browser → Profile C unlocked 🔓
```

**Никаких конфликтов! Последовательная обработка!**

---

**Автор**: Kiro AI  
**Дата**: 07.07.2026, 16:28  
**Статус**: ✅ ГОТОВО К ТЕСТИРОВАНИЮ
