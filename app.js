if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function replaceAllCompat(pattern, replacement) {
    if (pattern instanceof RegExp) {
      if (!pattern.global) {
        throw new TypeError("replaceAll richiede una RegExp globale.");
      }

      return this.replace(pattern, replacement);
    }

    return this.split(pattern).join(replacement);
  };
}

const crypto =
  globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto
    : {
        randomUUID() {
          return `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
        },
      };

const structuredClone =
  typeof globalThis.structuredClone === "function"
    ? (value) => globalThis.structuredClone(value)
    : (value) => JSON.parse(JSON.stringify(value));

const tabs = document.querySelectorAll("[data-tab-target]");
const panels = document.querySelectorAll("[data-tab-panel]");

const recipeSwitches = document.querySelectorAll("[data-recipe-target]");
const recipePanels = document.querySelectorAll("[data-recipe-panel]");

const NUTRITRACK_LOCAL_STATE_CACHE_KEY = "nutriTrackPrototypeState";
const NUTRITRACK_STATE_API_PATH = "/api/nutritrack/state";
const NUTRITRACK_SYNC_DEBOUNCE_MS = 450;
const defaultRecipeTimestamp = "2026-06-23T16:24:00.000Z";
const RECIPE_NUTRITION_SOURCE_LABEL = "Importato da Recipes";
const RECIPE_TOKEN_STOPWORDS = new Set(["di", "e", "con", "al", "ai", "a", "da", "del", "della", "dei", "degli", "delle", "per", "su", "in", "o"]);
const RECIPE_GENERIC_TOKENS = new Set(["integrale", "greco", "fresco", "fresca", "croccante", "light", "leggero", "leggera", "classico", "classica", "grigliato", "grigliata", "forno", "arrosto", "arrostita", "saltato", "saltata", "compatto", "misto", "mista"]);
const groceryArStartIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 7.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
    <path d="m16.5 10 4-2.5v11l-4-2.5" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
  </svg>
`;
const groceryArStopIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
`;

function setGroceryArToggleButtonState(isActive) {
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (!toggleButton) {
    return;
  }

  toggleButton.innerHTML = isActive ? groceryArStopIcon : groceryArStartIcon;
  toggleButton.setAttribute("aria-label", isActive ? "Ferma camera" : "Avvia camera");
}

const nutritrackSyncRuntime = {
  hydrationStarted: false,
  isHydrating: false,
  isSaving: false,
  hasPendingWrite: false,
  saveTimeoutId: null,
};

const recipeLibrary = [
  {
    id: "mediterranean-quinoa-bowl",
    title: "Mediterranean Quinoa Bowl",
    description: "Bowl fresca e saziante con quinoa, ceci croccanti e verdure mediterranee.",
    calories: 420,
    protein: 19,
    carbs: 46,
    fats: 16,
    duration: 25,
    servings: 2,
    difficulty: "Facile",
    dietTypes: ["balanced", "vegetarian"],
    mealTypes: ["lunch", "dinner"],
    ingredients: [
      "150 g di quinoa",
      "240 g di ceci gia cotti",
      "200 g di pomodorini",
      "1 cetriolo",
      "1/4 di cipolla rossa",
      "40 g di feta",
      "2 cucchiai di olio extravergine",
      "Succo di limone, origano e prezzemolo",
    ],
    instructions: [
      "Cuoci la quinoa in acqua o brodo leggero e lasciala intiepidire.",
      "Salta o arrostisci i ceci con poco olio finche diventano dorati.",
      "Taglia pomodorini, cetriolo e cipolla e condiscili con limone ed erbe.",
      "Distribuisci quinoa, ceci e verdure nelle bowl.",
      "Completa con feta sbriciolata e un filo di olio.",
    ],
  },
  {
    id: "protein-omelette-wrap",
    title: "Protein Omelette Wrap",
    description: "Wrap proteico con uova, spinaci e yogurt greco, pensato per un pranzo rapido.",
    calories: 510,
    protein: 34,
    carbs: 29,
    fats: 26,
    duration: 15,
    servings: 1,
    difficulty: "Facile",
    dietTypes: ["balanced", "high-protein", "vegetarian"],
    mealTypes: ["breakfast", "lunch"],
    ingredients: [
      "3 uova",
      "1 tortilla integrale",
      "80 g di spinaci",
      "60 g di yogurt greco",
      "1 cucchiaino di senape",
      "Pomodorini a piacere",
      "Pepe nero e paprika",
    ],
    instructions: [
      "Sbatti le uova con pepe e paprika.",
      "Cuoci una frittata sottile in padella con gli spinaci.",
      "Mescola yogurt greco e senape per creare la salsa.",
      "Farcisci la tortilla con omelette, pomodorini e salsa.",
      "Arrotola e servi subito oppure conserva per il meal prep.",
    ],
  },
  {
    id: "overnight-oats-berries",
    title: "Overnight Oats ai Frutti Rossi",
    description: "Colazione pronta dal giorno prima, bilanciata e adatta a mattine veloci.",
    calories: 360,
    protein: 18,
    carbs: 43,
    fats: 12,
    duration: 10,
    servings: 1,
    difficulty: "Facile",
    dietTypes: ["balanced", "vegetarian"],
    mealTypes: ["breakfast", "snack"],
    ingredients: [
      "50 g di fiocchi d'avena",
      "150 g di yogurt greco",
      "100 ml di latte o bevanda vegetale",
      "80 g di frutti rossi",
      "1 cucchiaino di semi di chia",
      "Cannella q.b.",
    ],
    instructions: [
      "Mescola avena, yogurt, latte e semi di chia in un barattolo.",
      "Aggiungi la cannella e meta dei frutti rossi.",
      "Lascia riposare in frigo per almeno 6 ore.",
      "Completa con i frutti rossi rimasti prima di servire.",
    ],
  },
  {
    id: "tofu-rice-stir-fry",
    title: "Tofu Stir Fry con Riso Integrale",
    description: "Piatto unico vegano con tofu croccante, riso integrale e verdure saltate.",
    calories: 640,
    protein: 28,
    carbs: 71,
    fats: 24,
    duration: 30,
    servings: 2,
    difficulty: "Media",
    dietTypes: ["balanced", "vegan"],
    mealTypes: ["lunch", "dinner"],
    ingredients: [
      "180 g di tofu compatto",
      "140 g di riso integrale",
      "1 zucchina",
      "1 carota",
      "1 peperone",
      "2 cucchiai di salsa di soia",
      "1 cucchiaio di olio di sesamo",
      "Zenzero e semi di sesamo",
    ],
    instructions: [
      "Cuoci il riso integrale secondo le istruzioni.",
      "Rosola il tofu a cubetti finché diventa croccante.",
      "Salta le verdure con zenzero e olio di sesamo.",
      "Unisci riso, tofu e salsa di soia e manteca per 2 minuti.",
      "Completa con semi di sesamo.",
    ],
  },
  {
    id: "yogurt-apple-crunch",
    title: "Yogurt Apple Crunch",
    description: "Snack ad alto contenuto proteico con mela, yogurt e topping croccante.",
    calories: 340,
    protein: 21,
    carbs: 31,
    fats: 13,
    duration: 8,
    servings: 1,
    difficulty: "Facile",
    dietTypes: ["balanced", "high-protein", "vegetarian"],
    mealTypes: ["snack", "breakfast"],
    ingredients: [
      "170 g di yogurt greco",
      "1 mela",
      "20 g di granola",
      "10 g di noci",
      "Cannella q.b.",
    ],
    instructions: [
      "Taglia la mela a cubetti sottili.",
      "Versa lo yogurt in una bowl e aggiungi la cannella.",
      "Completa con mela, granola e noci tritate.",
    ],
  },
  {
    id: "chicken-rice-power-bowl",
    title: "Chicken Rice Power Bowl",
    description: "Bowl completa con pollo, riso integrale e verdure per giornate ad alta energia.",
    calories: 760,
    protein: 48,
    carbs: 68,
    fats: 24,
    duration: 35,
    servings: 2,
    difficulty: "Media",
    dietTypes: ["balanced", "high-protein"],
    mealTypes: ["lunch", "dinner"],
    ingredients: [
      "300 g di petto di pollo",
      "160 g di riso integrale",
      "150 g di broccoli",
      "1 carota",
      "1 cucchiaio di olio extravergine",
      "Paprika, aglio in polvere e limone",
    ],
    instructions: [
      "Cuoci il riso integrale e tienilo da parte.",
      "Condisci il pollo con paprika e aglio, poi cuocilo in padella.",
      "Sbollenta o salta broccoli e carota.",
      "Componi la bowl con riso, pollo e verdure e termina con limone.",
    ],
  },
];

const groceryComparisonCatalog = [
  {
    id: "greek-yogurt-pro",
    barcode: "800100000001",
    name: "Yogurt greco 0%",
    brand: "NutriTrack Foods",
    category: "Latticini",
    serving: "170 g",
    calories: 97,
    protein: 17,
    sugar: 3.8,
    fiber: 0,
    highlights: "Molto proteico, zuccheri bassi, ottimo per colazione o snack.",
  },
  {
    id: "protein-muesli",
    barcode: "800100000002",
    name: "Muesli proteico",
    brand: "NutriTrack Foods",
    category: "Cereali",
    serving: "50 g",
    calories: 188,
    protein: 11,
    sugar: 8.2,
    fiber: 6.1,
    highlights: "Buon apporto di fibre, ma più zuccheri rispetto ad altre opzioni breakfast.",
  },
  {
    id: "oat-drink-unsweetened",
    barcode: "800100000003",
    name: "Bevanda d'avena senza zuccheri",
    brand: "NutriTrack Foods",
    category: "Bevande",
    serving: "200 ml",
    calories: 74,
    protein: 1.4,
    sugar: 2.4,
    fiber: 1.6,
    highlights: "Alternativa vegetale leggera, poco proteica ma facile da inserire nella routine.",
  },
  {
    id: "brown-rice-classic",
    barcode: "800100000004",
    name: "Riso integrale classico",
    brand: "NutriTrack Foods",
    category: "Cereali",
    serving: "80 g",
    calories: 284,
    protein: 6.2,
    sugar: 0.6,
    fiber: 2.8,
    highlights: "Base saziante e molto neutra, utile per pasti completi e meal prep.",
  },
  {
    id: "wholegrain-biscuits",
    barcode: "800100000005",
    name: "Biscotti integrali",
    brand: "NutriTrack Foods",
    category: "Dispensa",
    serving: "30 g",
    calories: 132,
    protein: 2.8,
    sugar: 7.1,
    fiber: 2.7,
    highlights: "Comodi da portare con te, ma meno interessanti se stai cercando un profilo high-protein.",
  },
];

const groceryNameToCatalogId = {
  "yogurt greco": "greek-yogurt-pro",
  "riso integrale": "brown-rice-classic",
};

const groceryArRuntime = {
  stream: null,
  detector: null,
  detectionLoopId: null,
  isStarting: false,
};

const openFoodFactsRuntime = {
  nutritionLookup: null,
  nutritionDraft: null,
  groceryLookup: null,
};

const barcodeScannerRuntime = {
  stream: null,
  detector: null,
  detectionLoopId: null,
  isStarting: false,
  isResolving: false,
  target: "",
  lastDetectedBarcode: "",
};

const recipeChatRuntime = {
  isWaiting: false,
};

const OPEN_FOOD_FACTS_FIELDS = [
  "code",
  "product_name",
  "product_name_it",
  "brands",
  "quantity",
  "serving_size",
  "categories",
  "categories_tags",
  "nutriscore_grade",
  "nutriscore_score",
  "nutriments",
  "image_front_small_url",
  "image_url",
].join(",");

function getDefaultRecipeState() {
  return {
    generator: {
      dietType: "balanced",
      caloriesTarget: "500",
      mealType: "dinner",
      prompt: "",
    },
    currentRecipe: null,
    history: [],
    savedRecipeIds: [],
    generatedRecipesById: {},
    chatMessages: getDefaultRecipeChatMessages(),
  };
}

function getDefaultRecipeChatMessages() {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Ciao! Sono il tuo AI Recipe Assistant.\n\nPosso aiutarti con **ricette**, meal prep, sostituzioni ingredienti e idee coerenti con dispensa e obiettivi nutrizionali.\n\n---\n\nProva a chiedermi:\n- una cena veloce\n- una colazione high-protein\n- come usare quello che hai già in dispensa",
      createdAt: defaultRecipeTimestamp,
    },
  ];
}

function getRelativeDateKey(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getLegacySeedProgressDailyLogs() {
  return [
    {
      date: getRelativeDateKey(-6),
      weightKg: 75.5,
      waterGlasses: 7,
      calories: 2060,
      protein: 143,
    },
    {
      date: getRelativeDateKey(-5),
      weightKg: 75.3,
      waterGlasses: 6,
      calories: 1985,
      protein: 151,
    },
    {
      date: getRelativeDateKey(-4),
      weightKg: 75.1,
      waterGlasses: 8,
      calories: 2150,
      protein: 149,
    },
    {
      date: getRelativeDateKey(-3),
      weightKg: 75.0,
      waterGlasses: 7,
      calories: 1890,
      protein: 138,
    },
    {
      date: getRelativeDateKey(-2),
      weightKg: 74.9,
      waterGlasses: 9,
      calories: 2010,
      protein: 156,
    },
    {
      date: getRelativeDateKey(-1),
      weightKg: 74.8,
      waterGlasses: 5,
      calories: 1940,
      protein: 147,
    },
  ];
}

function getDefaultProgressState() {
  return {
    selectedRange: "week",
    dailyLogs: [],
    autoSnapshots: {},
  };
}

const devicesCatalog = [
  {
    id: "smartwatch",
    badgeClass: "badge-watch",
    badgeLabel: "Wearable",
    title: "Smartwatch",
    description: "Monitora passi giornalieri, calorie bruciate, frequenza cardiaca e sessioni di attività.",
    availableLabel: "Dati: passi, workout, calorie",
    connectLabel: "Connetti Smartwatch",
    disconnectedLabel: "Disponibile",
    permissions: {
      steps: { label: "Passi", defaultEnabled: true },
      workouts: { label: "Workout", defaultEnabled: true },
      calories: { label: "Calorie", defaultEnabled: true },
    },
  },
  {
    id: "scale",
    badgeClass: "badge-scale",
    badgeLabel: "Metriche corpo",
    title: "Bilancia digitale",
    description: "Importa peso, massa grassa e composizione corporea in Progress.",
    availableLabel: "Dati: peso, BMI, massa grassa",
    connectLabel: "Connetti bilancia",
    disconnectedLabel: "Disponibile",
    permissions: {
      weight: { label: "Peso", defaultEnabled: true },
      bmi: { label: "BMI", defaultEnabled: true },
      bodyFat: { label: "Massa grassa", defaultEnabled: true },
    },
  },
  {
    id: "strava",
    badgeClass: "badge-app",
    badgeLabel: "Fitness App",
    title: "Strava",
    description: "Integra corsa, ciclismo e allenamenti nei tuoi dati di dispendio calorico.",
    availableLabel: "Dati: workout, durata, distanza",
    connectLabel: "Connetti Strava",
    disconnectedLabel: "Disponibile",
    permissions: {
      workouts: { label: "Workout", defaultEnabled: true },
      duration: { label: "Durata", defaultEnabled: true },
      distance: { label: "Distanza", defaultEnabled: true },
    },
  },
  {
    id: "healthHub",
    badgeClass: "badge-health",
    badgeLabel: "Health Hub",
    title: "Google Fit / Apple Health",
    description: "Centralizza metriche salute da più app e dispositivi in un'unica connessione.",
    availableLabel: "Dati: attività, passi, peso, sonno",
    connectLabel: "Connetti Health App",
    disconnectedLabel: "Disponibile",
    permissions: {
      activity: { label: "Attività", defaultEnabled: true },
      steps: { label: "Passi", defaultEnabled: true },
      weight: { label: "Peso", defaultEnabled: true },
      sleep: { label: "Sonno", defaultEnabled: false },
    },
  },
];

function getDefaultDevicesState() {
  return {
    showPermissionsPanel: false,
    integrations: devicesCatalog.reduce((state, device) => {
      state[device.id] = {
        connected: false,
        lastSyncAt: "",
        permissions: Object.fromEntries(
          Object.entries(device.permissions).map(([key, config]) => [key, config.defaultEnabled])
        ),
        latestData: {},
      };
      return state;
    }, {}),
    syncPreferences: {
      autoSyncDaily: true,
      importWorkoutCalories: true,
      useConnectedWeightInProfile: false,
    },
  };
}

function isLegacySeedNutritionMeals(meals) {
  if (!Array.isArray(meals) || meals.length !== 2) {
    return false;
  }

  return meals.every((meal, index) => {
    const expected = [
      { name: "Oatmeal with berries", time: "08:30", calories: 320, protein: 12, carbs: 54, fats: 6 },
      { name: "Grilled chicken salad", time: "12:45", calories: 450, protein: 35, carbs: 25, fats: 18 },
    ][index];

    return (
      meal?.name === expected.name &&
      meal?.time === expected.time &&
      normalizeNumber(meal?.calories) === expected.calories &&
      normalizeNumber(meal?.protein) === expected.protein &&
      normalizeNumber(meal?.carbs) === expected.carbs &&
      normalizeNumber(meal?.fats) === expected.fats
    );
  });
}

function isLegacySeedGroceryItems(items) {
  if (!Array.isArray(items) || items.length !== 5) {
    return false;
  }

  const expectedNames = ["Mele", "Spinaci", "Yogurt greco", "Petto di pollo", "Riso integrale"];
  return items.every((item, index) => item?.name === expectedNames[index]);
}

function isLegacySeedPantryItems(items) {
  return Array.isArray(items) && items.length === 1 && items[0]?.name === "Yogurt greco";
}

function isLegacySeedRecipeState(recipesState) {
  return (
    recipesState?.currentRecipe?.id === "mediterranean-quinoa-bowl" &&
    recipesState?.currentRecipe?.prompt === "Ricetta iniziale di esempio" &&
    Array.isArray(recipesState?.history) &&
    recipesState.history.length === 1 &&
    recipesState.history[0]?.id === "mediterranean-quinoa-bowl"
  );
}

function isLegacySeedProfileState(profileState) {
  return (
    profileState?.personal?.fullName === "John Doe" &&
    normalizeNumber(profileState?.personal?.age) === 30 &&
    profileState?.personal?.gender === "male" &&
    normalizeNumber(profileState?.personal?.heightCm) === 175 &&
    normalizeNumber(profileState?.personal?.currentWeightKg) === 74.7 &&
    normalizeNumber(profileState?.personal?.targetWeightKg) === 70 &&
    profileState?.personal?.activityLevel === "moderate" &&
    profileState?.personal?.dietType === "regular" &&
    profileState?.medical?.allergies === "None" &&
    profileState?.medical?.bloodType === "O+"
  );
}

const defaultState = {
  nutrition: {
    goals: {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fats: 65,
    },
    meals: [],
  },
  recipes: getDefaultRecipeState(),
  grocery: {
    items: [],
    pantry: [],
    ar: {
      pinnedProductIds: [],
      lastDetectedBarcode: "",
    },
  },
  datasets: {
    openFoodFacts: {
      source: {
        mode: "official-api-now-official-dump-next",
        officialDatasetPage: "https://world.openfoodfacts.org/data",
        officialProjectPage: "https://world.openfoodfacts.org/",
        license: "ODbL",
        retrievalStrategy: "scan-live-then-index-official-dump",
      },
      productsByBarcode: {},
    },
  },
  progress: getDefaultProgressState(),
  profile: {
    personal: {
      fullName: "",
      age: null,
      gender: "",
      heightCm: null,
      currentWeightKg: null,
      targetWeightKg: null,
      activityLevel: "",
      dietType: "",
    },
    medical: {
      allergies: "",
      medications: "",
      medicalConditions: "",
      bloodType: "",
    },
    goals: {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fats: 65,
      water: 8,
    },
  },
  devices: getDefaultDevicesState(),
};

function normalizeNutriTrackState(parsedState) {
  if (!parsedState || typeof parsedState !== "object") {
    return structuredClone(defaultState);
  }

  const parsedMeals = Array.isArray(parsedState.nutrition?.meals)
    ? parsedState.nutrition.meals.map(normalizeNutritionMeal)
    : structuredClone(defaultState.nutrition.meals).map(normalizeNutritionMeal);
  const parsedDailyLogs = Array.isArray(parsedState.progress?.dailyLogs)
    ? parsedState.progress.dailyLogs.map(normalizeProgressLog).filter(Boolean)
    : structuredClone(defaultState.progress.dailyLogs);
  const parsedAutoSnapshots = normalizeProgressSnapshots(parsedState.progress?.autoSnapshots);
  const shouldResetLegacyProgressLogs =
    parsedAutoSnapshots && Object.keys(parsedAutoSnapshots).length === 0 && isLegacySeedProgressLog(parsedDailyLogs);

  const shouldResetLegacyMeals = isLegacySeedNutritionMeals(parsedMeals);
  const shouldResetLegacyGroceryItems = isLegacySeedGroceryItems(parsedState.grocery?.items);
  const shouldResetLegacyPantry = isLegacySeedPantryItems(parsedState.grocery?.pantry);
  const shouldResetLegacyRecipeState = isLegacySeedRecipeState(parsedState.recipes);
  const shouldResetLegacyProfile = isLegacySeedProfileState(parsedState.profile);

  return {
    ...structuredClone(defaultState),
    ...parsedState,
    nutrition: {
      ...structuredClone(defaultState.nutrition),
      ...(parsedState.nutrition || {}),
      meals: shouldResetLegacyMeals ? [] : parsedMeals,
    },
    recipes: {
      ...structuredClone(defaultState.recipes),
      ...(parsedState.recipes || {}),
      generator: {
        ...structuredClone(defaultState.recipes.generator),
        ...((parsedState.recipes && parsedState.recipes.generator) || {}),
      },
      currentRecipe: shouldResetLegacyRecipeState
        ? null
        : parsedState.recipes?.currentRecipe
        ? {
            ...(defaultState.recipes.currentRecipe ? structuredClone(defaultState.recipes.currentRecipe) : {}),
            ...parsedState.recipes.currentRecipe,
          }
        : structuredClone(defaultState.recipes.currentRecipe),
      history: Array.isArray(parsedState.recipes?.history)
        ? (shouldResetLegacyRecipeState ? [] : parsedState.recipes.history)
        : structuredClone(defaultState.recipes.history),
      savedRecipeIds: Array.isArray(parsedState.recipes?.savedRecipeIds)
        ? parsedState.recipes.savedRecipeIds
        : structuredClone(defaultState.recipes.savedRecipeIds),
      generatedRecipesById:
        parsedState.recipes?.generatedRecipesById && typeof parsedState.recipes.generatedRecipesById === "object"
          ? parsedState.recipes.generatedRecipesById
          : structuredClone(defaultState.recipes.generatedRecipesById),
      chatMessages: Array.isArray(parsedState.recipes?.chatMessages)
        ? parsedState.recipes.chatMessages
        : structuredClone(defaultState.recipes.chatMessages),
    },
    grocery: {
      ...structuredClone(defaultState.grocery),
      ...(parsedState.grocery || {}),
      items: Array.isArray(parsedState.grocery?.items)
        ? (shouldResetLegacyGroceryItems ? [] : parsedState.grocery.items.map(normalizeGroceryItem))
        : structuredClone(defaultState.grocery.items),
      pantry: Array.isArray(parsedState.grocery?.pantry)
        ? (shouldResetLegacyPantry ? [] : parsedState.grocery.pantry.map(normalizeGroceryItem))
        : structuredClone(defaultState.grocery.pantry),
      ar: {
        ...structuredClone(defaultState.grocery.ar),
        ...((parsedState.grocery && parsedState.grocery.ar) || {}),
        pinnedProductIds: [],
        lastDetectedBarcode: "",
      },
    },
    datasets: {
      ...structuredClone(defaultState.datasets),
      ...(parsedState.datasets || {}),
      openFoodFacts: {
        ...structuredClone(defaultState.datasets.openFoodFacts),
        ...((parsedState.datasets && parsedState.datasets.openFoodFacts) || {}),
        source: {
          ...structuredClone(defaultState.datasets.openFoodFacts.source),
          ...((parsedState.datasets?.openFoodFacts && parsedState.datasets.openFoodFacts.source) || {}),
        },
        productsByBarcode:
          parsedState.datasets?.openFoodFacts?.productsByBarcode &&
          typeof parsedState.datasets.openFoodFacts.productsByBarcode === "object"
            ? parsedState.datasets.openFoodFacts.productsByBarcode
            : structuredClone(defaultState.datasets.openFoodFacts.productsByBarcode),
      },
    },
    progress: {
      ...structuredClone(defaultState.progress),
      ...(parsedState.progress || {}),
      dailyLogs: shouldResetLegacyProgressLogs ? [] : parsedDailyLogs,
      autoSnapshots: parsedAutoSnapshots,
    },
    profile: {
      ...structuredClone(defaultState.profile),
      ...(parsedState.profile || {}),
      personal: {
        ...structuredClone(defaultState.profile.personal),
        ...(shouldResetLegacyProfile ? {} : ((parsedState.profile && parsedState.profile.personal) || {})),
      },
      medical: {
        ...structuredClone(defaultState.profile.medical),
        ...(shouldResetLegacyProfile ? {} : ((parsedState.profile && parsedState.profile.medical) || {})),
      },
      goals: {
        ...structuredClone(defaultState.profile.goals),
        ...((parsedState.profile && parsedState.profile.goals) || {}),
      },
    },
    devices: normalizeDevicesState(parsedState.devices),
  };
}

function loadNutriTrackStateFromLocalCache() {
  try {
    const savedState = localStorage.getItem(NUTRITRACK_LOCAL_STATE_CACHE_KEY);

    if (!savedState) {
      return structuredClone(defaultState);
    }

    return normalizeNutriTrackState(JSON.parse(savedState));
  } catch (error) {
    console.warn("Unable to load saved state, using defaults.", error);
    return structuredClone(defaultState);
  }
}

function saveNutriTrackStateToLocalCache() {
  localStorage.setItem(NUTRITRACK_LOCAL_STATE_CACHE_KEY, JSON.stringify(appState));
}

function renderNutriTrackState() {
  renderNutrition();
  renderGrocery();
  renderProgress();
  renderDevices();
  renderProfile();
}

async function persistNutriTrackStateToApi() {
  if (nutritrackSyncRuntime.isSaving) {
    nutritrackSyncRuntime.hasPendingWrite = true;
    return;
  }

  nutritrackSyncRuntime.isSaving = true;

  try {
    const response = await fetch(NUTRITRACK_STATE_API_PATH, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: appState }),
    });

    if (!response.ok) {
      throw new Error(`Salvataggio NutriTrack fallito (${response.status}).`);
    }
  } catch (error) {
    console.warn("Unable to persist NutriTrack state to API.", error);
  } finally {
    nutritrackSyncRuntime.isSaving = false;

    if (nutritrackSyncRuntime.hasPendingWrite) {
      nutritrackSyncRuntime.hasPendingWrite = false;
      queueNutriTrackStateSync();
    }
  }
}

function queueNutriTrackStateSync() {
  if (nutritrackSyncRuntime.saveTimeoutId) {
    clearTimeout(nutritrackSyncRuntime.saveTimeoutId);
  }

  nutritrackSyncRuntime.saveTimeoutId = window.setTimeout(() => {
    nutritrackSyncRuntime.saveTimeoutId = null;
    persistNutriTrackStateToApi();
  }, NUTRITRACK_SYNC_DEBOUNCE_MS);
}

async function hydrateNutriTrackStateFromApi() {
  if (nutritrackSyncRuntime.hydrationStarted) {
    return;
  }

  nutritrackSyncRuntime.hydrationStarted = true;
  nutritrackSyncRuntime.isHydrating = true;

  try {
    const response = await fetch(NUTRITRACK_STATE_API_PATH, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Hydration NutriTrack fallita (${response.status}).`);
    }

    const payload = await response.json();

    if (!payload?.state) {
      queueNutriTrackStateSync();
      return;
    }

    const normalizedState = normalizeNutriTrackState(payload.state);
    Object.keys(appState).forEach((key) => {
      delete appState[key];
    });
    Object.assign(appState, normalizedState);
    saveNutriTrackStateToLocalCache();
    renderNutriTrackState();
  } catch (error) {
    console.warn("Unable to hydrate NutriTrack state from API.", error);
  } finally {
    nutritrackSyncRuntime.isHydrating = false;
  }
}

function saveState() {
  saveNutriTrackStateToLocalCache();

  if (!nutritrackSyncRuntime.isHydrating) {
    queueNutriTrackStateSync();
  }
}

const appState = loadNutriTrackStateFromLocalCache();

function switchToTab(target) {
  tabs.forEach((item) => item.classList.toggle("is-active", item.dataset.tabTarget === target));
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.tabPanel === target));

  if (target !== "grocery" && groceryArRuntime.stream) {
    stopGroceryArCamera();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchToTab(tab.dataset.tabTarget);
  });
});

recipeSwitches.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.recipeTarget;

    recipeSwitches.forEach((item) => item.classList.remove("mode-pill-active"));
    recipePanels.forEach((panel) => panel.classList.remove("is-active"));

    button.classList.add("mode-pill-active");
    document.querySelector(`[data-recipe-panel="${target}"]`)?.classList.add("is-active");
  });
});

function formatMealTime(value) {
  if (!value) {
    return "--:--";
  }

  const [hoursString, minutesString] = value.split(":");
  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatShortDayLabel(value) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (appState.progress.selectedRange === "month") {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}

function getTodayDateKey() {
  return getRelativeDateKey(0);
}

function getProgressRangeDays() {
  return appState.progress.selectedRange === "month" ? 30 : 7;
}

function getRecentDateKeys(days) {
  return Array.from({ length: days }, (_, index) => getRelativeDateKey(index - (days - 1)));
}

function setProgressFeedback(message) {
  const feedback = document.querySelector("[data-progress-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function getRecipeById(recipeId) {
  if (!recipeId) {
    return null;
  }

  const libraryRecipe = recipeLibrary.find((recipe) => recipe.id === recipeId);

  if (libraryRecipe) {
    return libraryRecipe;
  }

  if (appState.recipes?.generatedRecipesById?.[recipeId]) {
    return appState.recipes.generatedRecipesById[recipeId];
  }

  if (appState.recipes?.currentRecipe?.id === recipeId) {
    return appState.recipes.currentRecipe;
  }

  return null;
}

function slugifyRecipeValue(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureGeneratedRecipeStore() {
  if (!appState.recipes.generatedRecipesById || typeof appState.recipes.generatedRecipesById !== "object") {
    appState.recipes.generatedRecipesById = {};
  }
}

function registerRecipe(recipe) {
  if (!recipe?.id) {
    return recipe;
  }

  ensureGeneratedRecipeStore();
  appState.recipes.generatedRecipesById[recipe.id] = structuredClone(recipe);
  return recipe;
}

function getRecipeDietLabel(value) {
  const labels = {
    balanced: "Bilanciata",
    "high-protein": "High protein",
    vegetarian: "Vegetariana",
    vegan: "Vegana",
  };

  return labels[value] || value;
}

function getRecipeMealLabel(value) {
  const labels = {
    breakfast: "Colazione",
    lunch: "Pranzo",
    dinner: "Cena",
    snack: "Snack",
  };

  return labels[value] || value;
}

function setRecipeFeedback(message) {
  const feedback = document.querySelector("[data-recipe-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function updateFormValidationStyles(form) {
  if (!form) {
    return;
  }

  form.querySelectorAll("input, select, textarea").forEach((control) => {
    const field = control.closest(".field");
    const shouldHighlight = form.dataset.validationState === "submitted" && !control.checkValidity();

    control.classList.toggle("field-invalid-control", shouldHighlight);

    if (field) {
      field.classList.toggle("field-invalid", shouldHighlight);
    }
  });
}

function markFormValidationAttempt(form) {
  if (!form) {
    return;
  }

  form.dataset.validationState = "submitted";
  updateFormValidationStyles(form);
}

function resetFormValidationState(form) {
  if (!form) {
    return;
  }

  delete form.dataset.validationState;
  form.querySelectorAll(".field-invalid").forEach((field) => field.classList.remove("field-invalid"));
  form.querySelectorAll(".field-invalid-control").forEach((control) => control.classList.remove("field-invalid-control"));
}

function bindFormValidationFeedback(form) {
  if (!form) {
    return;
  }

  const refresh = () => updateFormValidationStyles(form);
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
}

function roundMacroValue(value) {
  return Math.max(0, Math.round(value));
}

function createNutritionSnapshot(values = {}) {
  return {
    calories: roundMacroValue(normalizeNumber(values.calories) || 0),
    protein: roundMacroValue(normalizeNumber(values.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(values.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(values.fats) || 0),
  };
}

function detectMealProfile(name) {
  const normalized = String(name || "").toLowerCase();
  const profiles = [
    {
      type: "breakfast",
      keywords: ["colazione", "breakfast", "yogurt", "latte", "avena", "pancake", "cereali", "toast", "brioche"],
      values: { calories: 340, protein: 16, carbs: 39, fats: 11 },
    },
    {
      type: "snack",
      keywords: ["snack", "spuntino", "barretta", "frutta", "mela", "banana", "mandorle", "cracker"],
      values: { calories: 220, protein: 9, carbs: 24, fats: 9 },
    },
    {
      type: "lunch",
      keywords: ["pranzo", "lunch", "insalata", "pasta", "riso", "bowl", "panino", "wrap"],
      values: { calories: 610, protein: 29, carbs: 58, fats: 22 },
    },
    {
      type: "dinner",
      keywords: ["cena", "dinner", "pollo", "salmone", "zuppa", "burger", "pesce", "carne"],
      values: { calories: 680, protein: 35, carbs: 49, fats: 28 },
    },
  ];

  return profiles.find((profile) => profile.keywords.some((keyword) => normalized.includes(keyword))) || {
    type: "meal",
    values: { calories: 480, protein: 24, carbs: 42, fats: 18 },
  };
}

function estimateNutritionFromMealName(name) {
  const normalized = String(name || "").toLowerCase();
  const profile = detectMealProfile(normalized);
  const estimated = { ...profile.values };
  const adjustments = [
    { keywords: ["protein", "proteico", "pollo", "tonno", "tacchino", "uova", "salmone", "tofu"], delta: { calories: 60, protein: 14, carbs: -4, fats: 3 } },
    { keywords: ["pasta", "riso", "pane", "wrap", "piadina", "patate", "avena"], delta: { calories: 90, protein: 2, carbs: 18, fats: 1 } },
    { keywords: ["insalata", "verdure", "zucchine", "broccoli", "spinaci"], delta: { calories: -40, protein: 1, carbs: -5, fats: -2 } },
    { keywords: ["formaggio", "feta", "mozzarella", "parmigiano", "avocado", "frutta secca", "noci"], delta: { calories: 80, protein: 3, carbs: -2, fats: 8 } },
    { keywords: ["dolce", "biscotti", "torta", "croissant", "gelato"], delta: { calories: 110, protein: -4, carbs: 16, fats: 4 } },
  ];

  adjustments.forEach((adjustment) => {
    if (adjustment.keywords.some((keyword) => normalized.includes(keyword))) {
      estimated.calories += adjustment.delta.calories;
      estimated.protein += adjustment.delta.protein;
      estimated.carbs += adjustment.delta.carbs;
      estimated.fats += adjustment.delta.fats;
    }
  });

  return {
    ...createNutritionSnapshot(estimated),
    nutritionSource: "ai-estimate",
    nutritionSourceLabel: "Stima AI",
  };
}

function createImportedNutritionDraft(values, sourceLabel) {
  return {
    ...createNutritionSnapshot(values),
    nutritionSource: "imported",
    nutritionSourceLabel: sourceLabel,
  };
}

function getNutritionDraftForMeal(name) {
  // Quando un prodotto OpenFoodFacts è collegato al form, i macro del pasto
  // non vengono stimati dall'IA: prendiamo direttamente i nutrienti strutturati
  // già normalizzati dal lookup API/dataset e li usiamo come fonte primaria.
  if (openFoodFactsRuntime.nutritionLookup) {
    return createImportedNutritionDraft(openFoodFactsRuntime.nutritionLookup, "Importato da OpenFoodFacts");
  }

  if (openFoodFactsRuntime.nutritionDraft) {
    return {
      ...createNutritionSnapshot(openFoodFactsRuntime.nutritionDraft),
      nutritionSource: openFoodFactsRuntime.nutritionDraft.nutritionSource || "imported",
      nutritionSourceLabel: openFoodFactsRuntime.nutritionDraft.nutritionSourceLabel || "Valori importati",
    };
  }

  return estimateNutritionFromMealName(name);
}

function clearNutritionDraft() {
  openFoodFactsRuntime.nutritionLookup = null;
  openFoodFactsRuntime.nutritionDraft = null;
}

function getNutritionTotals() {
  const totals = getNutritionTotalsForDate(getTodayDateKey());
  return {
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fats: totals.fats,
  };
}

function getNutritionTotalsForDate(dateKey) {
  const totals = appState.nutrition.meals.reduce(
    (result, meal) => {
      if (getMealDateKey(meal) !== dateKey) {
        return result;
      }

      result.calories += roundMacroValue(normalizeNumber(meal.calories) || 0);
      result.protein += roundMacroValue(normalizeNumber(meal.protein) || 0);
      result.carbs += roundMacroValue(normalizeNumber(meal.carbs) || 0);
      result.fats += roundMacroValue(normalizeNumber(meal.fats) || 0);
      result.count += 1;
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, count: 0 }
  );

  return totals;
}

function getMealDateKey(meal) {
  return isValidDateKey(meal?.date) ? meal.date : getTodayDateKey();
}

function ensureProgressAutoSnapshots() {
  if (!appState.progress.autoSnapshots || typeof appState.progress.autoSnapshots !== "object") {
    appState.progress.autoSnapshots = {};
  }
}

function getProgressAutoSnapshot(dateKey) {
  ensureProgressAutoSnapshots();
  return appState.progress.autoSnapshots[dateKey] || null;
}

function captureProgressSnapshotForDate(dateKey, options = {}) {
  if (!isValidDateKey(dateKey)) {
    return false;
  }

  ensureProgressAutoSnapshots();

  const nutritionTotals = getNutritionTotalsForDate(dateKey);
  const weightKg = options.weightKg ?? normalizeNumber(appState.profile.personal.currentWeightKg);
  const previousSnapshot = getProgressAutoSnapshot(dateKey) || {};
  const nextSnapshot = {
    calories: nutritionTotals.calories,
    protein: nutritionTotals.protein,
    weightKg,
    capturedAt: new Date().toISOString(),
  };

  const didChange =
    previousSnapshot.calories !== nextSnapshot.calories ||
    previousSnapshot.protein !== nextSnapshot.protein ||
    previousSnapshot.weightKg !== nextSnapshot.weightKg;

  if (didChange) {
    appState.progress.autoSnapshots[dateKey] = nextSnapshot;
  }

  return didChange;
}

function captureTodayProgressSnapshot(options = {}) {
  return captureProgressSnapshotForDate(getTodayDateKey(), options);
}

function setFeedback(message) {
  const feedback = document.querySelector("[data-nutrition-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function setProfileFeedback(message) {
  const feedback = document.querySelector("[data-profile-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function setGroceryFeedback(message) {
  const feedback = document.querySelector("[data-grocery-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function setDevicesFeedback(message) {
  const feedback = document.querySelector("[data-devices-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function getDeviceConfig(deviceId) {
  return devicesCatalog.find((device) => device.id === deviceId) || null;
}

function getDeviceState(deviceId) {
  return appState.devices.integrations[deviceId] || null;
}

function getConnectedDevices() {
  return devicesCatalog.filter((device) => getDeviceState(device.id)?.connected);
}

function getLatestDevicesSyncAt() {
  return getConnectedDevices()
    .map((device) => getDeviceState(device.id)?.lastSyncAt || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function formatDeviceSyncLabel(value) {
  if (!value) {
    return "Mai";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = getTodayDateKey();
  const syncDateKey = date.toISOString().slice(0, 10);

  if (syncDateKey === today) {
    return `Oggi, ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildEnabledPermissionSummary(device) {
  const deviceState = getDeviceState(device.id);

  if (!deviceState) {
    return device.availableLabel;
  }

  const enabledPermissions = Object.entries(device.permissions)
    .filter(([key]) => deviceState.permissions[key])
    .map(([, config]) => config.label.toLowerCase());

  if (enabledPermissions.length === 0) {
    return "Permessi attivi: nessuno";
  }

  return `Dati: ${enabledPermissions.join(", ")}`;
}

function syncSmartwatchData() {
  const mealsToday = getNutritionTotalsForDate(getTodayDateKey()).count;
  const completedGroceryItems = appState.grocery.items.filter((item) => item.completed).length;

  return {
    steps: 4200 + mealsToday * 850 + completedGroceryItems * 180,
    workoutCalories: 180 + mealsToday * 35,
  };
}

function syncScaleData() {
  const weightKg = normalizeNumber(appState.profile.personal.currentWeightKg);
  const bmi = calculateBmi(
    normalizeNumber(appState.profile.personal.heightCm),
    weightKg
  );

  return {
    weightKg,
    bmi: bmi ? Number(bmi.toFixed(1)) : null,
    bodyFatPercent: weightKg == null ? null : Number((Math.max(14, 24 - (weightKg % 4))).toFixed(1)),
  };
}

function syncStravaData() {
  const mealsToday = getNutritionTotalsForDate(getTodayDateKey()).count;

  return {
    distanceKm: Number((4.8 + mealsToday * 1.1).toFixed(1)),
    durationMin: 32 + mealsToday * 6,
  };
}

function syncHealthHubData() {
  const profileWeight = normalizeNumber(appState.profile.personal.currentWeightKg);

  return {
    steps: 5600 + appState.grocery.pantry.length * 140,
    weightKg: profileWeight,
    sleepHours: 7.4,
  };
}

function buildDeviceLatestData(deviceId) {
  const builders = {
    smartwatch: syncSmartwatchData,
    scale: syncScaleData,
    strava: syncStravaData,
    healthHub: syncHealthHubData,
  };

  return builders[deviceId] ? builders[deviceId]() : {};
}

function syncDevice(deviceId) {
  const deviceState = getDeviceState(deviceId);

  if (!deviceState?.connected) {
    return false;
  }

  deviceState.lastSyncAt = new Date().toISOString();
  deviceState.latestData = buildDeviceLatestData(deviceId);

  if (deviceId === "scale" && appState.devices.syncPreferences.useConnectedWeightInProfile) {
    const syncedWeight = normalizeNumber(deviceState.latestData.weightKg);

    if (syncedWeight != null) {
      appState.profile.personal.currentWeightKg = syncedWeight;
      captureTodayProgressSnapshot({ weightKg: syncedWeight });
      renderProfile();
      renderProgress();
    }
  }

  saveState();
  return true;
}

function connectDevice(deviceId) {
  const deviceState = getDeviceState(deviceId);

  if (!deviceState || deviceState.connected) {
    return false;
  }

  deviceState.connected = true;
  syncDevice(deviceId);
  return true;
}

function disconnectDevice(deviceId) {
  const deviceState = getDeviceState(deviceId);

  if (!deviceState || !deviceState.connected) {
    return false;
  }

  deviceState.connected = false;
  deviceState.lastSyncAt = "";
  deviceState.latestData = {};
  saveState();
  return true;
}

function getDeviceMetaLines(device) {
  const deviceState = getDeviceState(device.id);

  if (!deviceState?.connected) {
    return [
      "Pronto per la connessione",
      buildEnabledPermissionSummary(device),
    ];
  }

  const syncLabel = `Ultimo sync: ${formatDeviceSyncLabel(deviceState.lastSyncAt)}`;

  if (device.id === "scale" && deviceState.latestData.weightKg != null) {
    return [
      syncLabel,
      `Peso: ${deviceState.latestData.weightKg} kg${deviceState.latestData.bmi != null ? ` · BMI ${deviceState.latestData.bmi}` : ""}`,
    ];
  }

  if (device.id === "smartwatch" && deviceState.latestData.steps != null) {
    return [
      syncLabel,
      `${deviceState.latestData.steps} passi · ${deviceState.latestData.workoutCalories} kcal attive`,
    ];
  }

  if (device.id === "strava" && deviceState.latestData.distanceKm != null) {
    return [
      syncLabel,
      `${deviceState.latestData.distanceKm} km · ${deviceState.latestData.durationMin} min`,
    ];
  }

  if (device.id === "healthHub" && deviceState.latestData.steps != null) {
    return [
      syncLabel,
      `${deviceState.latestData.steps} passi · sonno ${deviceState.latestData.sleepHours} h`,
    ];
  }

  return [syncLabel, buildEnabledPermissionSummary(device)];
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function normalizeNutritionMeal(meal) {
  return {
    ...meal,
    date: isValidDateKey(meal?.date) ? meal.date : getTodayDateKey(),
    calories: roundMacroValue(normalizeNumber(meal?.calories) || 0),
    protein: roundMacroValue(normalizeNumber(meal?.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(meal?.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(meal?.fats) || 0),
  };
}

function normalizeProgressLog(entry) {
  if (!isValidDateKey(entry?.date)) {
    return null;
  }

  return {
    date: entry.date,
    weightKg: normalizeNumber(entry.weightKg),
    waterGlasses: normalizeNumber(entry.waterGlasses),
    calories: normalizeNumber(entry.calories),
    protein: normalizeNumber(entry.protein),
  };
}

function normalizeProgressSnapshots(snapshots) {
  if (!snapshots || typeof snapshots !== "object") {
    return {};
  }

  return Object.entries(snapshots).reduce((normalized, [dateKey, snapshot]) => {
    if (!isValidDateKey(dateKey) || !snapshot || typeof snapshot !== "object") {
      return normalized;
    }

    normalized[dateKey] = {
      calories: normalizeNumber(snapshot.calories),
      protein: normalizeNumber(snapshot.protein),
      weightKg: normalizeNumber(snapshot.weightKg),
      capturedAt: snapshot.capturedAt || "",
    };
    return normalized;
  }, {});
}

function isLegacySeedProgressLog(logs) {
  const legacyLogs = getLegacySeedProgressDailyLogs();

  if (!Array.isArray(logs) || logs.length !== legacyLogs.length) {
    return false;
  }

  return logs.every((entry, index) => {
    const legacyEntry = legacyLogs[index];

    return (
      entry?.date === legacyEntry.date &&
      normalizeNumber(entry?.weightKg) === legacyEntry.weightKg &&
      normalizeNumber(entry?.waterGlasses) === legacyEntry.waterGlasses &&
      normalizeNumber(entry?.calories) === legacyEntry.calories &&
      normalizeNumber(entry?.protein) === legacyEntry.protein
    );
  });
}

function normalizeDevicesState(devicesState) {
  const defaultDevicesState = getDefaultDevicesState();
  const savedDevicesState = devicesState && typeof devicesState === "object" ? devicesState : {};
  const savedIntegrations = savedDevicesState.integrations && typeof savedDevicesState.integrations === "object"
    ? savedDevicesState.integrations
    : {};
  const normalizedIntegrations = devicesCatalog.reduce((integrations, device) => {
    const savedIntegration = savedIntegrations[device.id] && typeof savedIntegrations[device.id] === "object"
      ? savedIntegrations[device.id]
      : {};
    const defaultIntegration = defaultDevicesState.integrations[device.id];

    integrations[device.id] = {
      ...defaultIntegration,
      ...savedIntegration,
      connected: Boolean(savedIntegration.connected),
      lastSyncAt: savedIntegration.lastSyncAt || "",
      permissions: Object.fromEntries(
        Object.entries(device.permissions).map(([key, config]) => [
          key,
          savedIntegration.permissions && key in savedIntegration.permissions
            ? Boolean(savedIntegration.permissions[key])
            : config.defaultEnabled,
        ])
      ),
      latestData:
        savedIntegration.latestData && typeof savedIntegration.latestData === "object"
          ? savedIntegration.latestData
          : {},
    };

    return integrations;
  }, {});

  return {
    ...defaultDevicesState,
    ...savedDevicesState,
    showPermissionsPanel: Boolean(savedDevicesState.showPermissionsPanel),
    integrations: normalizedIntegrations,
    syncPreferences: {
      ...defaultDevicesState.syncPreferences,
      ...(savedDevicesState.syncPreferences || {}),
    },
  };
}

function localizeGroceryCategory(category) {
  const categoryMap = {
    Produce: "Frutta e verdura",
    Dairy: "Latticini",
    Meat: "Carne e pesce",
    Grains: "Cereali",
    Pantry: "Dispensa",
    Frozen: "Surgelati",
    Beverages: "Bevande",
  };

  return categoryMap[category] || category;
}

function localizeSeedGroceryName(name) {
  const nameMap = {
    Apples: "Mele",
    Spinach: "Spinaci",
    "Greek yogurt": "Yogurt greco",
    "Chicken breast": "Petto di pollo",
    "Brown rice": "Riso integrale",
  };

  return nameMap[name] || name;
}

function normalizeGroceryItem(item) {
  return {
    ...item,
    name: localizeSeedGroceryName(item.name),
    category: localizeGroceryCategory(item.category),
    expiryDate: String(item?.expiryDate || "").trim(),
  };
}

function sanitizeBarcode(value) {
  return String(value || "").replaceAll(/\D/g, "");
}

function formatExpiryDate(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  const [year, month, day] = raw.split("-");

  if (!year || !month || !day) {
    return raw;
  }

  return `${day}/${month}/${year}`;
}

function getNutriscoreLabel(grade) {
  return grade ? `Nutri-Score ${String(grade).toUpperCase()}` : "Nutri-Score non disponibile";
}

function getNutriscoreClassName(grade) {
  return grade ? `nutriscore-${String(grade).toLowerCase()}` : "";
}

function normalizeOpenFoodFactsCategory(product) {
  const categoriesText = String(product?.categories || "").toLowerCase();
  const tags = Array.isArray(product?.categories_tags) ? product.categories_tags.join(" ").toLowerCase() : "";
  const haystack = `${categoriesText} ${tags}`;

  if (/yogurt|milk|cheese|dairy|latte|lait|fromage/.test(haystack)) {
    return "Latticini";
  }

  if (/meat|fish|seafood|carne|pesce|pollo|chicken|tonno/.test(haystack)) {
    return "Carne e pesce";
  }

  if (/drink|beverage|juice|water|bevande|bibite/.test(haystack)) {
    return "Bevande";
  }

  if (/frozen|surgel/.test(haystack)) {
    return "Surgelati";
  }

  if (/fruit|vegetable|frutta|verdura|produce/.test(haystack)) {
    return "Frutta e verdura";
  }

  if (/cereal|rice|pasta|bread|grain|avena|riso|pane/.test(haystack)) {
    return "Cereali";
  }

  return "Dispensa";
}

function getComparableProductKey(product) {
  if (!product) {
    return "";
  }

  return product.source === "openfoodfacts" ? `off:${product.barcode}` : product.id;
}

function readOpenFoodFactsMacro(nutriments, keys) {
  for (const key of keys) {
    const value = normalizeNumber(nutriments?.[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeOpenFoodFactsProduct(product, retrievalSource = "api") {
  if (!product?.code) {
    return null;
  }

  const nutriments = product.nutriments || {};
  const servingSize = String(product.serving_size || "").trim();
  const servingBased =
    nutriments["energy-kcal_serving"] !== undefined ||
    nutriments.proteins_serving !== undefined ||
    nutriments.carbohydrates_serving !== undefined ||
    nutriments.fat_serving !== undefined;

  const normalized = {
    source: "openfoodfacts",
    retrievalSource,
    barcode: sanitizeBarcode(product.code),
    name: String(product.product_name_it || product.product_name || "Prodotto senza nome").trim(),
    brand: String(product.brands || "OpenFoodFacts").trim(),
    category: normalizeOpenFoodFactsCategory(product),
    quantity: String(product.quantity || "").trim(),
    serving: servingSize || "100 g",
    calories: readOpenFoodFactsMacro(nutriments, servingBased ? ["energy-kcal_serving", "energy-kcal_value"] : ["energy-kcal_100g", "energy-kcal_value"]),
    protein: readOpenFoodFactsMacro(nutriments, servingBased ? ["proteins_serving"] : ["proteins_100g", "proteins"]),
    carbs: readOpenFoodFactsMacro(nutriments, servingBased ? ["carbohydrates_serving"] : ["carbohydrates_100g", "carbohydrates"]),
    fats: readOpenFoodFactsMacro(nutriments, servingBased ? ["fat_serving"] : ["fat_100g", "fat"]),
    sugar: readOpenFoodFactsMacro(nutriments, servingBased ? ["sugars_serving"] : ["sugars_100g", "sugars"]),
    fiber: readOpenFoodFactsMacro(nutriments, servingBased ? ["fiber_serving"] : ["fiber_100g", "fiber"]),
    nutriscoreGrade: String(product.nutriscore_grade || "").toLowerCase(),
    nutriscoreScore: normalizeNumber(product.nutriscore_score),
    imageUrl: product.image_front_small_url || product.image_url || "",
    macroBasis: servingBased ? "serving" : "100g",
    highlights: "Valori per 100 g/ml di prodotto",
  };

  normalized.ragText = buildOpenFoodFactsRagText(normalized);
  return normalized;
}

function buildOpenFoodFactsRagText(product) {
  const chunks = [
    `Barcode ${product.barcode}`,
    `Prodotto ${product.name}`,
    product.brand ? `Brand ${product.brand}` : "",
    product.category ? `Categoria ${product.category}` : "",
    product.quantity ? `Quantita ${product.quantity}` : "",
    product.serving ? `Porzione di riferimento ${product.serving}` : "",
    product.calories !== null ? `Calorie ${product.calories} kcal` : "",
    product.protein !== null ? `Proteine ${product.protein} g` : "",
    product.carbs !== null ? `Carboidrati ${product.carbs} g` : "",
    product.fats !== null ? `Grassi ${product.fats} g` : "",
    product.sugar !== null ? `Zuccheri ${product.sugar} g` : "",
    product.fiber !== null ? `Fibre ${product.fiber} g` : "",
    product.nutriscoreGrade ? `Nutri-Score ${product.nutriscoreGrade.toUpperCase()}` : "",
    product.nutriscoreScore !== null ? `Punteggio Nutri-Score ${product.nutriscoreScore}` : "",
    product.highlights,
  ].filter(Boolean);

  return chunks.join(". ");
}

function buildOpenFoodFactsRagRecord(product) {
  const source = appState.datasets?.openFoodFacts?.source || defaultState.datasets.openFoodFacts.source;

  return {
    id: `openfoodfacts:${product.barcode}`,
    barcode: product.barcode,
    title: product.name,
    brand: product.brand,
    category: product.category,
    quantity: product.quantity,
    serving: product.serving,
    nutrition: {
      calories: product.calories,
      protein: product.protein,
      carbs: product.carbs,
      fats: product.fats,
      sugar: product.sugar,
      fiber: product.fiber,
    },
    nutriscore: {
      grade: product.nutriscoreGrade || null,
      score: product.nutriscoreScore,
    },
    source: {
      provider: "OpenFoodFacts",
      acquisition: product.retrievalSource === "dataset" ? "official-dataset-fallback" : "live-api-lookup",
      officialDatasetPage: source.officialDatasetPage,
      officialProjectPage: source.officialProjectPage,
      license: source.license,
      intendedPipeline: source.retrievalStrategy,
    },
    text: product.ragText,
  };
}

function ensureOpenFoodFactsState() {
  if (!appState.datasets) {
    appState.datasets = structuredClone(defaultState.datasets);
  }

  if (!appState.datasets.openFoodFacts) {
    appState.datasets.openFoodFacts = structuredClone(defaultState.datasets.openFoodFacts);
  }

  if (!appState.datasets.openFoodFacts.productsByBarcode) {
    appState.datasets.openFoodFacts.productsByBarcode = {};
  }
}

function cacheOpenFoodFactsProduct(product) {
  if (!product?.barcode) {
    return;
  }

  ensureOpenFoodFactsState();
  appState.datasets.openFoodFacts.productsByBarcode[product.barcode] = product;
}

function getCachedOpenFoodFactsProduct(barcode) {
  ensureOpenFoodFactsState();
  return appState.datasets.openFoodFacts.productsByBarcode[sanitizeBarcode(barcode)] || null;
}

function getComparableProductByKey(productKey) {
  if (!productKey) {
    return null;
  }

  if (String(productKey).startsWith("off:")) {
    return getCachedOpenFoodFactsProduct(String(productKey).slice(4));
  }

  return getCatalogProductById(productKey);
}

function getCatalogProductById(productId) {
  return groceryComparisonCatalog.find((product) => product.id === productId) || null;
}

function getCatalogProductByBarcode(barcode) {
  const normalizedBarcode = sanitizeBarcode(barcode);
  return groceryComparisonCatalog.find((product) => product.barcode === normalizedBarcode) || null;
}

function getCatalogProductFromGroceryItem(item) {
  if (item?.barcode) {
    const cachedProduct = getCachedOpenFoodFactsProduct(item.barcode);

    if (cachedProduct) {
      return cachedProduct;
    }

    const catalogBarcodeProduct = getCatalogProductByBarcode(item.barcode);

    if (catalogBarcodeProduct) {
      return catalogBarcodeProduct;
    }
  }

  const catalogId = groceryNameToCatalogId[String(item?.name || "").toLowerCase()];
  return catalogId ? getCatalogProductById(catalogId) : null;
}

function calculateGroceryComparisonScore(product) {
  if (!product) {
    return 0;
  }

  const protein = normalizeNumber(product.protein) || 0;
  const fiber = normalizeNumber(product.fiber) || 0;
  const sugar = normalizeNumber(product.sugar) || 0;
  const calories = normalizeNumber(product.calories) || 0;

  return Math.round(protein * 4 + fiber * 5 - sugar * 2 - calories * 0.08);
}

function getGroceryComparisonWinner(products) {
  if (products.length < 2) {
    return null;
  }

  return products
    .map((product) => ({ product, score: calculateGroceryComparisonScore(product) }))
    .sort((firstItem, secondItem) => secondItem.score - firstItem.score)[0];
}

function ensureGroceryArState() {
  if (!appState.grocery.ar) {
    appState.grocery.ar = structuredClone(defaultState.grocery.ar);
  }
}

function pinGroceryComparisonProduct(productId) {
  ensureGroceryArState();

  const pinnedIds = appState.grocery.ar.pinnedProductIds.filter(Boolean);

  if (pinnedIds.includes(productId)) {
    return {
      added: false,
      reason: "already-pinned",
    };
  }

  if (pinnedIds.length >= 2) {
    return {
      added: false,
      reason: "slots-full",
    };
  }

  appState.grocery.ar.pinnedProductIds = [...pinnedIds, productId];
  return {
    added: true,
    reason: "added",
  };
}

function unpinGroceryComparisonProduct(productId) {
  ensureGroceryArState();
  appState.grocery.ar.pinnedProductIds = appState.grocery.ar.pinnedProductIds.filter((id) => id !== productId);
  appState.grocery.ar.lastDetectedBarcode = "";
}

function getPinnedGroceryComparisonProducts() {
  ensureGroceryArState();

  return appState.grocery.ar.pinnedProductIds
    .map((productId) => ({
      productId,
      product: getComparableProductByKey(productId),
    }))
    .filter((entry) => entry.product);
}

async function fetchOpenFoodFactsProduct(barcode) {
  const normalizedBarcode = sanitizeBarcode(barcode);
  console.log("[Frontend] Inizio lookup OpenFoodFacts.", { barcode: normalizedBarcode });

  if (!normalizedBarcode) {
    throw new Error("Barcode non valido.");
  }

  const cachedProduct = getCachedOpenFoodFactsProduct(normalizedBarcode);

  if (cachedProduct) {
    console.log("[Frontend] Prodotto OpenFoodFacts trovato.", { barcode: normalizedBarcode });
    return cachedProduct;
  }

  console.log("[Frontend] Chiamata a OpenFoodFacts.", {
    url: `/api/openfoodfacts/product/${normalizedBarcode}`
  });
  const response = await fetch(`/api/openfoodfacts/product/${normalizedBarcode}`);

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    console.error("[Frontend] Errore da OpenFoodFacts.", errorPayload);
    throw new Error(errorPayload?.error || "OpenFoodFacts non raggiungibile.");
  }

  const payload = await response.json();
  console.log("[Frontend] Risposta OpenFoodFacts ricevuta dal backend.", payload);

  const normalizedProduct = normalizeOpenFoodFactsProduct(payload.product, payload.source || "api");

  if (!normalizedProduct) {
    throw new Error("Risposta OpenFoodFacts incompleta.");
  }

  cacheOpenFoodFactsProduct(normalizedProduct);
  console.log("[Frontend] Prodotto OpenFoodFacts normalizzato e salvato in cache.", {
    barcode: normalizedProduct.barcode,
    name: normalizedProduct.name,
    nutriscore: normalizedProduct.nutriscoreGrade || null,
    retrievalSource: normalizedProduct.retrievalSource
  });
  saveState();
  return normalizedProduct;
}

function renderLookupResult(containerSelector, product, emptyMessage) {
  const container = document.querySelector(containerSelector);

  if (!container) {
    return;
  }

  if (!product) {
    container.innerHTML = emptyMessage ? `<div class="off-rag-empty">${escapeHtml(emptyMessage)}</div>` : "";
    return;
  }

  const quantityLabel = product.quantity || product.serving || "Quantità non disponibile";
  const nutriscoreLabel = product.nutriscoreGrade ? getNutriscoreLabel(product.nutriscoreGrade) : "Nutri-Score assente";
  const macroLine = [
    product.calories !== null ? `${product.calories} kcal` : null,
    product.protein !== null ? `${product.protein} g proteine` : null,
    product.carbs !== null ? `${product.carbs} g carboidrati` : null,
    product.fats !== null ? `${product.fats} g grassi` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  container.innerHTML = `
    <article class="lookup-result-card">
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.brand || "Brand non disponibile")} · ${escapeHtml(quantityLabel)}</span>
      <div class="lookup-chip-row">
        <span class="lookup-chip ${escapeHtml(getNutriscoreClassName(product.nutriscoreGrade))} nutriscore-chip">${escapeHtml(nutriscoreLabel)}</span>
        <span class="lookup-chip">${product.macroBasis === "serving" ? "Valori per porzione" : "Valori per 100 g/ml"}</span>
      </div>
      ${macroLine ? `<small>${escapeHtml(macroLine)}</small>` : `<small>Macronutrienti non completi nel dataset.</small>`}
    </article>
  `;
}

function setBarcodeScannerStatus(message) {
  const status = document.querySelector("[data-barcode-scanner-status]");

  if (status) {
    status.textContent = message;
  }
}

function getBarcodeScannerModal() {
  return document.querySelector("[data-barcode-scanner-modal]");
}

function getBarcodeScannerSubtitle(target) {
  if (target === "nutrition") {
    return "Scansiona il prodotto per compilare automaticamente i nutrienti del pasto.";
  }

  if (target === "grocery") {
    return "Scansiona il prodotto per recuperare i dati.";
  }

  return "Inquadra il barcode del prodotto.";
}

function openBarcodeScannerModal(target) {
  const modal = getBarcodeScannerModal();
  const subtitle = document.querySelector("[data-barcode-scanner-subtitle]");

  if (!modal) {
    return;
  }

  barcodeScannerRuntime.target = target;
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  if (subtitle) {
    subtitle.textContent = getBarcodeScannerSubtitle(target);
  }
}

function closeBarcodeScannerModal() {
  const modal = getBarcodeScannerModal();
  const video = document.querySelector("[data-barcode-scanner-video]");

  if (barcodeScannerRuntime.detectionLoopId) {
    cancelAnimationFrame(barcodeScannerRuntime.detectionLoopId);
    barcodeScannerRuntime.detectionLoopId = null;
  }

  if (barcodeScannerRuntime.stream) {
    barcodeScannerRuntime.stream.getTracks().forEach((track) => track.stop());
    barcodeScannerRuntime.stream = null;
  }

  barcodeScannerRuntime.detector = null;
  barcodeScannerRuntime.isStarting = false;
  barcodeScannerRuntime.isResolving = false;
  barcodeScannerRuntime.target = "";
  barcodeScannerRuntime.lastDetectedBarcode = "";

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (modal) {
    modal.hidden = true;
  }

  document.body.style.overflow = "";
}

function applyProductToNutritionLookup(product, barcode) {
  const form = document.querySelector("[data-nutrition-form]");

  if (!form) {
    return;
  }

  openFoodFactsRuntime.nutritionLookup = product;
  openFoodFactsRuntime.nutritionDraft = createImportedNutritionDraft(product, "Importato da OpenFoodFacts");
  form.elements.name.value = product.name;
  setFeedback(`Prodotto ${product.name} collegato a OpenFoodFacts. I valori nutrizionali verranno compilati automaticamente.`);
}

function applyProductToGroceryLookup(product, barcode) {
  const form = document.querySelector("[data-grocery-form]");

  if (!form) {
    return;
  }

  openFoodFactsRuntime.groceryLookup = product;
  form.elements.barcode.value = barcode;
  form.elements.name.value = product.name;
  form.elements.quantity.value = product.quantity || product.serving || "1 confezione";
  form.elements.category.value = product.category || "Dispensa";
  renderLookupResult("[data-off-grocery-result]", product);
  setGroceryFeedback(`Prodotto ${product.name} collegato a OpenFoodFacts.`);
}

async function resolveScannedBarcode(barcode) {
  const target = barcodeScannerRuntime.target;
  console.log("[Frontend] Barcode rilevato.", {
    barcode,
    target
  });

  if (!target || barcodeScannerRuntime.isResolving) {
    return;
  }

  barcodeScannerRuntime.isResolving = true;
  barcodeScannerRuntime.lastDetectedBarcode = barcode;
  setBarcodeScannerStatus("Prodotto rilevato. Recupero dati in corso...");

  try {
    const product = await fetchOpenFoodFactsProduct(barcode);

    if (target === "nutrition") {
      applyProductToNutritionLookup(product, barcode);
    } else if (target === "grocery") {
      applyProductToGroceryLookup(product, barcode);
    }

    setBarcodeScannerStatus(`Prodotto ${product.name} trovato. Compilazione completata.`);
    closeBarcodeScannerModal();
  } catch (error) {
    setBarcodeScannerStatus(error.message);

    if (target === "nutrition") {
      setFeedback(error.message);
      renderLookupResult("[data-off-nutrition-result]", null, error.message);
    } else if (target === "grocery") {
      setGroceryFeedback(error.message);
      renderLookupResult("[data-off-grocery-result]", null, error.message);
    }
  } finally {
    barcodeScannerRuntime.isResolving = false;
  }
}

function scheduleBarcodeScannerDetection() {
  const video = document.querySelector("[data-barcode-scanner-video]");

  if (!video || !barcodeScannerRuntime.stream || !barcodeScannerRuntime.detector) {
    return;
  }

  const detectFrame = async () => {
    if (!barcodeScannerRuntime.stream || !barcodeScannerRuntime.detector) {
      return;
    }

    if (!barcodeScannerRuntime.isResolving && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await barcodeScannerRuntime.detector.detect(video);
        const detectedBarcode = sanitizeBarcode(barcodes[0]?.rawValue || "");

        if (detectedBarcode && detectedBarcode !== barcodeScannerRuntime.lastDetectedBarcode) {
          await resolveScannedBarcode(detectedBarcode);
        }
      } catch (error) {
        setBarcodeScannerStatus("Camera attiva, ma la scansione non riesce in questo momento.");
      }
    }

    if (getBarcodeScannerModal()?.hidden !== true) {
      barcodeScannerRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
    }
  };

  barcodeScannerRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
}

async function startBarcodeScanner(target) {
  const video = document.querySelector("[data-barcode-scanner-video]");

  if (!video || barcodeScannerRuntime.isStarting) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    const message = "La camera non è disponibile.";
    setBarcodeScannerStatus(message);
    if (target === "nutrition") {
      setFeedback(message);
    } else {
      setGroceryFeedback(message);
    }
    return;
  }

  if (!("BarcodeDetector" in window)) {
    const message = "Questo browser non supporta BarcodeDetector. Per la scansione usa Chrome o Edge recenti.";
    setBarcodeScannerStatus(message);
    if (target === "nutrition") {
      setFeedback(message);
    } else {
      setGroceryFeedback(message);
    }
    return;
  }

  barcodeScannerRuntime.isStarting = true;
  barcodeScannerRuntime.lastDetectedBarcode = "";
  openBarcodeScannerModal(target);
  setBarcodeScannerStatus("Richiesta accesso alla camera...");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment",
        },
      },
      audio: false,
    });

    barcodeScannerRuntime.stream = stream;
    barcodeScannerRuntime.detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
    });
    video.srcObject = stream;
    await video.play();
    setBarcodeScannerStatus("Centra il bar-code nel riquadro.");
    scheduleBarcodeScannerDetection();
  } catch (error) {
    closeBarcodeScannerModal();
    const message = "Accesso alla camera non disponibile. Verifica permessi.";
    if (target === "nutrition") {
      setFeedback(message);
    } else {
      setGroceryFeedback(message);
    }
  } finally {
    barcodeScannerRuntime.isStarting = false;
  }
}

function setupBarcodeScanner() {
  document.querySelectorAll("[data-open-barcode-scanner]").forEach((button) => {
    button.addEventListener("click", async () => {
      await startBarcodeScanner(button.dataset.openBarcodeScanner);
    });
  });

  document.querySelectorAll("[data-close-barcode-scanner]").forEach((button) => {
    button.addEventListener("click", () => {
      closeBarcodeScannerModal();
    });
  });

  getBarcodeScannerModal()?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeBarcodeScannerModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && getBarcodeScannerModal() && !getBarcodeScannerModal().hidden) {
      closeBarcodeScannerModal();
    }
  });

  window.addEventListener("beforeunload", closeBarcodeScannerModal);
}

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) {
    return null;
  }

  const heightMeters = heightCm / 100;

  if (heightMeters <= 0) {
    return null;
  }

  return weightKg / (heightMeters * heightMeters);
}

function getBmiLabel(bmi) {
  if (!bmi) {
    return "Profilo incompleto";
  }

  if (bmi < 18.5) {
    return "Sottopeso";
  }

  if (bmi < 25) {
    return "Normale";
  }

  if (bmi < 30) {
    return "Sovrappeso";
  }

  return "Obesità";
}

function getActivityMultiplier(level) {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    "very-active": 1.9,
  };

  return multipliers[level] || multipliers.moderate;
}

function getActivityLabel(level) {
  const labels = {
    sedentary: "sedentario",
    light: "poco attivo",
    moderate: "moderato",
    active: "attivo",
    "very-active": "molto attivo",
  };

  return labels[level] || labels.moderate;
}

function calculateProfileRecommendations(personal) {
  const age = normalizeNumber(personal.age);
  const heightCm = normalizeNumber(personal.heightCm);
  const currentWeightKg = normalizeNumber(personal.currentWeightKg);
  const targetWeightKg = normalizeNumber(personal.targetWeightKg);
  const gender = personal.gender || "male";

  if (!age || !heightCm || !currentWeightKg) {
    return {
      tdee: null,
      calories: null,
      protein: null,
      carbs: null,
      fats: null,
      note: "Completa altezza, peso ed età per ottenere obiettivi personalizzati.",
      calorieNote: "Le raccomandazioni appariranno dopo aver completato il profilo.",
    };
  }

  const bmrBase =
    10 * currentWeightKg +
    6.25 * heightCm -
    5 * age +
    (gender === "female" ? -161 : gender === "male" ? 5 : -78);
  const tdee = Math.round(bmrBase * getActivityMultiplier(personal.activityLevel));

  let recommendedCalories = tdee;
  let calorieNote = "Target di mantenimento basato sul tuo profilo.";

  if (targetWeightKg && targetWeightKg < currentWeightKg) {
    recommendedCalories = Math.round(tdee - 500);
    calorieNote = "Deficit moderato per supportare la perdita di peso.";
  } else if (targetWeightKg && targetWeightKg > currentWeightKg) {
    recommendedCalories = Math.round(tdee + 250);
    calorieNote = "Surplus moderato per supportare l'aumento di peso.";
  }

  const protein = Math.round(currentWeightKg * 2);
  const fats = Math.round((recommendedCalories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((recommendedCalories - protein * 4 - fats * 9) / 4));

  return {
    tdee,
    calories: recommendedCalories,
    protein,
    carbs,
    fats,
    note: `Basato su un livello di attività ${getActivityLabel(personal.activityLevel)}.`,
    calorieNote,
  };
}

function buildIngredientLine(component) {
  return `${component.amount} ${component.name}`;
}

function sumRecipeNutrition(components) {
  return components.reduce(
    (totals, component) => ({
      calories: totals.calories + component.calories,
      protein: totals.protein + component.protein,
      carbs: totals.carbs + component.carbs,
      fats: totals.fats + component.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

function getRecentRecipeSignatures(limit = 10) {
  return appState.recipes.history.slice(0, limit).map((entry) => entry.signature).filter(Boolean);
}

function getPromptTokens(prompt) {
  return String(prompt || "")
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .filter((token) => token.length >= 3);
}

function getComparableTokens(value, options = {}) {
  const includeGenericTokens = options.includeGenericTokens === true;
  const tokens = normalizeComparableText(value)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !RECIPE_TOKEN_STOPWORDS.has(token));

  const filteredTokens = includeGenericTokens
    ? tokens
    : tokens.filter((token) => !RECIPE_GENERIC_TOKENS.has(token));

  return filteredTokens.length > 0 ? filteredTokens : tokens;
}

function buildRecipeComponentCatalog() {
  const proteins = {
    chicken: { name: "pollo grigliato", amount: "160 g di", calories: 260, protein: 34, carbs: 0, fats: 11, diets: ["balanced", "high-protein"], tags: ["pollo", "proteico", "grigliato"] },
    salmon: { name: "salmone al forno", amount: "150 g di", calories: 310, protein: 30, carbs: 0, fats: 20, diets: ["balanced", "high-protein"], tags: ["salmone", "pesce", "omega"] },
    turkey: { name: "fesa di tacchino", amount: "160 g di", calories: 220, protein: 36, carbs: 0, fats: 6, diets: ["balanced", "high-protein"], tags: ["tacchino", "lean"] },
    tofu: { name: "tofu croccante", amount: "180 g di", calories: 250, protein: 22, carbs: 8, fats: 15, diets: ["balanced", "vegetarian", "vegan"], tags: ["tofu", "vegano"] },
    tempeh: { name: "tempeh saltato", amount: "150 g di", calories: 290, protein: 27, carbs: 16, fats: 14, diets: ["balanced", "vegetarian", "vegan", "high-protein"], tags: ["tempeh", "vegano", "fermentato"] },
    eggs: { name: "uova strapazzate", amount: "3", calories: 230, protein: 21, carbs: 2, fats: 15, diets: ["balanced", "vegetarian", "high-protein"], tags: ["uova", "colazione", "proteico"] },
    yogurt: { name: "yogurt greco", amount: "170 g di", calories: 110, protein: 18, carbs: 5, fats: 2, diets: ["balanced", "vegetarian", "high-protein"], tags: ["yogurt", "cremoso"] },
    hummus: { name: "hummus", amount: "90 g di", calories: 210, protein: 7, carbs: 17, fats: 12, diets: ["balanced", "vegetarian", "vegan"], tags: ["hummus", "ceci"] },
    beans: { name: "ceci speziati", amount: "170 g di", calories: 260, protein: 13, carbs: 34, fats: 8, diets: ["balanced", "vegetarian", "vegan"], tags: ["ceci", "legumi"] },
  };

  const carbs = {
    oats: { name: "fiocchi d'avena", amount: "55 g di", calories: 214, protein: 7, carbs: 36, fats: 4, mealTypes: ["breakfast", "snack"], tags: ["avena", "colazione"] },
    granola: { name: "granola croccante", amount: "35 g di", calories: 158, protein: 4, carbs: 24, fats: 5, mealTypes: ["breakfast", "snack"], tags: ["granola", "croccante"] },
    toast: { name: "pane integrale tostato", amount: "2 fette di", calories: 170, protein: 8, carbs: 28, fats: 3, mealTypes: ["breakfast", "snack"], tags: ["toast", "pane"] },
    rice: { name: "riso integrale", amount: "150 g di", calories: 220, protein: 5, carbs: 46, fats: 2, mealTypes: ["lunch", "dinner"], tags: ["riso", "bowl"] },
    quinoa: { name: "quinoa", amount: "150 g di", calories: 225, protein: 8, carbs: 39, fats: 4, mealTypes: ["lunch", "dinner"], tags: ["quinoa", "gluten free"] },
    pasta: { name: "pasta integrale", amount: "85 g di", calories: 298, protein: 11, carbs: 56, fats: 3, mealTypes: ["lunch", "dinner"], tags: ["pasta", "comfort"] },
    potatoes: { name: "patate arrosto", amount: "220 g di", calories: 210, protein: 5, carbs: 40, fats: 4, mealTypes: ["lunch", "dinner"], tags: ["patate", "forno"] },
    wrap: { name: "wrap integrale", amount: "1", calories: 190, protein: 7, carbs: 31, fats: 5, mealTypes: ["lunch", "dinner"], tags: ["wrap", "piadina"] },
    fruit: { name: "frutta fresca", amount: "120 g di", calories: 72, protein: 1, carbs: 18, fats: 0, mealTypes: ["breakfast", "snack"], tags: ["frutta", "dolce"] },
  };

  const vegetables = {
    berries: { name: "frutti rossi", amount: "90 g di", calories: 40, protein: 1, carbs: 9, fats: 0, tags: ["frutti", "berries"] },
    apple: { name: "mela e cannella", amount: "1 porzione di", calories: 78, protein: 0, carbs: 20, fats: 0, tags: ["mela", "cannella"] },
    banana: { name: "banana a rondelle", amount: "1", calories: 96, protein: 1, carbs: 23, fats: 0, tags: ["banana"] },
    spinachTomato: { name: "spinaci e pomodorini", amount: "120 g di", calories: 38, protein: 3, carbs: 6, fats: 0, tags: ["spinaci", "pomodorini"] },
    mediterranean: { name: "verdure mediterranee", amount: "180 g di", calories: 72, protein: 3, carbs: 13, fats: 2, tags: ["zucchine", "peperoni", "pomodorini"] },
    broccoliCarrot: { name: "broccoli e carote", amount: "180 g di", calories: 84, protein: 5, carbs: 15, fats: 1, tags: ["broccoli", "carote"] },
    mushrooms: { name: "funghi e zucchine", amount: "170 g di", calories: 58, protein: 4, carbs: 9, fats: 1, tags: ["funghi", "zucchine"] },
    cucumberTomato: { name: "cetriolo e pomodoro", amount: "160 g di", calories: 42, protein: 2, carbs: 8, fats: 0, tags: ["cetriolo", "pomodoro"] },
  };

  const extras = {
    chia: { name: "semi di chia", amount: "10 g di", calories: 49, protein: 2, carbs: 4, fats: 3, tags: ["chia", "fibre"] },
    nuts: { name: "noci tritate", amount: "12 g di", calories: 78, protein: 2, carbs: 2, fats: 7, tags: ["noci", "crunch"] },
    avocado: { name: "avocado", amount: "70 g di", calories: 112, protein: 1, carbs: 6, fats: 10, tags: ["avocado", "healthy fats"] },
    feta: { name: "feta", amount: "35 g di", calories: 93, protein: 5, carbs: 1, fats: 7, tags: ["feta", "mediterraneo"] },
    parmesan: { name: "parmigiano", amount: "15 g di", calories: 58, protein: 5, carbs: 0, fats: 4, tags: ["parmigiano"] },
    tahini: { name: "salsa tahina e limone", amount: "18 g di", calories: 95, protein: 3, carbs: 3, fats: 8, tags: ["tahina", "limone"] },
    pesto: { name: "pesto leggero", amount: "20 g di", calories: 86, protein: 2, carbs: 2, fats: 8, tags: ["pesto"] },
    yogurtSauce: { name: "salsa yogurt e senape", amount: "35 g di", calories: 42, protein: 4, carbs: 2, fats: 1, tags: ["yogurt", "senape"] },
  };

  return { proteins, carbs, vegetables, extras };
}

function getRecipeFormatTemplates(mealType) {
  const templates = {
    breakfast: [
      { id: "bowl", title: "{proteinLabel} Bowl con {vegLabel}", description: "Colazione cremosa e bilanciata, pronta in pochi minuti.", duration: 8, servings: 1, difficulty: "Facile" },
      { id: "overnight", title: "Overnight {carbLabel} con {vegLabel}", description: "Preparazione da fare in anticipo per una mattina piu semplice.", duration: 10, servings: 1, difficulty: "Facile" },
      { id: "toast", title: "Toast di {proteinLabel} con {vegLabel}", description: "Colazione salata ad alto potere saziante.", duration: 10, servings: 1, difficulty: "Facile" },
      { id: "scramble", title: "{proteinLabel} con {carbLabel} e {vegLabel}", description: "Piatto proteico veloce, ottimo anche per brunch.", duration: 12, servings: 1, difficulty: "Facile" },
    ],
    snack: [
      { id: "cup", title: "Cup di {proteinLabel} con {vegLabel}", description: "Snack rapido con buon equilibrio tra proteine e carboidrati.", duration: 6, servings: 1, difficulty: "Facile" },
      { id: "toast-snack", title: "Toast snack con {proteinLabel} e {vegLabel}", description: "Spuntino piu sostanzioso ma ancora semplice da preparare.", duration: 7, servings: 1, difficulty: "Facile" },
      { id: "box", title: "Snack box con {proteinLabel} e {vegLabel}", description: "Idea pratica da portare fuori casa o in ufficio.", duration: 5, servings: 1, difficulty: "Facile" },
    ],
    lunch: [
      { id: "bowl", title: "{proteinLabel} Bowl con {carbLabel} e {vegLabel}", description: "Piatto unico completo, adatto a pausa pranzo e meal prep.", duration: 24, servings: 2, difficulty: "Facile" },
      { id: "wrap", title: "Wrap di {proteinLabel} con {vegLabel}", description: "Pranzo veloce e portabile, con buon bilanciamento dei macro.", duration: 18, servings: 1, difficulty: "Facile" },
      { id: "pasta", title: "{carbLabel} con {proteinLabel} e {vegLabel}", description: "Versione smart di un comfort food, piu centrata sugli obiettivi nutrizionali.", duration: 26, servings: 2, difficulty: "Media" },
      { id: "salad", title: "Insalata completa di {proteinLabel} e {vegLabel}", description: "Pranzo fresco, leggero ma con una quota proteica credibile.", duration: 16, servings: 1, difficulty: "Facile" },
    ],
    dinner: [
      { id: "plate", title: "{proteinLabel} con {carbLabel} e {vegLabel}", description: "Cena completa e gestibile anche in settimana.", duration: 28, servings: 2, difficulty: "Facile" },
      { id: "stirfry", title: "Stir-fry di {proteinLabel} con {vegLabel}", description: "Cena rapida in padella con sapori netti e buon volume.", duration: 20, servings: 2, difficulty: "Facile" },
      { id: "traybake", title: "Teglia di {proteinLabel} e {vegLabel}", description: "Versione da forno con poca gestione e ottima resa per meal prep.", duration: 32, servings: 2, difficulty: "Facile" },
      { id: "bowl", title: "Power bowl di {proteinLabel} con {carbLabel}", description: "Cena energizzante pensata per recupero e sazieta'.", duration: 25, servings: 2, difficulty: "Media" },
    ],
  };

  return templates[mealType] || templates.dinner;
}

function getRecipeIngredientVocabulary() {
  const catalog = buildRecipeComponentCatalog();
  const values = [
    ...Object.values(catalog.proteins),
    ...Object.values(catalog.carbs),
    ...Object.values(catalog.vegetables),
    ...Object.values(catalog.extras),
  ];

  return [...new Set(values.flatMap((item) => getComparableTokens([item.name, ...(item.tags || [])].join(" "))))];
}

function extractMaxDurationFromPrompt(prompt) {
  const match = String(prompt || "").match(/(\d+)\s*(?:min|mins|minuti|minute)\b/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseRecipePromptConstraints(prompt) {
  const normalizedPrompt = normalizeComparableText(prompt);
  const ingredientVocabulary = getRecipeIngredientVocabulary();
  const requestedIngredientTerms = ingredientVocabulary.filter((term) => normalizedPrompt.includes(term));

  return {
    normalizedPrompt,
    wantsPantry: /(dispensa|frigo|pantry|ingredienti gia|ingredienti già|quello che ho|quello che c e|quello che c'è)/i.test(prompt),
    strictPantry: /(usa|utilizza|solo|quello che ho|che ho in dispensa|che ho in frigo|ingredienti gia|ingredienti già)/i.test(prompt),
    maxDuration: extractMaxDurationFromPrompt(prompt),
    excludeLactose: /(senza lattosio|lactose free)/i.test(prompt),
    excludeGluten: /(senza glutine|gluten free)/i.test(prompt),
    preferHighProtein: /(high protein|proteic|proteica|proteico|ricco di proteine)/i.test(prompt),
    requestedIngredientTerms,
  };
}

function getRecipeSearchText(recipe) {
  return normalizeComparableText([
    recipe.title,
    recipe.description,
    ...(recipe.ingredients || []),
    ...(recipe.instructions || []),
  ].join(" "));
}

function textContainsComparableToken(text, token) {
  return getComparableTokens(text, { includeGenericTokens: true }).some(
    (candidate) => candidate === token || candidate.includes(token) || token.includes(candidate)
  );
}

function getRecipeConstraintViolations(recipe, constraints, pantryMatches) {
  const violations = [];
  const recipeText = getRecipeSearchText(recipe);
  const maxDuration = Number(recipe.duration) || 0;

  if (constraints.maxDuration && maxDuration > constraints.maxDuration) {
    violations.push("max-duration");
  }

  if (constraints.excludeLactose && /yogurt|feta|parmigiano|latte/.test(recipeText)) {
    violations.push("exclude-lactose");
  }

  if (constraints.excludeGluten && /pasta|pane|toast|wrap|granola|avena/.test(recipeText)) {
    violations.push("exclude-gluten");
  }

  if (constraints.preferHighProtein) {
    const proteinTarget = recipe.mealTypes?.includes("snack") || recipe.mealTypes?.includes("breakfast") ? 18 : 25;

    if ((Number(recipe.protein) || 0) < proteinTarget) {
      violations.push("high-protein");
    }
  }

  if (constraints.requestedIngredientTerms.some((term) => !textContainsComparableToken(recipeText, term))) {
    violations.push("ingredient-term");
  }

  if (constraints.strictPantry && appState.grocery.pantry.length > 0 && pantryMatches.length === 0) {
    violations.push("pantry");
  }

  return violations;
}

function getRecipeCriteriaNote(violations, constraints) {
  if (violations.length === 0) {
    return "";
  }

  if (violations.includes("pantry") && constraints.wantsPantry) {
    return "Nessun match diretto con la dispensa.";
  }

  if (violations.includes("ingredient-term")) {
    return "Non ho trovato una ricetta che includa tutti gli ingredienti richiesti, quindi ho scelto l'alternativa più coerente.";
  }

  if (violations.includes("max-duration")) {
    return "Non ho trovato una ricetta dentro il tempo richiesto, quindi ho scelto l'opzione più vicina.";
  }

  if (violations.includes("exclude-lactose") || violations.includes("exclude-gluten")) {
    return "Non ho trovato una ricetta che rispetti completamente tutte le esclusioni richieste.";
  }

  if (violations.includes("high-protein")) {
    return "Non ho trovato una ricetta high-protein, quindi ho scelto il compromesso più vicino.";
  }

  return "";
}

function getRecipeComponentSets(filters) {
  const catalog = buildRecipeComponentCatalog();
  const mealType = filters.mealType;
  const dietType = filters.dietType;
  const prompt = String(filters.prompt || "").toLowerCase();

  const proteins = Object.values(catalog.proteins).filter((item) => item.diets.includes(dietType) && (!prompt.includes("senza lattosio") || !/yogurt/.test(item.name)));
  const carbs = Object.values(catalog.carbs).filter((item) => item.mealTypes.includes(mealType));
  const vegetables = Object.values(catalog.vegetables);
  const extras = Object.values(catalog.extras).filter((item) => {
    if (dietType === "vegan") {
      return !/feta|parmigiano|yogurt/.test(item.name);
    }

    return true;
  });

  return { proteins, carbs, vegetables, extras };
}

function buildRecipeInstructions(mealType, template, parts) {
  const intro = {
    breakfast: `Prepara ${parts.carb.name} e tieni pronta la base proteica.`,
    snack: `Sistema ${parts.protein.name} e ${parts.vegetable.name} in una bowl o lunch box.`,
    lunch: `Cuoci ${parts.carb.name} e prepara ${parts.protein.name} come componente principale.`,
    dinner: `Prepara ${parts.protein.name} e porta a cottura ${parts.carb.name} o l'accompagnamento scelto.`,
  };

  const finishingVerb = template.id === "traybake" ? "Completa la teglia" : "Completa il piatto";

  return [
    intro[mealType] || intro.dinner,
    `Aggiungi ${parts.vegetable.name} e condisci con ${parts.extra.name}.`,
    `${finishingVerb} regolando sale, spezie ed eventuale succo di limone secondo gusto.`,
    mealType === "breakfast" || mealType === "snack"
      ? "Servi subito oppure conserva in frigo se vuoi prepararlo in anticipo."
      : "Impiatta e tieni da parte una porzione extra se vuoi usarla per meal prep.",
  ];
}

function buildGeneratedRecipeCandidate(filters, template, parts) {
  const nutrition = sumRecipeNutrition([parts.protein, parts.carb, parts.vegetable, parts.extra]);
  const title = template.title
    .replace("{proteinLabel}", parts.protein.name)
    .replace("{carbLabel}", parts.carb.name)
    .replace("{vegLabel}", parts.vegetable.name);
  const signature = slugifyRecipeValue(`${filters.mealType}-${filters.dietType}-${template.id}-${parts.protein.name}-${parts.carb.name}-${parts.vegetable.name}-${parts.extra.name}`);
  const recipe = {
    id: `recipe-${signature}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: template.description,
    calories: roundMacroValue(nutrition.calories),
    protein: roundMacroValue(nutrition.protein),
    carbs: roundMacroValue(nutrition.carbs),
    fats: roundMacroValue(nutrition.fats),
    duration: template.duration,
    servings: template.servings,
    difficulty: template.difficulty,
    dietTypes: [filters.dietType],
    mealTypes: [filters.mealType],
    ingredients: [
      buildIngredientLine(parts.protein),
      buildIngredientLine(parts.carb),
      buildIngredientLine(parts.vegetable),
      buildIngredientLine(parts.extra),
      "Sale, pepe e spezie a piacere",
    ],
    instructions: buildRecipeInstructions(filters.mealType, template, parts),
    generatedAt: new Date().toISOString(),
    prompt: String(filters.prompt || "").trim(),
    mode: "generated-local",
    signature,
  };

  return recipe;
}

function buildGeneratedRecipeCandidates(filters) {
  const templates = getRecipeFormatTemplates(filters.mealType);
  const { proteins, carbs, vegetables, extras } = getRecipeComponentSets(filters);
  const candidates = [];

  templates.forEach((template, templateIndex) => {
    proteins.forEach((protein, proteinIndex) => {
      carbs.forEach((carb, carbIndex) => {
        vegetables.forEach((vegetable, vegetableIndex) => {
          const extra = extras[(templateIndex + proteinIndex + carbIndex + vegetableIndex) % extras.length];

          if (!extra) {
            return;
          }

          candidates.push(buildGeneratedRecipeCandidate(filters, template, { protein, carb, vegetable, extra }));
        });
      });
    });
  });

  return candidates;
}

function recipeMatchesPrompt(recipe, prompt) {
  if (!prompt) {
    return true;
  }

  const searchableText = [
    recipe.title,
    recipe.description,
    ...recipe.ingredients,
    ...recipe.instructions,
  ]
    .join(" ")
    .toLowerCase();

  const promptTokens = prompt
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .filter((token) => token.length >= 3);

  if (promptTokens.length === 0) {
    return true;
  }

  return promptTokens.some((token) => searchableText.includes(token));
}

function buildRecipeRecommendation(filters) {
  const targetCalories = Number(filters.caloriesTarget) || 500;
  const prompt = String(filters.prompt || "").trim();
  const pantryNames = appState.grocery.pantry.map((item) => item.name.toLowerCase());
  const recentSignatures = getRecentRecipeSignatures();
  const constraints = parseRecipePromptConstraints(prompt);
  const promptTokens = getPromptTokens(prompt);
  const candidatePool = [
    ...buildGeneratedRecipeCandidates(filters),
    ...recipeLibrary
      .filter((recipe) => recipe.dietTypes.includes(filters.dietType))
      .filter((recipe) => recipe.mealTypes.includes(filters.mealType))
      .map((recipe) => ({
        ...recipe,
        generatedAt: new Date().toISOString(),
        prompt,
        mode: "seed-library",
        signature: recipe.id,
      })),
  ];
  const rankedRecipes = candidatePool
    .map((recipe) => {
      const pantryMatches = getPantryMatchesForRecipe(recipe);
      const violations = getRecipeConstraintViolations(recipe, constraints, pantryMatches);
      const calorieDelta = Math.abs(recipe.calories - targetCalories);
      const pantryBonus = pantryMatches.length * (constraints.wantsPantry ? 70 : 28);
      const requestedBonus = constraints.wantsPantry && pantryMatches.length > 0 ? 120 : 0;
      const promptBonus = promptTokens.length > 0 ? Math.min(promptTokens.filter((token) => recipeMatchesPrompt(recipe, token)).length * 18, 72) : 0;
      const noveltyPenalty = recentSignatures.includes(recipe.signature) ? 180 : 0;
      const violationPenalty = violations.length * 320;

      return {
        recipe,
        pantryMatches,
        violations,
        score: calorieDelta + noveltyPenalty + violationPenalty - pantryBonus - requestedBonus - promptBonus,
      };
    })
    .sort((firstItem, secondItem) => firstItem.score - secondItem.score);

  if (rankedRecipes.length === 0) {
    const emergencyRecipe = {
      ...recipeLibrary[0],
      generatedAt: new Date().toISOString(),
      prompt,
      mode: "seed-library",
      signature: recipeLibrary[0].id,
    };

    registerRecipe(emergencyRecipe);
    return emergencyRecipe;
  }

  const topCandidates = rankedRecipes.slice(0, Math.min(6, rankedRecipes.length));
  const selectableCandidates = topCandidates.length > 0 ? topCandidates : rankedRecipes;
  const selectionWindow = selectableCandidates.filter((entry) => entry.score <= selectableCandidates[0].score + 90);
  const fallbackRecipe = selectionWindow[Math.floor(Math.random() * selectionWindow.length)] || rankedRecipes[0];
  const selectedRecipe = fallbackRecipe.recipe;
  const pantryMatches = fallbackRecipe.pantryMatches;
  const criteriaNote = getRecipeCriteriaNote(fallbackRecipe.violations, constraints);
  const pantryNote =
    pantryMatches.length > 0
      ? `Hai già in dispensa: ${pantryMatches.join(", ")}.`
        : pantryNames.length > 0
        ? "Nessun match diretto con la dispensa."
        : "Aggiungi ingredienti alla Shopping List o alla dispensa per suggerimenti ancora più mirati.";

  const recipe = {
    ...selectedRecipe,
    prompt,
    generatedAt: new Date().toISOString(),
    pantryMatches,
    pantryNote,
    criteriaNote,
    personalNote: `Suggerita per ${getRecipeMealLabel(filters.mealType).toLowerCase()} ${getRecipeDietLabel(filters.dietType).toLowerCase()} intorno a ${targetCalories} kcal, con priorita a varieta e coerenza nutrizionale.`,
  };

  registerRecipe(recipe);
  return recipe;
}

function saveRecipeToHistory(recipe) {
  registerRecipe(recipe);
  appState.recipes.history = [
    {
      id: recipe.id,
      title: recipe.title,
      generatedAt: recipe.generatedAt,
      signature: recipe.signature || recipe.id,
    },
    ...appState.recipes.history.filter(
      (entry) => entry.id !== recipe.id && entry.signature !== (recipe.signature || recipe.id)
    ),
  ].slice(0, 6);
}

function buildRecipeAssistantReply(message) {
  const prompt = message.toLowerCase();
  const pantryNames = appState.grocery.pantry.map((item) => item.name);

  if (prompt.includes("meal prep")) {
    return `Per il meal prep ti conviene puntare su 2 basi riutilizzabili: ${pantryNames.includes("Riso integrale") ? "riso integrale" : "un cereale"} e una proteina già cotta. Prepara 3 bowl variando condimenti e verdure, così riduci il tempo nei giorni feriali.`;
  }

  if (prompt.includes("colazione")) {
    return "Una buona colazione semplice e bilanciata può partire da overnight oats, yogurt bowl proteica oppure toast salato con uova e verdure, in base al tempo che hai.";
  }

  if (prompt.includes("cena")) {
    return `Per una cena veloce puoi partire da ${pantryNames.includes("Petto di pollo") ? "petto di pollo e verdure" : "una bowl proteica"} e tenerti tra 500 e 650 kcal. Se vuoi posso anche strutturarla in ingredienti, passaggi e macro stimati.`;
  }

  if (prompt.includes("veg") || prompt.includes("vegan") || prompt.includes("vegetar")) {
    return "Per richieste vegetali possiamo orientarci su tofu, tempeh, ceci o bowl con quinoa, variando salsa e verdure per non ripetere sempre la stessa ricetta.";
  }

  if (prompt.includes("dispensa") || prompt.includes("ingredient")) {
    return pantryNames.length > 0
      ? `In questo momento la dispensa contiene: ${pantryNames.join(", ")}. Posso usarli per proporti una ricetta realistica, con sostituzioni e passaggi essenziali.`
      : "Dispensa vuota.";
  }

  return "Posso aiutarti con idee di ricette, meal prep, sostituzioni ingredienti e adattamenti in base a calorie target, tipo di dieta e alimenti gia presenti.";
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

function renderMarkdownBlock(block) {
  const trimmed = block.trim();

  if (!trimmed) {
    return "";
  }

  if (/^---+$/.test(trimmed)) {
    return "<hr />";
  }

  if (/^(\-|\*)\s+/m.test(trimmed) && trimmed.split("\n").every((line) => /^(\-|\*)\s+/.test(line.trim()))) {
    const items = trimmed
      .split("\n")
      .map((line) => line.trim().replace(/^(\-|\*)\s+/, ""))
      .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (/^\d+\.\s+/m.test(trimmed) && trimmed.split("\n").every((line) => /^\d+\.\s+/.test(line.trim()))) {
    const items = trimmed
      .split("\n")
      .map((line) => line.trim().replace(/^\d+\.\s+/, ""))
      .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  return `<p>${trimmed.split("\n").map((line) => formatInlineMarkdown(line)).join("<br />")}</p>`;
}

function renderChatMarkdown(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((block) => renderMarkdownBlock(block))
    .filter(Boolean)
    .join("");
}

function generateRecipeSuggestion(filters) {
  return buildRecipeRecommendation(filters);
}

function getRecipeChatOpenFoodFactsKnowledge() {
  ensureOpenFoodFactsState();

  // I record RAG inviati al backend rappresentano solo prodotti già acquisiti
  // dall'app tramite scan/lookup OpenFoodFacts. In questo modo il modello usa
  // il dataset come knowledge base locale, senza sostituire i nutrienti
  // strutturati che restano gestiti dal flusso deterministico del prodotto.
  return Object.values(appState.datasets.openFoodFacts.productsByBarcode || {})
    .slice(0, 24)
    .map((product) => buildOpenFoodFactsRagRecord(product));
}

function buildRecipeChatContext() {
  return {
    pantry: appState.grocery.pantry.slice(0, 12).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category,
    })),
    profile: {
      calories: appState.profile.goals.calories,
      protein: appState.profile.goals.protein,
      carbs: appState.profile.goals.carbs,
      fats: appState.profile.goals.fats,
      dietType: appState.profile.personal.dietType,
      activityLevel: appState.profile.personal.activityLevel,
    },
    generator: appState.recipes.generator,
    currentRecipe: appState.recipes.currentRecipe
      ? {
          title: appState.recipes.currentRecipe.title,
          calories: appState.recipes.currentRecipe.calories,
          protein: appState.recipes.currentRecipe.protein,
          carbs: appState.recipes.currentRecipe.carbs,
          fats: appState.recipes.currentRecipe.fats,
          ingredients: appState.recipes.currentRecipe.ingredients,
        }
      : null,
    openFoodFactsKnowledge: {
      provider: "OpenFoodFacts",
      records: getRecipeChatOpenFoodFactsKnowledge(),
    },
  };
}

async function getRecipeAssistantResponse(message) {
  const history = appState.recipes.chatMessages.slice(-8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  console.log("[Frontend] Invio messaggio chat al backend.", {
    messageLength: message.length
  });
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        context: buildRecipeChatContext(),
      }),
      signal: controller.signal,
    });

    const payload = await response.json();
    console.log("[Frontend] Risposta chat ricevuta dal backend.", payload);

    if (!response.ok) {
      throw new Error(payload.error || "Backend non raggiungibile.");
    }

    if (!payload.reply) {
      throw new Error("Risposta del backend non valida.");
    }

    return payload.reply;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La risposta ha impiegato troppo tempo.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function renderRecipeResult() {
  const container = document.querySelector("[data-recipe-result]");
  const recipe = appState.recipes.currentRecipe;

  if (!container) {
    return;
  }

  if (!recipe) {
    container.innerHTML = `
      <article class="empty-state">
        <h3>Nessuna ricetta generata</h3>
        <p>Imposta i criteri qui accanto e genera una proposta basata sui tuoi vincoli reali.</p>
      </article>
    `;
    return;
  }

  const isSaved = appState.recipes.savedRecipeIds.includes(recipe.id);

  container.innerHTML = `
    <div class="result-head">
      <div>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p>${escapeHtml(recipe.description)}</p>
        <div class="inline-meta">
          <span>${recipe.duration} min</span>
          <span>${recipe.servings} porzioni</span>
          <span>${escapeHtml(recipe.difficulty)}</span>
          <span>${escapeHtml(getRecipeMealLabel(appState.recipes.generator.mealType))}</span>
        </div>
      </div>
      <div class="calorie-badge">
        <strong>${recipe.calories}</strong>
        <span>calorie</span>
      </div>
    </div>
    <div class="recipe-actions-row">
      <button class="primary-btn primary-btn-blue" type="button" data-save-current-recipe>${isSaved ? "Rimuovi dai salvati" : "Salva ricetta"}</button>
      <button class="recipe-secondary-btn" type="button" data-apply-current-recipe-to-nutrition>Usa in Nutrition</button>
    </div>
    <div class="macro-pill-row">
      <span>Proteine ${recipe.protein}g</span>
      <span>Carboidrati ${recipe.carbs}g</span>
      <span>Grassi ${recipe.fats}g</span>
      <span>Generata ${escapeHtml(formatDateTime(recipe.generatedAt))}</span>
    </div>
    ${
      recipe.pantryNote || recipe.criteriaNote
        ? `
      <div class="lookup-chip-row">
        ${recipe.pantryNote ? `<span class="lookup-chip">${escapeHtml(recipe.pantryNote)}</span>` : ""}
        ${recipe.criteriaNote ? `<span class="lookup-chip">${escapeHtml(recipe.criteriaNote)}</span>` : ""}
      </div>
    `
        : ""
    }
    <div class="two-col-copy">
      <div>
        <h4>Ingredienti</h4>
        <ul>
          ${recipe.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
        </ul>
      </div>
      <div>
        <h4>Istruzioni</h4>
        <ol>
          ${recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </div>
    </div>
  `;
}

function renderRecipeHistory() {
  const container = document.querySelector("[data-recipe-history]");

  if (!container) {
    return;
  }

  if (appState.recipes.history.length === 0) {
    container.innerHTML = `<p class="recipe-side-empty">Nessuna generazione ancora.</p>`;
    return;
  }

  container.innerHTML = appState.recipes.history
    .map(
      (entry) => `
        <button class="recipe-history-item" type="button" data-recipe-history-id="${entry.id}">
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(formatDateTime(entry.generatedAt))}</span>
        </button>
      `
    )
    .join("");
}

function renderSavedRecipes() {
  const container = document.querySelector("[data-saved-recipes]");

  if (!container) {
    return;
  }

  if (appState.recipes.savedRecipeIds.length === 0) {
    container.innerHTML = `<p class="recipe-side-empty">Salva le ricette migliori per ritrovarle qui.</p>`;
    return;
  }

  container.innerHTML = appState.recipes.savedRecipeIds
    .map((recipeId) => getRecipeById(recipeId))
    .filter(Boolean)
    .map(
      (recipe) => `
        <button class="recipe-saved-item" type="button" data-recipe-saved-id="${recipe.id}">
          <strong>${escapeHtml(recipe.title)}</strong>
          <span>${recipe.calories} kcal</span>
        </button>
      `
    )
    .join("");
}

function renderRecipeChat() {
  const container = document.querySelector("[data-recipe-chat-messages]");

  if (!container) {
    return;
  }

  const messagesMarkup = appState.recipes.chatMessages
    .map(
      (message) => `
        <article class="message-card ${message.role === "user" ? "message-card-user" : ""}">
          <div class="message-markdown">${message.role === "assistant" ? renderChatMarkdown(message.content) : `<p>${escapeHtml(message.content)}</p>`}</div>
          <time datetime="${escapeHtml(message.createdAt)}">${escapeHtml(formatDateTime(message.createdAt))}</time>
        </article>
      `
    )
    .join("");
  const typingMarkup = recipeChatRuntime.isWaiting
    ? `
      <article class="message-card message-card-typing" aria-live="polite">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>Sto scrivendo...</p>
      </article>
    `
    : "";

  container.innerHTML = `${messagesMarkup}${typingMarkup}`;

  container.scrollTop = container.scrollHeight;
}

function renderRecipes() {
  const form = document.querySelector("[data-recipe-generator-form]");

  if (form) {
    form.elements.dietType.value = appState.recipes.generator.dietType;
    form.elements.caloriesTarget.value = appState.recipes.generator.caloriesTarget;
    form.elements.mealType.value = appState.recipes.generator.mealType;
    form.elements.prompt.value = appState.recipes.generator.prompt;
  }

  renderRecipeResult();
  renderRecipeHistory();
  renderSavedRecipes();
  renderRecipeChat();
}

function getSuggestedMealTime(mealType) {
  const defaults = {
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "20:00",
    snack: "16:30",
  };

  return defaults[mealType] || "";
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9àèéìòù]+/g, " ")
    .trim();
}

function parseQuantityLabel(quantityLabel) {
  const raw = String(quantityLabel || "").trim();
  const match = raw.match(/(\d+(?:[.,]\d+)?)(?:\s*([a-zA-Zà-ÿ]+))?/);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);
  const unit = String(match[2] || "").toLowerCase();

  if (value == null) {
    return null;
  }

  return {
    raw,
    value,
    unit,
  };
}

function normalizeQuantityUnit(unit) {
  if (!unit) {
    return "";
  }

  if (unit === "kg") {
    return "g";
  }

  if (unit === "l") {
    return "ml";
  }

  return unit;
}

function convertQuantityToBaseUnit(value, unit) {
  const normalizedUnit = normalizeQuantityUnit(unit);

  if (unit === "kg") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  if (unit === "l") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  return { value, unit: normalizedUnit };
}

function formatQuantityValue(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10).replace(".", ",");
}

function formatPantryQuantity(value, unit, fallbackRaw) {
  if (!unit) {
    return fallbackRaw || formatQuantityValue(value);
  }

  return `${formatQuantityValue(value)} ${unit}`;
}

function findMatchingRecipeIngredient(recipe, pantryItem) {
  if (!recipe || !pantryItem) {
    return null;
  }

  const pantryName = normalizeComparableText(pantryItem.name);
  const pantryTokens = getComparableTokens(pantryItem.name);

  return recipe.ingredients.find((ingredient) => {
    const normalizedIngredient = normalizeComparableText(ingredient);
    const ingredientTokens = getComparableTokens(ingredient);
    const hasTokenOverlap = pantryTokens.some((pantryToken) =>
      ingredientTokens.some(
        (ingredientToken) =>
          ingredientToken === pantryToken || ingredientToken.includes(pantryToken) || pantryToken.includes(ingredientToken)
      )
    );

    return pantryName && (normalizedIngredient.includes(pantryName) || hasTokenOverlap);
  }) || null;
}

function getRecipePantryMatches(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return [];
  }

  return appState.grocery.pantry.reduce((matches, pantryItem) => {
    const ingredientLine = findMatchingRecipeIngredient(recipe, pantryItem);

    if (ingredientLine) {
      matches.push({
        pantryItem,
        ingredientLine,
      });
    }

    return matches;
  }, []);
}

function getPantryMatchesForRecipe(recipe) {
  return getRecipePantryMatches(recipe).map(({ pantryItem }) => pantryItem.name);
}

function decreasePantryItemQuantity(pantryItem, ingredientLine) {
  const pantryQuantity = parseQuantityLabel(pantryItem.quantity);
  const ingredientQuantity = parseQuantityLabel(ingredientLine);

  if (!pantryQuantity) {
    return {
      consumed: true,
      nextQuantity: "",
      removed: true,
      reason: "used-up",
    };
  }

  if (!ingredientQuantity) {
    const nextValue = pantryQuantity.value - 1;

    if (nextValue <= 0) {
      return {
        consumed: pantryQuantity.value,
        nextQuantity: "",
        removed: true,
        reason: "used-up",
      };
    }

    return {
      consumed: 1,
      nextQuantity: formatPantryQuantity(nextValue, pantryQuantity.unit, pantryItem.quantity),
      removed: false,
      reason: "count-decrement",
    };
  }

  const pantryBase = convertQuantityToBaseUnit(pantryQuantity.value, pantryQuantity.unit);
  const ingredientBase = convertQuantityToBaseUnit(ingredientQuantity.value, ingredientQuantity.unit);

  if (pantryBase.unit && ingredientBase.unit && pantryBase.unit === ingredientBase.unit) {
    const nextValue = pantryBase.value - ingredientBase.value;

    if (nextValue <= 0) {
      return {
        consumed: ingredientBase.value,
        nextQuantity: "",
        removed: true,
        reason: "unit-consumed",
      };
    }

    return {
      consumed: ingredientBase.value,
      nextQuantity: formatPantryQuantity(nextValue, pantryBase.unit, pantryItem.quantity),
      removed: false,
      reason: "unit-consumed",
    };
  }

  const fallbackValue = pantryQuantity.value - 1;

  if (fallbackValue <= 0) {
    return {
      consumed: pantryQuantity.value,
      nextQuantity: "",
      removed: true,
      reason: "fallback-decrement",
    };
  }

  return {
    consumed: 1,
    nextQuantity: formatPantryQuantity(fallbackValue, pantryQuantity.unit, pantryItem.quantity),
    removed: false,
    reason: "fallback-decrement",
  };
}

function inferRecipeMealType(recipe) {
  return appState.recipes.generator.mealType || recipe?.mealTypes?.[0] || "lunch";
}

function createNutritionMealFromRecipe(recipe, mealType = inferRecipeMealType(recipe)) {
  if (!recipe) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: recipe.title,
    date: getTodayDateKey(),
    time: getSuggestedMealTime(mealType),
    calories: roundMacroValue(recipe.calories ?? 0),
    protein: roundMacroValue(recipe.protein ?? 0),
    carbs: roundMacroValue(recipe.carbs ?? 0),
    fats: roundMacroValue(recipe.fats ?? 0),
    barcode: "",
    source: "recipes",
    brand: "",
    nutriscoreGrade: "",
    nutritionSource: "imported",
    nutritionSourceLabel: RECIPE_NUTRITION_SOURCE_LABEL,
  };
}

function createRecipeNutritionDraft(recipe) {
  if (!recipe) {
    return null;
  }

  return createImportedNutritionDraft(recipe, RECIPE_NUTRITION_SOURCE_LABEL);
}

function addRecipeToNutritionLog(recipe, mealType = inferRecipeMealType(recipe)) {
  const meal = createNutritionMealFromRecipe(recipe, mealType);

  if (!meal) {
    return null;
  }

  appState.nutrition.meals.push(meal);
  captureProgressSnapshotForDate(getMealDateKey(meal));
  return meal;
}

function consumePantryForRecipe(recipe) {
  if (!recipe) {
    return [];
  }

  const updates = [];
  const matchedPantryItems = getRecipePantryMatches(recipe);

  matchedPantryItems.forEach(({ pantryItem, ingredientLine }) => {
    const result = decreasePantryItemQuantity(pantryItem, ingredientLine);
    const pantryIndex = appState.grocery.pantry.findIndex((item) => item.id === pantryItem.id);

    if (pantryIndex === -1) {
      return;
    }

    if (result.removed) {
      appState.grocery.pantry.splice(pantryIndex, 1);
    } else {
      appState.grocery.pantry[pantryIndex] = {
        ...appState.grocery.pantry[pantryIndex],
        quantity: result.nextQuantity,
      };
    }

    updates.push({
      pantryItemName: pantryItem.name,
      ingredientLine,
      removed: result.removed,
      nextQuantity: result.nextQuantity,
    });
  });

  return updates;
}

function getRecipeChatAction(message) {
  const normalizedMessage = normalizeComparableText(message);
  const addToNutritionIntent =
    /(aggiung|inserisc|salva|porta)/.test(normalizedMessage) &&
    /(nutrition|giornata|diario|pasti)/.test(normalizedMessage) &&
    /(ricett|propost|corrente|quest|past)/.test(normalizedMessage);

  if (addToNutritionIntent) {
    return { type: "add-current-recipe-to-nutrition" };
  }

  return null;
}

function executeRecipeChatAction(action) {
  if (!action) {
    return null;
  }

    if (action.type === "add-current-recipe-to-nutrition") {
      const recipe = appState.recipes.currentRecipe;

    if (!recipe) {
      return {
        success: false,
        message: "Non ho una ricetta attiva da usare.\n\nGenerane o aprine una dalla sezione Recipes e poi chiedimi di aggiungerla a Nutrition.",
      };
    }

      const mealType = inferRecipeMealType(recipe);
      const addedMeal = addRecipeToNutritionLog(recipe, mealType);
      const pantryUpdates = consumePantryForRecipe(recipe);
      saveState();
      switchToTab("nutrition");
      renderNutrition();
      renderGrocery();
      setFeedback(`Ho aggiunto ${addedMeal.name} ai pasti di oggi da Recipes.`);

      const pantrySummary =
        pantryUpdates.length > 0
        ? pantryUpdates
            .map((entry) =>
              `- **${entry.pantryItemName}** -> ${entry.removed ? "esaurito" : `restano ${entry.nextQuantity}`}`
            )
            .join("\n")
        : "- Nessun ingrediente della ricetta era presente in dispensa con un match diretto.";

    return {
      success: true,
      message:
        `Ho aggiunto **${addedMeal.name}** ai pasti di oggi in **Nutrition**.\n\n` +
        `- Orario impostato: ${formatMealTime(addedMeal.time)}\n` +
        `- Calorie: **${addedMeal.calories} kcal**\n` +
        `- Proteine: **${addedMeal.protein} g**\n\n` +
        `---\n\n` +
        `**Aggiornamento dispensa**\n${pantrySummary}`,
    };
  }

  return null;
}

function applyRecipeToNutrition(recipe, mealType) {
  const form = document.querySelector("[data-nutrition-form]");

  if (!form || !recipe) {
    return;
  }

  clearNutritionDraft();
  openFoodFactsRuntime.nutritionDraft = createRecipeNutritionDraft(recipe);
  form.reset();
  form.elements.name.value = recipe.title;
  form.elements.time.value = getSuggestedMealTime(mealType);
  switchToTab("nutrition");
  setFeedback("Ricetta importata da Recipes. I valori nutrizionali verranno inseriti automaticamente.");
}

function setupRecipesSection() {
  const generatorForm = document.querySelector("[data-recipe-generator-form]");
  const recipeResult = document.querySelector("[data-recipe-result]");
  const recipeHistory = document.querySelector("[data-recipe-history]");
  const savedRecipes = document.querySelector("[data-saved-recipes]");
  const chatForm = document.querySelector("[data-recipe-chat-form]");
  const chatResetButton = document.querySelector("[data-recipe-chat-reset]");

  if (!generatorForm || !recipeResult || !recipeHistory || !savedRecipes || !chatForm) {
    return;
  }

  generatorForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextFilters = {
      dietType: generatorForm.elements.dietType.value,
      caloriesTarget: generatorForm.elements.caloriesTarget.value,
      mealType: generatorForm.elements.mealType.value,
      prompt: String(generatorForm.elements.prompt.value || "").trim(),
    };

    appState.recipes.generator = nextFilters;
    appState.recipes.currentRecipe = generateRecipeSuggestion(nextFilters);
    saveRecipeToHistory(appState.recipes.currentRecipe);
    saveState();
    renderRecipes();
    setRecipeFeedback("Ricetta generata correttamente.");
  });

  recipeResult.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-current-recipe]");
    const applyButton = event.target.closest("[data-apply-current-recipe-to-nutrition]");

    if (applyButton && appState.recipes.currentRecipe) {
      applyRecipeToNutrition(appState.recipes.currentRecipe, appState.recipes.generator.mealType);
      return;
    }

    if (!saveButton || !appState.recipes.currentRecipe) {
      return;
    }

    const recipeId = appState.recipes.currentRecipe.id;
    const isSaved = appState.recipes.savedRecipeIds.includes(recipeId);

    appState.recipes.savedRecipeIds = isSaved
      ? appState.recipes.savedRecipeIds.filter((id) => id !== recipeId)
      : [recipeId, ...appState.recipes.savedRecipeIds];

    saveState();
    renderRecipes();
    setRecipeFeedback(isSaved ? "Ricetta rimossa dai salvati." : "Ricetta salvata.");
  });

  recipeHistory.addEventListener("click", (event) => {
    const button = event.target.closest("[data-recipe-history-id]");

    if (!button) {
      return;
    }

    const recipe = getRecipeById(button.dataset.recipeHistoryId);

    if (!recipe) {
      return;
    }

    const pantryMatches = getPantryMatchesForRecipe(recipe);
    appState.recipes.currentRecipe = {
      ...recipe,
      pantryMatches,
      pantryNote: pantryMatches.length ? `Hai già in dispensa: ${pantryMatches.join(", ")}.` : "Ricetta riaperta dallo storico recente.",
      personalNote: recipe.personalNote || "Ricetta recuperata dallo storico delle generazioni.",
    };

    saveState();
    renderRecipes();
    setRecipeFeedback("Ricetta ricaricata dallo storico.");
  });

  savedRecipes.addEventListener("click", (event) => {
    const button = event.target.closest("[data-recipe-saved-id]");

    if (!button) {
      return;
    }

    const recipe = getRecipeById(button.dataset.recipeSavedId);

    if (!recipe) {
      return;
    }

    const pantryMatches = getPantryMatchesForRecipe(recipe);
    appState.recipes.currentRecipe = {
      ...recipe,
      pantryMatches,
      pantryNote: pantryMatches.length ? `Hai già in dispensa: ${pantryMatches.join(", ")}.` : "Ricetta aperta dai preferiti.",
      personalNote: recipe.personalNote || "Ricetta recuperata dall'elenco salvati.",
    };

    saveState();
    renderRecipes();
    setRecipeFeedback("Ricetta aperta dai salvati.");
  });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = String(chatForm.elements.message.value || "").trim();
    console.log("[Frontend] Submit chat intercettato.", {
      messageLength: message.length
    });

    if (!message) {
      return;
    }

    appState.recipes.chatMessages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    });

    const requestedAction = getRecipeChatAction(message);

    if (requestedAction) {
      const actionResult = executeRecipeChatAction(requestedAction);

      if (actionResult?.message) {
        appState.recipes.chatMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: actionResult.message,
          createdAt: new Date().toISOString(),
        });
      }

      saveState();
      renderRecipeChat();
      chatForm.reset();
      return;
    }

    saveState();
    renderRecipeChat();
    chatForm.elements.message.value = "";

    const messageField = chatForm.elements.message;
    const submitButton = chatForm.querySelector('button[type="submit"]');

    messageField.disabled = true;
    if (submitButton) {
      submitButton.disabled = true;
    }

    recipeChatRuntime.isWaiting = true;
    renderRecipeChat();

    try {
      const assistantReply = await getRecipeAssistantResponse(message);
      console.log("[Frontend] Risposta chat pronta per il render.", {
        replyLength: assistantReply.length
      });

      appState.recipes.chatMessages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantReply,
        createdAt: new Date().toISOString(),
      });

      saveState();
      renderRecipeChat();
      chatForm.reset();
    } catch (error) {
      console.error("[Frontend] Errore nella chat backend, attivo fallback locale.", error);
      const fallbackReply = buildRecipeAssistantReply(message);

      appState.recipes.chatMessages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: fallbackReply,
        createdAt: new Date().toISOString(),
      });

      saveState();
      renderRecipeChat();
    } finally {
      recipeChatRuntime.isWaiting = false;
      renderRecipeChat();
      messageField.disabled = false;
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  chatResetButton?.addEventListener("click", () => {
    appState.recipes.chatMessages = getDefaultRecipeChatMessages();
    saveState();
    renderRecipeChat();
  });

  renderRecipes();
}

function getProgressLogByDate(dateKey) {
  return appState.progress.dailyLogs.find((entry) => entry.date === dateKey) || null;
}

function getResolvedProgressEntry(dateKey) {
  const log = getProgressLogByDate(dateKey);
  const todayKey = getTodayDateKey();
  const nutritionTotals = getNutritionTotalsForDate(dateKey);
  const autoSnapshot = getProgressAutoSnapshot(dateKey);
  const currentWeight = normalizeNumber(appState.profile.personal.currentWeightKg);
  const autoCalories = nutritionTotals.count > 0 ? nutritionTotals.calories : autoSnapshot?.calories ?? null;
  const autoProtein = nutritionTotals.count > 0 ? nutritionTotals.protein : autoSnapshot?.protein ?? null;
  const autoWeight = dateKey === todayKey ? currentWeight : autoSnapshot?.weightKg ?? null;

  return {
    date: dateKey,
    calories: log?.calories ?? autoCalories,
    protein: log?.protein ?? autoProtein,
    waterGlasses: log?.waterGlasses ?? null,
    weightKg: log?.weightKg ?? autoWeight,
    hasManualLog: Boolean(log),
    nutritionMealCount: nutritionTotals.count,
    isAutoNutrition: (log?.calories == null || log?.protein == null) && (autoCalories != null || autoProtein != null),
    isAutoWeight: log?.weightKg == null && autoWeight != null,
    hasAutoSnapshot: Boolean(autoSnapshot),
  };
}

function getProgressSeries() {
  return getRecentDateKeys(getProgressRangeDays()).map(getResolvedProgressEntry);
}

function getLastKnownWeight(series) {
  const reversed = [...series].reverse();
  const entry = reversed.find((item) => item.weightKg != null);
  return entry?.weightKg ?? normalizeNumber(appState.profile.personal.currentWeightKg);
}

function calculateAverage(values) {
  const filteredValues = values.filter((value) => value != null);

  if (filteredValues.length === 0) {
    return null;
  }

  return filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length;
}

function buildLineChartMarkup(values, color) {
  const width = 760;
  const height = 250;
  const paddingX = 85;
  const top = 45;
  const bottom = 210;
  const usableWidth = width - paddingX * 2;
  const filteredValues = values.filter((value) => value != null);
  const numericValues = values.map((value) => (value == null ? null : Number(value)));

  if (filteredValues.length === 0) {
    const gridLines = [top, 86, 127, 168, bottom]
      .map((y) => `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>`)
      .join("");

    return `
      <g class="grid">${gridLines}</g>
      <text class="chart-empty-label" x="${width / 2}" y="${height / 2}" text-anchor="middle">Nessun dato disponibile</text>
    `;
  }

  const minValue = Math.min(...filteredValues);
  const maxValue = Math.max(...filteredValues);
  const range = maxValue - minValue || 1;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;
  const gradientId = `progressGradient${color}${values.length}`;
  const strokeClass = color === "purple" ? "line-purple" : "line-green";
  const areaClass = color === "purple" ? "area-purple" : "area-green";
  const pointClass = color === "purple" ? "point-purple" : "point-green";

  const points = numericValues.map((value, index) => {
    if (value == null) {
      return null;
    }

    const x = paddingX + stepX * index;
    const y = bottom - ((value - minValue) / range) * (bottom - top);
    return { x, y };
  });

  const gridLines = [top, 86, 127, 168, bottom]
    .map((y) => `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>`)
    .join("");
  const pathSegments = [];
  let activeSegment = [];

  points.forEach((point) => {
    if (!point) {
      if (activeSegment.length > 0) {
        pathSegments.push(activeSegment);
        activeSegment = [];
      }
      return;
    }

    activeSegment.push(point);
  });

  if (activeSegment.length > 0) {
    pathSegments.push(activeSegment);
  }

  const linePath = pathSegments
    .map((segment) => segment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" "))
    .join(" ");
  const circles = points
    .filter(Boolean)
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5"></circle>`)
    .join("");
  const largestSegment = pathSegments.reduce(
    (largest, segment) => (segment.length > largest.length ? segment : largest),
    []
  );
  const areaPath =
    largestSegment.length >= 2
      ? `${largestSegment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")} L${largestSegment[largestSegment.length - 1].x} ${bottom} L${largestSegment[0].x} ${bottom} Z`
      : "";

  return `
    <defs>
      <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0.16" />
        <stop offset="100%" stop-color="${color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <g class="grid">${gridLines}</g>
    ${areaPath ? `<path class="area ${areaClass}" style="fill:url(#${gradientId})" d="${areaPath}"></path>` : ""}
    <path class="line ${strokeClass}" d="${linePath}"></path>
    <g class="points ${pointClass}">${circles}</g>
  `;
}

function renderBarChart(values, barsSelector, labelsSelector) {
  const bars = document.querySelector(barsSelector);
  const labels = document.querySelector(labelsSelector);

  if (!bars || !labels) {
    return;
  }

  const numericValues = values.map((entry) => entry.value ?? 0);
  const maxValue = Math.max(...numericValues, 1);
  const minChartWidth = Math.max(320, values.length * 62);

  bars.style.minWidth = `${minChartWidth}px`;
  labels.style.minWidth = `${minChartWidth}px`;

  bars.innerHTML = values
    .map((entry) => {
      const height = Math.max(16, Math.round(((entry.value ?? 0) / maxValue) * 110));
      return `<span style="height:${height}px" title="${escapeHtml(`${entry.label}: ${entry.value ?? 0}`)}"></span>`;
    })
    .join("");

  labels.innerHTML = values.map((entry) => `<span>${escapeHtml(entry.label)}</span>`).join("");
}

function setLineChartMinWidth(chartElement, pointCount, pixelsPerPoint = 84) {
  if (!chartElement) {
    return;
  }

  const minChartWidth = Math.max(320, pointCount * pixelsPerPoint);
  chartElement.style.minWidth = `${minChartWidth}px`;
}

function renderProgressStats(series) {
  const container = document.querySelector("[data-progress-stats]");

  if (!container) {
    return;
  }

  const weights = series.map((entry) => entry.weightKg).filter((value) => value != null);
  const firstWeight = weights[0] ?? normalizeNumber(appState.profile.personal.currentWeightKg);
  const currentWeight = getLastKnownWeight(series);
  const weightDelta = firstWeight != null && currentWeight != null ? currentWeight - firstWeight : null;
  const avgCalories = calculateAverage(series.map((entry) => entry.calories));
  const avgProtein = calculateAverage(series.map((entry) => entry.protein));

  container.innerHTML = `
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-weight-delta">
      <span class="progress-mini-stat-accent">Trend</span>
      <h3>Variazione peso</h3>
      <strong>${weightDelta == null ? "--" : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-weight-current">
      <span class="progress-mini-stat-accent">Oggi</span>
      <h3>Peso attuale</h3>
      <strong>${currentWeight == null ? "--" : `${currentWeight.toFixed(1)} kg`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-calories">
      <span class="progress-mini-stat-accent">Media</span>
      <h3>Calorie</h3>
      <strong>${avgCalories == null ? "--" : `${Math.round(avgCalories)} kcal`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-protein">
      <span class="progress-mini-stat-accent">Media</span>
      <h3>Proteine</h3>
      <strong>${avgProtein == null ? "--" : `${Math.round(avgProtein)} g`}</strong>
    </article>
  `;
}

function renderProgressCurrentDayCard() {
  const container = document.querySelector("[data-progress-current-day]");

  if (!container) {
    return;
  }

  const todayEntry = getResolvedProgressEntry(getTodayDateKey());
  const waterGoal = normalizeNumber(appState.profile.goals.water) || 0;
  const nutritionSourceLabel =
    todayEntry.nutritionMealCount > 0
      ? `${todayEntry.nutritionMealCount} ${todayEntry.nutritionMealCount === 1 ? "pasto registrato" : "pasti registrati"}`
      : todayEntry.hasAutoSnapshot
        ? "snapshot automatico salvato"
        : "nessun pasto registrato";

  container.innerHTML = `
    <div class="progress-current-day-card">
      <strong>Oggi</strong>
      <span>Calorie: ${todayEntry.calories ?? "--"} kcal</span>
      <span>Proteine: ${todayEntry.protein ?? "--"} g</span>
      <span>Peso: ${todayEntry.weightKg == null ? "--" : `${todayEntry.weightKg.toFixed(1)} kg`}</span>
      <span>Acqua: ${todayEntry.waterGlasses ?? "--"} / ${waterGoal || "--"} bicchieri</span>
      <span>Nutrition: ${nutritionSourceLabel}</span>
    </div>
  `;
}

function renderProgressSourceList() {
  const container = document.querySelector("[data-progress-source-list]");

  if (!container) {
    return;
  }

  const todayEntry = getResolvedProgressEntry(getTodayDateKey());
  const snapshot = getProgressAutoSnapshot(getTodayDateKey());
  const items = [
    {
      title: "Nutrition",
      body:
        todayEntry.nutritionMealCount > 0
          ? `${todayEntry.nutritionMealCount} ${todayEntry.nutritionMealCount === 1 ? "pasto contribuisce" : "pasti contribuiscono"} ai grafici di oggi.`
          : snapshot?.calories != null || snapshot?.protein != null
            ? "Uso l'ultimo snapshot giornaliero salvato in automatico."
            : "Nessun dato nutrizionale storico disponibile per oggi.",
    },
    {
      title: "Profile",
      body:
        todayEntry.weightKg != null
          ? `Peso corrente disponibile: ${todayEntry.weightKg.toFixed(1)} kg.`
          : "Nessun peso disponibile da Profile per oggi.",
    },
  ];

  container.innerHTML = items
    .map(
      (item) => `
        <article class="progress-source-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.body)}</span>
        </article>
      `
    )
    .join("");
}

function renderProgressCharts(series) {
  const calorieChart = document.querySelector("[data-progress-calorie-chart]");
  const weightChart = document.querySelector("[data-progress-weight-chart]");

  if (calorieChart) {
    setLineChartMinWidth(calorieChart, series.length);
    calorieChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.calories), "green");
  }

  if (weightChart) {
    setLineChartMinWidth(weightChart, series.length);
    weightChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.weightKg), "purple");
  }

  renderBarChart(
    series.map((entry) => ({ label: formatShortDayLabel(entry.date), value: entry.waterGlasses })),
    "[data-progress-water-bars]",
    "[data-progress-water-labels]"
  );
}

function syncProgressChartViewport() {
  const shells = document.querySelectorAll('.app-section[data-tab-panel="progress"] .chart-scroll-shell');

  if (!shells.length) {
    return;
  }

  const isCompactViewport = window.matchMedia("(max-width: 840px)").matches;

  requestAnimationFrame(() => {
    shells.forEach((shell) => {
      if (!isCompactViewport) {
        shell.scrollLeft = 0;
        return;
      }

      shell.scrollLeft = shell.scrollWidth - shell.clientWidth;
    });
  });
}

function renderProgress() {
  const series = getProgressSeries();
  const form = document.querySelector("[data-progress-log-form]");

  document.querySelectorAll("[data-progress-range]").forEach((button) => {
    button.classList.toggle("range-btn-active", button.dataset.progressRange === appState.progress.selectedRange);
  });

  if (form && !form.elements.date.value) {
    form.elements.date.value = getTodayDateKey();
  }

  renderProgressStats(series);
  renderProgressCurrentDayCard();
  renderProgressSourceList();
  renderProgressCharts(series);
  syncProgressChartViewport();
}

function populateProgressForm(dateKey) {
  const form = document.querySelector("[data-progress-log-form]");
  const log = getProgressLogByDate(dateKey);

  if (!form) {
    return;
  }

  form.elements.date.value = dateKey;
  form.elements.weightKg.value = log?.weightKg ?? "";
  form.elements.waterGlasses.value = log?.waterGlasses ?? "";
  form.elements.calories.value = log?.calories ?? "";
  form.elements.protein.value = log?.protein ?? "";
}

function setupProgressSection() {
  const form = document.querySelector("[data-progress-log-form]");
  const deleteButton = document.querySelector("[data-progress-delete-log]");

  if (!form || !deleteButton) {
    return;
  }

  bindFormValidationFeedback(form);

  document.querySelectorAll("[data-progress-range]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.progress.selectedRange = button.dataset.progressRange;
      saveState();
      renderProgress();
    });
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "date") {
      populateProgressForm(form.elements.date.value);
      setProgressFeedback("");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const date = String(form.elements.date.value || "").trim();

    if (!date) {
      setProgressFeedback("Seleziona una data valida.");
      return;
    }

    const nextLog = {
      date,
      weightKg: normalizeNumber(form.elements.weightKg.value),
      waterGlasses: normalizeNumber(form.elements.waterGlasses.value),
      calories: normalizeNumber(form.elements.calories.value),
      protein: normalizeNumber(form.elements.protein.value),
    };

    const hasAnyValue = [nextLog.weightKg, nextLog.waterGlasses, nextLog.calories, nextLog.protein].some(
      (value) => value != null
    );

    if (!hasAnyValue) {
      setProgressFeedback("Inserisci almeno un valore manuale oppure usa il pulsante di rimozione.");
      return;
    }

    appState.progress.dailyLogs = [
      ...appState.progress.dailyLogs.filter((entry) => entry.date !== date),
      nextLog,
    ].sort((firstEntry, secondEntry) => firstEntry.date.localeCompare(secondEntry.date));

    saveState();
    renderProgress();
    populateProgressForm(date);
    resetFormValidationState(form);
    setProgressFeedback("Progressi salvati.");
  });

  deleteButton.addEventListener("click", () => {
    const date = String(form.elements.date.value || "").trim();

    if (!date) {
      setProgressFeedback("Seleziona la data dei dati da rimuovere.");
      return;
    }

    const initialLength = appState.progress.dailyLogs.length;
    appState.progress.dailyLogs = appState.progress.dailyLogs.filter((entry) => entry.date !== date);

    if (initialLength === appState.progress.dailyLogs.length) {
      setProgressFeedback("Non ci sono dati da rimuovere.");
      return;
    }

    saveState();
    renderProgress();
    populateProgressForm(date);
    setProgressFeedback("Progressi rimossi.");
  });

  populateProgressForm(getTodayDateKey());
  renderProgress();
}

function renderNutritionSummary() {
  const totals = getNutritionTotals();
  const { goals } = appState.nutrition;

  Object.entries(totals).forEach(([key, value]) => {
    document.querySelectorAll(`[data-nutrition-total="${key}"]`).forEach((element) => {
      element.textContent = String(value);
    });
  });

  Object.entries(goals).forEach(([key, value]) => {
    document.querySelectorAll(`[data-nutrition-goal="${key}"]`).forEach((element) => {
      element.textContent = String(value);
    });

    const progressElement = document.querySelector(`[data-nutrition-progress="${key}"]`);
    const progress = value > 0 ? Math.min((totals[key] / value) * 100, 100) : 0;

    if (progressElement) {
      progressElement.style.width = `${progress}%`;
    }
  });

  const calorieGoalDisplay = document.querySelector("[data-calorie-goal-display]");

  if (calorieGoalDisplay) {
    calorieGoalDisplay.textContent = `${goals.calories} kcal`;
  }
}

function syncNutritionGoalsFromProfile() {
  const { calories, protein, carbs, fats } = appState.profile.goals;

  appState.nutrition.goals = {
    calories,
    protein,
    carbs,
    fats,
  };
}

function upsertPantryItemFromGrocery(item) {
  const pantryItem = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    expiryDate: item.expiryDate || "",
    category: item.category,
    barcode: item.barcode || "",
    source: item.source || "manual",
    nutriscoreGrade: item.nutriscoreGrade || "",
  };
  const existingIndex = appState.grocery.pantry.findIndex((entry) => entry.id === item.id);

  if (existingIndex >= 0) {
    appState.grocery.pantry[existingIndex] = pantryItem;
  } else {
    appState.grocery.pantry.push(pantryItem);
  }

  appState.grocery.pantry.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
}

function removePantryItem(groceryItemId) {
  appState.grocery.pantry = appState.grocery.pantry.filter((item) => item.id !== groceryItemId);
}

function renderMeals() {
  const list = document.querySelector("[data-meals-list]");
  const todayMeals = appState.nutrition.meals.filter((meal) => getMealDateKey(meal) === getTodayDateKey());

  if (!list) {
    return;
  }

  if (todayMeals.length === 0) {
    list.innerHTML = `
      <article class="panel empty-state">
        <h3>Nessun pasto inserito</h3>
        <p>Costruisci il tuo diario alimentare.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = todayMeals
    .slice()
    .sort((firstMeal, secondMeal) => firstMeal.time.localeCompare(secondMeal.time))
    .map(
      (meal) => `
        <article class="meal-card">
          <div class="meal-copy">
            <h3>${escapeHtml(meal.name)}</h3>
            ${
              meal.nutriscoreGrade || meal.nutritionSourceLabel
                ? `
              <div class="lookup-chip-row">
                ${meal.nutriscoreGrade ? `<span class="lookup-chip ${escapeHtml(getNutriscoreClassName(meal.nutriscoreGrade))} nutriscore-chip">${escapeHtml(getNutriscoreLabel(meal.nutriscoreGrade))}</span>` : ""}
                ${meal.source === "openfoodfacts" ? `<span class="lookup-chip">OpenFoodFacts</span>` : ""}
                ${meal.nutritionSourceLabel ? `<span class="lookup-chip">${escapeHtml(meal.nutritionSourceLabel)}</span>` : ""}
              </div>
            `
                : ""
            }
            <div class="meal-macros">
              <span>Calorie: <strong>${meal.calories}</strong></span>
              <span>Proteine: <strong>${meal.protein}g</strong></span>
              <span>Carboidrati: <strong>${meal.carbs}g</strong></span>
              <span>Grassi: <strong>${meal.fats}g</strong></span>
            </div>
          </div>
          <div class="meal-meta">
            <time datetime="${meal.time}">${formatMealTime(meal.time)}</time>
            <button class="devices-soft meal-edit-btn" type="button" data-edit-meal-id="${meal.id}">Correggi valori</button>
            <button class="delete-btn" type="button" aria-label="Rimuovi pasto" data-delete-meal-id="${meal.id}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
              </svg>
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderNutrition() {
  renderNutritionSummary();
  renderMeals();
  renderProgress();
}

function renderGrocerySummary() {
  const totalItems = appState.grocery.items.length;
  const completedItems = appState.grocery.items.filter((item) => item.completed).length;
  const count = document.querySelector("[data-grocery-count]");
  const progress = document.querySelector("[data-grocery-progress]");
  const percentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  if (count) {
    count.textContent = `${completedItems}/${totalItems}`;
  }

  if (progress) {
    progress.style.width = `${percentage}%`;
  }
}

function renderGroceryList() {
  const list = document.querySelector("[data-grocery-list]");

  if (!list) {
    return;
  }

  if (appState.grocery.items.length === 0) {
    list.innerHTML = `
      <article class="panel empty-state">
        <h3>Shopping List vuota</h3>
        <p>Aggiungi il prossimo prodotto da comprare e costruisci il tuo inventario domestico.</p>
      </article>
    `;
    return;
  }

  const groupedItems = appState.grocery.items.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }

    groups[item.category].push(item);
    return groups;
  }, {});

  list.innerHTML = Object.entries(groupedItems)
    .sort(([firstCategory], [secondCategory]) => firstCategory.localeCompare(secondCategory))
    .map(
      ([category, items]) => `
        <article class="panel category-panel">
          <div class="category-block">
            <h3>${escapeHtml(category)}</h3>
            <div class="category-items">
          ${items
            .map((item) => {
              return `
                <article class="grocery-item${item.completed ? " is-complete" : ""}">
                  <div class="grocery-item-top">
                    <label class="check-row">
                      <input type="checkbox" ${item.completed ? "checked" : ""} data-grocery-toggle-id="${item.id}" />
                      <span class="checkbox-ui"></span>
                      <span>
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(item.quantity)}</small>
                        ${
                          item.nutriscoreGrade
                            ? `
                          <div class="lookup-chip-row">
                            ${item.nutriscoreGrade ? `<span class="lookup-chip ${escapeHtml(getNutriscoreClassName(item.nutriscoreGrade))} nutriscore-chip">${escapeHtml(getNutriscoreLabel(item.nutriscoreGrade))}</span>` : ""}
                          </div>
                        `
                            : ""
                        }
                      </span>
                    </label>
                    <button class="delete-btn grocery-delete-mobile" type="button" aria-label="Rimuovi prodotto" data-grocery-delete-id="${item.id}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
                    </button>
                  </div>
                  <div class="inline-actions">
                    <button class="delete-btn grocery-delete-desktop" type="button" aria-label="Rimuovi prodotto" data-grocery-delete-id="${item.id}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderPantry() {
  const pantryList = document.querySelector("[data-pantry-list]");

  if (!pantryList) {
    return;
  }

  if (appState.grocery.pantry.length === 0) {
    pantryList.innerHTML = `
      <article class="empty-pantry">
        <h3>Nessun alimento salvato in dispensa</h3>
        <p>Quando completi un acquisto, l'articolo comparira qui come ingrediente disponibile.</p>
      </article>
    `;
    return;
  }

  pantryList.innerHTML = `
    <div class="pantry-list-head" aria-hidden="true">
      <span>Prodotto</span>
      <span>Quantità / scadenza</span>
      <span>Categoria</span>
    </div>
    <div class="pantry-list-body">
      ${appState.grocery.pantry
        .map(
          (item) => `
            <article class="pantry-item">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.quantity)}${item.expiryDate ? ` • Scad. ${escapeHtml(formatExpiryDate(item.expiryDate))}` : ""}</span>
              <small>${escapeHtml(item.category)}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function exportOpenFoodFactsRagRecords() {
  ensureOpenFoodFactsState();

  const records = Object.values(appState.datasets.openFoodFacts.productsByBarcode || {})
    .sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name))
    .map((product) => buildOpenFoodFactsRagRecord(product));

  if (records.length === 0) {
    setGroceryFeedback("Non ci sono ancora record OpenFoodFacts da esportare.");
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    dataset: appState.datasets.openFoodFacts.source,
    count: records.length,
    records,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "openfoodfacts-rag-records.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setGroceryFeedback(`Esportati ${records.length} record RAG OpenFoodFacts.`);
}

function renderGroceryArOverlay() {
  const overlay = document.querySelector("[data-grocery-ar-overlay]");
  const comparisonBasisLabel = "Valori per 100 g/ml di prodotto";

  if (!overlay) {
    return;
  }

  if (!groceryArRuntime.stream) {
    overlay.innerHTML = "";
    return;
  }

  ensureGroceryArState();

  const pinnedProducts = getPinnedGroceryComparisonProducts();

  if (pinnedProducts.length === 0) {
    overlay.innerHTML = "";
    return;
  }

  overlay.innerHTML = pinnedProducts
    .map(
      ({ productId, product }) => `
        <article class="grocery-ar-card">
          <div class="grocery-ar-card-top">
            <strong>${escapeHtml(product.name)}</strong>
            <button class="grocery-ar-remove-btn" type="button" data-grocery-ar-remove-id="${escapeHtml(productId)}" aria-label="Rimuovi ${escapeHtml(product.name)} dal confronto">x</button>
          </div>
          <span class="grocery-ar-meta-line">${escapeHtml(product.brand)}</span>
          <span class="grocery-ar-meta-line">${escapeHtml(product.serving)}</span>
          ${product.nutriscoreGrade ? `<span class="grocery-ar-meta-line">${escapeHtml(getNutriscoreLabel(product.nutriscoreGrade))}</span>` : ""}
          <small>${comparisonBasisLabel}</small>
        </article>
      `
    )
    .join("");
}

function renderGroceryArComparison() {
  const comparison = document.querySelector("[data-grocery-ar-comparison]");
  const comparisonBasisLabel = "Valori per 100 g/ml di prodotto";

  if (!comparison) {
    return;
  }

  ensureGroceryArState();

  const pinnedProducts = getPinnedGroceryComparisonProducts();
  const winner = getGroceryComparisonWinner(pinnedProducts.map((entry) => entry.product));

  if (pinnedProducts.length === 0) {
    comparison.innerHTML = `
      <div class="grocery-ar-comparison-empty">
        Nessun prodotto in confronto.
      </div>
    `;
  } else {
    comparison.innerHTML = `
      <div class="grocery-ar-comparison-header">
        <strong>Confronto</strong>
        <span>${pinnedProducts.length === 1 ? "Scansiona un secondo prodotto." : "Rimuovi un prodotto con x per sostituirlo."}</span>
      </div>
      <div class="grocery-ar-comparison-grid">
        ${pinnedProducts
          .map(({ productId, product }) => {
            const score = calculateGroceryComparisonScore(product);
            const isWinner =
              winner && getComparableProductKey(winner.product) === getComparableProductKey(product) && pinnedProducts.length > 1;

            return `
              <article class="grocery-ar-compare-card">
                <div class="grocery-ar-card-top">
                  <strong>${escapeHtml(product.name)}</strong>
                  <button class="grocery-ar-remove-btn" type="button" data-grocery-ar-remove-id="${escapeHtml(productId)}" aria-label="Rimuovi ${escapeHtml(product.name)} dal confronto">x</button>
                </div>
                <span class="grocery-ar-metric-line">Calorie: ${product.calories ?? "--"} kcal</span>
                <span class="grocery-ar-metric-line">Proteine: ${product.protein ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Carboidrati: ${product.carbs ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Grassi: ${product.fats ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Zuccheri: ${product.sugar ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Fibre: ${product.fiber ?? "--"} g</span>
                <small>${comparisonBasisLabel}</small>
                <div class="grocery-ar-score${product.nutriscoreGrade ? "" : " is-neutral"}">
                  ${isWinner ? "Scelta consigliata" : product.nutriscoreGrade ? getNutriscoreLabel(product.nutriscoreGrade) : "Nutrition score"}: ${product.nutriscoreGrade ? escapeHtml(String(product.nutriscoreScore ?? product.nutriscoreGrade.toUpperCase())) : score}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }
}

function renderGrocery() {
  renderGrocerySummary();
  renderGroceryList();
  renderPantry();
  renderGroceryArOverlay();
  renderGroceryArComparison();
}

function stopGroceryArCamera() {
  const stage = document.querySelector(".grocery-ar-stage");
  const video = document.querySelector("[data-grocery-ar-video]");
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (groceryArRuntime.detectionLoopId) {
    cancelAnimationFrame(groceryArRuntime.detectionLoopId);
    groceryArRuntime.detectionLoopId = null;
  }

  if (groceryArRuntime.stream) {
    groceryArRuntime.stream.getTracks().forEach((track) => track.stop());
    groceryArRuntime.stream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (stage) {
    stage.classList.remove("is-live");
  }

  if (toggleButton) {
    setGroceryArToggleButtonState(false);
  }

}

function scheduleGroceryBarcodeDetection() {
  const video = document.querySelector("[data-grocery-ar-video]");

  if (!video || !groceryArRuntime.stream || !groceryArRuntime.detector) {
    return;
  }

  const detectFrame = async () => {
    if (!groceryArRuntime.stream || !groceryArRuntime.detector) {
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await groceryArRuntime.detector.detect(video);
        const firstCode = barcodes[0]?.rawValue;

        if (firstCode && appState.grocery.ar.lastDetectedBarcode === firstCode) {
          groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
          return;
        }

        let matchedProduct = firstCode ? getCachedOpenFoodFactsProduct(firstCode) || getCatalogProductByBarcode(firstCode) : null;

        if (!matchedProduct && firstCode) {
          appState.grocery.ar.lastDetectedBarcode = firstCode;
          try {
            matchedProduct = await fetchOpenFoodFactsProduct(firstCode);
          } catch (error) {
            matchedProduct = null;
          }
        }

        if (matchedProduct) {
          ensureGroceryArState();

          appState.grocery.ar.lastDetectedBarcode = firstCode;
          const pinResult = pinGroceryComparisonProduct(getComparableProductKey(matchedProduct));

          if (pinResult.added) {
            saveState();
            renderGroceryArOverlay();
            renderGroceryArComparison();
          }
        }
      } catch (error) {
      }
    }

    groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
  };

  groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
}

async function startGroceryArCamera() {
  const video = document.querySelector("[data-grocery-ar-video]");
  const stage = document.querySelector(".grocery-ar-stage");
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (!video || !stage || groceryArRuntime.isStarting) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return;
  }

  groceryArRuntime.isStarting = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment",
        },
      },
      audio: false,
    });

    groceryArRuntime.stream = stream;
    video.srcObject = stream;
    await video.play();
    stage.classList.add("is-live");

    if (toggleButton) {
      setGroceryArToggleButtonState(true);
    }

    if ("BarcodeDetector" in window) {
      groceryArRuntime.detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });
      scheduleGroceryBarcodeDetection();
    } else {
      groceryArRuntime.detector = null;
    }
  } catch (error) {
    stopGroceryArCamera();
  } finally {
    groceryArRuntime.isStarting = false;
  }
}

function promptMealNutritionCorrection(meal) {
  const fields = [
    { key: "calories", label: "Calorie (kcal)" },
    { key: "protein", label: "Proteine (g)" },
    { key: "carbs", label: "Carboidrati (g)" },
    { key: "fats", label: "Grassi (g)" },
  ];
  const updatedValues = {};

  for (const field of fields) {
    const nextValue = window.prompt(`${field.label} per ${meal.name}`, String(meal[field.key] ?? 0));

    if (nextValue === null) {
      return null;
    }

    const normalizedValue = normalizeNumber(nextValue);

    if (normalizedValue === null || normalizedValue < 0) {
      return undefined;
    }

    updatedValues[field.key] = roundMacroValue(normalizedValue);
  }

  return updatedValues;
}

function setupNutritionSection() {
  const form = document.querySelector("[data-nutrition-form]");
  const mealsList = document.querySelector("[data-meals-list]");

  if (!form || !mealsList) {
    return;
  }

  bindFormValidationFeedback(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const formData = new FormData(form);
    const linkedProduct = openFoodFactsRuntime.nutritionLookup;
    const nutritionDraft = getNutritionDraftForMeal(formData.get("name"));
    const meal = {
      id: crypto.randomUUID(),
      name: String(formData.get("name") || "").trim(),
      date: getTodayDateKey(),
      time: String(formData.get("time") || "").trim(),
      calories: nutritionDraft.calories,
      protein: nutritionDraft.protein,
      carbs: nutritionDraft.carbs,
      fats: nutritionDraft.fats,
      barcode: linkedProduct?.barcode || "",
      source: linkedProduct ? linkedProduct.source : "manual",
      brand: linkedProduct?.brand || "",
      nutriscoreGrade: linkedProduct?.nutriscoreGrade || "",
      nutritionSource: nutritionDraft.nutritionSource,
      nutritionSourceLabel: nutritionDraft.nutritionSourceLabel,
    };

    const hasInvalidNumber = ["calories", "protein", "carbs", "fats"].some((key) => {
      const value = meal[key];
      return Number.isNaN(value) || value < 0;
    });

    if (!meal.name || !meal.time || hasInvalidNumber) {
      setFeedback("Completa almeno nome e orario con valori validi.");
      return;
    }

    appState.nutrition.meals.push(meal);
    captureProgressSnapshotForDate(getMealDateKey(meal));
    saveState();
    renderNutrition();
    form.reset();
    resetFormValidationState(form);
    clearNutritionDraft();
    setFeedback(`${meal.nutritionSourceLabel || "Valori nutrizionali"} salvati. Puoi correggerli dal pasto appena creato.`);
  });

  mealsList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-meal-id]");
    const button = event.target.closest("[data-delete-meal-id]");

    if (editButton) {
      const meal = appState.nutrition.meals.find((entry) => entry.id === editButton.dataset.editMealId);

      if (!meal) {
        return;
      }

      const updatedValues = promptMealNutritionCorrection(meal);

      if (updatedValues === null) {
        setFeedback("Correzione annullata.");
        return;
      }

      if (updatedValues === undefined) {
        setFeedback("Inserisci solo numeri validi per correggere i valori nutrizionali.");
        return;
      }

      Object.assign(meal, updatedValues, {
        nutritionSource: "manual-correction",
        nutritionSourceLabel: "Corretto manualmente",
      });
      captureProgressSnapshotForDate(getMealDateKey(meal));
      saveState();
      renderNutrition();
      setFeedback("Valori nutrizionali aggiornati manualmente.");
      return;
    }

    if (!button) {
      return;
    }

    const { deleteMealId } = button.dataset;
    const mealToDelete = appState.nutrition.meals.find((meal) => meal.id === deleteMealId);
    const mealDateKey = mealToDelete ? getMealDateKey(mealToDelete) : getTodayDateKey();
    appState.nutrition.meals = appState.nutrition.meals.filter((meal) => meal.id !== deleteMealId);
    captureProgressSnapshotForDate(mealDateKey);
    saveState();
    renderNutrition();
    setFeedback("Pasto rimosso.");
  });

  renderNutrition();
}

function setupGrocerySection() {
  const form = document.querySelector("[data-grocery-form]");
  const list = document.querySelector("[data-grocery-list]");
  const clearCompletedButton = document.querySelector("[data-clear-completed]");
  const arToggleButton = document.querySelector("[data-grocery-ar-toggle]");
  const arClearButton = document.querySelector("[data-grocery-ar-clear]");

  if (!form || !list || !clearCompletedButton || !arToggleButton || !arClearButton) {
    return;
  }

  bindFormValidationFeedback(form);

  ensureGroceryArState();

  if (appState.grocery.pantry.length === 0) {
    appState.grocery.items
      .filter((item) => item.completed)
      .forEach((item) => upsertPantryItemFromGrocery(item));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const formData = new FormData(form);
    const linkedProduct = openFoodFactsRuntime.groceryLookup;
    const item = {
      id: crypto.randomUUID(),
      name: String(formData.get("name") || "").trim(),
      quantity: String(formData.get("quantity") || "").trim(),
      expiryDate: String(formData.get("expiryDate") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      completed: false,
      barcode: linkedProduct?.barcode || sanitizeBarcode(formData.get("barcode")),
      source: linkedProduct?.source || "manual",
      nutriscoreGrade: linkedProduct?.nutriscoreGrade || "",
    };

    if (!item.name || !item.quantity || !item.category) {
      setGroceryFeedback("Completa tutti i campi per aggiungere un prodotto.");
      return;
    }

    appState.grocery.items.push(item);
    saveState();
    renderGrocery();
    form.reset();
    resetFormValidationState(form);
    form.elements.category.value = "Frutta e verdura";
    openFoodFactsRuntime.groceryLookup = null;
    form.elements.barcode.value = "";
    renderLookupResult("[data-off-grocery-result]", null, "");
    setGroceryFeedback("Prodotto salvato nella lista della spesa.");
  });

  list.addEventListener("click", (event) => {
    const arCompareButton = event.target.closest("[data-grocery-ar-item-id]");

    if (arCompareButton) {
      const matchedProduct = getComparableProductByKey(arCompareButton.dataset.groceryArItemId);

      if (!matchedProduct) {
        return;
      }

      const pinResult = pinGroceryComparisonProduct(getComparableProductKey(matchedProduct));

      if (pinResult.added) {
        saveState();
        renderGroceryArOverlay();
        renderGroceryArComparison();
      }
      return;
    }

    const deleteButton = event.target.closest("[data-grocery-delete-id]");

    if (deleteButton) {
      const { groceryDeleteId } = deleteButton.dataset;
      appState.grocery.items = appState.grocery.items.filter((item) => item.id !== groceryDeleteId);
      saveState();
      renderGrocery();
      setGroceryFeedback("Prodotto rimosso dalla lista.");
      return;
    }

    const toggle = event.target.closest("[data-grocery-toggle-id]");

    if (toggle) {
      const nextCompleted = toggle.checked;

      appState.grocery.items = appState.grocery.items.map((item) =>
        item.id === toggle.dataset.groceryToggleId
          ? { ...item, completed: nextCompleted }
          : item
      );

      const updatedItem = appState.grocery.items.find((item) => item.id === toggle.dataset.groceryToggleId);

      if (updatedItem && nextCompleted) {
        upsertPantryItemFromGrocery(updatedItem);
      } else if (updatedItem && !nextCompleted) {
        removePantryItem(updatedItem.id);
      }

      saveState();
      renderGrocery();
      setGroceryFeedback(nextCompleted ? "Prodotto acquistato e salvato in dispensa." : "Prodotto nella lista della spesa.");
    }
  });

  arToggleButton.addEventListener("click", async () => {
    if (groceryArRuntime.stream) {
      stopGroceryArCamera();
      return;
    }

    await startGroceryArCamera();
  });

  arClearButton.addEventListener("click", () => {
    ensureGroceryArState();
    appState.grocery.ar.pinnedProductIds = [];
    appState.grocery.ar.lastDetectedBarcode = "";
    saveState();
    renderGroceryArOverlay();
    renderGroceryArComparison();
  });

  const arPanel = document.querySelector(".grocery-ar-panel");

  arPanel?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-grocery-ar-remove-id]");

    if (!removeButton) {
      return;
    }

    const removedProduct = getComparableProductByKey(removeButton.dataset.groceryArRemoveId);
    unpinGroceryComparisonProduct(removeButton.dataset.groceryArRemoveId);
    saveState();
    renderGroceryArOverlay();
    renderGroceryArComparison();
  });

  clearCompletedButton.addEventListener("click", () => {
    const completedCount = appState.grocery.items.filter((item) => item.completed).length;

    if (completedCount === 0) {
      setGroceryFeedback("Non ci sono prodotti completati da rimuovere.");
      return;
    }

    appState.grocery.items = appState.grocery.items.filter((item) => !item.completed);
    saveState();
    renderGrocery();
    setGroceryFeedback("Prodotti completati spostati in dispensa.");
  });

  window.addEventListener("beforeunload", stopGroceryArCamera);
  renderGrocery();
}

function renderProfile() {
  const form = document.querySelector("[data-profile-form]");

  if (!form) {
    return;
  }

  const { personal, medical, goals } = appState.profile;

  form.elements.fullName.value = personal.fullName;
  form.elements.age.value = personal.age;
  form.elements.gender.value = personal.gender;
  form.elements.heightCm.value = personal.heightCm;
  form.elements.currentWeightKg.value = personal.currentWeightKg;
  form.elements.targetWeightKg.value = personal.targetWeightKg;
  form.elements.activityLevel.value = personal.activityLevel;

  form.elements.allergies.value = medical.allergies;
  form.elements.medications.value = medical.medications;
  form.elements.medicalConditions.value = medical.medicalConditions;
  form.elements.bloodType.value = medical.bloodType;

  form.elements.goalCalories.value = goals.calories;
  form.elements.goalProtein.value = goals.protein;
  form.elements.goalCarbs.value = goals.carbs;
  form.elements.goalFats.value = goals.fats;
  form.elements.goalWater.value = goals.water;

  document.querySelectorAll("[data-diet-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dietType === personal.dietType);
  });

  const bmi = calculateBmi(normalizeNumber(personal.heightCm), normalizeNumber(personal.currentWeightKg));
  const bmiDisplay = document.querySelector("[data-bmi-display]");

  if (bmiDisplay) {
    bmiDisplay.innerHTML = bmi
      ? `${bmi.toFixed(1)} <em>${getBmiLabel(bmi)}</em>`
      : `-- <em>${getBmiLabel(bmi)}</em>`;
  }

  const recommendations = calculateProfileRecommendations(personal);

  const recommendationMap = {
    tdee: recommendations.tdee ? `${recommendations.tdee} kcal` : "--",
    calories: recommendations.calories ? `${recommendations.calories} kcal` : "--",
    protein: recommendations.protein ? `${recommendations.protein}g` : "--",
    carbs: recommendations.carbs ? `${recommendations.carbs}g` : "--",
    fats: recommendations.fats ? `${recommendations.fats}g` : "--",
  };

  Object.entries(recommendationMap).forEach(([key, value]) => {
    const element = document.querySelector(`[data-profile-recommendation="${key}"]`);

    if (element) {
      element.textContent = value;
    }
  });

  const note = document.querySelector("[data-profile-recommendation-note]");
  const calorieNote = document.querySelector("[data-profile-goal-note]");

  if (note) {
    note.textContent = recommendations.note;
  }

  if (calorieNote) {
    calorieNote.textContent = recommendations.calorieNote;
  }

  renderProgress();
  renderDevices();
}

function renderDevicesSummary() {
  const container = document.querySelector("[data-devices-summary]");

  if (!container) {
    return;
  }

  const connectedCount = getConnectedDevices().length;
  const latestSyncAt = getLatestDevicesSyncAt();

  container.innerHTML = `
    <article>
      <strong>${devicesCatalog.length}</strong>
      <span>integrazioni disponibili</span>
    </article>
    <article>
      <strong>${connectedCount}</strong>
      <span>connessioni attive</span>
    </article>
    <article>
      <strong>${latestSyncAt ? formatDeviceSyncLabel(latestSyncAt) : "--"}</strong>
      <span>ultimo sync</span>
    </article>
  `;
}

function renderDevicesGrid() {
  const container = document.querySelector("[data-devices-grid]");

  if (!container) {
    return;
  }

  container.innerHTML = devicesCatalog
    .map((device) => {
      const deviceState = getDeviceState(device.id);
      const isConnected = Boolean(deviceState?.connected);
      const metaLines = getDeviceMetaLines(device);

      return `
        <article class="device-card${isConnected ? " is-connected" : ""}">
          <div class="device-top">
            <div>
              <span class="device-badge ${escapeHtml(device.badgeClass)}">${escapeHtml(device.badgeLabel)}</span>
              <h3>${escapeHtml(device.title)}</h3>
              <p>${escapeHtml(device.description)}</p>
            </div>
            <span class="status-pill${isConnected ? " connected" : ""}">${isConnected ? "Connesso" : escapeHtml(device.disconnectedLabel)}</span>
          </div>
          <div class="device-meta">
            ${metaLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
          </div>
          <div class="device-actions">
            ${
              isConnected
                ? `
              <button class="ghost-btn" type="button" data-device-sync="${escapeHtml(device.id)}">Sync ora</button>
              <button class="ghost-btn danger" type="button" data-device-disconnect="${escapeHtml(device.id)}">Disconnetti</button>
            `
                : `<button class="ghost-btn primary" type="button" data-device-connect="${escapeHtml(device.id)}">${escapeHtml(device.connectLabel)}</button>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDevicesPermissionsPanel() {
  const panel = document.querySelector("[data-devices-permissions-panel]");

  if (!panel) {
    return;
  }

  panel.hidden = !appState.devices.showPermissionsPanel;

  if (panel.hidden) {
    panel.innerHTML = "";
    return;
  }

  const connectedDevices = getConnectedDevices();

  if (connectedDevices.length === 0) {
    panel.innerHTML = `
      <h3>Permessi integrazioni</h3>
      <p class="save-hint">Collega almeno un dispositivo per gestire i permessi dei dati condivisi.</p>
    `;
    return;
  }

  panel.innerHTML = `
    <h3>Permessi integrazioni</h3>
    <div class="sync-options">
      ${connectedDevices
        .map((device) => {
          const deviceState = getDeviceState(device.id);
          return `
            <div class="sync-row">
              <span class="sync-row-copy">
                <span class="sync-row-head">
                  <strong>${escapeHtml(device.title)}</strong>
                </span>
                <small>${escapeHtml(device.description)}</small>
                <div class="lookup-chip-row">
                  ${Object.entries(device.permissions)
                    .map(
                      ([key, config]) => `
                        <label class="lookup-chip">
                          <input type="checkbox" data-device-permission="${escapeHtml(device.id)}" data-device-permission-key="${escapeHtml(key)}" ${deviceState.permissions[key] ? "checked" : ""} />
                          ${escapeHtml(config.label)}
                        </label>
                      `
                    )
                    .join("")}
                </div>
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDevicesManagePermissionsButton() {
  const button = document.querySelector("[data-devices-manage-permissions]");

  if (!button) {
    return;
  }

  button.textContent = appState.devices.showPermissionsPanel ? "Gestisci permessi ↑" : "Gestisci permessi ↓";
}

function renderDevicesSyncOptions() {
  const container = document.querySelector("[data-devices-sync-options]");

  if (!container) {
    return;
  }

  const options = [
    {
      key: "autoSyncDaily",
      title: "Auto-sync ogni giorno",
      description: "Aggiorna automaticamente i dati connessi di salute e nutrizione.",
    },
    {
      key: "importWorkoutCalories",
      title: "Importa le calorie dei workout in Progress",
      description: "Usa i dati di attività esterni per aggiornare la stima delle calorie bruciate.",
    },
    {
      key: "useConnectedWeightInProfile",
      title: "Usa i dati di peso connessi in Profile",
      description: "Aggiorna le metriche corporee dalle misurazioni della bilancia smart.",
    },
  ];

  container.innerHTML = options
    .map(
      (option) => `
        <label class="sync-row">
          <span class="sync-row-copy">
            <span class="sync-row-head">
              <strong>${escapeHtml(option.title)}</strong>
              <input type="checkbox" data-device-sync-pref="${escapeHtml(option.key)}" ${appState.devices.syncPreferences[option.key] ? "checked" : ""} />
            </span>
            <small>${escapeHtml(option.description)}</small>
          </span>
        </label>
      `
    )
    .join("");
}

function renderDevices() {
  renderDevicesManagePermissionsButton();
  renderDevicesSummary();
  renderDevicesGrid();
  renderDevicesPermissionsPanel();
  renderDevicesSyncOptions();
}

function setupDevicesSection() {
  const grid = document.querySelector("[data-devices-grid]");
  const permissionsButton = document.querySelector("[data-devices-manage-permissions]");
  const addButton = document.querySelector("[data-devices-add]");
  const permissionsPanel = document.querySelector("[data-devices-permissions-panel]");
  const syncOptions = document.querySelector("[data-devices-sync-options]");

  if (!grid || !permissionsButton || !addButton || !permissionsPanel || !syncOptions) {
    return;
  }

  permissionsButton.addEventListener("click", () => {
    appState.devices.showPermissionsPanel = !appState.devices.showPermissionsPanel;
    saveState();
    renderDevicesManagePermissionsButton();
    renderDevicesPermissionsPanel();
  });

  addButton.addEventListener("click", () => {
    const nextDevice = devicesCatalog.find((device) => !getDeviceState(device.id)?.connected);

    if (!nextDevice) {
      setDevicesFeedback("Tutte le integrazioni disponibili sono già collegate.");
      return;
    }

    connectDevice(nextDevice.id);
    renderDevices();
    setDevicesFeedback(`${nextDevice.title} collegato e sincronizzato.`);
  });

  grid.addEventListener("click", (event) => {
    const connectButton = event.target.closest("[data-device-connect]");
    const syncButton = event.target.closest("[data-device-sync]");
    const disconnectButton = event.target.closest("[data-device-disconnect]");

    if (connectButton) {
      const device = getDeviceConfig(connectButton.dataset.deviceConnect);

      if (!device || !connectDevice(device.id)) {
        return;
      }

      renderDevices();
      setDevicesFeedback(`${device.title} collegato e sincronizzato.`);
      return;
    }

    if (syncButton) {
      const device = getDeviceConfig(syncButton.dataset.deviceSync);

      if (!device || !syncDevice(device.id)) {
        return;
      }

      renderDevices();
      setDevicesFeedback(`${device.title} sincronizzato.`);
      return;
    }

    if (disconnectButton) {
      const device = getDeviceConfig(disconnectButton.dataset.deviceDisconnect);

      if (!device || !disconnectDevice(device.id)) {
        return;
      }

      renderDevices();
      setDevicesFeedback(`${device.title} disconnesso.`);
    }
  });

  permissionsPanel.addEventListener("change", (event) => {
    const permissionToggle = event.target.closest("[data-device-permission]");

    if (!permissionToggle) {
      return;
    }

    const deviceState = getDeviceState(permissionToggle.dataset.devicePermission);

    if (!deviceState) {
      return;
    }

    deviceState.permissions[permissionToggle.dataset.devicePermissionKey] = permissionToggle.checked;
    saveState();
    renderDevicesGrid();
    setDevicesFeedback("Permessi integrazione aggiornati.");
  });

  syncOptions.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-device-sync-pref]");

    if (!toggle) {
      return;
    }

    appState.devices.syncPreferences[toggle.dataset.deviceSyncPref] = toggle.checked;

    if (toggle.dataset.deviceSyncPref === "useConnectedWeightInProfile" && toggle.checked) {
      const scaleState = getDeviceState("scale");

      if (scaleState?.connected) {
        syncDevice("scale");
      }
    } else {
      saveState();
    }

    renderDevices();
    setDevicesFeedback("Preferenze sync aggiornate.");
  });

  renderDevices();
}

function setupProfileSection() {
  const form = document.querySelector("[data-profile-form]");
  const applyButton = document.querySelector("[data-apply-profile-recommendations]");

  if (!form || !applyButton) {
    return;
  }

  bindFormValidationFeedback(form);

  document.querySelectorAll("[data-diet-type]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.profile.personal.dietType = button.dataset.dietType;
      renderProfile();
      setProfileFeedback("Salva per conservare le preferenze alimentari.");
    });
  });

  form.addEventListener("input", (event) => {
    const relevantFields = ["age", "gender", "heightCm", "currentWeightKg", "targetWeightKg", "activityLevel"];

    if (relevantFields.includes(event.target.name)) {
      const draftPersonal = {
        ...appState.profile.personal,
        age: form.elements.age.value,
        gender: form.elements.gender.value,
        heightCm: form.elements.heightCm.value,
        currentWeightKg: form.elements.currentWeightKg.value,
        targetWeightKg: form.elements.targetWeightKg.value,
        activityLevel: form.elements.activityLevel.value,
      };

      const bmi = calculateBmi(normalizeNumber(draftPersonal.heightCm), normalizeNumber(draftPersonal.currentWeightKg));
      const bmiDisplay = document.querySelector("[data-bmi-display]");

      if (bmiDisplay) {
        bmiDisplay.innerHTML = bmi
          ? `${bmi.toFixed(1)} <em>${getBmiLabel(bmi)}</em>`
          : `-- <em>${getBmiLabel(bmi)}</em>`;
      }

      const recommendations = calculateProfileRecommendations(draftPersonal);
      const liveMap = {
        tdee: recommendations.tdee ? `${recommendations.tdee} kcal` : "--",
        calories: recommendations.calories ? `${recommendations.calories} kcal` : "--",
        protein: recommendations.protein ? `${recommendations.protein}g` : "--",
        carbs: recommendations.carbs ? `${recommendations.carbs}g` : "--",
        fats: recommendations.fats ? `${recommendations.fats}g` : "--",
      };

      Object.entries(liveMap).forEach(([key, value]) => {
        const element = document.querySelector(`[data-profile-recommendation="${key}"]`);

        if (element) {
          element.textContent = value;
        }
      });

      const note = document.querySelector("[data-profile-recommendation-note]");
      const calorieNote = document.querySelector("[data-profile-goal-note]");

      if (note) {
        note.textContent = recommendations.note;
      }

      if (calorieNote) {
        calorieNote.textContent = recommendations.calorieNote;
      }
    }
  });

  applyButton.addEventListener("click", () => {
    const recommendations = calculateProfileRecommendations({
      ...appState.profile.personal,
      age: form.elements.age.value,
      gender: form.elements.gender.value,
      heightCm: form.elements.heightCm.value,
      currentWeightKg: form.elements.currentWeightKg.value,
      targetWeightKg: form.elements.targetWeightKg.value,
      activityLevel: form.elements.activityLevel.value,
    });

    if (!recommendations.calories) {
      setProfileFeedback("Completa età, altezza e peso prima di applicare le raccomandazioni.");
      return;
    }

    form.elements.goalCalories.value = recommendations.calories;
    form.elements.goalProtein.value = recommendations.protein;
    form.elements.goalCarbs.value = recommendations.carbs;
    form.elements.goalFats.value = recommendations.fats;
    setProfileFeedback("Obiettivi consigliati applicati. Salva il profilo per mantenerli.");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const nextProfile = {
      personal: {
        fullName: String(form.elements.fullName.value).trim(),
        age: normalizeNumber(form.elements.age.value),
        gender: form.elements.gender.value,
        heightCm: normalizeNumber(form.elements.heightCm.value),
        currentWeightKg: normalizeNumber(form.elements.currentWeightKg.value),
        targetWeightKg: normalizeNumber(form.elements.targetWeightKg.value),
        activityLevel: form.elements.activityLevel.value,
        dietType: appState.profile.personal.dietType,
      },
      medical: {
        allergies: String(form.elements.allergies.value).trim(),
        medications: String(form.elements.medications.value).trim(),
        medicalConditions: String(form.elements.medicalConditions.value).trim(),
        bloodType: form.elements.bloodType.value,
      },
      goals: {
        calories: normalizeNumber(form.elements.goalCalories.value),
        protein: normalizeNumber(form.elements.goalProtein.value),
        carbs: normalizeNumber(form.elements.goalCarbs.value),
        fats: normalizeNumber(form.elements.goalFats.value),
        water: normalizeNumber(form.elements.goalWater.value),
      },
    };

    const requiredValues = [
      nextProfile.personal.fullName,
      nextProfile.personal.age,
      nextProfile.personal.heightCm,
      nextProfile.personal.currentWeightKg,
      nextProfile.personal.targetWeightKg,
      nextProfile.personal.activityLevel,
      nextProfile.goals.calories,
      nextProfile.goals.protein,
      nextProfile.goals.carbs,
      nextProfile.goals.fats,
      nextProfile.goals.water,
    ];

    if (requiredValues.some((value) => value === null || value === "")) {
      setProfileFeedback("Completa i campi obbligatori.");
      return;
    }

    appState.profile = nextProfile;
    syncNutritionGoalsFromProfile();
    captureTodayProgressSnapshot({
      weightKg: nextProfile.personal.currentWeightKg,
    });
    saveState();
    renderProfile();
    renderNutrition();
    resetFormValidationState(form);
    setProfileFeedback("Profilo salvato e sincronizzato.");
  });

  renderProfile();
}

syncNutritionGoalsFromProfile();
captureTodayProgressSnapshot();
saveState();
setupBarcodeScanner();
setupNutritionSection();
setupRecipesSection();
setupGrocerySection();
setupProgressSection();
setupDevicesSection();
setupProfileSection();
hydrateNutriTrackStateFromApi();
