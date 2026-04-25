# ALC — Assembly Line Control System

Учебный проект: распределённая система контроля производственных линий.
Сервер демонстрирует архитектурные паттерны **CQRS**, **BFF** и реализует
требования по безопасности (refresh-токены, rate limit, helmet, CORS, валидация).

---

## 1. Стек

| Слой | Технологии |
|---|---|
| Сервер | Node.js, TypeScript, Express 5, MongoDB (Mongoose), Redis + BullMQ, Socket.IO, Winston |
| Клиент | React Native (Expo) + Redux Toolkit, axios, socket.io-client |
| Desktop | Electron (обёртка над web-сборкой клиента) |

---

## 2. Запуск

### 2.1. Зависимости

Нужно поднять локально две внешних службы:

```bash
# MongoDB на 27017
brew services start mongodb-community
# или Docker: docker run -d -p 27017:27017 mongo

# Redis на 6379
brew services start redis
# или Docker: docker run -d -p 6379:6379 redis
```

### 2.2. Сервер

```bash
cd server
npm install
cp .env .env.local           # при необходимости — уже есть рабочий .env
npm run seed                 # засеять справочники + демо-данные
npm run dev                  # старт на http://localhost:4000
```

Переменные окружения в `server/.env`:

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/alc
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8081,http://localhost:19006
```

### 2.3. Клиент (мобильный / web)

```bash
cd client
npm install
npm run web        # web-версия (Expo) — http://localhost:8081
npm run android    # Android (нужен запущенный эмулятор)
npm run ios        # iOS (только macOS)
```

### 2.4. Desktop (Electron)

```bash
cd electron
npm install
npm start          # электрон-обёртка над web-сборкой клиента
```

---

## 3. Архитектура

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Mobile    │  │   Web      │  │  Desktop   │
│ (operator) │  │ (engineer) │  │  (admin)   │
└──────┬─────┘  └──────┬─────┘  └─────┬──────┘
       │ /bff/mobile   │ /bff/web     │ /bff/desktop
       └───────────────┼──────────────┘
                       ▼
              ┌──────────────────┐
              │  Express server  │
              │  + middleware:   │
              │  helmet, CORS,   │
              │  rate-limit,     │
              │  mongo-sanitize  │
              └────────┬─────────┘
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  ┌─────────┐   ┌──────────┐    ┌────────────┐
  │ Routes  │   │  CQRS    │    │   BFF      │
  │ (CRUD)  │   │ commands │    │ aggregation│
  │         │   │ queries  │    │            │
  └────┬────┘   └─────┬────┘    └─────┬──────┘
       │              │               │
       │              ├──── publish ──┤
       │              │      events   │
       ▼              ▼               ▼
   ┌──────────┐  ┌────────────────────────────┐
   │ MongoDB  │  │ Redis (BullMQ): commands + │
   │ (write)  │◄─│ domain events workers      │
   └────┬─────┘  └────────┬───────────────────┘
        │                 │ rebuild / patch
        ▼                 ▼
   ┌──────────────────────────────┐
   │ node_read_model collection   │
   │ (denormalized, raw MongoDB)  │
   └──────────────────────────────┘
                 ▲
                 │ read
              CQRS queries + BFF
```

### 3.1. CQRS — `server/src/cqrs/`

- **Command side** (`cqrs/commands/`) — пишет через Mongoose в основную (write) модель,
  публикует доменные события (`NodeCreated`, `NodeStatusChanged`, ...) и инвалидирует
  read-side кэш.
- **Query side** (`cqrs/queries/`) — читает напрямую через драйвер MongoDB из
  денормализированной коллекции `node_read_model`. ORM не используется — это
  явное требование лекции (запросы могут обходить доменную модель).
- URL стиль соответствует требованию (`POST /nodes/commands/...`,
  `POST /nodes/:id/commands/change-status` — отражает доменное действие, а не CRUD).

### 3.2. BFF — `server/src/bff/`

Три отдельных API под трёх клиентов:

| Endpoint | Клиент | Что отдаёт |
|---|---|---|
| `GET /api/bff/mobile/dashboard` | мобильный (оператор) | плоский минимальный DTO + summary |
| `GET /api/bff/web/management` | web (инженер) | иерархия sites → lines → nodes |
| `GET /api/bff/desktop/analytics` | desktop (админ) | сквозная аналитика по всей системе |

BFF **не содержит бизнес-логики** — только агрегация, фильтрация, переформатирование DTO
под нужды конкретного клиента. Этот анти-паттерн (бизнес-логика в BFF) специально не нарушен.

### 3.3. Read model — `server/src/readmodels/nodeReadModel.ts`

Денормализованная коллекция `node_read_model`, в которой в каждом документе уже лежат
имя площадки, имя линии, имя владельца и счётчик активных алертов — никаких джойнов
при чтении. Обновляется асинхронно обработчиком событий
(`server/src/events/handlers/index.ts`) → eventual consistency.

### 3.4. Очередь — `server/src/queue/`

BullMQ-воркер обрабатывает тяжёлые команды (`restart`, `calibrate`, `diagnostics`,
`emergency_stop`...). API кладёт команду в очередь и сразу отдаёт `202`-подобный
ответ с `job_id`, воркер исполняет в фоне, эмитит события через Socket.IO
и публикует доменные события для апдейта read model.

### 3.5. Cache — `server/src/cache/`

Простой in-memory TTL-кэш с tag-based инвалидацией. Query-side endpoint'ы
кэшируют результат на 30с под тегами `nodes`, `stats`, `node:<id>`.
Каждая команда (включая выполнение через очередь) вызывает `cacheInvalidate(...)`
с релевантными тегами — read-side не отдаёт устаревшие данные.

### 3.6. События — `server/src/events/`

Доменные события (`NodeCreated`, `NodeStatusChanged`, `AlertCreated`,
`CommandExecuted`) публикуются через отдельную очередь BullMQ
(`domain-events`). Воркер событий апдейтит read model и логирует.

---

## 4. Безопасность

| Требование | Где |
|---|---|
| 6.1.1 — валидация входных данных | [server/src/middleware/validate.ts](server/src/middleware/validate.ts) — schema-based, применяется в routes (`auth`, `sites`, `lines`, `nodes`, `commands`) |
| 6.1.2 — user_id из токена | [server/src/middleware/auth.ts](server/src/middleware/auth.ts) — `req.user.id` достаётся из JWT, нигде не берётся из тела запроса |
| 6.2.1 — короткий access token | `JWT_EXPIRES_IN=15m` в `.env` |
| 6.2.2 — refresh token | модель [server/src/models/RefreshToken.ts](server/src/models/RefreshToken.ts), endpoint `POST /api/auth/refresh` (ротация: старый отзывается, выдаётся новая пара) |
| 6.3.1 — rate limit на login | [server/src/middleware/rateLimit.ts](server/src/middleware/rateLimit.ts) — 10 попыток/мин/IP на `/auth/login`, 300/мин/IP на остальное `/api` |
| 6.3.2 — NoSQL injection | [server/src/middleware/sanitize.ts](server/src/middleware/sanitize.ts) — удаляет ключи с `$` и `.` из body/query/params |
| 6.3.3 — XSS / заголовки | `helmet()` в [server/src/index.ts](server/src/index.ts) |
| 6.3.4 — CORS | whitelist `CORS_ORIGINS` (без `*`), [server/src/index.ts](server/src/index.ts) |

---

## 5. Метрики и тепловая карта

`GET /api/metrics/heatmap` (нужен JWT с ролью admin/engineer) — отдаёт:

- **`hot_points.by_volume`** — топ-5 endpoint'ов по числу запросов
- **`hot_points.by_latency`** — топ-3 по среднему времени ответа
- **`hot_points.heavy_commands`** — самые частые command-операции (worker)
- **`summary.queue`** — счётчики `enqueued / completed / failed`
- **`cache`** — `size / hits / misses / hitRate`

Источники данных:
- HTTP метрики собирает `requestLogger` middleware
  ([server/src/middleware/requestLogger.ts](server/src/middleware/requestLogger.ts)).
- Метрики команд и очереди инкрементируются в воркере
  ([server/src/queue/worker.ts](server/src/queue/worker.ts)).

Логи доступны через `GET /api/logs?level=error&limit=100` (роль admin/engineer)
и в файлах `server/logs/combined.log`, `server/logs/error.log`.

---

## 6. Структура веток (требование 5.1)

| Ветка | Назначение |
|---|---|
| `main` | стабильная, всегда деплоится |
| `develop` | интеграционная, сюда мерджатся feature-ветки |
| `feature/CQRS-command` | реализация CQRS (commands/queries/read-model) |
| `feature/bff-mobile` | BFF под мобильный клиент |
| `feature/bff-web` | BFF под web |
| `feature/bff-desktop` | BFF под desktop |
| `feature/security` | refresh tokens, rate limit, helmet, CORS, валидация |
| `feature/metrics` | heatmap + cache |

Соглашения по коммитам (Conventional Commits):

```
feat: ...        — новая функциональность
fix: ...         — багфикс
refactor: ...    — переработка без изменения поведения
docs: ...        — документация
chore: ...       — рутинные задачи (deps, конфиг)
test: ...        — тесты
```

PR должен содержать: описание изменений, что реализовано, как проверить.

---

## 7. Карта API (основное)

### Auth
- `POST /api/auth/login` — `{ username, password }` → `{ access_token, refresh_token, expires_in }`
- `POST /api/auth/refresh` — `{ refresh_token }` → новая пара токенов
- `POST /api/auth/logout` — отзывает refresh токены пользователя
- `GET  /api/auth/me`

### CRUD (требует Bearer)
- `/api/sites`, `/api/lines`, `/api/nodes`, `/api/alerts`, `/api/commands`, `/api/telemetry`, `/api/users`

### CQRS
- `POST /api/cqrs/nodes/commands/create`
- `POST /api/cqrs/nodes/:id/commands/change-status`
- `DELETE /api/cqrs/nodes/:id/commands`
- `GET /api/cqrs/nodes/queries`
- `GET /api/cqrs/nodes/queries/stats`
- `GET /api/cqrs/nodes/:id/queries`

### BFF
- `GET /api/bff/mobile/dashboard`
- `GET /api/bff/mobile/node/:id`
- `GET /api/bff/web/management`
- `GET /api/bff/web/monitoring`
- `GET /api/bff/desktop/analytics` (admin)
- `GET /api/bff/desktop/users-with-stats` (admin)

### Метрики и логи
- `GET /api/metrics/heatmap` (admin/engineer)
- `GET /api/metrics/cache` (admin/engineer)
- `GET /api/logs?level=error&limit=100` (admin/engineer)
- `GET /api/health`

---

## 8. Как проверить выполнение требований

| Что проверить | Как |
|---|---|
| CQRS разделение | сравни [cqrs/commands](server/src/cqrs/commands/) (Mongoose + публикация событий) и [cqrs/queries](server/src/cqrs/queries/) (raw MongoDB, без ORM) |
| BFF без бизнес-логики | в [server/src/bff](server/src/bff/) только `find/aggregate` + переформатирование DTO; никаких записей |
| Read model денормализована | в [readmodels/nodeReadModel.ts](server/src/readmodels/nodeReadModel.ts) видны поля `site_name`, `line_name`, `owner_username`, `active_alerts_count` — все джойны разрешены заранее |
| Refresh token | `POST /api/auth/refresh` с истёкшим access — выдаёт новую пару, старый refresh помечается `revoked` |
| Rate limit | 11 раз подряд `POST /api/auth/login` с одного IP → 429 |
| Cache invalidation | `GET /api/cqrs/nodes/queries` → ответ с `X-Cache: MISS`; повтор → `HIT`; `POST /api/cqrs/nodes/commands/create` → следующий GET снова `MISS` |
| Heatmap | сделать ~20 запросов, потом `GET /api/metrics/heatmap` — увидишь `hot_points.by_volume` |
| Валидация | `POST /api/sites` с пустым `name` → 400 `{ error: "Ошибка валидации", details: [...] }` |
| CORS | запрос с `Origin: http://evil.com` без него в whitelist → ошибка CORS |
| NoSQL injection | `POST /api/auth/login` с `{"username":{"$ne":""},"password":{"$ne":""}}` — sanitize удалит `$ne`, валидация отклонит как `username должно быть строкой` |
