# Demo-off roadmap

Questa roadmap traduce i segnali ancora "demo" del progetto in un piano operativo breve, con priorita tecniche chiare e criteri di uscita verificabili.

## Obiettivo

Portare NutriTrack da prototipo ibrido a baseline applicativa piu solida, riducendo:

- dipendenza dal blob JSON come fonte primaria
- uso di utente demo implicito nel backend
- integrazioni device simulate o salvate solo su file
- naming e documentazione che presentano ancora l'app come demo

## Milestone 1 - Togliere i marker demo dal backend

### Obiettivo

Rimuovere i placeholder che rendono il backend esplicitamente temporaneo anche quando il database e attivo.

### Task

1. Sostituire `NUTRITRACK_DEMO_USER_EMAIL` con un concetto di utente corrente piu neutro.
2. Eliminare la logica `ensureDemoUser(...)` come meccanismo implicito globale.
3. Rinominare `prototype-local-only` e altri placeholder tecnici che finiscono nel database.
4. Chiarire nel codice quando siamo in `development seed`, `single-user local mode` o `real user mode`.

### File coinvolti

- `prototipo_backend/nutritrack-state/nutritrack-state-postgres-store.js`
- `prototipo_backend/.env.example`
- `prototipo_backend/database/README.md`

### Criterio di uscita

Il backend puo scrivere su Postgres senza dipendere da un utente demo nominato esplicitamente.

## Milestone 2 - Rendere Postgres la fonte primaria

### Obiettivo

Chiudere la transizione ibrida in modo che il JSON non sia piu la sorgente principale dell'app.

### Task

1. Introdurre lettura da Postgres per `profile`, `nutrition`, `grocery`, `pantry` e `progress`.
2. Mantenere il file JSON solo come fallback temporaneo o strumento di migrazione.
3. Ridurre e poi rimuovere le modalita `file_only` e `hybrid_mirror`.
4. Aggiungere una migrazione iniziale dei dati dal file esistente verso Postgres.

### File coinvolti

- `prototipo_backend/nutritrack-state/nutritrack-state-repository.js`
- `prototipo_backend/nutritrack-state/nutritrack-state-postgres-store.js`
- `prototipo_backend/data/nutritrack-state.json`

### Criterio di uscita

`GET /api/nutritrack/state` legge da Postgres per le sezioni strutturate principali e il frontend non dipende piu dal blob JSON per il normale funzionamento.

## Milestone 3 - Portare i device fuori dalla modalita mock

### Obiettivo

Separare chiaramente le integrazioni reali da quelle simulate.

### Task

1. Mantenere un layer provider backend esplicito per ogni integrazione device.
2. Decidere quali provider restano simulatori di sviluppo e quali diventano integrazioni reali.
3. Scegliere se il primo passaggio a persistenza strutturata riguarda `strava`, `scale` o entrambi.
4. Se si passa a Postgres, salvare connessione, permessi, errori, sync runs e measurements nel layer device dedicato.

### File coinvolti

- `prototipo_backend/strava.js`
- `prototipo_backend/scale.js`
- `prototipo_backend/scale-provider-mock.js`
- `frontend/scripts/devices.js`
- `prototipo_backend/database/migrations/*.sql`

### Criterio di uscita

Almeno un provider device usa persistenza strutturata oppure il layer provider backend e pronto a sostituire il mock senza cambiare le route pubbliche. Il modello dati non deve piu assumere che `is_mock` sia il default di sistema.

## Milestone 4 - Consolidare OpenFoodFacts

### Obiettivo

Portare la strategia dati OpenFoodFacts da transizione dichiarata a flusso backend stabile.

### Task

1. Usare davvero `openfoodfacts_products_cache` come cache applicativa.
2. Centralizzare nel backend la strategia `API live -> cache -> dataset locale`.
3. Ridurre i metadati transitori esposti nel default state frontend.
4. Preparare il cache layer per supportare meglio il retrieval della chat nutrizionale.

### File coinvolti

- `prototipo_backend/openfoodfacts.js`
- `frontend/scripts/data-config.js`
- `prototipo_backend/database/migrations/001_postgres_base.sql`

### Criterio di uscita

Il frontend non espone piu una strategia "now/next" come parte del suo stato base, e il backend gestisce cache e fallback in modo trasparente.

## Milestone 5 - Ripulire naming, docs e test minimi

### Obiettivo

Allineare comunicazione e affidabilita tecnica alla nuova baseline.

### Task

1. Rimuovere da README e documentazione i riferimenti che presentano l'app come solo prototipo, dove non servono piu.
2. Valutare rinomina di `prototipo_backend` e del package backend.
3. Aggiungere smoke test minimi per stato app, database status, OpenFoodFacts e sync device.
4. Documentare una modalita locale chiara: sviluppo, bootstrap DB, seed e verifica.

### File coinvolti

- `README.md`
- `prototipo_backend/package.json`
- `prototipo_backend/database/README.md`
- futura cartella test backend

### Criterio di uscita

La repo si presenta come applicazione in sviluppo strutturato, non come demo fragile.

## Ordine consigliato

1. Milestone 1
2. Milestone 2
3. Milestone 3
4. Milestone 4
5. Milestone 5

## Primo sprint consigliato

Se vogliamo massimizzare impatto e ridurre rischio, il primo sprint dovrebbe coprire:

1. rimozione utente demo implicito
2. lettura Postgres per `profile` e `progress`
3. smoke test base su `GET /api/database/status` e `GET/PUT /api/nutritrack/state`

Questo e il punto in cui l'app inizia davvero a smettere di sembrare una demo anche dal comportamento, non solo dal naming.
