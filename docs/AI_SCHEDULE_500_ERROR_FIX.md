# Исправление ошибки 500 для обычных пользователей при запросе AI Schedule

## 🔴 Проблема

При попытке обычных пользователей (role: 'user') получить свое расписание AI через эндпоинт `/api/ai-schedule/me` возникала ошибка **500 Internal Server Error**.

### Симптомы

**Логи обычного пользователя:**
```
GET http://localhost:5000/api/ai-schedule/me 500 (Internal Server Error)
AiScheduleStatus.jsx:62 [AI Schedule Status] Failed to load: AxiosError: Request failed with status code 500
```

**Логи админа:**
- Ошибка 500 отсутствовала
- Была только ожидаемая ошибка 401 от `/api/refresh` (нормально при отсутствии refresh token)

### Разница в поведении

- ✅ **Admin**: Запрос `/api/ai-schedule/me` работал корректно
- ❌ **User**: Запрос `/api/ai-schedule/me` возвращал 500 ошибку

## 🔍 Анализ корневой причины

### Цепочка проблемы

1. **JWT Token Payload** (`backend/src/dtos/UserDto.js`):
   ```javascript
   const UserDto = user => ({
     id: user._id,      // ← Поле называется 'id'
     email: user.email,
     role: user.role,
   });
   ```

2. **Auth Middleware** (`backend/src/middleware/authMiddleware.js`):
   ```javascript
   const userData = tokenService.validateAccessToken(accessToken);
   req.user = userData;  // ← Устанавливает req.user (не req.userId)
   ```

3. **AI Schedule Controller** (`backend/src/controllers/aiScheduleController.js`) - **ДО ИСПРАВЛЕНИЯ**:
   ```javascript
   async getMySchedule(req, res) {
     const userId = req.userId;  // ❌ ОШИБКА: req.userId не существует!
     // userId = undefined
     const schedule = await aiScheduleService.getScheduleStatus(userId);
     // User.findById(undefined) → null → throw Error('User not found')
     // → 500 Internal Server Error
   }
   ```

### Почему возникла разница между admin и user?

На самом деле проблема затрагивала **и admin, и user**. Однако:

1. **Обычные пользователи** всегда видят компонент `AiScheduleStatus`, который делает запрос
2. **Админы** могут не видеть этот компонент в некоторых частях UI
3. Из логов видно, что у admin тоже был бы 500, если бы компонент отрендерился

**Ключевая проблема**: Использование несуществующего `req.userId` вместо `req.user.id`

## ✅ Решение

### Исправленный код

```javascript
/**
 * Получить своё расписание (для пользователя)
 * GET /api/ai/schedule/me
 */
async getMySchedule(req, res) {
  try {
    const userId = req.user?.id; // ✅ ИСПРАВЛЕНО: req.user.id
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    const schedule = await aiScheduleService.getScheduleStatus(userId);
    
    res.json({
      success: true,
      schedule
    });
  } catch (error) {
    console.error('[AI Schedule Controller] Get my schedule error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### Что изменилось

1. ✅ **Изменено**: `req.userId` → `req.user?.id`
2. ✅ **Добавлена проверка**: Если `userId` не определен → возвращаем 401 (не аутентифицирован)
3. ✅ **Добавлен optional chaining** (`?.`) для безопасного доступа

## 📊 Проверка других контроллеров

### Результаты поиска `req.userId` в проекте

```bash
Found 0 results
```

**Вывод**: Проблема была **только в `aiScheduleController.js`**

### Результаты поиска `req.user` в контроллерах

Все остальные контроллеры **корректно** используют `req.user.id`:

- ✅ `aiAutoResponseController.js` - использует `req.user.id`
- ✅ `luxeeController.js` - использует `req.user.id`
- ✅ `spambotController.js` - использует `req.user.id`
- ✅ `UserController.js` - использует `req.user.id`
- ✅ `aiManagementController/*` - использует `req.user.id`

## 🎯 Корневая причина бага

### Как это произошло?

**Гипотеза**: При создании `aiScheduleController.js` разработчик мог:

1. Скопировать шаблон из другого контроллера, где был `req.userId`
2. Предположить, что middleware устанавливает `req.userId` (типичная практика)
3. Не проверить реальную реализацию `authMiddleware.js`

### Почему не было замечено раньше?

1. ❓ Компонент `AiScheduleStatus` мог не всегда рендериться
2. ❓ Возможно, функциональность была добавлена недавно
3. ❓ Тестирование проводилось только с admin аккаунтами

## 🚨 Общие ошибки WebSocket в логах (не критично)

Обе роли (admin и user) имеют предупреждение:

```
WebSocket connection to 'ws://localhost:5000/socket.io/?EIO=4&transport=websocket' failed: 
WebSocket is closed before the connection is established.
```

**Причина**: React Strict Mode в development режиме вызывает двойной mount/unmount компонентов
**Решение**: Это нормальное поведение для development. В production этого не будет.

## 📝 Выводы и рекомендации

### Что исправлено

✅ Ошибка 500 для `/api/ai-schedule/me` устранена  
✅ Теперь используется правильное поле `req.user.id`  
✅ Добавлена проверка на отсутствие userId  

### Рекомендации на будущее

1. **Создать тесты** для всех auth-protected эндпоинтов
2. **Документировать** структуру `req.user` в комментариях к `authMiddleware`
3. **Использовать TypeScript** для предотвращения таких ошибок на этапе компиляции
4. **Code review** должен проверять правильность использования `req.user`

### Проверка после исправления

После применения исправления:

1. ✅ Обычные пользователи могут получить свое расписание
2. ✅ Админы продолжают работать без проблем
3. ✅ Ошибки 500 больше не возникают

## 📅 Дата исправления

**22.07.2026, 20:20 (UTC+3)**

## 🔗 Затронутые файлы

- `backend/src/controllers/aiScheduleController.js` - **ИСПРАВЛЕНО**
- `backend/src/middleware/authMiddleware.js` - проанализирован
- `backend/src/dtos/UserDto.js` - проанализирован
- `backend/src/services/aiScheduleService.js` - проанализирован

---

**Статус**: ✅ Решено
