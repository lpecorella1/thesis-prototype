# NutriTrack

Applicazione web per gestire alimentazione, dispensa, spesa, ricette e progressi nutrizionali in un unico flusso. Il progetto nasce come prototipo tesi; il percorso operativo principale è il deploy Docker su server con PostgreSQL e autenticazione, mentre l'avvio locale diretto resta disponibile come fallback di sviluppo/debug.

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

## Avvio su server/Docker

Questo è il percorso raccomandato per test, demo e uso su Mercurio. Dal root del progetto avvio app e PostgreSQL insieme:

```bash
cp .env.docker.example .env
docker compose up --build
```

Su Mercurio l'app viene pubblicata sotto:

```text
https://mercurio.isti.cnr.it/nutritrack
```

In locale con Docker apro invece:

```text
http://localhost:3000/nutritrack
```

Il `docker-compose.yml` crea due servizi:

- `app`: backend Node.js che serve anche il frontend statico;
- `db`: PostgreSQL con le migrazioni montate in `/docker-entrypoint-initdb.d`.

Le porte pubblicate da Compose sono vincolate a `127.0.0.1`, quindi app e database non vengono esposti direttamente su tutte le interfacce di rete del server. Nel container `app`, Node ascolta comunque su `0.0.0.0` per restare raggiungibile dal port mapping Docker; l'esposizione verso l'host resta limitata dal binding `127.0.0.1:${NUTRITRACK_PORT:-3000}:3000`.

Il base path applicativo predefinito è:

```env
NUTRITRACK_BASE_PATH=/nutritrack
```

All'avvio del container `app`, lo script `npm run bootstrap:postgres-state` inizializza lo stato minimo in PostgreSQL se le tabelle sono ancora vuote.

Le migrazioni vengono applicate automaticamente quando il volume PostgreSQL viene creato per la prima volta. Se devo ricreare il database da zero:

```bash
docker compose down -v
docker compose up --build
```

Per usare Azure OpenAI nel container compilo le variabili `AZURE_OPENAI_*` nel file `.env` creato da `.env.docker.example`.

## Avvio locale diretto

Questo percorso resta disponibile solo per sviluppo rapido o debug quando non voglio passare da Docker/Mercurio:

```bash
cd prototipo_backend
cp .env.example .env
npm install
npm start
```

Poi apro l'app su:

```text
http://localhost:3000/nutritrack
```

Per provarla da telefono sulla stessa rete uso:

```bash
npm run start:mobile
```

Lo script mobile avvia HTTPS locale e rigenera il certificato se l'IP della rete cambia.

## Configurazione

I file di esempio hanno ruoli diversi:

- `.env.docker.example`: riferimento principale per Docker/Mercurio, copiato in `.env` nella root;
- `prototipo_backend/.env.example`: fallback per avvio locale diretto con `npm start`, copiato in `prototipo_backend/.env`.

Le più importanti sono:

- `NUTRITRACK_APP_MODE=authenticated-user|single-user-local`
- `NUTRITRACK_BASE_PATH=/nutritrack`
- `NUTRITRACK_USE_POSTGRES=0|1`
- `DATABASE_URL=postgresql://...`
- `NUTRITRACK_LOCAL_USER_EMAIL=app-local@nutritrack.local`
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- `SCALE_PROVIDER=mock`

Uso `authenticated-user` su Mercurio/Docker quando voglio provare registrazione, login, cookie di sessione e persistenza per utente su PostgreSQL. Tengo `single-user-local` solo per sviluppo locale rapido senza login.

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

## Recipes Assistant

La sezione Recipes mantiene il frontend leggero: l'interfaccia raccoglie input, mostra risultati, gestisce cronologia/UI state e invia le azioni al backend. La logica di dominio resta invece lato server, dove il backend costruisce il contesto NutriTrack reale e dialoga con Azure OpenAI.

Il contesto usato dall'assistente include profilo e obiettivi, preferenze alimentari, dispensa e alimenti in scadenza, lista della spesa, pasti recenti, progressi, ricetta corrente e record OpenFoodFacts disponibili nello stato.

Le route principali sono:

- `POST /nutritrack/api/recipes/generate`: genera una ricetta usando filtri e contesto backend;
- `POST /nutritrack/api/recipes/assistant/chat`: gestisce la chat Recipes con classificazione minima dell'intento;
- `POST /nutritrack/api/recipes/apply-to-diet`: applica una ricetta alla giornata alimentare e aggiorna lo stato;
- `POST /nutritrack/api/chat`: resta disponibile come chat generale, usando comunque il contesto NutriTrack costruito lato server.

La chat riconosce già intenti come applicare la ricetta corrente alla dieta, chiedere una lista della spesa, generare o modificare una ricetta, usare ingredienti disponibili e proseguire una conversazione generica. Per ora solo l'applicazione della ricetta corrente produce un'azione strutturata immediata; gli altri intenti passano ancora dalla risposta conversazionale di Azure OpenAI.

Le prossime parti da consolidare sono una route più coerente per la generazione dell'assistente, ad esempio `POST /nutritrack/api/recipes/assistant/generate`, una route dedicata per la lista della spesa generata dall'assistente, il matching ingredienti-dispensa lato backend, il salvataggio esplicito delle decisioni che modificano dieta o dispensa e la riduzione dei fallback locali rimasti nel frontend.

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
- [`docs/prototype_markdown.md`](./docs/prototype_markdown.md): bozza testuale collegata alla tesi.
