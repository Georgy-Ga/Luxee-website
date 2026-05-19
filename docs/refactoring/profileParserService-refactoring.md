# Рефакторинг profileParserService.js

## Текущее состояние
- **Файл:** `backend/src/services/luxeeApi/profileParserService.js`
- **Размер:** 508 строк
- **Проблема:** Один большой файл со множеством методов

## Анализ структуры (из прочитанного кода)

### Методы в файле:
1. `getActiveProfile` - получить активный профиль
2. `getProfiles` - получить все профили
3. `getProfilesWithUnread` - профили с непрочитанными
4. `getProfileUnansweredCount` - количество неотвеченных чатов
5. `getProfileChatsWithUnanswered` - чаты с неотвеченными сообщениями
6. И другие методы для работы с профилями и чатами

## План разбиения

### Новая структура:
```
backend/src/services/luxeeApi/profileParserService/
├── index.js                 (~30 строк) - главный экспорт
├── profileExtractor.js      (~150 строк) - методы получения профилей
├── chatExtractor.js         (~150 строк) - методы работы с чатами  
├── profileHelpers.js        (~100 строк) - вспомогательные функции для профилей
└── chatHelpers.js           (~80 строк) - вспомогательные функции для чатов
```

### Распределение методов:

**profileExtractor.js:**
- getActiveProfile
- getProfiles
- getProfilesWithUnread

**chatExtractor.js:**
- getProfileUnansweredCount
- getProfileChatsWithUnanswered
- другие методы работы с чатами

**profileHelpers.js:**
- функции парсинга данных профиля
- функции форматирования

**chatHelpers.js:**
- функции парсинга чатов
- функции подсчета

**index.js:**
- импорт всех модулей
- экспорт единого объекта (для обратной совместимости)

## Шаги выполнения

1. ✅ Создать папку `profileParserService/`
2. ✅ Создать `index.js` с экспортами
3. ✅ Создать `profileExtractor.js` и перенести методы профилей
4. ✅ Создать `chatExtractor.js` и перенести методы чатов
5. ✅ Создать helper файлы
6. ✅ Удалить старый файл
7. ✅ Обновить импорты в зависимых файлах
8. ✅ Тестирование
9. ✅ Обновить документацию

## Зависимые файлы (нужно обновить импорты)

Поиск использования: `import.*profileParserService`

## Статус
🔄 В процессе
