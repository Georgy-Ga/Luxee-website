# 💡 Идея на будущее: авторитетные лимиты анкет через «второй контекст» браузера

> Это **план на потом** — сейчас НЕ реализуется. Здесь описана идея и текущее состояние правок.

## Зачем

Для получения настоящих (серверных) лимитов `available-profiles` с luxee.io сейчас мы каждый раз делаем свой Selenium-логин, что дорого:
- ~10–60 сек на цикл (запуск браузера + логин + запрос + logout);
- риск троттлина/блокировки luxee при частых вызовах.

Авторитетнее показывать **серверное значение** лимита, а не локальную прикидку по `sentMessagesCount`.

## Идея

У проекта уже есть «ИИ-контекст» (авторизованная сессия на luxee.io, где сохранены куки/сессия).
Можно создать **второй контекст браузера (Playwright)**, который **не изолирован**, а как бы
открывается «вторым окном» от основного — и **переиспользует те же куки/сессию**.

Преимущество:
- не нужно заново авторизовываться (куки есть);
- тот же аккаунт, те же данные;
- легко собрать `available-profiles` → получить честные `limits.chat/mail`.

### Требуемые действия (когда решим делать)
1. Уточнить, как именно в проекте хранится «ИИ-контекст» (браузер/контекст/профиль cookies).
2. Из него создать второй «окно/контекст» (без изоляции), держа ту же сессию.
3. В этом контексте открыть `/clients/list`, взять токен и клиента, дёрнуть
   `/api/v2/communication/available-profiles`, распарсить `limits`.
4. Скомпоновать результат `{ import_uid: { chat: {max,count}, mail: {max,count} } }` и вернуть
   на фронт тем же контрактом, что и сейчас (поле `limits` у анкеты).

## Текущий механизм (уже реализовано)

### Текущий механизм (уже реализовано)

### Как собираются лимиты сейчас
- При загрузке анкет аккаунта (`GET /spambot/profiles`) Python логинится, парсит анкеты и
  дополнительно (best-effort, без нового браузера) собирает лимиты через API
  `available-profiles` → лимиты прикрепляются к каждой анкете (`profile.limits`).
- Сбор лимитов идёт в рамках **одной открытой requests-сессии** (без повторного логина
  и без закрытия браузера): перебираем несколько клиентов, пока не соберём анкеты
  (available-profiles возвращает подмножество анкет на каждого конкретного клиента).
  Данные, уже собранные, не теряются; для оставшихся анкет делается повторный проход.
  Если после проходов данных нет — анкете ставится `{"no_information": true}`.
- После завершения/остановки/ошибки рассылки фронт по socket-событию зовёт лёгкий
  `GET /spambot(/admin)/profile-limits` → Python делает отдельный `extract_profiles_limits()`
  (логин + только лимиты) → на фронте обновляются ТОЛЬКО лимиты (state + localStorage-кэш),
  остальные поля анкет не перезапрашиваются. Реальные лимиты НЕ затираются, если сервер
  вернул пусто/`no information`.

## Файлы, которые я меняла (чтобы это работало)

### Backend Spambot (Python)
- `backend-spambot/core/src/models.py` — добавлено `Profile.limits = {}`
- `backend-spambot/core/src/luxee_site/luxee_browser.py`
  - `get_profiles_limits()` — карта `{ import_uid: {chat, mail} }` через `available-profiles`
  - `_attach_profiles_limits()` — best-effort крепления лимитов к анкетам (с ретраем и меткой «нет данных»)
- `backend-spambot/core/src/process.py` — `extract_profiles_limits()` (лёгкий сбор лимитов)
- `backend-spambot/api/models.py` — `ProfileInfo.limits: Optional[dict]`
- `backend-spambot/api/service.py` — проброс `limits` в ответ + `get_profile_limits()`
- `backend-spambot/api/routes.py` — новый `GET /api/limits`

### Backend (Node)
- `backend/src/services/spambotService.js` — `getProfilesLimits()`, `getAdminProfileLimits()`
- `backend/src/controllers/spambotController.js` — `getProfileLimits`, `getAdminProfileLimits`
- `backend/src/routes/spambotRoutes.js` — `GET /profile-limits`, `GET /admin/profile-limits`

### Frontend
- `frontend/src/api/spambotApi.js` — `getProfileLimits()`, `getAdminProfileLimits()`
- `frontend/src/components/Spambot/ProfileSelector.jsx` — отображение `chat`/`mail` лимитов
- `frontend/src/pages/Spambot.jsx` — обновление ТОЛЬКО лимитов по socket (completed/stopped/error)

## Формат лимитов (что возвращает luxee)
```json
{
  "limits": {
    "chat": { "max": 30, "count": 1 },
    "mail": { "max": 10, "count": 0 }
  }
}
```
- `max` — дневной максимум
- `count` — уже потрачено
- показывается `(max - count)/max`, т.е. `chat 30/30`, `mail 10/10`
- если данных нет (после ретраев) — `chat: no information`, `mail: no information`