# Postgres data architecture

Questa nota riassume come stiamo impostando il database del progetto usando Postgres come base primaria, con una struttura adatta a crescere senza diventare fragile.

## Principi adottati

### 1. Il core applicativo resta relazionale

Per utenti, profili, pasti, grocery, pantry, progressi e ricette usiamo tabelle relazionali con vincoli espliciti. La motivazione e allineata alla documentazione ufficiale PostgreSQL: `CHECK`, `NOT NULL`, `UNIQUE`, `PRIMARY KEY` e `FOREIGN KEY` servono proprio a impedire stati inconsistenti del dato e sono preferibili a controlli sparsi solo nel codice applicativo.

### 2. JSONB solo dove la struttura e davvero variabile

Per payload di provider esterni, metadata di sync e cache OpenFoodFacts usiamo `JSONB`, non colonne testuali generiche. La documentazione PostgreSQL dice che, in generale, la maggior parte delle applicazioni dovrebbe preferire `jsonb` a `json`, perche e piu efficiente da processare e indicizzare.

### 3. Device data modellati come osservazioni

Per i device non salviamo solo "connesso / non connesso". Ci servono almeno:

- il provider collegato
- lo stato della connessione
- i permessi concessi
- i singoli tentativi di sync
- i dati misurati con timestamp

Questa scelta e coerente con la logica del modello HL7 FHIR:

- `Observation` descrive misurazioni e semplici osservazioni su paziente o device
- `Observation.device` collega la misura al device che l'ha generata
- `Device` rappresenta l'istanza del dispositivo o della sorgente che produce il dato

Non stiamo implementando FHIR completo nel database, ma usiamo quella struttura concettuale per non perdere provenienza, temporalita e auditabilita.

## Scelte di schema

### Core tables

- `users`
- `user_profiles`
- `recipes`
- `nutrition_meals`
- `grocery_items`
- `pantry_items`
- `progress_logs`
- `saved_recipes`

### Device layer

- `device_providers`
- `device_connections`
- `device_connection_permissions`
- `device_sync_runs`
- `device_measurements`

### External knowledge / cache

- `openfoodfacts_products_cache`

## Perche questa organizzazione e piu robusta

- evita blob JSON unici come fonte di verita per tutto
- mantiene i dati queryable e indicizzabili
- separa chiaramente dominio, integrazioni e cache
- rende piu semplice capire se un'integrazione funziona davvero oppure no
- permette una migrazione graduale del backend, ma con una base dati gia corretta

## Fonti

- PostgreSQL docs, constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL docs, JSON types: https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL docs, CREATE TYPE: https://www.postgresql.org/docs/current/sql-createtype.html
- HL7 FHIR Observation: https://www.hl7.org/fhir/observation.html
- HL7 FHIR Device: https://www.hl7.org/fhir/device.html
