# Catch Up висит + «прочитала, но не ответила» — анализ logs3.txt и кода

Дата анализа: 2026-09-14. Код не менялся, только анализ.

## 0. Короткий вывод

1. **`logs3.txt` вообще не содержит логов Catch Up.** В файле 6634 строки, из них 6616 — `luxee-backend-spambot` (Python-рассылки), 18 — `luxee-frontend` (nginx access). Ни одной строки от Node-бэкенда, где живёт весь AI/Catch Up код (`backend/src/services/aiAuto/*`). Прямой поиск по `catch`, `catch_up`, `catchup`, `unread`, `answer`, `reply` даёт **0 совпадений**. То есть по этому файлу доказать/опровергнуть зависание Catch Up **невозможно** — нужны логи другого контейнера (`docker compose logs backend` / `docker logs luxee-backend`), где пишутся `utils.log('AI Auto'...)`, `[🚦 NAVIGATION]`, `[📊 CATCH UP FILTER]`, `[🔧 PROCESSOR]`.
2. То, что файл **доказывает**: инфраструктура в окне логов жива. Диапазон меток `2026-09-14 11:21:01 → 12:50:47 UTC` (~1,5 часа, ~30–85 строк/мин без провалов), рассылки `start_distribution`/`send_messages`/`_update_distribution_status` идут до последней секунды (`12:50:47 Sent message`), дистрибуции завершаются (`completed. Sent: N, Skipped: M`). Значит «висит» — это не падение compose/сети, а **логика AI-сервиса**.
3. Симптом «зашли в Catch Up, сообщение стало прочитанным, ответа нет, и бейдж висит» **полностью объясняется кодом**: навигация в чат (`page.goto`) происходит **до** генерации/отправки и сама по себе отмечает сообщения прочитанными на luxee.io. Любая неудача после этого (генерация, отправка, blacklist/excluded/schedule) = «прочитала, но не ответила». А дальше неудача **кешируется на 10–16 часов** + действует оптимизация «count не изменился — не заходить», поэтому бот больше туда не возвращается, пока бейдж висит. Плюс мьютекс без TTL и последовательный обход всех чатов (~10–25 c на чат при тике 5 c) дают серию `account_locked` — со стороны это тоже выглядит как «висит».

Ниже — таймлайн, механика, ранжированные причины и варианты исправления.

## 1. Что реально лежит в logs3.txt

- Размер ~1 МБ, 6634 строки. Контейнеры: `luxee-backend-spambot` 6616, `luxee-frontend` 18. Других контейнеров нет.
- Временные рамки по встроенным меткам Python-логера: **11:21:01 → 12:50:47 UTC 14.09.2026** (совпадает с «качал за последние полтора часа», файл записан в 15:52 локального времени).
- Плотность ровная весь период (см. поминутную разбивку при проверке — 24–85 строк/мин, нулевых минут нет). Обрывов/пауз нет.
- Топ источников бизнес-логов: `service.py:163 _update_distribution_status` (599), `luxee_browser.py:703 start_distribution` (572), `:454/:462 send_messages` (542+542), `:758` ожидание между клиентами (524). Это цикл рассылок, не AI-ответы.
- Единственные ошибки в файле (19 шт, пачками с 11:53 до 12:22): `Failed to send mail ... Unable to send / You have exceeded your daily direct activity limit.. Skipping...` — это **лимиты сайта на direct activity для mail-рассылок спамбота**, не фатал: цикл продолжается, следующие клиенты отправляются. Важно как контекст: **у сайта есть дневные лимиты на отправку**, и AI-отправка (`sendResponse`) может упираться в то же самое (тогда в backend-логах будет `send_failed`, а в spambot-логах этого не видно).
- Строки про «AI» (30 шт) — ложные срабатывания: это клиент по имени **Claude (2791843)**, не AI-движок. `pending` (17) — тоже ложные: подстрока в слове `spending` в тексте рассылки `Could you love someone again after spending...`.
- `Skip client ... because chat is not empty` (десятки) и `chat is not empty` для mails — нормальная логика рассылок (не лезть в непустой чат), к Catch Up отношения не имеет.
- Хвост лога (12:49–12:50) здоров: логины, сбор лимитов (`Collected limits for 9/28 profiles`), `Sent message`, `Status updated`, `Waiting N seconds`. Спамбот на момент конца логов **не висел**.

Вывод раздела: по logs3.txt Catch Up не висел и не отвечал просто потому, что **его там нет**. Любые выводы о Catch Up из этого файла — косвенные.

## 2. Как работает Catch Up в коде (факты, не гипотезы)

Файлы: `backend/src/services/aiAuto/index.js` (оркестратор, строки ~530–892), `catchUpScanner.js`, `chatProcessor.js`, `utils.js`, `aiResponseService.js`, `aiAutoResponseService.js` (тикер).

Порядок одного цикла `processAccountMessages(accountId, userId, page)`:

1. Рестарт AI-контекста раз в 2 часа → **мьютекс** `processingLocks` (без TTL; повторный тик → `return { reason: 'account_locked' }`) → проверка **расписания** (`user_schedule_resting` → ранний выход, Catch Up даже не проверяется) → sync кеша профилей.
2. Активный профиль → его чаты → сортировка по `lastActivity` → `processSingleChat` по очереди до первого успеха. Неудача → следующий чат.
3. Другие профили с сообщениями (кроме excluded) → переключение профиля → то же самое.
4. **Catch Up — только если `messageSent == false`**, т.е. резервная ветка:
   - `getCatchUpCount(page)` читает бейдж `#profile-catchup .profiles_new-messages` **без открытия**. Если `count == 0` или `count == lastCount` (кеш `lastCatchUpCounts`, in-memory) → **`⏭️ Skipping Catch Up`, внутрь не заходим вообще**.
   - Иначе `getAllCatchUpChats(page)`: `modelsChat.openCatchUp()` + `sleep(2000)` + сбор `.chats[data-identity]` → `chatId = profileUidOuter_manUid`.
   - Фильтр: `getProfileByUid` (outer→inner через `modelsChat.getProfile`), `isChatProcessed` (кеш `accountId_profileUid_manUid`, TTL **10–16 ч случайных**), `isProfileExcluded`, `isUserBlacklisted(..., 'catchUp')`.
   - `chatProcessor.processSingleChat({..., isCatchUp: true})` по очереди; **успех → кеш 10–16 ч + `page.reload()` + `return catch_up_sent`** (один ответ за цикл); неудача с `reason ∈ {history_extraction_failed, generation_failed, send_failed, exception}` → **тоже кеш 10–16 ч** («чтобы не долбить»); остальные причины (blacklist, excluded, `navigation_failed`, `navigation_timeout`, `already_answered`-нет-для-catchup, `shouldnt_reply`-нет-для-catchup) → **без кеша**, просто `continue`.
   - После цикла: если ничего не отправлено → `page.reload()` «чтобы выйти из Catch Up»; если все было в кеше → тоже `page.reload()`.
5. Activity Center — только если `messageSent == false` и после Catch Up.
6. `finally { processingLocks.delete(accountId) }` — разблокировка.

`processSingleChat` для Catch Up (`isCatchUp: true`):

- `page.goto(chat URL, domcontentloaded, 10s)` → `sleep(3000)` → сверка `activeChatId`. **В этот момент сайт уже показывает сообщения прочитанными.**
- Проверки `unAnswered` **нет** (by design, «пишем в любом случае»).
- История: `getChatHistory(page, 6)`, до 3 попыток. Нет истории + Catch Up → **fallback «первое сообщение»** (пустая история, greeting). Нет истории + обычный чат → `history_extraction_failed`.
- Catch Up + есть история: стандартный промт; если последнее от девушки → дописка `NOTE: The man saw your last message but didn't reply. Re-engage...` (см. также комментарий в `promptBuilder.js:181` про страховку от роста NOTE).
- Задержка «печатания» для Catch Up: **7–13 c случайных** (`sleep`), без адаптивной логики обычных чатов. Повторной проверки `unAnswered` после задержки для Catch Up нет.
- `aiResponseService.generateAndSend`: `generateResponse` → **повторная проверка `canAccountUseAi`** (если AI выключили во время генерации → `success: false, cancelled: true, reason: 'AI disabled during generation'` — сгенерированный текст выкидывается, отправки нет) → `sendResponse`. Любой throw → проброс наверх → в процессоре это `exception`.
- Итог: `sent=true` только если генерация **и** отправка успешны. Иначе `generation_failed` / `send_failed` / `exception` / `navigation_*`.

Тикер: `aiAutoResponseService.js:475` — `setInterval(processMessages, 5000)` на аккаунт. Один чат стоит ~10–25 c (goto 10 + sleep 3 + ретраи истории + задержка 7–13 + генерация), а цикл может обходить десятки чатов. Значит при активной переписке **каждый второй-третий тик упирается в `account_locked`** — это штатно, но в UI/статусах выглядит как «завис».

## 3. Почему «прочитала, но не ответила» — разбор по коду

Ключевой факт: **чтение происходит раньше ответа и независимо от него.** `page.goto` на URL чата открывает чат в браузере бота → luxee.io шлёт read-receipt собеседнику. Дальше любая из веток ниже даёт ровно наблюдаемое:

- `generation_failed` (упал LLM: таймаут/429/5xx, плохой ключ, обрыв контекста) — сообщение уже прочитано, ответа нет;
- `AI disabled during generation` (`canAccountUseAi == false`: AI выключили в админке/лимиты/флаг аккаунта между началом генерации и отправкой) — текст сгенерирован, но **намеренно не отправлен** (`aiResponseService.js:409–423`);
- `send_failed` (селектор отправки не найден, чат заблокирован сайтом, дневной лимит direct activity как в спамботе, гонка с перезагрузкой);
- `navigation_failed` / `navigation_timeout` (открыли не тот чат / не дождались DOM) — чат могли успеть открыть (прочитано), а `activeChatId` не совпал;
- `history_extraction_failed` для обычного чата; для Catch Up вместо этого — fallback-greeting (ответ «в пустоту», который тоже может не отправиться);
- ранние выходы **до** Catch Up, при которых бот «заходил» глазами оператора, но код туда не ходил: `user_schedule_resting` (расписание), `account_locked`, `no_active_profile`, `active_profile excluded`, успех на активном/другом профиле (`return` до Catch Up);
- скипы **внутри** Catch Up без отправки: `isProfileExcluded`, `isUserBlacklisted('catchUp')`, `Profile not found` (outer→inner не смаппился — чат пропускается молча, но overlay уже открыт и чат уже «потрогали»).

Отдельно: для Catch Up сознательно снята проверка `unAnswered` и добавлен re-engage NOTE, когда последнее сообщение от девушки. То есть бот **намеренно пишет вторым подряд**. Если сайт/лимит такое режет — снова «прочитала, ответа нет».

## 4. Почему «висит» (бейдж не уходит, повторных заходов нет)

Ранжировано по вероятности для описанного кейса:

1. **(Наиболее вероятно) Неудача закэширована на 10–16 ч.** `index.js:839–855`: `history_extraction_failed / generation_failed / send_failed / exception` → `markChatAsProcessed` (случайные 10–16 ч). Следующие циклы видят чат в `catchUpProcessedCache` → `⏭️ Skip (in cache)`. Снаружи: один раз «зашла, прочитала, не ответила» — и тишина полдня. Это же объясняет «мы туда зашли, но ответа не было почему-то»: заход был, отправка упала, чат ушёл в кеш неудач.
2. **Гейт «count не изменился — не заходить».** `index.js:548–569`: `lastCatchUpCounts` (in-memory). Если бейдж показывает то же число (а после прочтения без ответа число часто то же самое или ±1), бот пишет `Skipping Catch Up: count unchanged` и **даже не открывает overlay**. Оператор видит висящий бейдж, бот его игнорирует по дизайну. После рестарта Node-процесса кеш сбрасывается — поведение «само чинится рестартом», что тоже характерно для таких жалоб.
3. **Мьютекс + длинный последовательный цикл.** Тик 5 c против ~10–25 c на чат и обхода всех профилей и всего Catch Up в одном цикле. Пока один цикл идёт, все остальные возвращают `account_locked`. Если Catch Up-цикл идёт минуты (много `unprocessedChats`), снаружи это «висит». У мьютекса нет TTL и нет очереди — overlapping-тики просто дропаются.
4. **`page.reload()` без try/catch.** Строки ~869–876 и ~883–887: `await page.reload({waitUntil: domcontentloaded, timeout: 10000})` вне try. Если reload упадёт (таймаут/закрытый контекст), исключение улетит в общий catch (`reason: 'exception'`), цикл оборвётся, а браузер **останется внутри Catch Up overlay**. Следующий цикл начнёт сканирование профилей из неверного UI-состояния → каскад `navigation_failed`/`Profile not found`. Плюс `getCatchUpCount` при отсутствии `#profile-catchup` возвращает 0 → следующие циклы скипают Catch Up как «пустой».
5. **Blacklist/excluded без кеша и без раннего выхода.** Такие чаты `continue` в цикле; если их много, цикл долго крутится вхолостую, держа лок; финальный `reload` только в конце. При обрыве до конца — overlay остаётся открытым («висит в catch up»).
6. **Расписание/флаги.** `user_schedule_resting` и `canAccountUseAi == false` тихо отменяют всю работу, включая Catch Up. Если оператор смотрит в момент «отдыха» или выключенного AI — бейдж висит, заходов нет, и это не баг, а конфиг.
7. **Рестарт AI-контекста каждые 2 часа** (`index.js:32–67`): меняет `page` на новую из перезапущенного контекста. Если рестарт случился между `openCatchUp` и `processSingleChat`, последующие `page.goto/evaluate` идут уже в другом контексте/URL — возможны `navigation_failed` + «прочитала, но не ответила».

Что **не** подтверждается logs3.txt и требует backend-логов: какой именно `reason` был (`generation_failed` vs `send_failed` vs `blacklisted` vs `locked` vs `resting`), какой `chatId/manName/profile`, был ли `Reloading page to exit Catch Up`, рос ли `processingLocks`.

## 5. Как подтвердить за 10 минут (ничего не меняя)

Нужны логи **Node-бэкенда**, не спамбота. В логах искать маркеры из кода:

```bash
# 1. Найти нужный контейнер/сервис (имя отличается от spambot!)
docker ps --format '{{.Names}} / {{.Image}} / {{.Status}}'
docker compose ps

# 2. Логи бэкенда за те же 1.5 часа (время в UTC!):
docker compose logs backend --since 90m 2>&1 | grep -Ei 'AI Auto|CATCH UP|NAVIGATION|PROCESSOR|Catch Up' | tail -n 200

# 3. Конкретный цикл Catch Up:
docker compose logs backend --since 90m 2>&1 | grep -E 'Catch Up count|ENTERING CATCH UP|CATCH UP FILTER|PROCESSING CATCH UP|processSingleChat|Message sent|account_locked|user_schedule_resting|blacklisted|profile excluded|Reloading page to exit' | tail -n 200

# 4. Причины неудач:
docker compose logs backend --since 90m 2>&1 | grep -E 'generation_failed|send_failed|history_extraction_failed|navigation_failed|navigation_timeout|already_answered|shouldnt_reply|AI disabled during|no_messages_to_send|catch_up_sent|activity_center' | tail -n 100
```

Таблица «маркер → смысл»:

| Маркер в backend-логе | Что означает |
|---|---|
| `Account ... is LOCKED ... - skipping cycle` | тики дропаются мьютексом, цикл ещё идёт (подтверждает п.3) |
| `в режиме ОТДЫХА` / `user_schedule_resting` | расписание запрещает работу, Catch Up не проверяется (п.6) |
| `Catch Up count: N / Last count: M` + `SKIPPING CATCH UP` | гейт count-unchanged (п.2) |
| `OPENING CATCH UP` → `EXTRACTION COMPLETE: N` → `FILTER RESULTS` | заход был; смотреть `Ready to process` vs `In cache (skipped)` |
| `Chat in CACHE (skipping)` / `Cached failed chat: ... (reason: ...)` | п.1, там же и точный reason |
| `Processing Catch Up: <Man> (profile: ...)` → `Chat NOT sent, reason: X` | точное место «прочитала, но не ответила» |
| `AI disabled during generation` | генерация выкинута проверкой флага (п.3) |
| `Reloading page to exit Catch Up` есть/нет | дошёл ли цикл до выхода из overlay (п.4) |
| `Finished cycle - no messages sent` vs `catch_up_sent` | итог цикла |

Дополнительно сверить с админкой/БД на тот момент: был ли включён AI у пользователя/аккаунта, расписание work/rest, blacklist (`catchUp` категория) для `manUid`, excluded-профили, кастомный промпт профиля (его отсутствие раньше давало дефолтный SYSTEM — см. комментарий в `chatProcessor.js:389–391`, уже пофикшено, но стоит проверить).

## 6. Варианты исправления (без применения, на выбор)

Порядок от дешёвого к дорогому. Код не трогал по просьбе.

- **A. Разделить кеш успеха и кеш неудачи (рекомендуется первым).** Сейчас обе ветки (`index.js:779` и `:846`) зовут один `markChatAsProcessed` на 10–16 ч. Неудачу (`generation_failed/send_failed/exception/history_extraction_failed`) кешировать отдельно и коротко (например 15–30 мин) + максимум N ретраев, после — длинный кеш. Убирает «один silent fail → тишина полдня». Риск: чаще дёргать упавший чат; лечится бэкоффом.
- **B. Не кешировать «прочитано, но не отправлено» как обработанное без пометки.** Либо вообще не кешировать неудачу (оставить только успех), либо писать причину в кеш и показывать её в админке/статусе (`lastCatchUpError: {chatId, reason, at}`), чтобы «висит» превращалось в диагностируемое состояние.
- **C. Починить гейт `count unchanged`.** Варианты: хранить не только число, но и множество `chatId`/хеш списка; заходить, если прошло > X минут с последней проверки независимо от count; не скипать, если предыдущий цикл закончился неудачей. Сейчас любое совпадение числа = пропуск, включая кейс «одно прочитали, одно новое пришло».
- **D. Мьютекс с TTL +Telemetry.** Добавить `timeout` (например 5–8 мин): если `elapsed > TTL` — считать лок протухшим, логировать `stale lock released` и продолжать; плюс счётчик `account_locked` в метрики/логи. Убирает вечное «висит» при зависшем `page.*`. Параллельно уменьшить стоимость цикла: обрабатывать max N Catch Up чатов за цикл, early-exit уже есть (один успех → return).
- **E. Обернуть финальные `page.reload()` в try/catch + проверка выхода.** Оба `reload` после Catch Up (строки ~869–887) — в try, при неудаче `page.goto('https://luxee.io/chats/')` как fallback + лог `exit_catchup_failed`. Плюс в начало цикла — инвариант «если мы в overlay, выйти»: сейчас следующий цикл молча стартует из неверного UI.
- **F. Убрать read-before-write.** Перед `page.goto` делать дешёвые проверки, не требующие открытия чата (blacklist/excluded/schedule/lock уже есть частично — проверить порядок), а историю извлекать по возможности без навигации (через API/кеш `modelsChat.getChats.list[chatId]`, как это уже делает `getLastMessage`). Тогда «прочитала» будет означать «собираемся ответить», а не «открыли посмотреть».
- **G. Логирование причин в статус, а не только в stdout.** Писать итог цикла (`no_messages_to_send` + детали: сколько скипнуто по каждой причине) в БД/админку. Сейчас для диагностики нужен grep по stdout контейнера, которого в собранных логах вообще не было — процессно стоит добавить `docker compose logs backend` в регламент сбора.
- **H. Регламент сбора логов.** `logs3.txt` собирался, видимо, как `docker compose logs luxee-backend-spambot` (+frontend). Для жалоб на Catch Up/ответы нужен `backend` (Node). Иначе каждый разбор будет упираться в «логов нужного сервиса нет».

## 8. Добавленное логирование (2026-09-14)

Ответ на «логов Catch Up нет»: теперь есть структурированный in-memory лог всего AI-цикла.

- Модуль: `backend/src/services/aiAuto/cycleLogger.js` — кольцевой буфер (5000 глобально / 500 на аккаунт, переживает тики, НЕ переживает рестарт бэкенда), в docker stdout ничего не дублирует.
- Инструментировано: `aiAuto/index.js` (lock, schedule, итоги, весь Catch Up: `count_check` каждый цикл, `entering`, `extracted`, `chat_filtered` с decision `ready|cached|blacklisted|excluded|profile_not_found`, `chat_result` с `sent/reason/cached`, `exit` с mode, `empty`; Activity Center), `chatProcessor.js` (`nav_failed`, `history_failed`, `skipped`, `generation_failed` incl. `ai_disabled_during_generation`, `send_failed`, `sent` с превью текста), `catchUpScanner.js` (`open_failed`), `aiAutoResponseService.js` (precheck: `globally_disabled`, `ai_disabled`, `no_ai_context`).
- API (требует auth, как остальные):
  - `GET /ai/auto-response/accounts/:accountId/cycle-log?stage=catchup&event=chat_result&limit=200` — события в хронологическом порядке.
  - `GET /ai/auto-response/accounts/:accountId/cycle-diagnostics` — `isRunning`, `lock {isLocked, elapsedSec}`, `lastCatchUpCount`, `catchUpCache {total, active, expired}`, `summary {lastCatchUp, lastSent, lastFail, lastSkip, byStage}`.
- Типовой разбор «прочитала, но не ответила»: `cycle-log?stage=chat` → строка `send_failed/generation_failed` с `chatId/manName/isCatchUp`, затем `cycle-diagnostics` → `lastFail.reason`. Типовой разбор «висит»: `summary.lastCatchUp.skipReason` (`count unchanged` / `count is 0`) + `lock.isLocked`.

## 7. Что ответить на «почему висит прямо сейчас» одной фразой

По имеющимся данным точную строку-причину назвать нельзя (нужного контейнера в файле нет), но механика, дающая ровно этот симптом, в коде есть и она детерминирована: **бот открыл чат (отсюда read-receipt), не смог сгенерировать/отправить ответ, закэшировал чат как «обработанный» на 10–16 часов, а следующие циклы пропускают Catch Up по «count не изменился» или дропаются мьютексом — снаружи это выглядит как зависший Catch Up без ответа.** Первый шаг — взять backend-логи командами из раздела 5 и найти строку `Chat NOT sent, reason: ...` / `Cached failed chat` для этого чата; дальше фиксить по пунктам A–C.
