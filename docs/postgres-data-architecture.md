# Architettura dati PostgreSQL

Ho scelto PostgreSQL per togliere lo stato principale dell'app da un unico blob JSON e portarlo dentro un modello più controllabile. L'obiettivo non è rendere tutto rigido subito, ma avere una base dati che mi permetta di crescere senza perdere coerenza tra profilo, dieta, dispensa, ricette e progressi.

## Principi

### Core relazionale

Per i dati centrali uso tabelle relazionali e vincoli espliciti. In questo modo controllo a livello database relazioni, unicità, valori obbligatori e limiti numerici, invece di affidare tutta la consistenza al codice del backend.

Le aree core sono:

- `users`
- `user_sessions`
- `user_profiles`
- `recipes`
- `saved_recipes`
- `nutrition_meals`
- `grocery_items`
- `pantry_items`
- `progress_logs`

### JSONB solo dove serve flessibilità

Uso `JSONB` per payload esterni, metadata e cache perché lì la struttura può cambiare più facilmente. Non lo uso come scorciatoia per evitare di modellare il dominio principale.

I casi principali sono:

- `recipes.recipe_payload`
- `device_connections.metadata`
- `device_sync_runs.payload_summary`
- `device_measurements.source_payload`
- `openfoodfacts_products_cache.nutriments`
- `openfoodfacts_products_cache.source_payload`

### Device come osservazioni

Per i device non mi basta sapere se una sorgente è collegata. Voglio distinguere:

- provider configurato;
- stato della connessione;
- permessi concessi;
- tentativi di sincronizzazione;
- misurazioni importate o registrate;
- payload originale, quando serve per audit o debug.

Il modello è ispirato al modo in cui HL7 FHIR separa `Device` e `Observation`: non sto implementando FHIR completo, ma mantengo la stessa attenzione a provenienza, timestamp e tracciabilità della misura.

## Stato runtime attuale

Oggi PostgreSQL è già la sorgente primaria per:

- profilo;
- pasti;
- lista della spesa;
- dispensa;
- progressi;
- ricette salvate e generate;
- metadati dataset.

Il file JSON legacy resta solo per blocchi residui di UI/cache quando PostgreSQL è attivo. In modalità `file_only`, invece, resta utile per lavorare localmente senza database.

Il layer device è a metà strada in modo intenzionale: lo schema SQL è pronto, ma il provider `scale` usa ancora un file dedicato lato backend. Così posso stabilizzare l'interfaccia pubblica (`GET /api/devices/state` e `/api/scale/*`) prima di spostare anche quel provider sulle tabelle device.

## Perché questa scelta è più solida

- riduco il rischio di stati incoerenti nel JSON;
- posso interrogare e indicizzare i dati importanti;
- separo dati utente, cache esterne e integrazioni;
- preparo la modalità autenticata senza cambiare il modello dati ogni volta;
- mantengo comunque una modalità locale leggera per sviluppo e demo.

## Fonti tecniche

- PostgreSQL, constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL, JSON types: https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL, `CREATE TYPE`: https://www.postgresql.org/docs/current/sql-createtype.html
- HL7 FHIR Observation: https://www.hl7.org/fhir/observation.html
- HL7 FHIR Device: https://www.hl7.org/fhir/device.html
