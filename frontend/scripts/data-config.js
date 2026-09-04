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
    },
  },
  devices: getDefaultDevicesState(),
};
