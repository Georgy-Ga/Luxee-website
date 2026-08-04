# Activity Center - Новый промпт для первых сообщений

## ✅ Изменения выполнены

Создан специальный промпт для Activity Center, который генерирует **только вопросы** без приветствий и представлений.

---

## 🎯 Цель нового промпта

**Генерировать ОДИН интересный вопрос**, который:
- Зацепит мужчину 35-60 лет
- Заставит его ответить
- Будет уникальным и непов торяющимся
- Подходит для сайта знакомств
- НЕ содержит 18+ контент

---

## 📝 Что изменилось

### 1. Добавлен новый промпт `ACTIVITY_CENTER_PROMPT` в `config.js`

**Ключевые особенности:**

```
❌ NEVER:
- Start with greetings ("Hey", "Hi", "Hello")
- Introduce yourself ("I'm [name]")
- Mention location/age/country
- Ask "How are you?" or "How's your day?"
- Use 18+ topics
- Write statements - ONLY questions

✅ ALWAYS:
- Write ONLY ONE question (no additional text)
- Make it thought-provoking or interesting
- Keep it natural and conversational
- End with question mark
- Vary the topic each time
```

**Длина:** 8-15 слов максимум

**Примеры вопросов:**
- "What's something you're really good at?"
- "If you had a superpower, what would it be?"
- "What's your guilty pleasure TV show?"
- "What makes you smile without fail?"
- "What's one thing on your bucket list?"

---

### 2. Обновлена логика в `promptBuilder.js`

**Автоматическая детекция Activity Center:**

```javascript
const isActivityCenter = !manMessage && !typeInstructions && !formattedHistory;

if (isActivityCenter) {
    // Используем ACTIVITY_CENTER_PROMPT
    messages.push({
        role: 'system',
        content: ACTIVITY_CENTER_PROMPT,
    });
    
    // Простая задача - без profile context
    const userMessage = `Write ONE engaging question to start a conversation with a man named ${manName}. Make it unique, interesting, and thought-provoking.`;
    
    messages.push({
        role: 'user',
        content: userMessage,
    });
    
    return messages;
}
```

---

## 🔄 Сравнение: старый vs новый

### Старый промпт (generic):

**System:** SYSTEM_PROMPT (весь стандартный промпт про ответы на сообщения)

**User:**
```
My profile information:
- Name: Margarita
- Age: 25
- Country: Ukraine
- City: Kyiv

This is a FIRST MESSAGE to start a conversation with a man. 
Write a short, friendly, warm greeting that shows interest (1-2 sentences).
```

**Результат:**
```
"Hey, I'm Margarita. How's your day going?"
"Hi! 😊 I noticed you liked my profile. What caught your attention?"
```

**Проблемы:**
- ❌ Всегда начинается с "Hey" / "Hi"
- ❌ Часто представляется (лишнее)
- ❌ Вопрос "How's your day?" повторяется
- ❌ Передается лишняя информация (возраст, город)

---

### Новый промпт (Activity Center):

**System:** ACTIVITY_CENTER_PROMPT (специализированный промпт для вопросов)

**User:**
```
Write ONE engaging question to start a conversation with a man named Luis. 
Make it unique, interesting, and thought-provoking.
```

**Ожидаемый результат:**
```
"What's the most adventurous thing you've ever done?"
"If you could travel anywhere tomorrow, where would you go?"
"What's something that always makes you laugh?"
"What's your idea of a perfect Sunday?"
```

**Преимущества:**
- ✅ Только вопрос, без приветствия
- ✅ Не представляется
- ✅ Уникальные, разнообразные вопросы
- ✅ Не передается лишняя информация
- ✅ Заточен под целевую аудиторию (35-60 лет)

---

## 📊 Типы вопросов

Промпт генерирует 4 типа вопросов:

### 1. **Playful/Flirty** (Игривые/Флиртующие)
```
"What's the most spontaneous thing you've ever done?"
"What's your idea of a perfect weekend?"
```

### 2. **Curious/Thoughtful** (Любопытные/Задумчивые)
```
"What's something you're passionate about?"
"If you could live anywhere, where would you choose?"
```

### 3. **Light/Fun** (Легкие/Веселые)
```
"Coffee or tea person?"
"What's the last thing that made you laugh?"
"Beach vacation or mountain adventure?"
```

### 4. **Attraction/Chemistry** (Притяжение/Химия)
```
"What do you find most attractive in a woman?"
"What makes you feel most alive?"
```

---

## 🔧 Технические детали

### Файлы изменены:

1. **`backend/src/services/aiService/config.js`**
   - Добавлен `export const ACTIVITY_CENTER_PROMPT`
   - ~80 строк нового промпта

2. **`backend/src/services/aiService/promptBuilder.js`**
   - Импорт `ACTIVITY_CENTER_PROMPT`
   - Детекция Activity Center mode
   - Использование нового промпта
   - Убрана старая дублирующаяся логика

### Как работает детекция:

```javascript
const isActivityCenter = !manMessage && !typeInstructions && !formattedHistory;
```

**Условия для Activity Center:**
- `manMessage` = пустая строка (нет сообщения от мужчины)
- `typeInstructions` = пустая строка (нет инструкций)
- `formattedHistory` = пустая строка (нет истории)

Все три условия = **Activity Center mode** → используем специальный промпт

---

## 🎯 Что передается в AI

**Для Activity Center:**

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {
      "role": "system",
      "content": "I'm a woman on a dating site writing a FIRST MESSAGE...\n\n# MY GOAL\n\nWrite ONE engaging question..."
    },
    {
      "role": "user",
      "content": "Write ONE engaging question to start a conversation with a man named Luis. Make it unique, interesting, and thought-provoking."
    }
  ],
  "temperature": 1.1,
  "max_tokens": 800,
  "top_p": 0.95,
  "frequency_penalty": 0.7,
  "presence_penalty": 0.6
}
```

**Для обычного чата (без изменений):**

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {
      "role": "system",
      "content": "I'm a woman chatting with a man on a dating site...\n\n# MY PRIMARY GOAL\n\nKeep him engaged..."
    },
    {
      "role": "user",
      "content": "My profile information:\n- Name: Margarita\n...\n\nMan's message: \"Hello\"\n\nGenerate a natural response..."
    }
  ]
}
```

---

## ⚙️ Параметры генерации

Используются те же параметры что и раньше:

```javascript
{
  temperature: 1.1,        // Высокая креативность
  max_tokens: 800,         // Достаточно для вопроса
  top_p: 0.95,            // Разнообразие
  frequency_penalty: 0.7,  // Избегаем повторений
  presence_penalty: 0.6    // Новые темы
}
```

**Frequency penalty 0.7** особенно важен - он заставляет AI генерировать **разные** вопросы каждый раз.

---

## 🧪 Как протестировать

1. Запустите backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Включите AI Auto Response для аккаунта

3. Попросите кого-то поставить лайк/подписаться

4. Проверьте логи:
   ```
   [AI DEBUG] ===== BUILDING PROMPT FOR AI =====
     👤 Profile: Margarita
     👨 Man name: Luis
     💬 Man message: 
     🔔 ACTIVITY CENTER MODE DETECTED - using special prompt
     📨 Total messages in array: 2
     📄 Messages structure:
       1. [system] I'm a woman on a dating site writing a FIRST MESSAGE...
       2. [user] Write ONE engaging question to start a conversation...
   
   [AI DEBUG] ===== GENERATING AI RESPONSE =====
   [AI DEBUG] Raw AI response: "What's something that always makes you smile?"
   ```

5. Проверьте что сообщение:
   - ✅ Только вопрос (без приветствия)
   - ✅ Заканчивается на "?"
   - ✅ 8-15 слов
   - ✅ Интересное и уникальное

---

## 📈 Ожидаемые улучшения

### Качество первых сообщений:

**Было:**
```
"Hey, I'm Margarita. How's your day going?"
"Hey, I'm Margarita. How's your day going?"  ← повторяется
"Hi! 😊 I noticed you liked my profile."
```

**Стало:**
```
"What's something you're really passionate about?"
"If you could have any superpower, what would it be?"
"What's your go-to way to unwind after a long day?"
```

### Метрики:

- ✅ **Уникальность:** каждый вопрос разный
- ✅ **Engagement:** вопросы заставляют думать и отвечать
- ✅ **Conversion:** выше шанс получить ответ
- ✅ **Соответствие аудитории:** подходит для 35-60 лет
- ✅ **Чистота:** нет лишнего текста

---

## 🔄 Обратная совместимость

- ✅ Старый промпт **SYSTEM_PROMPT** сохранен без изменений
- ✅ Работает для обычных чатов (ответы на сообщения)
- ✅ Функция `buildActivityCenterPrompt` сохранена (legacy)
- ✅ Все существующие чаты продолжают работать

---

## 📌 Важные моменты

### 1. Не передается информация о профиле

Для Activity Center **не нужна** информация:
- Возраст
- Страна
- Город

Это **фича**, не баг! Вопросы должны быть универсальными.

### 2. Имя мужчины НЕ упоминается в вопросе

Промпт не говорит "use his name". Вопросы универсальные, без обращения по имени.

Это **правильно** - более естественно не упоминать имя в первом сообщении-вопросе.

### 3. Emoji используются редко

Промпт говорит "use sparingly or not at all". Большинство вопросов работают лучше БЕЗ эмодзи.

### 4. Длина строго ограничена

"8-15 words maximum" - короткие, пунчевые вопросы работают лучше.

---

## 🎉 Результат

Activity Center теперь генерирует **профессиональные, интересные вопросы** которые:

1. ✅ Зацепят целевую аудиторию (35-60 лет)
2. ✅ Заставят мужчину ответить
3. ✅ Будут уникальными каждый раз
4. ✅ Подходят для сайта знакомств
5. ✅ Не содержат лишнего текста
6. ✅ Не повторяют банальные фразы

---

**Дата:** 03.08.2026  
**Статус:** ✅ Готово к тестированию  
**Автор:** Kiro AI Assistant
