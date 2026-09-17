# Catch Up логи — инструкция пользования

## Что это

Структурированный лог AI-цикла в памяти бэкенда: видно каждый тик (5 сек),
каждый заход в Catch Up, решение по каждому чату и точную причину
«прочитала, но не ответила». Время везде **киевское** (`Europe/Kyiv`,
с учётом летнего/зимнего).

Что покрыто: `precheck` (глобальный выключатель, выключенный AI, нет контекста),
`lock`, `schedule` (режим отдыха), итоги цикла, весь Catch Up
(`count_check`, `entering`, `extracted`, `chat_filtered`, `chat_result`,
`exit`, `empty`, `open_failed`), каждый чат (`nav_failed`, `history_failed`,
`skipped`, `generation_failed`, `send_failed`, `sent` с превью текста),
Activity Center.

## Быстрый старт

Бэкенд слушает на `5001` наружу (внутри compose — `5000`), все пути с префиксом `/api`.
Нужен JWT из логина (подходит обычный пользовательский токен).

```bash
BASE=http://148.251.233.7:5001
TOKEN=ваш_jwt

# 1. Диагностика одним взглядом: лок, счётчик Catch Up, кеш, последнее sent/fail
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/ai/auto-response/accounts/<ACCOUNT_ID>/cycle-diagnostics" | python3 -m json.tool

# 2. Лента событий аккаунта (последние 200)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/ai/auto-response/accounts/<ACCOUNT_ID>/cycle-log?limit=200"

# 3. Только Catch Up
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/ai/auto-response/accounts/<ACCOUNT_ID>/cycle-log?stage=catchup&limit=200"

# 4. Только результаты по чатам Catch Up (кто отвечен, кто нет и почему)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/ai/auto-response/accounts/<ACCOUNT_ID>/cycle-log?stage=catchup&event=chat_result&limit=200"

# 5. Только чаты (включая обычные): навигация/генерация/отправка
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/ai/auto-response/accounts/<ACCOUNT_ID>/cycle-log?stage=chat&limit=200"
```

`ACCOUNT_ID` — Mongo `_id` Luxee-аккаунта (видно в админке / ответах `/luxee/accounts`).

## Разбор типовых жалоб

### «Catch Up висит, бейдж не уходит»

1. `cycle-diagnostics` → поле `summary.lastCatchUp`:
   - `shouldCheck: false, skipReason: "count unchanged (N) - same cached chats"` —
     бот сознательно не заходит: число на бейдже не менялось. Если при этом
     внутри лежат новые сообщения — это кейс для фикса гейта (см. ANALYSIS).
   - `shouldCheck: false, skipReason: "count is 0 (empty)"` — бот считает
     Catch Up пустым (бейдж не найден в DOM — возможно, зависший overlay).
2. `summary.byStage` — если растёт только `lock` (`locked_skip`), цикл ещё
   выполняется: смотри `lock: { isLocked: true, elapsedSec }`. Норма — десятки
   секунд; сотни секунд — зависший `page.*`, нужен рестарт AI-контекста.
3. `summary.lastSkip.reason: "user_schedule_resting"` — аккаунт в режиме отдыха
   по расписанию, это не баг.

### «Прочитала, но не ответила»

1. `cycle-log?stage=chat&limit=200` — найти событие по `manName`, смотреть `reason`:
   - `generation_failed` / `ai_disabled_during_generation` — упал LLM или AI
     выключили прямо во время генерации;
   - `send_failed` — текст готов, но сайт не принял отправку (селектор, лимит,
     блок);
   - `already_answered` / `shouldnt_reply` — чат уже отвечен, скип штатный;
   - `navigation_failed` / `navigation_timeout` — не открылся нужный чат.
2. Вслед за ним в `stage=catchup,event=chat_result` будет та же причина
   + `cached: true/false`. `cached: true` = чат молчит 10–16 часов —
   вот почему «зашла один раз и тишина».

### «Бот вообще ничего не делает»

1. `cycle-diagnostics` → `isRunning: false` — тикер не запущен для аккаунта.
2. `cycle-log?stage=precheck` → `globally_disabled` / `ai_disabled` / `no_ai_context`.
3. Пустой `cycle-log` (total: 0) при `isRunning: true` — процесс завис до
   оркестратора, смотреть `docker compose logs backend`.

## Время

- API (`ts`) и `utils.log` в stdout: **Киев** (`2026-09-14T16:21:33.212+03:00`,
  зимой `+02:00`). Пересчёт автоматический, от TZ сервера не зависит.
- Сырые `console.log` отладки и `docker compose logs` БЕЗ флага: меток времени
  от приложения нет / время демона (обычно UTC). Для сопоставления:
  `docker compose logs -t backend` и прибавляйте +3 часа летом (+2 зимой).
- Спамбот (`luxee-backend-spambot`, Python) — свой формат времени, к этому логу
  не относится.

## Ограничения (честно)

- Буфер в памяти: **500 событий на аккаунт / 5000 всего**. При тике 5 сек
  «пустых» `count_check` хватает примерно на 2–3 часа на аккаунт; важные
  события (`sent`, `failed`) ищите фильтрами по `stage`/`event`, а не скроллом.
- **Рестарт бэкенда стирает лог.** Для истории за дни нужен следующий шаг —
  запись в Mongo (модель + тот же API).
- Сырые отладочные `console.log` (`[🚦 NAVIGATION]` и т.п.) остались без меток
  времени — источником правды считайте API выше, а не grep по stdout.

## Файлы

- `backend/src/services/aiAuto/cycleLogger.js` — буфер, фильтры, сводка.
- `backend/src/services/aiAuto/utils.js` — `getTimestamp()` / `getKyivISO()` (Киев).
- Инструментированы: `aiAuto/index.js`, `aiAuto/chatProcessor.js`,
  `aiAuto/catchUpScanner.js`, `aiAutoResponseService.js`.
- API: `aiAutoResponseController.getCycleLog/getCycleDiagnostics`,
  роуты в `src/routes/index.js`.
