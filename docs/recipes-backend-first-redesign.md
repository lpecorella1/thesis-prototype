# Recipes Backend-First Redesign

## Obiettivo

Portare Recipes da una sezione con logica locale mista a una sezione frontend thin-client, dove:

- il frontend raccoglie input, visualizza output e mantiene solo stato UI;
- il backend costruisce il contesto reale dell'app;
- l'assistente Recipes gestisce intenti multipli, non solo la generazione di una singola ricetta;
- template, ranking e fallback locali diventano debito tecnico esplicito da rimuovere.

## Stato attuale: cosa fa oggi `frontend/scripts/recipes.js`

### 1. Stato UI e recupero ricette

Da tenere nel frontend:

- `renderRecipeResult`
- `renderRecipeHistory`
- `renderSavedRecipes`
- `renderRecipeChat`
- `renderRecipes`
- `setupRecipeGeneratorForm`
- `setupRecipeResultActions`
- `setupRecipeHistoryActions`
- `setupSavedRecipeActions`
- `setupRecipeChat`
- `setupRecipesSection`
- `setRecipeGeneratorPendingState`
- `setRecipeChatPendingState`
- `setRecipeFeedback`
- `appendRecipeChatMessage`

Questa parte e coerente con il target: e UI orchestration, non intelligence di dominio.

### 2. Persistenza e cache locale

Da mantenere temporaneamente, ma da ridurre a dati UI/client cache:

- `ensureGeneratedRecipeStore`
- `registerRecipe`
- `saveRecipeToHistory`
- `getRecipeById`
- `restoreRecipeFromCollection`
- `setCurrentRecipeWithContext`

Nota: oggi queste funzioni mescolano cache UI e arricchimento dominio, perche aggiungono `pantryMatches`, `pantryNote` e `personalNote` lato client. Nel target queste note devono arrivare dal backend gia calcolate.

### 3. Costruzione contesto AI lato client

Da spostare dietro backend:

- `getRecipeGenerationContext`
- `buildRecipeChatContext`
- `getRecipeChatOpenFoodFactsKnowledge`

Motivo:

- il client oggi passa solo una vista parziale dello stato reale;
- il backend ha gia accesso allo snapshot NutriTrack via repository;
- il contesto deve essere composto server-side, in modo consistente tra generate recipe, shopping list e assistant chat.

### 4. Heuristics e matching locale

Da dismettere:

- `normalizeComparableText`
- `getComparableTokens`
- `findMatchingRecipeIngredient`
- `getRecipePantryMatches`
- `getPantryMatchesForRecipe`
- `parseQuantityLabel`
- `decreasePantryItemQuantity`
- `buildPantryUsageFeedback`

Motivo:

- sono heuristics locali che fanno inferenza su ingredienti sporchi;
- duplicano responsabilita di normalizzazione che devono esistere nel backend;
- impediscono consistenza tra dispensa, grocery, meal log e ricette applicate.

### 5. Integrazione ricetta -> dieta/dispensa

Da dividere:

Da tenere nel frontend solo come wiring UI:

- `applyRecipeToNutrition`
- `getSuggestedMealTime`

Da spostare backend:

- `consumePantryForRecipe`
- logica di match ingredienti/dispensa
- logica di decremento quantita
- eventuale `apply_recipe_to_diet`

Motivo:

- oggi applicare una ricetta modifica dieta e dispensa tramite regole locali deboli;
- nel target serve un'azione backend atomica che sappia cosa e stato usato e con quale confidenza.

### 6. Chat assistant locale

Da rimuovere o confinare a fallback temporaneo:

- `buildRecipeAssistantReply`
- `getRecipeChatAction`
- `executeRecipeChatAction`

Motivo:

- oggi la chat ha una mini-classificazione hardcoded;
- il fallback locale produce risposte euristiche non allineate allo stato completo;
- le action devono nascere dalla classificazione backend dell'intento.

### 7. Rendering markdown chat

Da tenere nel frontend:

- `formatInlineMarkdown`
- `renderMarkdownBlock`
- `renderChatMarkdown`

Questa parte e presentazione, non dominio.

## Dipendenze attuali fuori da `recipes.js`

### `frontend/scripts/data-config.js`

Da considerare debito da dismissione per Recipes:

- `recipeLibrary`
- `RECIPE_TOKEN_STOPWORDS`
- `RECIPE_GENERIC_TOKENS`

`recipeLibrary` puo restare solo come fallback controllato in fase transitoria. Non deve piu essere la base primaria dell'esperienza Recipes.

### `frontend/scripts/state.js`

Da mantenere, ma con possibile ridefinizione del shape `appState.recipes`:

- cronologia UI
- ricette salvate
- chat messages
- current recipe

Da evitare in futuro dentro `appState.recipes`:

- metadati derivati localmente da matching dispensa;
- knowledge base OpenFoodFacts preparata lato client.

### `prototipo_backend/server.js`

Gia presenti:

- `POST /api/recipes/generate`
- `POST /api/chat`
- `GET/PUT /api/nutritrack/state`

Problema attuale:

- `POST /api/recipes/generate` riceve `filters + context` dal frontend, ma il backend non costruisce autonomamente il contesto;
- `POST /api/chat` e shared/generico, non Recipes-specifico, e accetta ancora contesto preparato dal client;
- la normalizzazione della ricetta esiste lato backend, ma la composizione del contesto no.

## Architettura target

### Frontend Recipes

Responsabilita target:

- raccogliere input utente;
- inviare richieste tipizzate al backend;
- visualizzare ricette, liste spesa, messaggi assistant;
- mantenere stato UI e cronologia conversazionale;
- aprire eventualmente una recipe salvata o un risultato precedente.

Non deve piu:

- inventare ricette;
- classificare intenti in modo hardcoded;
- fare matching ingredienti con heuristics locali;
- consumare dispensa localmente;
- costruire knowledge base AI dal dataset client.

### Backend Recipes Assistant

Responsabilita target:

- leggere snapshot reale dell'app;
- costruire contesto strutturato e normalizzato;
- classificare l'intento della richiesta;
- orchestrare risposta conversationale, generazione ricetta o shopping list;
- produrre output strutturati e spiegabili.

## Contratto backend proposto

### 1. `POST /api/recipes/assistant/generate`

Sostituisce l'attuale `POST /api/recipes/generate`.

Request minima:

```json
{
  "input": {
    "mealType": "lunch",
    "dietType": "balanced",
    "caloriesTarget": 650,
    "prompt": "voglio usare ingredienti in scadenza"
  },
  "options": {
    "preferPantry": true,
    "excludeRecentlyUsed": true
  }
}
```

Responsabilita backend:

- legge stato reale da repository;
- costruisce `assistantContext.recipes`;
- chiama il modello;
- restituisce ricetta gia arricchita.

Response minima:

```json
{
  "recipe": {
    "id": "recipe_123",
    "title": "Chicken rice bowl",
    "description": "....",
    "ingredients": ["..."],
    "instructions": ["..."],
    "nutrition": {
      "calories": 650,
      "protein": 42,
      "carbs": 58,
      "fats": 18
    },
    "pantryMatches": [
      {
        "pantryItemId": "pantry_1",
        "displayName": "Riso integrale",
        "matchType": "exact"
      }
    ],
    "missingIngredients": [
      {
        "displayName": "Spinaci",
        "normalizedName": "spinaci"
      }
    ],
    "criteriaNote": "..."
  },
  "meta": {
    "source": "assistant-backend",
    "generatedAt": "2026-07-15T00:00:00.000Z"
  }
}
```

### 2. `POST /api/recipes/assistant/chat`

Sostituisce per Recipes l'uso diretto di `POST /api/chat`.

Request minima:

```json
{
  "message": "cosa posso cucinare con quello che ho in dispensa?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "currentRecipeId": "recipe_123"
}
```

Responsabilita backend:

- classifica l'intento;
- costruisce contesto reale;
- decide se rispondere in testo o invocare una capability strutturata.

Response minima:

```json
{
  "intent": "use_available_ingredients",
  "reply": "Puoi partire da...",
  "action": null
}
```

Oppure:

```json
{
  "intent": "generate_recipe",
  "reply": "Ti propongo questa ricetta.",
  "action": {
    "type": "recipe_generated",
    "recipe": {}
  }
}
```

### 3. `POST /api/recipes/assistant/shopping-list`

Nuova action dedicata.

Request minima:

```json
{
  "source": {
    "recipeId": "recipe_123"
  },
  "options": {
    "excludePantryItems": true,
    "groupByCategory": true
  }
}
```

Response minima:

```json
{
  "shoppingList": {
    "items": [
      {
        "displayName": "Spinaci",
        "normalizedName": "spinaci",
        "quantity": "150 g",
        "category": "Verdure"
      }
    ]
  }
}
```

### 4. `POST /api/recipes/assistant/apply-to-diet`

Da introdurre dopo generate/chat.

Responsabilita:

- crea meal log;
- marca ingredienti consumati con match backend;
- restituisce il risultato come singola operazione coerente.

## Modello di contesto backend da costruire

Il backend deve comporre un `recipesAssistantContext` unico, riusabile da tutte le action.

Shape proposta:

```json
{
  "userProfile": {
    "dietType": "balanced",
    "activityLevel": "moderate",
    "goals": {
      "calories": 2000,
      "protein": 150,
      "carbs": 250,
      "fats": 65
    },
    "medical": {
      "allergies": "...",
      "medicalConditions": "..."
    }
  },
  "pantry": [],
  "groceryItems": [],
  "openFoodFactsProducts": [],
  "recentMeals": [],
  "recentRecipes": [],
  "constraints": {
    "avoidRecentlyUsedIngredients": true
  }
}
```

## Normalizzazione necessaria

Blocco critico da introdurre nel backend prima di scalare l'assistente:

- canonicalizzazione nomi ingrediente/prodotto;
- deduplica tra pantry, grocery e meal log;
- mapping prodotto -> ingrediente usabile dal modello;
- distinzione tra nome display e nome normalizzato;
- match con confidenza, non booleani impliciti.

Proposta minima:

- creare un modulo backend tipo `recipes-assistant-context.js`;
- creare un modulo backend tipo `recipes-normalization.js`;
- centralizzare li le funzioni oggi disperse tra client e server.

## Piano di migrazione consigliato

### Fase 1. Congelare la crescita della logica locale

- non aggiungere nuove heuristics in `frontend/scripts/recipes.js`;
- segnare `recipeLibrary`, token matching e fallback chat come transitori;
- evitare nuove action locali nella chat.

### Fase 2. Spostare la costruzione contesto nel backend

- il frontend smette di mandare `context` completo;
- il backend legge `GET / PUT /api/nutritrack/state` tramite repository interno, non tramite il client;
- `POST /api/recipes/generate` puo essere adattato in compatibilita temporanea prima del rename.

### Fase 3. Introdurre endpoint Recipes Assistant dedicati

- creare endpoint distinti per `generate`, `chat`, `shopping-list`;
- mantenere l'attuale route finche il frontend non migra;
- evitare endpoint generici che mischiano domini diversi.

### Fase 4. Migrare il frontend a thin client

- `generateRecipeWithAi` invia solo input e opzioni;
- `getRecipeAssistantResponse` usa route Recipes-specifica;
- `setCurrentRecipeWithContext` smette di calcolare note localmente e si limita a usare payload backend.

### Fase 5. Rimuovere fallback locali

- eliminare `buildRecipeAssistantReply`;
- eliminare matching ingredienti lato client;
- eliminare consumo dispensa lato client;
- eliminare `recipeLibrary` come fonte primaria.

## Prima implementazione concreta consigliata

Ordine operativo piu efficace:

1. estrarre nel backend un builder di contesto Recipes che legge dallo snapshot reale NutriTrack;
2. rifattorizzare `POST /api/recipes/generate` per usare solo contesto backend;
3. introdurre `POST /api/recipes/assistant/chat` con classificazione intento minima;
4. migrare il frontend Recipes alle nuove route;
5. solo dopo rimuovere fallback e heuristics locali.

## Checklist file-by-file

### `frontend/scripts/recipes.js`

Tenere:

- rendering
- pending state
- wiring eventi
- cronologia UI

Spostare backend:

- context building
- pantry matching
- pantry consumption
- chat intent handling

Eliminare a regime:

- fallback reply locale
- token heuristics
- recipe ingredient matching locale

### `frontend/scripts/data-config.js`

Tenere temporaneamente:

- `getDefaultRecipeState`
- chat seed iniziale se serve UX

Eliminare a regime:

- `recipeLibrary`
- `RECIPE_TOKEN_STOPWORDS`
- `RECIPE_GENERIC_TOKENS`

### `prototipo_backend/server.js`

Evolvere:

- da route AI thin wrappers
- a orchestratore Recipes Assistant con contesto reale e intent routing

## Decisione architetturale

Il prossimo blocco di lavoro non e `cleanup recipes`.

Il prossimo blocco e:

- backend-first redesign di Recipes;
- prima capability: `generate_recipe` con contesto backend reale;
- poi assistant chat multi-intent;
- poi shopping list;
- infine applicazione ricetta alla dieta.
