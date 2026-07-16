# 🔍 Детальные логи для отладки рассылок

## Что сделано

Добавлены **детальные логи** во все критические точки процесса запуска рассылок:

### 1️⃣ Backend Node.js (`backend/src/controllers/distributionController.js`)

```
[DistributionController] 🚀 START request: { userId, distributionId }
[DistributionController] ❌ Distribution not found: ...
[DistributionController] ❌ Invalid status: ...
[DistributionController] 🍪 Context found: true/false
[DistributionController] ❌ No context for account: ...
[DistributionController] 📤 Sending to spambot: { distributionId, account, profilesCount }
[DistributionController] ✅ Spambot response: { ... }
```

### 2️⃣ Spambot API (`backend-spambot/src/api/distribution.py`)

```
[Distribution API] 🚀 START request received
[Distribution API] Distribution ID: ...
[Distribution API] Account ID: ...
[Distribution API] Profile: ...
[Distribution API] Messages: ...
[Distribution API] Mail: ...
[Distribution API] Result: { ... }
```

### 3️⃣ Distribution Manager (`backend-spambot/src/services/distribution_manager.py`)

```
[DistributionManager] 🚀 START DISTRIBUTION
[DistributionManager]   Distribution ID: ...
[DistributionManager]   Account ID: ...
[DistributionManager]   Username: ...
[DistributionManager]   Profile: ... (UID: ...)
[DistributionManager]   Messages: ...
[DistributionManager]   Mail: ...
[DistributionManager] ⚙️ Creating thread for distribution
[DistributionManager] ✅ Thread started: ...
[DistributionManager] Active distributions: ...
```

## Как тестировать

### Шаг 1: Пересобрать контейнеры

```bash
docker-compose down
docker-compose build
docker-compose up
```

### Шаг 2: Открыть логи

```bash
docker-compose logs -f
```

### Шаг 3: Создать и запустить рассылку

1. **Добавить в очередь** (кнопка "Добавить в очередь →")
2. **Запустить рассылку** (кнопка "🚀 Начать рассылку (N)")
3. **Наблюдать логи**

## Что должно появиться в логах

### ✅ Правильный флоу:

```
luxee-backend | [DistributionController] 🚀 START request: { userId: '...', distributionId: '...' }
luxee-backend | [DistributionController] 🍪 Context found: true
luxee-backend | [DistributionController] 📤 Sending to spambot: { distributionId: '...', account: '...', profilesCount: 3 }
luxee-spambot | [Distribution API] 🚀 START request received
luxee-spambot | [Distribution API] Distribution ID: ...
luxee-spambot | [Distribution API] Account ID: ...
luxee-spambot | [Distribution API] Profile: Margarita
luxee-spambot | [Distribution API] Messages: 1
luxee-spambot | [DistributionManager] 🚀 START DISTRIBUTION
luxee-spambot | [DistributionManager]   Distribution ID: ...
luxee-spambot | [DistributionManager]   Username: Translator.04@gmail.com
luxee-spambot | [DistributionManager]   Profile: Margarita (UID: 608434)
luxee-spambot | [DistributionManager] ⚙️ Creating thread for distribution
luxee-spambot | [DistributionManager] ✅ Thread started: Thread-X
luxee-spambot | [DistributionManager] Active distributions: 1
luxee-backend | [DistributionController] ✅ Spambot response: { success: true, distribution_id: '...', message: 'Distribution started' }
```

### ❌ Если НЕТ вызова `/start`:

Значит проблема на фронте - кнопка "🚀 Начать рассылку" не вызывает API. Проверить:
- Очередь не пустая (должно быть "🚀 Начать рассылку (1)" а не "(0)")
- Hard refresh браузера (Ctrl+F5)
- Проверить Console в DevTools

### ❌ Если есть вызов, но ошибка:

Смотрим на конкретное место ошибки в логах и исправляем.

## Возможные проблемы

### 1. Кнопка disabled (0 в очереди)

**Причина:** Не нажата кнопка "Добавить в очередь →"

**Решение:** 
1. Заполнить форму
2. Нажать "Добавить в очередь →"
3. Проверить что счётчик изменился на (1)
4. Теперь нажать "🚀 Начать рассылку (1)"

### 2. Context not found

**Причина:** Luxee аккаунт не залогинен через старую систему

**Решение:** Сначала залогиниться через вкладку Luxee

### 3. Account is busy

**Причина:** Уже есть активная рассылка

**Решение:** Дождаться завершения или остановить текущую

## Следующие шаги

После тестирования с логами мы точно увидим:
- ✅ Вызывается ли `/start`
- ✅ Доходит ли запрос до spambot
- ✅ Создаётся ли поток
- ✅ Где именно падает, если падает

Это позволит быстро локализовать и исправить проблему.

---

**Создано:** 2026-07-16
**Автор:** Kiro AI Assistant
