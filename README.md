# NutriTrack

Applicazione web per gestire alimentazione, dispensa, spesa, ricette e progressi nutrizionali in un unico flusso. Il progetto nasce come prototipo tesi, la parte applicativa è organizzata come base locale strutturata: frontend statico, backend Node.js, persistenza PostgreSQL opzionale e integrazioni AI.

## Cosa contiene

- `frontend/`: interfaccia web dell'applicazione.
- `prototipo_backend/`: backend Node.js, API locali, autenticazione, integrazione Azure OpenAI, OpenFoodFacts, stato NutriTrack e provider device.
- `prototipo_backend/database/`: schema PostgreSQL, migrazioni e bootstrap locale.
- `docs/`: documentazione tecnica e bozza testuale collegata alla tesi.

Il nome `prototipo_backend` è ancora storico: per ora lo mantengo per non rompere percorsi, script e riferimenti interni.

## Funzionalità principali

- profilo utente, obiettivi nutrizionali e preferenze alimentari;
- diario alimentare, dispensa, lista della spesa e progressi giornalieri;
- generazione ricette e chat assistant con contesto costruito dal backend;
- applicazione di una ricetta alla dieta con aggiornamento dello stato;
- ricerca prodotto tramite OpenFoodFacts;
- modalità locale single-user e modalità autenticata con sessioni;
- provider bilancia `scale` con stato backend e misurazioni lato client;
- persistenza su file per sviluppo rapido oppure PostgreSQL come sorgente primaria strutturata.

## Avvio locale

```bash
cd prototipo_backend
cp .env.example .env
npm install
npm start
```

Poi apro l'app su:

```text
http://localhost:3000
```

Per provarla da telefono sulla stessa rete uso:

```bash
npm run start:mobile
```

Lo script mobile avvia HTTPS locale e rigenera il certificato se l'IP della rete cambia.

## Configurazione

Le variabili di riferimento sono in `prototipo_backend/.env.example`.

Le più importanti sono:

- `NUTRITRACK_APP_MODE=single-user-local|authenticated-user`
- `NUTRITRACK_USE_POSTGRES=0|1`
- `DATABASE_URL=postgresql://...`
- `NUTRITRACK_LOCAL_USER_EMAIL=app-local@nutritrack.local`
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- `SCALE_PROVIDER=mock`

Uso `single-user-local` quando voglio lavorare velocemente senza login. Uso `authenticated-user` quando voglio provare registrazione, login, cookie di sessione e persistenza per utente su PostgreSQL.

## Database

Per inizializzare PostgreSQL in locale:

```bash
cd prototipo_backend
./database/bootstrap-local-postgres.sh
```

Se voglio ricreare il database da zero durante il bootstrap:

```bash
RESET_DB=1 ./database/bootstrap-local-postgres.sh
```

La guida completa è in [`prototipo_backend/database/README.md`](./prototipo_backend/database/README.md). Le scelte di modello dati sono riassunte in [`docs/postgres-data-architecture.md`](./docs/postgres-data-architecture.md).

## Verifiche

Smoke test locale senza PostgreSQL:

```bash
cd prototipo_backend
npm run verify:runtime-smoke
```

Verifica della modalità PostgreSQL primaria su un backend già avviato:

```bash
npm run verify:postgres-primary
```

Se il backend gira su un endpoint diverso:

```bash
NUTRITRACK_BASE_URL=http://127.0.0.1:3000 npm run verify:postgres-primary
```

## Documentazione utile

- [`prototipo_backend/database/README.md`](./prototipo_backend/database/README.md): setup, persistenza e verifiche database.
- [`docs/postgres-data-architecture.md`](./docs/postgres-data-architecture.md): motivazioni dell'architettura dati.
- [`docs/recipes-assistant.md`](./docs/recipes-assistant.md): stato attuale della sezione Recipes e cosa resta da consolidare.
- [`docs/prototype_markdown.md`](./docs/prototype_markdown.md): bozza testuale collegata alla tesi.
