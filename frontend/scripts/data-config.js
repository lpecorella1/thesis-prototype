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
  return [];
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getRelativeDateKey(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return formatDateKey(date);
}

function getDefaultProgressState() {
  return {
    selectedRange: "week",
    dailyLogs: [],
    autoSnapshots: {},
  };
}

const PHYSICAL_ACTIVITY_DATASET_SOURCE = {
  mode: "local-seed-rag-ready",
  officialDatasetPage: "https://pacompendium.com/adult-compendium/",
  officialProjectPage: "https://pacompendium.com/",
  citation: "Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities.",
  retrievalStrategy: "local-metadata-with-met-estimation",
};

const physicalActivityCatalog = [
  {
    id: "walking-moderate",
    label: "Camminata moderata",
    aliases: ["camminata", "camminare", "passeggiata", "walking", "walk"],
    category: "Walking",
    compendiumCode: "17190",
    met: 3.8,
    intensity: "moderata",
    description: "Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface",
  },
  {
    id: "walking-brisk",
    label: "Camminata veloce",
    aliases: ["camminata veloce", "camminata rapida", "fitwalking", "brisk walking"],
    category: "Walking",
    compendiumCode: "17200",
    met: 4.8,
    intensity: "moderata",
    description: "Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise",
  },
  {
    id: "running-general",
    label: "Corsa",
    aliases: ["corsa", "correre", "running", "jogging", "jogging generale"],
    category: "Running",
    compendiumCode: "12020",
    met: 7.5,
    intensity: "vigorosa",
    description: "Jogging, general, self-selected pace",
  },
  {
    id: "cycling-moderate",
    label: "Bicicletta moderata",
    aliases: ["bicicletta", "bici", "ciclismo", "cycling", "bike"],
    category: "Bicycling",
    compendiumCode: "01020",
    met: 6.8,
    intensity: "moderata",
    description: "Bicycling, 10 to 11.9 mph, leisure, slow, light effort",
  },
  {
    id: "swimming-general",
    label: "Nuoto",
    aliases: ["nuoto", "nuotare", "swimming", "piscina"],
    category: "Water Activities",
    compendiumCode: "18240",
    met: 5.8,
    intensity: "moderata",
    description: "Swimming laps, freestyle, slow, recreational",
  },
  {
    id: "yoga",
    label: "Yoga",
    aliases: ["yoga", "hatha yoga", "stretching yoga"],
    category: "Conditioning Exercises",
    compendiumCode: "02150",
    met: 2.3,
    intensity: "leggera",
    description: "Yoga, Hatha",
  },
  {
    id: "pilates",
    label: "Pilates",
    aliases: ["pilates", "mat pilates"],
    category: "Conditioning Exercises",
    compendiumCode: "02105",
    met: 2.8,
    intensity: "moderata",
    description: "Pilates, general",
  },
  {
    id: "strength-training",
    label: "Allenamento forza",
    aliases: ["pesi", "forza", "muscoli", "allenamento forza", "strength", "weight lifting"],
    category: "Conditioning Exercises",
    compendiumCode: "02054",
    met: 3.5,
    intensity: "moderata",
    description: "Resistance (weight) training, multiple exercises, 8-15 reps at varied resistance",
  },
  {
    id: "hiit",
    label: "HIIT",
    aliases: ["hiit", "circuito", "interval training", "alta intensita"],
    category: "Conditioning Exercises",
    compendiumCode: "02210",
    met: 7,
    intensity: "vigorosa",
    description: "High intensity interval exercise, moderate effort",
  },
  {
    id: "soccer",
    label: "Calcio",
    aliases: ["calcio", "calcetto", "football", "soccer"],
    category: "Sports",
    compendiumCode: "15610",
    met: 7,
    intensity: "vigorosa",
    description: "Soccer, casual, general",
  },
  {
    id: "dancing",
    label: "Danza",
    aliases: ["danza", "ballo", "dancing", "dance"],
    category: "Dancing",
    compendiumCode: "03020",
    met: 5,
    intensity: "moderata",
    description: "Dancing, general",
  },
  {
    id: "house-cleaning",
    label: "Pulizie di casa",
    aliases: ["pulizie", "pulire", "casa", "faccende", "cleaning"],
    category: "Home Activities",
    compendiumCode: "05010",
    met: 3.3,
    intensity: "moderata",
    description: "Cleaning, sweeping carpet or floors, general",
  },
];

const devicesCatalog = [
  {
    id: "scale",
    badgeClass: "badge-scale",
    badgeLabel: "Metriche corpo",
    title: "Bilancia digitale",
    description: "Importa peso, massa grassa e composizione corporea in Progress.",
    availableLabel: "Dati: peso, BMI, massa grassa",
    connectLabel: "Connetti",
    disconnectedLabel: "Disponibile",
    permissions: {
      weight: { label: "Peso", defaultEnabled: true },
      bmi: { label: "BMI", defaultEnabled: true },
      bodyFat: { label: "Massa grassa", defaultEnabled: true },
    },
  },
];

function getDefaultDevicesUiState() {
  return {
    showPermissionsPanel: false,
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
    selectedDate: getRelativeDateKey(0),
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
    physicalActivities: {
      source: PHYSICAL_ACTIVITY_DATASET_SOURCE,
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
      dietaryPreferences: "",
      labMetrics: [],
    },
    goals: {
      primaryObjective: "",
      secondaryObjective: "",
      healthFocus: "",
      calories: 2000,
      protein: 150,
      carbs: 250,
      fats: 65,
      water: 8,
      includeBurnedCaloriesInGoal: false,
    },
  },
  devices: getDefaultDevicesState(),
};
