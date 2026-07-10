# Intervals.icu MCP Server

Prywatny, deterministyczny serwer MCP do analizy historii treningowej i bezpiecznego planowania treningów na podstawie Intervals.icu. Nie wywołuje modelu językowego, nie pobiera plików FIT ani surowych streamów i nie łączy się bezpośrednio z Garminem.

```text
Garmin → Garmin Connect → Intervals.icu → ten serwer MCP → ChatGPT/Codex
```

Serwer używa Streamable HTTP z MCP SDK 1.29.0:

- `POST /mcp` — JSON-RPC MCP;
- `GET /healthz` — żywotność procesu;
- `GET /readyz` — gotowość konfiguracji Intervals.icu.

`GET`, `DELETE`, `PUT` i `PATCH` na `/mcp` zwracają `405`. Transport jest bezstanowy, dzięki czemu proces może być skalowany bez współdzielonej pamięci sesji.

## Bezpieczeństwo

Zapis jest domyślnie wyłączony. Nie wystawiaj serwera publicznie z prywatnymi danymi zdrowotnymi bez uwierzytelnienia. Obecna fabryka HTTP przyjmuje middleware uwierzytelniający przed `/mcp`, co pozwala później dodać OAuth 2.1 bez zmiany narzędzi ani klienta Intervals.

Serwer nie loguje argumentów narzędzi, odpowiedzi Intervals, klucza API ani treści błędów upstream. `apply_training_plan` pojawia się wyłącznie przy `WRITE_ENABLED=true` i wymaga krótkotrwałego tokenu HMAC otrzymanego z `validate_training_plan`.

## Konfiguracja

```bash
npm install
cp .env.example .env
cp config/training-profile.example.yaml config/training-profile.yaml
```

Uzupełnij `.env`:

```dotenv
PORT=3000
INTERVALS_ICU_API_KEY=...
INTERVALS_ICU_ATHLETE_ID=i12345
USER_TIMEZONE=Europe/Warsaw
TRAINING_PROFILE_PATH=./config/training-profile.yaml
WRITE_ENABLED=false
VALIDATION_HMAC_SECRET=
LOG_LEVEL=info
```

`TRAINING_PROFILE_PATH` wskazuje prywatny plik YAML. Alternatywnie `TRAINING_PROFILE_YAML` może zawierać YAML bezpośrednio; dla zgodności wstecznej nadal akceptuje również ścieżkę. Prawdziwy profil i `.env` są ignorowane przez Git i obraz Dockera. Strefy, FTP, FTHR i masa są pobierane z Intervals.icu, nie z profilu.

Przy włączeniu zapisu ustaw losowy sekret o długości co najmniej 32 znaków, np. `openssl rand -hex 32`. Najpierw wywołaj `validate_training_plan`, a do `apply_training_plan` przekaż dokładnie zwrócony `normalizedPlan` i `validationToken`. Token wygasa po 5 minutach i jest związany z kanonicznym hashem całego planu.

## Uruchomienie lokalne

```bash
npm run build
npm start
```

Tryb developerski:

```bash
npm run dev
```

Kontrola:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

Adres MCP do konfiguracji własnej aplikacji: `http://localhost:3000/mcp`. W środowisku publicznym używaj wyłącznie HTTPS i OAuth 2.1.

## Narzędzia MCP

- `get_training_context` — profil, strefy/progi, tygodniowa objętość, fitness/fatigue/form, ostatnie aktywności, trendy wellness i przyszły kalendarz;
- `list_activities` — stronicowane podsumowania aktywności, zawsze posortowane malejąco po dacie (`sort: date_desc`); filtr `sport` obejmuje `run`, `ride`, `strength`, `swim`, `walk`, `hike`, `climbing` i `other`, a `activityType` pozwala wybrać dokładny typ, np. `bouldering`;
- `get_activity_details` — podsumowanie, laps/interwały, strefy, najlepsze wysiłki i kompletność;
- `get_wellness` — dzienne wellness, z brakami jako `null`;
- `get_training_calendar` — wydarzenia i stabilny `eventHash` wykorzystywany przy aktualizacji;
- `validate_training_plan` — walidacja bez zapisu, podsumowanie, ostrzeżenia i opcjonalny token;
- `apply_training_plan` — tylko przy `WRITE_ENABLED=true`; idempotentne tworzenie lub aktualizacja z kontrolą konfliktu.

Nie ma narzędzi do kasowania, edycji wykonanych aktywności ani zarządzania strefami.

## Architektura

Kod jest podzielony na lekkie warstwy: `tools` i `server` są adapterami transportowymi, moduły `activities`, `calendar`, `wellness`, `coaching` i `workouts` zawierają przypadki użycia oraz modele, a `intervals` izoluje kontrakt zewnętrznego API. Transport nie zawiera logiki biznesowej. `npm run architecture` pilnuje braku cykli i importów z warstwy rdzenia do transportu.

Logi są strukturalne i celowo nie zawierają argumentów narzędzi, treści odpowiedzi, nagłówków ani danych zdrowotnych. Rejestrowane są jedynie identyfikator żądania, metoda, ścieżka, status, nazwa narzędzia, kod błędu i czas wykonania.

`get_training_context` zwraca kompaktowy kontrakt trenerski, a nie surową konfigurację Intervals.icu. Profile dyscyplin zawierają nazwane progi i strefy z jednostkami; `threshold_pace` jest normalizowane do sekund na kilometr. Surowe ustawienia sportowe są dostępne wyłącznie z `includeRawZones: true`. Fitness, fatigue i form korzystają z danych athlete, a przy ich braku z CTL/ATL w wellness; wyliczona forma oznacza `CTL - ATL`.

Pokrycie wellness ma osobne liczniki okna, rekordów i poszczególnych pomiarów. Tygodnie objętości wskazują `isPartial`, `coveredFrom` i `coveredTo`, a ostatnie aktywności deklarują porządek, limit, całkowitą liczbę i obcięcie. `missingData` składa się z obiektów `{ field, reason }`; pusty kalendarz lub inny poprawnie pusty wynik nie jest zgłaszany jako brak danych.

Podsumowanie aktywności zwraca lokalny czas ISO 8601 z offsetem skonfigurowanej strefy. `rpe` oznacza wyłącznie RPE 1–10 (`icu_rpe`), a złożone obciążenie sesji jest osobnym polem `sessionRpeLoad`. Metryki podsumowania mają ustaloną ergonomiczną precyzję, a wartości niemające zastosowania (np. prędkość treningu siłowego) są `null`. `activityType` zachowuje typ szczegółowy, np. `bouldering`, przy `sport: climbing`.

## Model planu

Asystent przekazuje neutralny model Zod/TypeScript, a serwer deterministycznie renderuje składnię structured workout Intervals. Obsługiwane sporty to `run`, `ride`, `strength`, `recovery`; kroki: `warmup`, `steady`, `interval`, `recovery`, `repeat`, `cooldown`, `open`; targety: `open`, strefy i zakresy HR/pace/power oraz cadence. Trening siłowy w MVP jest wydarzeniem opisowym w `athleteNotes`.

Walidator ogranicza plan do 14 wydarzeń i 28 dni, pilnuje dodatnich czasów/dystansów, maksymalnie 20 powtórzeń, duplikatów, stref, kolizji kalendarza, skoków tygodniowej objętości i ciężkich dni obok siebie.

Idempotencja opiera się na trwałym `clientWorkoutId` zapisanym w opisie wydarzenia. Identyczny zapis zwraca `unchanged`. Aktualizacja istniejącego wydarzenia wymaga zgodnego `expectedEventHash`; ręczna zmiana w Intervals powoduje jawny `conflict`, a błąd częściowy nigdy nie kasuje innych wydarzeń.

## Testy

Intervals API jest mockowane — testy nie potrzebują prawdziwego klucza:

```bash
npm test
npm run build
npm run check
npm run coverage
```

`npm run check` uruchamia typecheck kodu i testów, ESLint, testy, kontrolę granic architektury oraz Knip. Pokrycie ma progi bazowe, które należy stopniowo podnosić. Zestaw obejmuje schematy Zod, mapowanie i braki danych, stabilną paginację, renderer, strefę czasową, token, event hash, idempotencję, wyłączony zapis, błędy/retry Intervals oraz pełne wywołanie MCP po HTTP.

## Docker

```bash
docker build -t intervals-icu-mcp .
docker run --rm -p 3000:3000 --env-file .env \
  -v "$PWD/config/training-profile.yaml:/app/config/training-profile.yaml:ro" \
  intervals-icu-mcp
```

Proces nasłuchuje na `0.0.0.0` i porcie z `PORT`. Obraz działa jako nieuprzywilejowany użytkownik i zawiera healthcheck.

## Railway

Repozytorium zawiera `Dockerfile`, więc Railway może użyć buildera Dockerfile. Utwórz prywatną usługę z repozytorium i ustaw zmienne z `.env.example`; `PORT` może pozostać zarządzany przez Railway. Dla profilu najwygodniej umieścić wielowierszowy YAML bezpośrednio w prywatnej zmiennej `TRAINING_PROFILE_YAML`.

Po wdrożeniu sprawdź `https://<domain>/healthz` i `https://<domain>/readyz`, a adres aplikacji MCP ustaw na `https://<domain>/mcp`. Nie ustawiaj `WRITE_ENABLED=true`, dopóki nie skonfigurujesz `VALIDATION_HMAC_SECRET` i nie zweryfikujesz przepływu na środowisku prywatnym.

Publiczne wdrożenie wymaga przed `/mcp` middleware OAuth 2.1 oraz HTTPS. Same endpointy health/readiness nie ujawniają danych zdrowotnych ani sekretów.
