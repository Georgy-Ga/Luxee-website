# Database Models

## MongoDB Collections

Проект использует MongoDB с Mongoose ODM. Всего 5 коллекций.

---

## 1. User (Пользователи системы)

**Файл**: `backend/src/models/UserModel.js`

**Схема**:
```javascript
{
  email: String (required, unique),
  password: String (required, hashed with bcrypt),
  role: String (enum: ['user', 'admin'], default: 'user'),
  aiEnabled: Boolean (default: true),
  aiEnabledByAdmin: Boolean (default: true)
}
```

**Поля**:
- `email` - Email пользователя (уникальный)
- `password` - Хешированный пароль (bcrypt, salt=3)
- `role` - Роль: `user` или `admin`
- `aiEnabled` - Может ли пользователь сам использовать AI
- `aiEnabledByAdmin` - Разрешил ли админ использовать AI

**Индексы**:
- `email` (unique)

**Связи**:
- `Token` (1:1) - Refresh token пользователя
- `LuxeeAccount` (1:N) - Luxee аккаунты пользователя
- `AiRule` (1:N) - AI правила созданные пользователем

**Логика прав AI**:
```javascript
canUseAi = aiEnabled && aiEnabledByAdmin

// Примеры:
aiEnabled=true, aiEnabledByAdmin=true   → Может использовать AI
aiEnabled=false, aiEnabledByAdmin=true  → Сам выключил AI
aiEnabled=true, aiEnabledByAdmin=false  → Админ запретил AI
aiEnabled=false, aiEnabledByAdmin=false → AI недоступен
```

**Пример документа**:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "password": "$2b$03$...",
  "role": "user",
  "aiEnabled": true,
  "aiEnabledByAdmin": true
}
```

---

## 2. Token (Refresh токены)

**Файл**: `backend/src/models/TokenModel.js`

**Схема**:
```javascript
{
  user: ObjectId (ref: 'User', required),
  refreshToken: String (required)
}
```

**Поля**:
- `user` - Ссылка на пользователя
- `refreshToken` - JWT refresh token

**Индексы**:
- `user` (для быстрого поиска)
- `refreshToken` (для валидации)

**Особенности**:
- Один токен на пользователя (при новом логине старый заменяется)
- Живёт 30 дней
- Удаляется при logout

**Пример документа**:
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "user": "507f1f77bcf86cd799439011",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 3. LuxeeAccount (Luxee аккаунты)

**Файл**: `backend/src/models/LuxeeAccountModel.js`

**Схема**:
```javascript
{
  user: ObjectId (ref: 'User', required),
  luxeeEmail: String (required),
  luxeePassword: String (required),
  sessionData: String,
  isActive: Boolean (default: false),
  lastActivity: Date (default: Date.now),
  createdAt: Date (default: Date.now),
  aiEnabled: Boolean (default: false),
  aiContext: String
}
```

**Поля**:
- `user` - Владелец аккаунта
- `luxeeEmail` - Email на Luxee.io
- `luxeePassword` - Пароль на Luxee.io (хранится в открытом виде ⚠️)
- `sessionData` - Сериализованная сессия браузера (cookies, localStorage)
- `isActive` - Активен ли аккаунт (есть ли браузерный контекст)
- `lastActivity` - Последняя активность
- `createdAt` - Дата создания
- `aiEnabled` - Включен ли AI для этого аккаунта
- `aiContext` - ID отдельного браузерного контекста для AI

**Индексы**:
- `user` (для поиска аккаунтов пользователя)

**Связи**:
- `User` (N:1) - Владелец аккаунта
- `AnsweredChat` (1:N) - Отвеченные чаты аккаунта

**Жизненный цикл**:
```
1. Создание → luxeeEmail, luxeePassword, user
2. Авторизация → sessionData, isActive=true
3. Работа → lastActivity обновляется
4. AI включен → aiEnabled=true, создаётся aiContext
5. Удаление → isActive=false, контексты закрываются
```

**⚠️ ПРОБЛЕМА БЕЗОПАСНОСТИ**: Пароль хранится в открытом виде!

**Решение**:
```javascript
// Шифрование пароля
import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString();
}
```

**Пример документа**:
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "user": "507f1f77bcf86cd799439011",
  "luxeeEmail": "model@luxee.io",
  "luxeePassword": "password123",
  "sessionData": "{\"cookies\":[...],\"localStorage\":{...}}",
  "isActive": true,
  "lastActivity": "2026-05-25T03:00:00.000Z",
  "createdAt": "2026-05-20T10:00:00.000Z",
  "aiEnabled": true,
  "aiContext": "ai_context_507f1f77bcf86cd799439013"
}
```

---

## 4. AiRule (Кастомные AI правила)

**Файл**: `backend/src/models/AiRule.js`

**Схема**:
```javascript
{
  rule: String (required, trim),
  description: String (trim),
  isActive: Boolean (default: true),
  createdBy: ObjectId (ref: 'User', required),
  order: Number (default: 0),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Поля**:
- `rule` - Текст правила для AI промпта
- `description` - Описание правила (для админов)
- `isActive` - Активно ли правило
- `createdBy` - Кто создал правило
- `order` - Порядок применения (меньше = раньше)
- `createdAt` - Дата создания (автоматически)
- `updatedAt` - Дата обновления (автоматически)

**Индексы**:
- `isActive` (для быстрой выборки активных)
- `order` (для сортировки)

**Использование**:
```javascript
// Получение активных правил
const rules = await AiRule.find({ isActive: true })
  .sort({ order: 1, createdAt: 1 });

// Добавление в промпт
const customRules = rules.map(r => r.rule).join('\n');
const systemPrompt = `
  ${basePrompt}
  
  CUSTOM RULES:
  ${customRules}
`;
```

**Пример документа**:
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "rule": "Always be positive and upbeat",
  "description": "Maintain positive tone in all responses",
  "isActive": true,
  "createdBy": "507f1f77bcf86cd799439011",
  "order": 0,
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-20T10:00:00.000Z"
}
```

---

## 5. AnsweredChat (Отвеченные чаты)

**Файл**: `backend/src/models/AnsweredChat.js`

**Схема**:
```javascript
{
  accountId: ObjectId (ref: 'Account', required),
  profileUid: Number (required),
  chats: [
    {
      chatId: String (required),
      memberUid: Number (required),
      memberUsername: String,
      memberAvatar: String,
      lastManMessage: {
        body: String,
        createdAt: String
      },
      lastWomanMessage: {
        body: String,
        createdAt: String
      },
      lastActivity: String,
      savedAt: Date (default: Date.now)
    }
  ],
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Поля**:
- `accountId` - Luxee аккаунт
- `profileUid` - UID профиля девушки
- `chats` - Массив отвеченных чатов (максимум 5)
  - `chatId` - ID чата (формат: "profileUid_memberUid")
  - `memberUid` - UID мужчины
  - `memberUsername` - Имя мужчины
  - `memberAvatar` - Аватар мужчины
  - `lastManMessage` - Последнее сообщение от мужчины
  - `lastWomanMessage` - Последнее сообщение от девушки
  - `lastActivity` - Timestamp последней активности
  - `savedAt` - Когда чат был сохранён

**Индексы**:
- `{ accountId: 1, profileUid: 1 }` (unique) - Один документ на профиль

**Логика**:
```javascript
// Сохранение чата (максимум 5)
1. Найти документ по accountId + profileUid
2. Если чат уже есть → обновить
3. Если чата нет → добавить в начало
4. Сортировать по savedAt (новые сверху)
5. Ограничить до 5 чатов (удалить старые)

// Удаление чата (когда мужчина написал снова)
1. Найти документ
2. Удалить чат из массива
3. Сохранить
```

**Зачем нужно**:
- Показывать историю отвеченных чатов в UI
- Не показывать чаты где уже ответили
- Ограничение 5 чатов для экономии памяти

**Пример документа**:
```json
{
  "_id": "507f1f77bcf86cd799439015",
  "accountId": "507f1f77bcf86cd799439013",
  "profileUid": 12345,
  "chats": [
    {
      "chatId": "12345_67890",
      "memberUid": 67890,
      "memberUsername": "John",
      "memberAvatar": "https://...",
      "lastManMessage": {
        "body": "Hi!",
        "createdAt": "1716600000"
      },
      "lastWomanMessage": {
        "body": "Hello! How are you?",
        "createdAt": "1716600100"
      },
      "lastActivity": "1716600100",
      "savedAt": "2026-05-25T03:00:00.000Z"
    }
  ],
  "createdAt": "2026-05-25T03:00:00.000Z",
  "updatedAt": "2026-05-25T03:00:00.000Z"
}
```

---

## Связи между коллекциями

```
User (1) ──────────── (1) Token
  │
  │ (1:N)
  ├─────────────────── LuxeeAccount
  │                         │
  │                         │ (1:N)
  │                         └─────── AnsweredChat
  │
  └─────────────────── (1:N) AiRule
```

---

## Статистика размеров

**Средний размер документов**:
- User: ~200 bytes
- Token: ~500 bytes (JWT токен)
- LuxeeAccount: ~2-5 KB (sessionData большой)
- AiRule: ~300 bytes
- AnsweredChat: ~2-3 KB (5 чатов)

**При 100 пользователях**:
- Users: 20 KB
- Tokens: 50 KB
- LuxeeAccounts (200): 400-1000 KB
- AiRules (50): 15 KB
- AnsweredChats (200): 400-600 KB

**Итого**: ~1-2 MB для 100 пользователей

---

## Оптимизация

### 1. Индексы
```javascript
// Добавить составные индексы
LuxeeAccountSchema.index({ user: 1, isActive: 1 });
AnsweredChatSchema.index({ accountId: 1, 'chats.chatId': 1 });
```

### 2. Проекции
```javascript
// Не загружать sessionData если не нужно
const accounts = await LuxeeAccountModel.find({ user: userId })
  .select('-sessionData -luxeePassword');
```

### 3. Лимиты
```javascript
// Ограничить количество аккаунтов на пользователя
const accountsCount = await LuxeeAccountModel.countDocuments({ user: userId });
if (accountsCount >= 10) {
  throw new Error('Maximum 10 accounts per user');
}
```

### 4. TTL индексы
```javascript
// Автоматическое удаление старых токенов
TokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 дней
```

---

## Миграции

При изменении схем нужны миграции:

```javascript
// migrations/001_add_ai_fields.js
async function up() {
  await UserModel.updateMany(
    { aiEnabled: { $exists: false } },
    { $set: { aiEnabled: true, aiEnabledByAdmin: true } }
  );
}

async function down() {
  await UserModel.updateMany(
    {},
    { $unset: { aiEnabled: '', aiEnabledByAdmin: '' } }
  );
}
```

---

## Backup стратегия

```bash
# Ежедневный backup
mongodump --uri="mongodb://localhost:27017/luxee" --out=/backups/$(date +%Y%m%d)

# Восстановление
mongorestore --uri="mongodb://localhost:27017/luxee" /backups/20260525
```

---

## Заключение

База данных простая и эффективная. Основные проблемы:
1. ⚠️ Пароли Luxee в открытом виде
2. ⚠️ Большой sessionData (2-5 KB)
3. ⚠️ Нет TTL для старых данных

Рекомендуется:
1. Шифровать luxeePassword
2. Сжимать sessionData (gzip)
3. Добавить TTL индексы
4. Регулярные backups
