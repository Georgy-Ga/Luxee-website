# CatchUp: кнопка Skip — идея на будущее (НЕ реализовано)

Дата заметки: 2026-10-03. Источник: ручной разбор CatchUp через F12.

## Что найдено

Элементы списка CatchUp (`#chats-main-wrap .chats[data-identity]`) бывают двух видов:

1. **Живой чат** (пример: Alma Hawker `1333496_2609591`):
   - бейдж `span.profiles_new-messages.active` с числом (напр. `1`);
   - превью `div.chat-short-message` с текстом (напр. `Yes`).
2. **Пустая задача** (пример: Eduardo `2305786_2544973`):
   - бейдж пуст, превью пустое;
   - есть кнопка `<small class="profiles_task-skip" data-sid="...">Skip</small>` — сайт позволяет снять задачу с CatchUp вручную.

## Идея (когда-нибудь)

Для чатов, которые бот не может разрешить (владелец не найден после всех
переключений, пустой тред без автора), вместо вечного `retry in 5 min`
кликать `profiles_task-skip` и снимать задачу с CatchUp. Это меняет состояние
сайта — поэтому только по явному решению, с логом и лимитом.

## Связанный контекст

- `backend/src/services/aiAuto/catchUpScanner.js` — извлечение чатов CatchUp;
- `markRetryLater` / `shouldRetryNow` — текущий механизм отложенного retry;
- Кейс Eduardo (2026-10-03): `profileUidOuter` ошибочно резолвился в UID
  мужчины при пустом `members` — исправлено приоритетом
  members → data-member-uid → позиция (см. код).
