# Intervals.icu MCP Server

A deterministic Model Context Protocol (MCP) server for analyzing training history and safely planning workouts with data from [Intervals.icu](https://intervals.icu/).

The server gives MCP clients a compact coaching context, completed activities, activity details, wellness data, the training calendar, and a guarded workflow for writing training plans. It does not call a language model, download FIT files or raw activity streams, connect directly to Garmin, delete calendar events, edit completed activities, or manage athlete zones.

```text
Garmin -> Garmin Connect -> Intervals.icu -> this MCP server -> ChatGPT/Codex
```

## MCP tools

The server exposes six tools in its default read-only configuration. A seventh tool, `apply_training_plan`, is registered only when writes are explicitly enabled.

| Tool | Availability | Purpose |
| --- | --- | --- |
| `get_training_context` | Always | Build a compact coaching snapshot from athlete settings, recent training, wellness, and the upcoming calendar. |
| `list_activities` | Always | List normalized completed activities with stable cursor pagination. |
| `get_activity_details` | Always | Inspect one activity's summary, laps/intervals, zones, best efforts, and data completeness. |
| `get_wellness` | Always | Read daily recovery and wellness measurements. |
| `get_training_calendar` | Always | Read planned workouts, races, rest days, and notes, including version hashes used for safe updates. |
| `validate_training_plan` | Always | Validate and normalize a proposed plan without writing anything. |
| `apply_training_plan` | `WRITE_ENABLED=true` | Create new events or conflict-safe updates from a previously validated plan. Never deletes events. |

Every successful tool result is returned as `{ "data": ... }`. Dates passed as `startDate`, `endDate`, or workout `date` use `YYYY-MM-DD` in `USER_TIMEZONE`.

### `get_training_context`

Use this as the usual first call for coaching or plan generation. It combines the configured private training profile with normalized Intervals.icu data instead of returning raw provider payloads.

Inputs:

| Argument | Required | Default / limit | Meaning |
| --- | --- | --- | --- |
| `historyDays` | No | `42`; 1–84 | Historical window for activities, volume, load, and wellness. |
| `futureDays` | No | `14`; 1–28 | Upcoming calendar window. |
| `sports` | No | All available sports | Filter to one or more of `run`, `ride`, `strength`, `swim`, `walk`, `hike`, `climbing`, or `other`. |
| `includeRawZones` | No | `false` | Include unfiltered Intervals.icu sport settings in addition to normalized zones. |

The result includes:

- training goals, availability, preferences, and injury context from the optional profile;
- sport-specific FTP, LTHR, maximum heart rate, threshold pace, and normalized zones;
- fitness, fatigue, and form, with the data source identified;
- weekly duration, distance, load, activity count, and partial-week coverage;
- recent activities in descending date order, including truncation metadata;
- wellness coverage, averages, and the latest available measurements;
- upcoming calendar events; and
- explicit `missingData` entries that distinguish unavailable, unconfigured, and unrecorded data.

Raw sport settings are omitted by default to keep the response useful for an MCP client's context window. Threshold pace is normalized to seconds per kilometer; each zone series declares its unit.

### `list_activities`

Inputs:

| Argument | Required | Default / limit | Meaning |
| --- | --- | --- | --- |
| `startDate` | Yes | Maximum 366-day range | First local calendar date to query. |
| `endDate` | Yes | Maximum 366-day range | Last local calendar date to query. |
| `sport` | No | — | Normalized sport filter: `run`, `ride`, `strength`, `swim`, `walk`, `hike`, `climbing`, or `other`. |
| `activityType` | No | — | Exact normalized source type, such as `bouldering`. |
| `limit` | No | `50`; 1–200 | Number of activities in the page. |
| `cursor` | No | — | Opaque `nextCursor` from the preceding page of the same query. |

Activities are guaranteed to be sorted newest first (`sort: "date_desc"`). Each summary includes normalized sport and detailed activity type, local start time with UTC offset, duration, distance, pace/speed where applicable, heart rate, elevation gain, training load, RPE, session RPE load, notes, and plan-versus-actual status. Missing or inapplicable metrics are `null`, not zero.

To continue pagination, repeat the same date and filter arguments with the returned `nextCursor`. A cursor is tied to its original query and is rejected if the query changes.

### `get_activity_details`

Inputs:

| Argument | Required | Default | Meaning |
| --- | --- | --- | --- |
| `activityId` | Yes | — | Intervals.icu activity ID returned by `list_activities`. |
| `includeIntervals` | No | `true` | Request laps and interval data from Intervals.icu. |

The result extends the normalized activity summary with laps, intervals, zone distribution, best efforts, notes, and `completeness` flags for heart rate, power, intervals, and other missing fields. It intentionally does not expose FIT files or second-by-second streams.

### `get_wellness`

Inputs are `startDate` and `endDate`, with a maximum range of 366 days. The result contains daily sleep duration, HRV, resting heart rate, weight, fatigue, stress, soreness, RPE, SpO2, steps, CTL, ATL, and provider-defined custom values. Measurements that were not recorded are returned as `null`.

### `get_training_calendar`

Inputs are `startDate` and `endDate`, with a maximum range of 366 days. Each returned event includes its date, name, category, normalized sport, description, duration, distance, training load, structured workout text, optional `clientWorkoutId`, and a stable `eventHash`.

Keep the `eventHash` when preparing an update. Passing it back as `expectedEventHash` lets `apply_training_plan` detect a manual change made in Intervals.icu instead of overwriting it.

### `validate_training_plan`

This read-only tool accepts `{ "plan": <training plan> }`. It validates the schema and current Intervals.icu state, sorts workouts into a normalized plan, and returns:

- `valid`, structured `errors`, and non-blocking `warnings`;
- `normalizedPlan`, which should be used unchanged for the apply call;
- totals and per-week duration/distance;
- a human-readable preview; and
- a five-minute `validationToken` when `VALIDATION_HMAC_SECRET` is configured and the plan is valid.

Validation checks include the configured timezone, dates from today through 28 days ahead, duplicate IDs and workouts, available zones for each sport, calendar collisions, adjacent hard days, multiple non-recovery workouts on one day, and weekly duration increases above 25%.

The plan supports at most 14 workouts:

```json
{
  "planId": "week-2026-07-13",
  "timezone": "Europe/Warsaw",
  "workouts": [
    {
      "clientWorkoutId": "week-2026-07-13.run-1",
      "date": "2026-07-14",
      "sport": "run",
      "name": "Easy aerobic run",
      "intent": "Stay relaxed and finish fresh",
      "steps": [
        {
          "type": "steady",
          "durationSeconds": 2700,
          "target": { "type": "heart_rate_zone", "zone": 2 }
        }
      ],
      "athleteNotes": "Use conversational effort if heart rate is unusually high."
    }
  ]
}
```

Supported sports are `run`, `ride`, `strength`, and `recovery`. Workout steps can be `warmup`, `steady`, `interval`, `recovery`, `repeat`, `cooldown`, or `open`. A timed step needs `durationSeconds` or `distanceMeters`; repeats allow up to 20 repetitions. Targets can be open, heart-rate/pace/power zones, heart-rate/pace/power ranges, or cadence ranges. In the current MVP, strength sessions are descriptive events and use `athleteNotes` rather than structured steps.

### `apply_training_plan`

This tool is absent unless both the deployment and the client are deliberately prepared for writes. Call it with the exact `normalizedPlan` and `validationToken` returned by `validate_training_plan`:

```json
{
  "plan": { "...": "the exact normalizedPlan" },
  "validationToken": "...",
  "mode": "create_or_update"
}
```

The validation token is HMAC-signed over the entire normalized plan and expires after five minutes. Every workout receives one of `created`, `updated`, `unchanged`, `conflict`, or `failed`. The overall result reports whether the operation was partial.

Idempotency is based on the durable `clientWorkoutId` stored in the event description. An identical event returns `unchanged`. Updating an existing event requires its current `eventHash` in `expectedEventHash`; a mismatch returns `conflict`. Failures are isolated per workout, and the tool never deletes another event.

## Quick start

Requirements: Node.js 22 or a Docker-compatible runtime, an Intervals.icu API key, and your Intervals.icu athlete ID.

```bash
npm install
cp .env.example .env
cp config/training-profile.example.yaml config/training-profile.yaml
```

Configure `.env`:

```dotenv
PORT=3000
MCP_AUTH_TOKEN=replace-with-a-random-token-of-at-least-32-characters
INTERVALS_ICU_API_KEY=your-intervals-api-key
INTERVALS_ICU_ATHLETE_ID=i12345
USER_TIMEZONE=Europe/Warsaw
TRAINING_PROFILE_PATH=./config/training-profile.yaml
WRITE_ENABLED=false
VALIDATION_HMAC_SECRET=
LOG_LEVEL=info
```

Generate the MCP access token with, for example, `openssl rand -hex 32`. This is a separate secret from the Intervals.icu API key.

Build and start the server:

```bash
npm run build
npm start
```

For development with automatic reloads:

```bash
npm run dev
```

Check the process and its Intervals.icu configuration:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

Configure an MCP client to use `http://localhost:3000/mcp` with this header on every request:

```text
Authorization: Bearer <MCP_AUTH_TOKEN>
```

Use HTTPS for any non-local deployment and provide the Bearer token only to trusted clients.

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MCP_AUTH_TOKEN` | Yes | — | Static Bearer token, at least 32 non-whitespace characters. The process will not start without it. |
| `INTERVALS_ICU_API_KEY` | For readiness | — | Intervals.icu API key. |
| `INTERVALS_ICU_ATHLETE_ID` | For readiness | — | Intervals.icu athlete ID, commonly prefixed with `i`. |
| `PORT` | No | `3000` | HTTP listen port. |
| `USER_TIMEZONE` | No | `Europe/Warsaw` | Valid IANA timezone used for dates and local timestamps. |
| `TRAINING_PROFILE_PATH` | No | — | Path to the private YAML coaching profile for local use. |
| `TRAINING_PROFILE_YAML` | No | — | Full inline YAML profile, useful for deployments; takes precedence over the path. |
| `WRITE_ENABLED` | No | `false` | Register the `apply_training_plan` tool. |
| `VALIDATION_HMAC_SECRET` | For writes | — | Secret of at least 32 characters used to sign validation tokens. |
| `INTERVALS_ICU_BASE_URL` | No | `https://intervals.icu/api/v1` | Advanced override for the upstream API URL. |
| `INTERVALS_ICU_TIMEOUT_MS` | No | `10000` | Upstream timeout, from 1,000 to 60,000 ms. |
| `LOG_LEVEL` | No | `info` | Pino log level, including `silent`. |

`TRAINING_PROFILE_PATH` and the real profile file are intended to remain private and are ignored by Git and the Docker build context. The profile supplies coaching context such as goals, availability, preferences, experience, and injury notes. Physiological values such as zones, FTP, LTHR, and weight come from Intervals.icu rather than this profile.

To enable writes, set `WRITE_ENABLED=true` and generate an independent signing secret, for example:

```bash
openssl rand -hex 32
```

Assign that value to `VALIDATION_HMAC_SECRET`. Do not reuse the MCP access token or Intervals.icu API key.

## HTTP transport and security

The server uses stateless Streamable HTTP from MCP SDK 1.29.x:

- `POST /mcp` — authenticated MCP JSON-RPC;
- `GET /healthz` — public process liveness check; and
- `GET /readyz` — public configuration readiness check.

`GET`, `DELETE`, `PUT`, and `PATCH` requests to `/mcp` return `405`. The stateless transport allows multiple server instances without shared MCP session memory.

All `/mcp` requests require the static Bearer token. Missing, malformed, and incorrect credentials return the same `401` response, and token digests are compared in constant time. Health and readiness endpoints stay public for deployment probes and expose no health data or secrets.

Logs are structured and intentionally omit tool arguments, Intervals.icu response bodies, API keys, authorization headers, upstream error contents, and health data. They contain only operational fields such as request ID, method, path, status, tool name, error code, and duration.

Writes are disabled by default. Even when enabled, applying a plan requires a recent successful validation, conflict checking, and an idempotent client workout ID.

## Docker

```bash
docker build -t intervals-icu-mcp .
docker run --rm -p 3000:3000 --env-file .env \
  -v "$PWD/config/training-profile.yaml:/app/config/training-profile.yaml:ro" \
  intervals-icu-mcp
```

The container listens on `0.0.0.0`, uses `PORT`, runs as an unprivileged user, and includes a health check.

## Railway

The repository includes a `Dockerfile`, so Railway can deploy it with the Dockerfile builder. Create a private service from the repository and configure the variables from `.env.example`; Railway can manage `PORT`.

Do not use a local `TRAINING_PROFILE_PATH` on Railway. Instead, paste the complete profile into a private multiline `TRAINING_PROFILE_YAML` variable. The profile then remains outside the repository and container image.

Set a private MCP token, for example:

```bash
railway variable set MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
```

After deployment, check `https://<domain>/healthz` and `https://<domain>/readyz`, then configure the MCP endpoint as `https://<domain>/mcp`. Leave `WRITE_ENABLED=false` until `VALIDATION_HMAC_SECRET` is configured and the full validation/apply flow has been tested in a private environment.

Railway terminates public HTTPS while the application listens on HTTP inside the platform. To rotate access, replace `MCP_AUTH_TOKEN`, allow the service to redeploy, and then update every trusted MCP client. The server accepts one active token at a time.

## Architecture and development

The code is split into small layers. `tools` and `server` adapt MCP and HTTP; `activities`, `calendar`, `wellness`, `coaching`, and `workouts` contain use cases and domain models; `intervals` isolates the upstream API contract. Business logic does not live in the transport layer. Architecture checks prevent dependency cycles and core-to-transport imports.

Intervals.icu is mocked in tests, so development does not require a real API key:

```bash
npm test
npm run build
npm run check
npm run coverage
```

`npm run check` runs application and test type checking, ESLint, tests, architecture rules, and Knip. The suite covers schemas, mappings and missing data, stable pagination, workout rendering, timezone handling, validation tokens, event hashes, idempotency, disabled writes, upstream errors/retries, and an end-to-end MCP call over HTTP.
