# Spambot: Детальный план внедрения денормализации

**Дата**: 2026-07-23  
**Задача**: Добавить поле `accountEmail` в модель распыления для надежного хранения email

---

## 🔍 ДЕТАЛЬНАЯ ТРАССИРОВКА ДАННЫХ

### 1️⃣ Место создания рассылки

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `startDistribution()`  
**Строки**: 90-174

#### Текущий код (строки 104-127):

```javascript
// 1. Получаем аккаунт из БД
let account;
if (userRole === 'admin') {
    account = await LuxeeAccountModel.findById(accountId).populate('user', 'email');
} else {
    account = await LuxeeAccountModel.findOne({
        _id: accountId,
        user: userId,
    }).populate('user', 'email');
}

if (!account) {
    throw new Error('Account not found or access denied');
}

// 2. Создаем рассылку
const distribution = new SpambotDistributionModel({
    user: account.user._id,
    luxeeAccount: accountId,
    distributionId: `temp_...`,
    config: { ... },
    status: shouldQueue ? 'queued' : 'running',
});
```

#### ✅ ЧТО ЗДЕСЬ ДОСТУПНО:
- `account` — объект LuxeeAccount из БД
- `account.luxeeEmail` — ✅ **ЕСТЬ** (это поле модели)
- `account.user._id` — ID владельца

#### 🎯 ЧТО НУЖНО ДОБАВИТЬ:

```javascript
const distribution = new SpambotDistributionModel({
    user: account.user._id,
    luxeeAccount: accountId,
    accountEmail: account.luxeeEmail,  // ← ДОБАВИТЬ ЭТУ СТРОКУ
    distributionId: `temp_...`,
    // ...
});
```

---

### 2️⃣ Возврат данных клиенту

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `startDistribution()` — return statement  
**Строки**: 163-173 (для queued) и далее для running

#### Текущий код (queued):

```javascript
return {
    id: distribution._id,
    distributionId: distribution.distributionId,
    status: 'queued',
    accountEmail: account.luxeeEmail,  // ← Берем из account
    user: account.user._id,
    config: distribution.config,
    // ...
};
```

#### ✅ После денормализации:

```javascript
return {
    id: distribution._id,
    distributionId: distribution.distributionId,
    status: 'queued',
    accountEmail: distribution.accountEmail,  // ← Берем из distribution!
    user: distribution.user,
    config: distribution.config,
    // ...
};
```

**Преимущество**: Не нужно держать `account` в памяти, всё уже в `distribution`

---

### 3️⃣ Метод getUserDistributions

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `getUserDistributions(userId)`  
**Строки**: 451-511

#### Текущий код (с quick fix):

```javascript
async getUserDistributions(userId, limit = 20) {
    const distributions = await SpambotDistributionModel
        .find({ user: userId })
        .populate('luxeeAccount', 'luxeeEmail')  // ← Нужен populate!
        .sort({ createdAt: -1 })
        .limit(limit);

    return distributions.map(d => ({
        id: d._id,
        distributionId: d.distributionId,
        accountEmail: d.luxeeAccount?.luxeeEmail || '❌ Account Deleted',  // ← Проверка!
        // ...
    }));
}
```

#### ✅ После денормализации:

```javascript
async getUserDistributions(userId, limit = 20) {
    const distributions = await SpambotDistributionModel
        .find({ user: userId })
        // .populate() больше не нужен!
        .sort({ createdAt: -1 })
        .limit(limit);

    return distributions.map(d => ({
        id: d._id,
        distributionId: d.distributionId,
        accountEmail: d.accountEmail,  // ← Просто берем поле!
        // ...
    }));
}
```

**Преимущества**:
- ✅ Не нужен `.populate()` (1 запрос вместо 2)
- ✅ Не нужна проверка на null
- ✅ Быстрее работает
- ✅ Email всегда доступен

---

### 4️⃣ Метод getAllDistributions (для админа)

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `getAllDistributions(limit = 20)`  
**Строки**: 535-598

#### Аналогично getUserDistributions:

```javascript
// БЫЛО:
.populate('luxeeAccount', 'luxeeEmail')
accountEmail: d.luxeeAccount?.luxeeEmail || '❌ Account Deleted',

// СТАНЕТ:
// populate не нужен
accountEmail: d.accountEmail,
```

---

### 5️⃣ Очередь (SpambotQueueService)

**Файл**: `backend/src/services/SpambotQueueService.js`  
**Метод**: `startNextInQueue()`

#### Где используется accountEmail:

```javascript
// Строки ~80-100
const account = await LuxeeAccountModel.findById(accountId);

// ...отправка в Python Service
const response = await axios.post(`${PYTHON_SERVICE_URL}/api/distribution/start`, {
    username: account.luxeeEmail,  // ← Берем из account
    password: account.luxeePassword,
    // ...
});
```

#### ✅ Что можно улучшить:

Можно взять email из `distribution.accountEmail` вместо загрузки всего аккаунта:

```javascript
// Если нужен только email:
const config = {
    username: distribution.accountEmail,  // ← Из distribution!
    password: account.luxeePassword,      // ← Но пароль нужен из account
    // ...
};
```

**Но**: Пароль всё равно нужен из аккаунта, поэтому здесь improvement минимальный.  
**Решение**: Оставить как есть, но добавить fallback:

```javascript
const account = await LuxeeAccountModel.findById(accountId);
if (!account) {
    throw new Error(`Account ${distribution.accountEmail} not found or deleted`);
    // Теперь в ошибке будет email!
}
```

---

## 📋 ПОШАГОВЫЙ ПЛАН ВНЕДРЕНИЯ

### Шаг 1: Обновить модель

**Файл**: `backend/src/models/SpambotDistributionModel.js`

**Изменения**:
```javascript
const SpambotDistributionSchema = new Schema({
    user: { ... },
    luxeeAccount: { ... },
    
    // ✅ НОВОЕ ПОЛЕ
    accountEmail: {
        type: String,
        required: true,  // Обязательное для новых записей
        index: true,      // Индекс для поиска
    },
    
    distributionId: { ... },
    // ...
});
```

**Важно**: Поле `required: true`, но для старых записей его нет → нужна миграция!

---

### Шаг 2: Обновить SpambotService.startDistribution()

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `startDistribution()`

**Изменение** (строка ~127):

```javascript
const distribution = new SpambotDistributionModel({
    user: account.user._id,
    luxeeAccount: accountId,
    accountEmail: account.luxeeEmail,  // ← ДОБАВИТЬ
    distributionId: `temp_...`,
    config: { ... },
    status: shouldQueue ? 'queued' : 'running',
    queuedAt: shouldQueue ? new Date() : undefined,
});
```

---

### Шаг 3: Упростить getUserDistributions()

**Файл**: `backend/src/services/SpambotService.js`  
**Метод**: `getUserDistributions()`

**Было**:
```javascript
const distributions = await SpambotDistributionModel
    .find({ user: userId })
    .populate('luxeeAccount', 'luxeeEmail')
    .sort({ createdAt: -1 })
    .limit(limit);

return distributions.map(d => ({
    accountEmail: d.luxeeAccount?.luxeeEmail || '❌ Account Deleted',
    // ...
}));
```

**Станет**:
```javascript
const distributions = await SpambotDistributionModel
    .find({ user: userId })
    // populate больше не нужен!
    .sort({ createdAt: -1 })
    .limit(limit);

return distributions.map(d => ({
    accountEmail: d.accountEmail,  // Просто берем поле!
    // ...
}));
```

---

### Шаг 4: Упростить getAllDistributions()

**Аналогично getUserDistributions()**:
- Убрать `.populate('luxeeAccount', 'luxeeEmail')`
- Заменить `d.luxeeAccount?.luxeeEmail || '❌ Account Deleted'` на `d.accountEmail`

---

### Шаг 5: Создать скрипт миграции

**Файл**: `backend/migrateAccountEmail.js`

**Цель**: Заполнить поле `accountEmail` для всех существующих рассылок.

```javascript
import SpambotDistributionModel from './src/models/SpambotDistributionModel.js';
import LuxeeAccountModel from './src/models/LuxeeAccountModel.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    console.log('🚀 Starting accountEmail migration...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // 1. Получить все рассылки
    const distributions = await SpambotDistributionModel.find({})
        .populate('luxeeAccount', 'luxeeEmail');
    
    console.log(`📊 Found ${distributions.length} distributions\n`);
    
    let updated = 0;
    let alreadyHaveEmail = 0;
    let accountDeleted = 0;
    
    // 2. Обработать каждую рассылку
    for (const d of distributions) {
        // Если email уже есть → пропустить
        if (d.accountEmail) {
            alreadyHaveEmail++;
            continue;
        }
        
        // Если аккаунт существует → сохранить email
        if (d.luxeeAccount) {
            d.accountEmail = d.luxeeAccount.luxeeEmail;
            await d.save();
            updated++;
            console.log(`✅ ${updated}. Set email for distribution ${d.distributionId}: ${d.accountEmail}`);
        } else {
            // Аккаунт удален → пометить
            d.accountEmail = '❌ Account Deleted';
            await d.save();
            accountDeleted++;
            console.log(`⚠️  ${accountDeleted}. Marked as deleted: ${d.distributionId}`);
        }
    }
    
    console.log('\n📈 Migration summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ℹ️  Already had email: ${alreadyHaveEmail}`);
    console.log(`   ⚠️  Account deleted: ${accountDeleted}`);
    console.log(`   📊 Total: ${distributions.length}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Migration completed!');
}

migrate().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
```

---

### Шаг 6: Запустить миграцию

**В Docker контейнере**:

```bash
# 1. Войти в контейнер backend
docker exec -it luxee-backend bash

# 2. Запустить миграцию
node migrateAccountEmail.js

# 3. Проверить результат
# Должно быть: "✅ Migration completed!"
```

---

### Шаг 7: Проверка

**1. Проверить БД**:
```bash
docker exec -it luxee-mongodb mongosh

use luxee-db
db.spambotdistributions.find({}, { accountEmail: 1, distributionId: 1 }).limit(5)

# Должен видеть accountEmail у всех записей
```

**2. Проверить API**:
```bash
# Обновить страницу Spambot
# История должна загружаться без ошибок
# Email должен отображаться
```

**3. Создать новую рассылку**:
```bash
# Создать тестовую рассылку
# Проверить что accountEmail сразу заполнен
```

---

## 🎯 ПРОВЕРКА КОРРЕКТНОСТИ

### Перед запуском миграции:

```javascript
// В MongoDB
db.spambotdistributions.findOne()

// Должно быть:
{
    _id: ObjectId("..."),
    user: ObjectId("..."),
    luxeeAccount: ObjectId("..."),
    // accountEmail: отсутствует! ← проблема
    distributionId: "...",
    config: { ... },
    status: "completed"
}
```

### После миграции:

```javascript
// В MongoDB
db.spambotdistributions.findOne()

// Должно быть:
{
    _id: ObjectId("..."),
    user: ObjectId("..."),
    luxeeAccount: ObjectId("..."),
    accountEmail: "translator.04@gmail.com",  // ← ДОБАВЛЕНО!
    distributionId: "...",
    config: { ... },
    status: "completed"
}
```

### При создании новой рассылки:

```javascript
// После startDistribution() в БД сразу:
{
    accountEmail: "translator.04@gmail.com",  // ← Сразу заполнено!
    luxeeAccount: ObjectId("..."),
    // ...
}
```

---

## ⚠️ ВОЗМОЖНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: "required: true" для старых записей

**Симптом**: Ошибка при сохранении старых рассылок после обновления модели.

**Решение**: Миграция заполнит все старые записи ПЕРЕД применением `required: true`.

**Порядок действий**:
1. ✅ Сначала добавить поле БЕЗ `required: true`
2. ✅ Запустить миграцию
3. ✅ Потом добавить `required: true`

Или:

1. Добавить поле с `required: false`
2. Запустить миграцию
3. Изменить на `required: true` (опционально)

### Проблема 2: Аккаунт удален во время миграции

**Симптом**: `d.luxeeAccount` === null

**Решение**: Уже предусмотрено в скрипте миграции:
```javascript
if (d.luxeeAccount) {
    d.accountEmail = d.luxeeAccount.luxeeEmail;
} else {
    d.accountEmail = '❌ Account Deleted';
}
```

### Проблема 3: Email изменен в аккаунте

**Симптом**: В LuxeeAccount email изменился, но в старых рассылках остался старый.

**Решение**: Это нормально! Денормализация хранит исторические данные.
- Старые рассылки → показывают старый email (правильно)
- Новые рассылки → показывают новый email

---

## 📊 СРАВНЕНИЕ: ДО И ПОСЛЕ

### ДО (с quick fix):

```javascript
// Запрос к БД:
const distributions = await SpambotDistributionModel
    .find({ user: userId })
    .populate('luxeeAccount', 'luxeeEmail')  // ← 2 запроса к БД!
    .limit(20);

// Обработка:
return distributions.map(d => ({
    accountEmail: d.luxeeAccount?.luxeeEmail || '❌ Account Deleted',  // ← проверка!
}));
```

**Проблемы**:
- Медленно (2 запроса)
- Сложный код (проверки на null)
- Если аккаунт удален → теряем email

### ПОСЛЕ (с денормализацией):

```javascript
// Запрос к БД:
const distributions = await SpambotDistributionModel
    .find({ user: userId })
    // populate не нужен!  // ← 1 запрос к БД!
    .limit(20);

// Обработка:
return distributions.map(d => ({
    accountEmail: d.accountEmail,  // ← просто берем поле!
}));
```

**Преимущества**:
- ✅ Быстро (1 запрос)
- ✅ Простой код
- ✅ Email всегда доступен

---

## 🚀 ИТОГОВЫЙ ЧЕКЛИСТ

- [ ] **Шаг 1**: Обновить модель `SpambotDistributionModel` (добавить `accountEmail`)
- [ ] **Шаг 2**: Обновить `SpambotService.startDistribution()` (сохранять email)
- [ ] **Шаг 3**: Упростить `getUserDistributions()` (убрать populate)
- [ ] **Шаг 4**: Упростить `getAllDistributions()` (убрать populate)
- [ ] **Шаг 5**: Создать скрипт миграции `migrateAccountEmail.js`
- [ ] **Шаг 6**: Запустить миграцию в Docker
- [ ] **Шаг 7**: Проверить результаты (БД, API, UI)
- [ ] **Шаг 8**: Создать тестовую рассылку
- [ ] **Шаг 9**: Убедиться что всё работает

---

## 💡 ЗАКЛЮЧЕНИЕ

После внедрения денормализации:

1. **Email ВСЕГДА доступен** — даже если аккаунт удален
2. **Производительность улучшена** — 1 запрос вместо 2
3. **Код упрощен** — нет проверок на null
4. **Историчность сохранена** — старые рассылки показывают правильный email
5. **Надежность увеличена** — нет крашей

**Это правильное решение для production! 🎯**

---

_Создано: 2026-07-23_  
_Автор: AI Assistant (Kiro)_
