# Spambot UI Improvements Plan

## 📊 СРАВНЕНИЕ: Оригинальный GUI vs Текущий Frontend

### ✅ ЧТО УЖЕ ЕСТЬ:

1. **Тип сообщения:** Chat / Mail ✅
2. **Множественные сообщения** с интервалами ✅
3. **Фильтры пользователей:** Purchased / Free ✅
4. **Фильтр чатов:** Только пустые чаты ✅
5. **Лимиты:** Limit, Update Limit, Max Time ✅
6. **Mail:** Title, Text, Pictures ✅

---

### ❌ ЧЕГО НЕТ (КРИТИЧНО):

#### **1. Фильтр "Отправлять только если:"**
**Оригинал (distribution_settings_frame.py:12-21):**
```python
chat_conditions = [
    ("Не отправляли ранее", "empty"),        # only_empty_chat = True
    ("Уже отправляли", "not_empty"),         # only_not_empty_chat = True
    ("Отправлять всем", "all"),              # both False
]
```

**Текущее состояние:**
- ✅ Есть: "Только с пустыми чатами" (only_empty_chat)
- ❌ НЕТ: "Уже отправляли" (only_not_empty_chat)
- ❌ НЕТ: "Отправлять всем" (оба false)

**Проблема:** Нет radio buttons, только один checkbox

---

#### **2. Тип пользователя (КРИТИЧНО)**
**Оригинал (distribution_settings_frame.py:23-28):**
```python
user_types = [
    ("Оплаченный", "paid"),           # purchased=True, free=False
    ("Бесплатный", "free"),           # purchased=False, free=True
    ("Все", "all"),                   # purchased=True, free=True
    ("Отправлять конкретным пользователям", "specific")  # ← ОТСУТСТВУЕТ!
]
```

**Текущее состояние:**
- ✅ Есть: Checkbox "Включить клиентов с покупками"
- ✅ Есть: Checkbox "Включить бесплатных клиентов"
- ❌ НЕТ: "Отправлять конкретным пользователям" (specific_users)

**Проблема:** 
- Нет режима "specific users"
- Нет поля для ввода конкретных ID пользователей

---

#### **3. Исключения (exclude_ids)**
**Оригинал (distribution_settings_frame.py:34-36):**
```python
ttk.Label(self.settings_frame, text="Исключать по ID (через запятую):").pack(anchor="w")
self.exclude_text = tk.Text(self.settings_frame, height=2)
self.exclude_text.pack(fill=tk.X, pady=10)
```

**Текущее состояние:**
- ❌ НЕТ поля для исключений

**Проблема:** Hardcoded `excludeIds: []` в DistributionForm.jsx:54

---

#### **4. Очередь рассылок (Distribution Queue)**
**Оригинал (distribution_list_frame.py):**
```python
# Можно добавить несколько рассылок в очередь
# Показывает список:
# 🔹 Рассылка №1 🔹
# Профиль: Marina (608434)
# Лимит отправки: 50
# Условия: все пользователи, все чаты
# ...
# 🔹 Рассылка №2 🔹
# ...
```

**Текущее состояние:**
- ❌ НЕТ очереди
- ❌ НЕТ кнопки "Добавить на рассылку →"
- ❌ НЕТ списка добавленных рассылок
- ❌ НЕТ кнопки "Начать рассылку!" (для запуска всех)

**Проблема:** Текущий UI сразу запускает одну рассылку без очереди

---

#### **5. Лимит сообщений (max 7)**
**Оригинал (message_frame.py:77-79):**
```python
if len(self.message_entries) >= 7:
    messagebox.showwarning("Лимит", "Не более 7 сообщений!")
    return
```

**Текущее состояние:**
- ❌ НЕТ лимита на количество сообщений

---

#### **6. Mail: Картинки - массив, не число**
**Оригинал (message_frame.py:70-74):**
```python
images_label = ttk.Label(self.messages_frame, text="Картинки (номера через запятую):")
images_label.pack(anchor="w", padx=5)
images_entry = ttk.Entry(self.messages_frame)
# Парсинг: [1, 2, 3] - массив номеров
```

**Текущее состояние:**
```jsx
<input type="number" value={mailPictures} ... />
// Отправляет: picturesNumber: 3 (число, а не массив!)
```

**Проблема:** Неправильная структура данных

---

## 🎯 ПЛАН РЕАЛИЗАЦИИ:

### **ФАЗА 1: Исправить существующие поля**

#### **1.1. Фильтр чатов: Radio buttons вместо checkbox**
**Где:** `DistributionForm.jsx`

**Было:**
```jsx
<input type="checkbox" checked={onlyEmptyChat} ... />
<span>Только с пустыми чатами</span>
```

**Должно стать:**
```jsx
<label>Отправлять только если:</label>
<div className="space-y-2">
  <label>
    <input type="radio" name="chatCondition" value="all" checked={chatCondition === 'all'} />
    <span>Отправлять всем</span>
  </label>
  <label>
    <input type="radio" name="chatCondition" value="empty" />
    <span>Не отправляли ранее (пустые чаты)</span>
  </label>
  <label>
    <input type="radio" name="chatCondition" value="not_empty" />
    <span>Уже отправляли (непустые чаты)</span>
  </label>
</div>
```

**Маппинг:**
- `all` → `onlyEmptyChat: false, onlyNotEmptyChat: false`
- `empty` → `onlyEmptyChat: true, onlyNotEmptyChat: false`
- `not_empty` → `onlyEmptyChat: false, onlyNotEmptyChat: true`

---

#### **1.2. Тип пользователя: Radio buttons + specific users**
**Было:**
```jsx
<input type="checkbox" checked={purchased} />
<span>Включить клиентов с покупками</span>
```

**Должно стать:**
```jsx
<label>Тип пользователя:</label>
<div className="space-y-2">
  <label>
    <input type="radio" name="userType" value="all" />
    <span>Все</span>
  </label>
  <label>
    <input type="radio" name="userType" value="paid" />
    <span>Оплаченный (Purchased)</span>
  </label>
  <label>
    <input type="radio" name="userType" value="free" />
    <span>Бесплатный (Free)</span>
  </label>
  <label>
    <input type="radio" name="userType" value="specific" />
    <span>Отправлять конкретным пользователям</span>
  </label>
</div>

{userType === 'specific' && (
  <div>
    <label>Список пользователей для отправки (ID через запятую):</label>
    <textarea value={specificUsers} onChange={...} rows={2} />
  </div>
)}
```

**Маппинг:**
- `all` → `purchased: true, free: true, specificUsers: []`
- `paid` → `purchased: true, free: false, specificUsers: []`
- `free` → `purchased: false, free: true, specificUsers: []`
- `specific` → `purchased: false, free: false, specificUsers: [1, 2, 3]`

---

#### **1.3. Добавить поле "Исключать по ID"**
```jsx
<div>
  <label>Исключать по ID (через запятую):</label>
  <textarea 
    value={excludeIds} 
    onChange={(e) => setExcludeIds(e.target.value)}
    placeholder="123, 456, 789"
    rows={2}
  />
</div>
```

**Парсинг:**
```javascript
const excludeIdsArray = excludeIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
```

---

#### **1.4. Mail: Картинки - массив**
**Было:**
```jsx
<input type="number" value={mailPictures} />
// Отправка: picturesNumber: 3
```

**Должно стать:**
```jsx
<input 
  type="text" 
  value={mailPictures} 
  placeholder="1, 2, 3"
  onChange={(e) => setMailPictures(e.target.value)}
/>
// Отправка: picturesNumber: [1, 2, 3]
```

**Парсинг:**
```javascript
const picturesArray = mailPictures.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
```

---

### **ФАЗА 2: Добавить очередь рассылок**

#### **2.1. Изменить UI Layout**

**Было (сверху вниз):**
```
[Шаг 1: Аккаунт]
[Шаг 2: Профиль]
[Шаг 3: Форма]
[История рассылок]
```

**Должно стать (2 колонки):**
```
+---------------------------+---------------------------+
| [Шаг 1: Аккаунт]          | [Очередь рассылок]       |
| [Шаг 2: Профиль]          |                          |
| [Шаг 3: Форма]            | 🔹 Рассылка №1           |
|                           | Профиль: Marina          |
| [Добавить на рассылку →]  | Лимит: 50                |
|                           | ...                      |
|                           |                          |
|                           | 🔹 Рассылка №2           |
|                           | ...                      |
|                           |                          |
|                           | [Начать рассылку!]       |
+---------------------------+---------------------------+
| [История рассылок]                                    |
+-------------------------------------------------------+
```

**Layout:**
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Левая колонка: Форма */}
  <div className="space-y-6">
    <AccountSelector ... />
    <ProfileSelector ... />
    <DistributionForm 
      onAddToQueue={handleAddToQueue}  // ← Не сразу запуск!
    />
  </div>

  {/* Правая колонка: Очередь */}
  <DistributionQueue 
    distributions={queuedDistributions}
    onStart={handleStartAllDistributions}
    onRemove={handleRemoveFromQueue}
  />
</div>
```

---

#### **2.2. State для очереди**
```javascript
const [queuedDistributions, setQueuedDistributions] = useState([]);

const handleAddToQueue = (config) => {
  const distribution = {
    id: Date.now(), // temp ID
    profile: selectedProfile,
    account: selectedAccount,
    config: config,
    number: queuedDistributions.length + 1
  };
  
  setQueuedDistributions([...queuedDistributions, distribution]);
  
  // Очистить форму
  setSelectedProfile(null);
};

const handleRemoveFromQueue = (id) => {
  setQueuedDistributions(prev => prev.filter(d => d.id !== id));
};

const handleStartAllDistributions = async () => {
  for (const dist of queuedDistributions) {
    await spambotApi.createDistribution(dist.account._id, dist.config);
  }
  setQueuedDistributions([]);
};
```

---

#### **2.3. Компонент DistributionQueue**
```jsx
const DistributionQueue = ({ distributions, onStart, onRemove }) => {
  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4">
      <h3>Добавлено на рассылку:</h3>
      
      {distributions.length === 0 ? (
        <p>Очередь пуста</p>
      ) : (
        <div className="space-y-4">
          {distributions.map(dist => (
            <div key={dist.id} className="border rounded p-3">
              <div className="font-bold">🔹 Рассылка №{dist.number}</div>
              <div>Профиль: {dist.profile.name} ({dist.profile.uid})</div>
              <div>Лимит: {dist.config.limit}</div>
              <div>Тип: {dist.config.distributionType === 'chat' ? 'Chat' : 'Mail'}</div>
              <button onClick={() => onRemove(dist.id)}>Удалить</button>
            </div>
          ))}
        </div>
      )}
      
      {distributions.length > 0 && (
        <button 
          onClick={onStart}
          className="w-full mt-4 bg-green-600 hover:bg-green-700"
        >
          Начать рассылку!
        </button>
      )}
    </div>
  );
};
```

---

### **ФАЗА 3: Переименования (EN/RU)**

#### **3.1. Оставить на английском (как в оригинале):**
- ✅ "Chat" → **Chat** (не "Чат")
- ✅ "Mail" → **Mail** (не "Почта")
- ✅ "Purchased" → **Purchased** или **Оплаченный**
- ✅ "Free" → **Free** или **Бесплатный**

#### **3.2. Перевести на русский:**
- ❌ "Тип рассылки" → **OK** (оставить)
- ✅ "Фильтры клиентов" → **Тип пользователя:**
- ✅ "Лимит сообщений" → **Лимит на рассылку:**
- ✅ "Обновление фильтра" → **Обновлять список после:**
- ✅ "Макс. время (мин)" → **Максимальное время на рассылку (мин.):**

---

## 📋 ИТОГОВЫЙ ЧЕКЛИСТ:

### **Критично (обязательно):**
- [ ] 1. Radio buttons для "Отправлять только если" (3 варианта)
- [ ] 2. Radio buttons для "Тип пользователя" (4 варианта)
- [ ] 3. Поле "Отправлять конкретным пользователям" (textarea)
- [ ] 4. Поле "Исключать по ID" (textarea)
- [ ] 5. Mail: Картинки - массив, не число
- [ ] 6. Очередь рассылок (правая колонка)
- [ ] 7. Кнопка "Добавить на рассылку →"
- [ ] 8. Кнопка "Начать рассылку!" (для всей очереди)

### **Важно:**
- [ ] 9. Лимит 7 сообщений для Chat
- [ ] 10. Переименовать labels (EN/RU mix)
- [ ] 11. 2-колоночный layout (форма слева, очередь справа)

### **Опционально:**
- [ ] 12. Валидация specificUsers (только числа)
- [ ] 13. Валидация excludeIds (только числа)
- [ ] 14. Счетчик символов для Mail (150-3500)
- [ ] 15. Tooltip'ы для полей

---

## 🎨 ПРИМЕРЫ LABELS (как в оригинале):

```
✅ "Chat" / "Mail" (EN)
✅ "Отправлять только если:" (RU)
✅ "Тип пользователя:" (RU)
✅ "Purchased" (EN) или "Оплаченный" (RU+EN)
✅ "Free" (EN) или "Бесплатный" (RU+EN)
✅ "Лимит на рассылку:" (RU)
✅ "Обновлять список после:" (RU)
✅ "Максимальное время на рассылку (мин.):" (RU)
```

---

## ⚠️ ВАЖНЫЕ МОМЕНТЫ:

1. **Очередь** - главная фича оригинала! Можно добавить несколько рассылок перед запуском
2. **specific_users** - критично для таргетированных рассылок
3. **exclude_ids** - обязательно, иначе нельзя исключить VIP/проблемных
4. **Radio buttons** - важно для UX, чтобы не было конфликтов настроек
5. **Chat/Mail на EN** - админы привыкли к терминам сайта

---

**Ждем подтверждения перед реализацией!**
