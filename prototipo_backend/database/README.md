# PostgreSQL database

Questa cartella e la sorgente canonica della struttura dati Postgres del progetto.

## Struttura

- `migrations/`: migrazioni SQL ordinate
- `nutritrack-schema.sql`: snapshot leggibile dello schema corrente, utile per revisione rapida

## Principi

1. I dati core dell'app stanno in tabelle relazionali con `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL` e `CHECK`.
2. `JSONB` e usato solo per payload esterni, metadata e cache flessibili.
3. I dati dei device sono modellati come connessioni + sync runs + measurements, non come blob opaco.
4. La lettura dell'app puo restare graduale, ma la base dati di riferimento e Postgres.

Nota:

- nello schema corrente `device_connections.is_mock` ha default `FALSE`
- un provider mock va marcato esplicitamente, non assunto come default del sistema

## Ordine di bootstrap

1. creare il database locale
2. applicare in ordine tutte le migrazioni presenti in `migrations/`
3. impostare `DATABASE_URL`
4. attivare `NUTRITRACK_USE_POSTGRES=1`
5. avviare il backend e verificare `GET /api/database/status`

In alternativa, quando Postgres locale e in esecuzione, puoi usare:

`./database/bootstrap-local-postgres.sh`

Variabili utili:

- `PSQL_BIN`
- `DB_NAME`
- `DB_USER`
- `DB_HOST`
- `DB_PORT`
- `RESET_DB=1` per ricreare il database da zero durante il bootstrap iniziale

## Configurazione backend

Usa `prototipo_backend/.env.example` come base per le variabili ambiente locali.

Valori minimi:

- `DATABASE_URL=postgresql://...`
- `NUTRITRACK_USE_POSTGRES=1`
- `NUTRITRACK_LOCAL_USER_EMAIL=app-local@nutritrack.local`

Nota:

- `NUTRITRACK_DEMO_USER_EMAIL` resta supportata come variabile legacy, ma il backend ora usa il concetto di single-user locale invece di utente demo implicito.
- con Postgres attivo, la scrittura e ora `Postgres-first`; il file JSON legacy conserva solo i blocchi non ancora migrati, non piu lo stato completo dell'app.

## Split attuale della persistenza

Oggi il backend usa tre livelli distinti, con ruoli diversi:

### 1. Postgres strutturato

Fonte primaria per le sezioni core gia migrate:

- `profile`
- `nutrition.meals`
- `grocery.items`
- `grocery.pantry`
- `progress.dailyLogs`

### 2. File dedicati ai provider device

Lo stato operativo delle integrazioni device non passa oggi dal blob legacy:

- `prototipo_backend/data/scale-connection.json` per il provider `scale`
- `prototipo_backend/data/strava-connection.json` per il provider `strava`, quando presente

Questo livello e backend-owned e viene esposto al frontend tramite `GET /api/devices/state`.

### 3. Legacy UI/cache file

`prototipo_backend/data/nutritrack-state.json` non e piu una fonte completa dello stato app.
Con Postgres attivo conserva solo blocchi non ancora migrati oppure puramente UX/cache:

- `recipes`
- `datasets`
- `devices.syncPreferences`
- `nutrition.goals`
- `grocery.ar`
- `progress.autoSnapshots`

Nota importante:

- `devices.integrations.*` non vive piu nel file legacy
- le tabelle device in Postgres esistono come base target del modello futuro, ma non sono ancora la persistenza attiva dei provider correnti

## Verifica minima consigliata

Dopo il bootstrap:

1. avviare il backend
2. chiamare `GET /api/database/status`
3. eseguire un salvataggio su `PUT /api/nutritrack/state` per backfill iniziale dei dati legacy
4. controllare che Postgres popoli:
   - `user_profiles`
   - `nutrition_meals`
   - `grocery_items`
   - `pantry_items`
   - `progress_logs`
5. eseguire `npm run verify:postgres-primary`

Lo script `verify:postgres-primary` controlla che:

- `GET /api/database/status` riporti `hybrid_read_through`
- `GET /api/nutritrack/state` riporti `primarySource=postgres_structured_sections_complete`
- le sezioni strutturate `profile`, `nutrition`, `grocery` e `progress` risultino coperte da Postgres

Non verifica ancora il layer device: quello oggi va controllato separatamente tramite `GET /api/devices/state` e le route `/api/scale/*` / `/api/strava/*`.

Puoi cambiare endpoint con `NUTRITRACK_BASE_URL`, ad esempio:

`NUTRITRACK_BASE_URL=http://127.0.0.1:3000 npm run verify:postgres-primary`
