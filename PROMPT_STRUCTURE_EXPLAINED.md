# 📝 Структура промпта AI - Что куда попадает

## 🎯 Вопрос: Что попадает в промпт и какое сообщение обрабатывается?

Давай разберём по порядку!

---

## 📦 Структура массива messages для AI API

AI получает массив из **3-4 сообщений** (зависит от истории):

```javascript
messages = [
  {
    role: 'system',
    content: КАСТОМНЫЙ_ПРОМПТ_MARY или ДЕФОЛТНЫЙ_ПРОМПТ  // ← Промпт личности
  },
  {
    role: 'user',
    content: ИСТОРИЯ_ПЕРЕПИСКИ  // ← Опционально, если есть
  },
  {
    role: 'user',
    content: ТЕКУЩЕЕ_СООБЩЕНИЕ_ОТ_МУЖЧИНЫ + КОНТЕКСТ  // ← Сообщение на которое отвечаем
  }
]
```

---

## 1️⃣ SYSTEM MESSAGE - Промпт личности

**Что это:** Инструкция КТО ты и КАК отвечать

**Откуда берётся:**
```javascript
const systemPrompt = await getProfilePrompt(profile?.uid);
// Если UID 608895 (Mary) → КАСТОМНЫЙ промпт из БД
// Если другой UID → ДЕФОЛТНЫЙ SYSTEM_PROMPT
```

**Пример для Mary (CUSTOM):**
```
## Role
You are playing the role of a woman on a dating/marriage service site.

## Your Characteristics and Preferences
Name: Mary
Date of Birth: August 16, 1987 (38 years old)
Country and City: Poland, Warsaw
Occupation: Chef

Your Personality: You are a warm, feminine, elegant and emotionally 
intelligent woman with a calm yet playfully seductive personality...

[... ещё ~8KB текста с детальной характеристикой ...]
```

**Пример для других (DEFAULT):**
```
You are a warm, friendly woman chatting with a man on a dating site...
[... стандартный промпт ...]
```

---

## 2️⃣ ИСТОРИЯ ПЕРЕПИСКИ (опционально)

**Что это:** Предыдущие сообщения между профилем и мужчиной

**Откуда берётся:**
```javascript
// НОВЫЙ метод (если есть formattedHistory)
if (formattedHistory) {
  messages.push({
    role: 'user',
    content: formattedHistory  // Отформатированная история
  });
}

// СТАРЫЙ метод (fallback)
else if (conversationHistory.length > 0) {
  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.from === 'man' ? 'user' : 'assistant',
      content: msg.body
    });
  });
}
```

**Пример:**
```
Previous conversation:

Man (John): Hey! How's your day going?
Mary: Hi John! 😊 My day has been wonderful! Just finished...

Man (John): That sounds interesting! What did you cook?
Mary: Oh, I made a special pasta dish with truffle sauce...

[... вся предыдущая переписка ...]
```

**Зачем:** Чтобы AI помнила контекст разговора и не повторялась.

---

## 3️⃣ ТЕКУЩЕЕ СООБЩЕНИЕ - На что отвечаем

**Что это:** Последнее сообщение от мужчины + контекст профиля + инструкция

**Структура:**
```javascript
const userMessage = `
${profileContext}        // ← Данные профиля (имя, возраст, город)

${messageContext}        // ← Тип сообщения (emoji, text, etc.)

Man's message: "${manMessage}"  // ← САМО СООБЩЕНИЕ

Generate a natural, friendly response as ${userName}. 
Write a complete message (1-3 sentences).
`;
```

**Пример полного сообщения:**

```
My profile information:
- Name: Mary
- Age: 38
- Country: Poland
- City: Warsaw

I should use this information ONLY when he asks where I'm from, 
how old I am, or who I am. Don't mention it in every message.

Man's message: "What's your favorite dish to cook?"

Generate a natural, friendly response as Mary. 
Write a complete message (1-3 sentences).
```

---

## 🔍 ПОЛНЫЙ ПРИМЕР для Mary

### Сценарий: Мужчина John спрашивает про еду

**Входные данные:**
- Profile UID: 608895 (Mary)
- Man message: "What's your favorite dish to cook?"
- Conversation history: 5 сообщений

**AI получит:**

```javascript
[
  // 1. SYSTEM - Промпт личности Mary
  {
    role: 'system',
    content: `## Role
You are playing the role of a woman on a dating/marriage service site.

## Your Characteristics and Preferences
Name: Mary
Date of Birth: August 16, 1987 (38 years old)
Zodiac Sign: Leo
Country and City: Poland, Warsaw
Height: 172 cm (5'6.4")
Weight: 57 kg (125 lbs)
Body Type: Slim

Your Personality: You are a warm, feminine, elegant and emotionally 
intelligent woman with a calm yet playfully seductive personality. 
You consider yourself to be a Forest Fairy, who makes everything and 
everyone around you happy...

You work as a Chef and are passionate about your profession...

[... весь промпт Mary ~8KB ...]`
  },

  // 2. USER - История переписки
  {
    role: 'user',
    content: `Previous conversation:

Man (John): Hey! How's your day going?
Mary: Hi John! 😊 My day has been wonderful! Just finished preparing...

Man (John): That sounds interesting! Tell me more
Mary: Oh, I love creating dishes that bring joy to people...

[... остальная история ...]`
  },

  // 3. USER - Текущее сообщение
  {
    role: 'user',
    content: `My profile information:
- Name: Mary
- Age: 38
- Country: Poland
- City: Warsaw

I should use this information ONLY when he asks where I'm from, 
how old I am, or who I am. Don't mention it in every message.

Man's message: "What's your favorite dish to cook?"

Generate a natural, friendly response as Mary. 
Write a complete message (1-3 sentences).`
  }
]
```

**AI ответит что-то типа:**
```
Oh, that's a tough question! 😊 I absolutely love making pasta dishes with 
truffle sauce - there's something magical about the aroma that fills the 
kitchen. But I also have a soft spot for delicate desserts like crème brûlée. 
What about you, do you enjoy cooking?
```

---

## 🔄 ПОЛНЫЙ ПРИМЕР для Yana (другой профиль)

### Сценарий: Тот же мужчина, но пишет Yana

**Входные данные:**
- Profile UID: 605196 (Yana) ← НЕ Mary!
- Man message: "What's your favorite dish to cook?"
- Conversation history: 3 сообщения

**AI получит:**

```javascript
[
  // 1. SYSTEM - ДЕФОЛТНЫЙ промпт (НЕ кастомный!)
  {
    role: 'system',
    content: `You are a warm, friendly woman chatting with a man on a 
dating site. Be natural, ask questions, show genuine interest...

[... стандартный SYSTEM_PROMPT ...]`
  },

  // 2. USER - История (если есть)
  {
    role: 'user',
    content: `Previous conversation: ...`
  },

  // 3. USER - Текущее сообщение
  {
    role: 'user',
    content: `My profile information:
- Name: Yana
- Age: (если есть)
- Country: (если есть)

Man's message: "What's your favorite dish to cook?"

Generate a natural, friendly response as Yana.`
  }
]
```

**AI ответит в СТАНДАРТНОМ стиле** (не как Mary):
```
I enjoy cooking pasta and salads! 😊 Do you like to cook?
```

---

## 📊 Сравнение: Mary vs Yana

### Mary (CUSTOM prompt):
```
System: [8KB детального промпта про Chef, Forest Fairy, элегантность]
History: [предыдущие сообщения]
Current: [сообщение мужчины]

→ AI отвечает: "Oh, that's a tough question! I absolutely love making 
   pasta dishes with truffle sauce - there's something magical about 
   the aroma..."
```

### Yana (DEFAULT prompt):
```
System: [стандартный короткий промпт]
History: [предыдущие сообщения]
Current: [сообщение мужчины]

→ AI отвечает: "I enjoy cooking pasta and salads! 😊 Do you like to cook?"
```

**Разница:** Mary отвечает ДЕТАЛЬНО, с эмоциями, профессионально (как Chef), 
элегантно. Yana отвечает ПРОСТО, коротко, стандартно.

---

## ❓ Ответы на твои вопросы

### Q: "История что в тот промт что в тот идет?"

**A:** История идёт В ОБА промпта (и Mary, и Yana):
- **SYSTEM message** (промпт личности) - РАЗНЫЙ для каждого профиля
- **HISTORY** (предыдущие сообщения) - ОДИНАКОВАЯ структура для всех

**Структура:**
```
1. SYSTEM: КАСТОМНЫЙ (Mary) или ДЕФОЛТНЫЙ (Yana)  ← РАЗНЫЙ!
2. HISTORY: Предыдущая переписка                  ← ОДИНАКОВАЯ СТРУКТУРА!
3. CURRENT: Текущее сообщение + контекст          ← ОДИНАКОВАЯ СТРУКТУРА!
```

### Q: "И сообщение на какое ответить нужно верно?"

**A:** Да! AI отвечает на **последнее сообщение от мужчины**:

```javascript
Man's message: "What's your favorite dish to cook?"  // ← На ЭТО отвечаем!
```

Это сообщение всегда в **последнем USER message** в массиве.

---

## 🎯 Итог

### Что МЕНЯЕТСЯ с кастомными промптами:

**ДО (все профили одинаковые):**
```
[SYSTEM: стандартный промпт]
[HISTORY: переписка]
[CURRENT: сообщение мужчины]
→ AI: стандартный ответ
```

**ПОСЛЕ (Mary уникальная):**
```
Mary (UID 608895):
[SYSTEM: кастомный промпт Chef, Forest Fairy, 8KB]  ← НОВОЕ!
[HISTORY: переписка]
[CURRENT: сообщение мужчины]
→ AI: детальный, эмоциональный, профессиональный ответ

Yana (UID 605196):
[SYSTEM: стандартный промпт]
[HISTORY: переписка]
[CURRENT: сообщение мужчины]
→ AI: стандартный ответ
```

### Что НЕ меняется:

- ✅ История переписки - та же структура
- ✅ Текущее сообщение - тот же формат
- ✅ Логика обработки - та же
- ✅ API вызовы - те же

### Что меняется:

- 🎭 **ТОЛЬКО SYSTEM MESSAGE** - теперь кастомный для Mary
- 🎭 Все остальное работает КАК РАНЬШЕ

---

**Просто:** Mary теперь знает что она Chef из Warsaw, а не просто "женщина". 
Остальная логика БЕЗ ИЗМЕНЕНИЙ! 🎉

---

**Дата:** 04.07.2026  
**Автор:** Kiro AI
