# NutriTrack

Repository di NutriTrack, organizzata tra interfaccia web, backend e documentazione.

## Struttura

- `frontend/`: interfaccia web statica dell'app
- `prototipo_backend/`: backend locale, integrazioni AI/OpenFoodFacts e persistenza stato
- `docs/`: materiali di supporto e documentazione progetto

## Database

Postgres e la base dati di riferimento del progetto.

Punti di ingresso:

- schema/migrazione canonica: [`prototipo_backend/database/migrations/001_postgres_base.sql`](./prototipo_backend/database/migrations/001_postgres_base.sql)
- guida database: [`prototipo_backend/database/README.md`](./prototipo_backend/database/README.md)
- architettura dati: [`docs/postgres-data-architecture.md`](./docs/postgres-data-architecture.md)
- roadmap uscita dalla modalita demo: [`docs/demo-off-roadmap.md`](./docs/demo-off-roadmap.md)
- variabili ambiente di esempio: [`prototipo_backend/.env.example`](./prototipo_backend/.env.example)

## Avvio

- `cd prototipo_backend`
- `node server.js`

Per la modalita mobile:

- `cd prototipo_backend`
- `node start-mobile.js`
