# Database next steps

Questa nota accompagna lo schema SQL corrente e fissa i prossimi passi della migrazione dal file JSON a una persistenza relazionale piu robusta.

## Step 1 completato

Lo schema in `prototipo_backend/database/nutritrack-schema.sql` ora copre anche:

- `progress_logs`: storico giornaliero utente per peso, acqua, passi, calorie bruciate, sonno e note.
- `device_connections`: stato della connessione verso provider esterni o simulati.
- `device_sync_runs`: audit dei tentativi di sincronizzazione.
- `device_measurements`: dati importati dai device con timestamp e riferimento al sync.

## Mappatura stato frontend -> persistenza

### Persistenza relazionale diretta

- `profile.personal`, `profile.medical`, `profile.goals` -> `users`, `user_profiles`
- `nutrition.meals` -> `nutrition_meals`
- `grocery.items` -> `grocery_items`
- `grocery.pantry` -> `pantry_items`
- `recipes.savedRecipeIds` -> `saved_recipes`
- `progress.dailyLogs` -> `progress_logs`

### Persistenza da chiarire o secondaria

- `recipes.currentRecipe`
- `recipes.chatMessages`
- `datasets.openFoodFacts.source`
- `progress.autoSnapshots`
- `devices.showPermissionsPanel`

### Persistenza attiva device oggi

Il modello SQL per i device esiste gia, ma non e ancora la persistenza runtime usata dai provider correnti.

Stato attuale:

- `scale` -> file provider dedicato `prototipo_backend/data/scale-connection.json`
- `GET /api/devices/state` ricompone lo stato leggendo provider backend + preferenze legacy UI

Quindi:

- `device_connections`, `device_sync_runs` e `device_measurements` sono tabelle target del modello finale
- non sono ancora la fonte di verita attiva per `scale`

Questi blocchi non vanno forzati subito nel cuore del modello relazionale: alcuni sono cache, altri sono dati derivati, altri ancora sono conversazione o supporto UX.

## Step 2 completato in parte

Il repository Postgres parallelo al file store e stato introdotto per:

1. `user_profiles`
2. `nutrition_meals`
3. `grocery_items`
4. `pantry_items`
5. `progress_logs`

I devices sono gia usciti dalla simulazione frontend pura, ma non sono ancora passati alle tabelle device di Postgres.

## Stato attuale del passo 2

Il backend ora puo lavorare in modalita ibrida:

- con Postgres attivo, scrive prima sulle tabelle strutturate
- usa un profilo locale single-user lato backend finche l'autenticazione non e implementata
- puo fare il mirror delle sezioni strutturate su Postgres se attivi `NUTRITRACK_USE_POSTGRES=1`
- usa `DATABASE_URL` per la connessione
- espone `GET /api/database/status` per capire se sta lavorando in `file_only` o `postgres_primary`
- espone `GET /api/nutritrack/state` con metadati `storage`, cosi e visibile quando `profile`, `nutrition`, `grocery`, `progress`, `recipes` e `datasets` arrivano primariamente da Postgres e quando la copertura strutturata e completa
- include uno smoke check `npm run verify:postgres-primary` per verificare quando il fallback legacy puo essere disattivato
- espone `GET /api/devices/state` con metadati propri per separare:
  - provider backend attivi
  - sorgente dello stato integrazioni
  - sorgente dello stato UI legacy residuo

Con Postgres attivo, il file JSON legacy non conserva piu lo stato completo dell'app: conserva solo i blocchi non ancora migrati, cioe UI state, cache e supporto UX.

Il mirror Postgres attuale copre:

- `profile` -> `user_profiles`
- `nutrition.meals` -> `nutrition_meals`
- `grocery.items` -> `grocery_items`
- `grocery.pantry` -> `pantry_items`
- `progress.dailyLogs` -> `progress_logs`

Il file JSON legacy oggi conserva:

- `recipes.generator`
- `recipes.currentRecipe`
- `recipes.chatMessages`
- `datasets.openFoodFacts.source`
- `devices.showPermissionsPanel`
- `grocery.ar`
- `progress.autoSnapshots`

## Prossimo passo consigliato

Step 3: decidere la strategia finale del layer device:

1. mantenere provider file-based fino all'arrivo dei provider reali
2. oppure iniziare il passaggio di `scale` verso:
   - `device_connections`
   - `device_connection_permissions`
   - `device_sync_runs`
   - `device_measurements`
