# Database PostgreSQL

Uso questa cartella come riferimento canonico per la struttura dati PostgreSQL di NutriTrack. Le migrazioni sono la fonte operativa, mentre `nutritrack-schema.sql` è lo snapshot leggibile dello schema corrente.

## Struttura

- `migrations/`: migrazioni SQL ordinate e incrementali.
- `nutritrack-schema.sql`: schema completo aggiornato alla migrazione più recente.
- `bootstrap-local-postgres.sh`: script di bootstrap per il database locale diretto, usato solo fuori da Docker.

## Cosa salvo in PostgreSQL

Ho portato su tabelle strutturate le aree principali dell'app:

- utenti e sessioni: `users`, `user_sessions`;
- profilo e obiettivi: `user_profiles`;
- ricette e salvataggi: `recipes`, `saved_recipes`;
- diario alimentare: `nutrition_meals`;
- spesa e dispensa: `grocery_items`, `pantry_items`;
- progressi giornalieri: `progress_logs`;
- modello target per i device: `device_providers`, `device_connections`, `device_connection_permissions`, `device_sync_runs`, `device_measurements`;
- cache prodotti: `openfoodfacts_products_cache`.

La tabella `device_connections` usa `is_mock DEFAULT FALSE`: quando lavoro con un provider simulato lo marco esplicitamente, invece di farlo diventare il comportamento implicito del sistema.

## Principi che sto seguendo

1. Tengo il dominio principale in tabelle relazionali con `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL` e `CHECK`.
2. Uso `JSONB` solo per payload esterni, metadata, cache e dettagli che possono cambiare forma.
3. Tengo separati dati applicativi, integrazioni device e cache esterne.
4. Mantengo una migrazione graduale: il backend può ancora lavorare in locale senza PostgreSQL, ma quando `NUTRITRACK_USE_POSTGRES=1` la persistenza strutturata diventa primaria.

## Bootstrap Docker/Mercurio

Nel percorso principale Docker/Mercurio non lancio manualmente lo script di bootstrap locale: PostgreSQL viene avviato dal servizio `db` di `docker-compose.yml` e le migrazioni in `migrations/` vengono montate in `/docker-entrypoint-initdb.d`.

Quando il volume PostgreSQL viene creato per la prima volta, Postgres applica automaticamente le migrazioni. Il container `app` esegue poi `npm run bootstrap:postgres-state` per inizializzare lo stato applicativo minimo.

Per ricreare il database Docker da zero:

```bash
docker compose down -v
docker compose up --build
```

## Bootstrap locale diretto

Questo percorso resta utile solo per sviluppo/debug senza Docker. Prima configuro `prototipo_backend/.env` partendo da `.env.example`, poi avvio PostgreSQL e lancio:

```bash
cd prototipo_backend
./database/bootstrap-local-postgres.sh
```

Per ricreare il database da zero:

```bash
RESET_DB=1 ./database/bootstrap-local-postgres.sh
```

Variabili utili per il bootstrap:

- `PSQL_BIN`
- `DB_NAME`
- `DB_USER`
- `DB_HOST`
- `DB_PORT`
- `RESET_DB=1`

## Configurazione backend

Valori minimi per usare PostgreSQL:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/nutritrack
NUTRITRACK_USE_POSTGRES=1
NUTRITRACK_BASE_PATH=/nutritrack
NUTRITRACK_APP_MODE=authenticated-user
NUTRITRACK_LOCAL_USER_EMAIL=app-local@nutritrack.local
```

Le modalità runtime sono due:

- `single-user-local`: sviluppo locale senza login, agganciato a un utente implicito definito da `NUTRITRACK_LOCAL_USER_EMAIL`;
- `authenticated-user`: login, registrazione, cookie di sessione e dati risolti per utente autenticato.

`NUTRITRACK_DEMO_USER_EMAIL` è ancora accettata come variabile legacy, ma nei nuovi riferimenti uso `NUTRITRACK_LOCAL_USER_EMAIL`.

## Persistenza attuale

Con PostgreSQL attivo, `GET /nutritrack/api/nutritrack/state` ricompone lo stato partendo dalle tabelle strutturate e restituisce anche metadata `storage`.

Le sezioni primarie coperte da PostgreSQL sono:

- `profile`
- `nutrition`
- `grocery`
- `progress`
- `recipes`
- `datasets`

Il file `prototipo_backend/data/nutritrack-state.json` non è più la fonte completa dell'app quando PostgreSQL è attivo. Lo uso per i blocchi residui di UI/cache o per la modalità `file_only`, in particolare:

- `recipes.generator`
- `recipes.currentRecipe`
- `recipes.chatMessages`
- `datasets.openFoodFacts.source`
- `devices.showPermissionsPanel`
- `grocery.ar`
- `progress.autoSnapshots`

## Device

Il modello SQL dei device è già pronto come destinazione strutturata, ma il provider `scale` usa ancora uno stato backend dedicato su file:

```text
prototipo_backend/data/scale-connection.json
```

Il frontend non legge direttamente quel file: passa sempre da `GET /nutritrack/api/devices/state` e dalle route `/nutritrack/api/scale/*`.

## Verifica minima

Dopo il bootstrap controllo:

1. `GET /nutritrack/api/database/status`
2. `GET /nutritrack/api/nutritrack/state`
3. `PUT /nutritrack/api/nutritrack/state` per un primo salvataggio/backfill
4. popolamento delle tabelle principali
5. `npm run verify:postgres-primary`

Lo script `verify:postgres-primary` verifica che:

- il database sia in modalità `postgres_primary`;
- `GET /nutritrack/api/nutritrack/state` abbia `primarySource=postgres_primary`;
- `profile`, `nutrition`, `grocery`, `progress`, `recipes` e `datasets` risultino coperte da PostgreSQL.

Per lo smoke test locale senza PostgreSQL uso:

```bash
npm run verify:runtime-smoke
```

Questo controllo avvia un backend isolato in `file_only`, legge stato e device, registra una misura bilancia lato client e verifica un round-trip di salvataggio dello stato.
