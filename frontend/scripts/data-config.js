const crypto =
  globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto
    : {
        randomUUID() {
          return `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
        },
      };

const defaultRecipeTimestamp = "2026-06-23T16:24:00.000Z";
const RECIPE_NUTRITION_SOURCE_LABEL = "Importato da Recipes";

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

function getDefaultProgressState() {
  return {
    selectedRange: "week",
    dailyLogs: [],
    autoSnapshots: {},
  };
}

const devicesCatalog = [
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
];

function getDefaultDevicesUiState() {
  return {
    showPermissionsPanel: false,
    syncPreferences: {
      autoSyncDaily: true,
      importWorkoutCalories: true,
      useConnectedWeightInProfile: false,
    },
  };
}

function getDefaultDevicesIntegrationsState() {
  return devicesCatalog.reduce((state, device) => {
    state[device.id] = {
      connected: false,
      lastSyncAt: "",
      permissions: Object.fromEntries(
        Object.entries(device.permissions).map(([key, config]) => [key, config.defaultEnabled])
      ),
      latestData: {},
      ...(device.id === "strava"
        ? {
            configured: false,
            athleteName: "",
            athleteId: null,
            acceptedScopes: [],
            lastSyncStatus: "",
          }
        : {}),
    };
    return state;
  }, {});
}

function getDefaultDevicesState() {
  return {
    ...getDefaultDevicesUiState(),
    integrations: getDefaultDevicesIntegrationsState(),
  };
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
        mode: "official-api-with-cache",
        officialDatasetPage: "https://world.openfoodfacts.org/data",
        officialProjectPage: "https://world.openfoodfacts.org/",
        license: "ODbL",
        retrievalStrategy: "live-api-with-dataset-support",
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
