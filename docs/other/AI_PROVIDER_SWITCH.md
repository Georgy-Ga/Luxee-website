# Переключение AI-провайдера: NVIDIA (тест) ↔ DeepSeek (прод)

Переключение — **одной строкой** `AI_PROVIDER` в корневом `.env` (для Docker)
или `backend/.env` (для `npm run dev`). Код хранит обе ветки, удалять
DeepSeek-код запрещено.

## NVIDIA (текущий тестовый режим)

```env
AI_PROVIDER=nvidia
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=nvapi-...          # ключ с https://build.nvidia.com
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
```

Параметры в коде (`backend/src/services/aiService/apiClient.js`):
- `temperature: 0.9`, `max_tokens: 250` (thinking выключен через
  `chat_template_kwargs.enable_thinking=false`, поэтому хватает малого бюджета)
- `timeout: 60000` — **TEMP-мера (2026-09)**: endpoint периодически висит
  по 40с+ (см. висяки в логах). Вернуть 30000 при уходе с NVIDIA.
- Семафор: максимум 4 параллельных запроса на процесс (`AI_MAX_CONCURRENT`
  в том же файле) + максимум 1 повтор только сетевых таймаутов.
- Проверка старта: в логе должно быть `[AI Config] AI_PROVIDER: nvidia`.

## DeepSeek (прод)

```env
AI_PROVIDER=deepseek
AI_API_URL=https://api.deepseek.com
AI_API_KEY=sk-...                 # баланс должен быть пополнен!
AI_MODEL=deepseek-v4-flash
```

Параметры в коде (те же места):
- `temperature: 1.1`, `max_tokens: 800` — reasoning съедает бюджет, запас нужен
- `timeout: 30000` — вернуть с 60000 при переезде обратно
- Семафор и ретрай работают для обоих провайдеров без изменений
- Проверка старта: `[AI Config] AI_PROVIDER: deepseek` **без**
  warning про пустой ключ

## Чеклист переключения

1. Поменять `AI_PROVIDER` (+ убедиться, что ключ нужного провайдера задан).
2. Локально: рестарт `npm run dev`. Docker: `docker compose build backend && docker compose up -d backend`
   (переменные окружения подхватываются только пересозданием контейнера).
3. В логе старта проверить `[AI Config]` (провайдер/URL/модель/ключ).
4. Ожидаемые ошибки чужого провайдера:
   - DeepSeek `402 Payment Required` → пополнить баланс или `AI_PROVIDER=nvidia`
   - DeepSeek `401` → неверный/пустой `AI_API_KEY`
   - NVIDIA `timeout` пачками → смотреть семафор/нагрузку, не таймаут
