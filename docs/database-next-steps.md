# Database next steps

Questa nota accompagna lo schema SQL del prototipo e fissa il primo passo della migrazione dal file JSON a una persistenza relazionale piu robusta.

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
- `devices.integrations.*` -> `device_connections`
- dati importati da sync device -> `device_sync_runs`, `device_measurements`

### Persistenza da chiarire o secondaria

- `recipes.currentRecipe`, `recipes.history`, `recipes.generatedRecipesById`
- `recipes.chatMessages`
- `datasets.openFoodFacts.productsByBarcode`
- `progress.autoSnapshots`

Questi blocchi non vanno forzati subito nel cuore del modello relazionale: alcuni sono cache, altri sono dati derivati, altri ancora sono conversazione o supporto UX.

## Prossimo passo consigliato

Step 2: introdurre un repository Postgres parallelo al file store, iniziando da:

1. `user_profiles`
2. `nutrition_meals`
3. `grocery_items`
4. `pantry_items`
5. `progress_logs`

Solo dopo conviene spostare i devices dalla simulazione frontend a un flusso backend con stato reale di connessione e sync.

## Stato attuale del passo 2

Il backend ora puo lavorare in modalita ibrida:

- continua a salvare il blob JSON per non rompere il prototipo
- puo fare il mirror delle sezioni strutturate su Postgres se attivi `NUTRITRACK_USE_POSTGRES=1`
- usa `DATABASE_URL` per la connessione
- espone `GET /api/database/status` per capire se sta lavorando in `file_only` o `hybrid_mirror`

Il mirror Postgres attuale copre:

- `profile` -> `user_profiles`
- `nutrition.meals` -> `nutrition_meals`
- `grocery.items` -> `grocery_items`
- `grocery.pantry` -> `pantry_items`
- `progress.dailyLogs` -> `progress_logs`

Per ora la lettura completa dell'app continua a passare dal file JSON: e voluto, per rendere la transizione graduale e piu facile da verificare.
