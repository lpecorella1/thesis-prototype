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

## Ordine di bootstrap

1. creare il database locale
2. applicare `migrations/001_postgres_base.sql`
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
- `NUTRITRACK_DEMO_USER_EMAIL=demo@nutritrack.local`

## Verifica minima consigliata

Dopo il bootstrap:

1. avviare il backend
2. chiamare `GET /api/database/status`
3. eseguire un salvataggio su `PUT /api/nutritrack/state`
4. controllare che il mirror popoli:
   - `user_profiles`
   - `nutrition_meals`
   - `grocery_items`
   - `pantry_items`
   - `progress_logs`
