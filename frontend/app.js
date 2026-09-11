const bootstrap = window.NutriTrackBootstrap;

if (!bootstrap) {
  throw new Error("Bootstrap frontend non caricato: impossibile inizializzare NutriTrack.");
}

const requiredBootstrapKeys = [
  "crypto",
  "structuredClone",
  "tabs",
  "panels",
  "homeCards",
  "sectionLinks",
  "homeButtons",
  "mobileHomeMediaQuery",
  "recipeSwitches",
  "recipePanels",
  "NUTRITRACK_LOCAL_STATE_CACHE_KEY",
  "NUTRITRACK_STATE_API_PATH",
  "defaultRecipeTimestamp",
  "RECIPE_NUTRITION_SOURCE_LABEL",
  "PHYSICAL_ACTIVITY_DATASET_SOURCE",
  "physicalActivityCatalog",
  "getRelativeDateKey",
  "getDefaultDevicesUiState",
  "getDefaultDevicesIntegrationsState",
  "getDefaultDevicesState",
  "devicesCatalog",
  "nutritrackSyncRuntime",
  "groceryArRuntime",
  "openFoodFactsRuntime",
  "barcodeScannerRuntime",
  "recipeChatRuntime",
  "OPEN_FOOD_FACTS_FIELDS",
  "defaultState",
  "setGroceryArToggleButtonState",
];

const missingBootstrapKeys = requiredBootstrapKeys.filter((key) => !(key in bootstrap));

if (missingBootstrapKeys.length > 0) {
  throw new Error(`Bootstrap frontend incompleto: mancano ${missingBootstrapKeys.join(", ")}.`);
}

const appState = loadNutriTrackStateFromLocalCache();
const nutritrackCoreRuntime = {
  started: false,
};
const nutritionEntryRuntime = {
  entryMode: "",
  entryMethod: "",
};
const WATER_GOAL_MIN = 1;
const WATER_GOAL_MAX = 15;
const WATER_GLASS_ML = 200;
const PHYSICAL_ACTIVITY_MATCH_LIMIT = 4;
const PHYSICAL_ACTIVITY_COMMON_LABELS = [
  "Camminata",
  "Camminata lenta",
  "Camminata veloce",
  "Corsa",
  "Jogging",
  "Bicicletta",
  "Cyclette",
  "Allenamento forza",
  "Corpo libero",
  "Circuit training",
  "Palestra",
  "Ellittica",
  "Vogatore",
  "Kettlebell",
  "Yoga",
  "Yoga su sedia",
  "Tai Chi",
  "Tai Chi su sedia",
  "Pilates",
  "Nuoto",
  "Danza",
  "Attività domestica",
  "Giardinaggio",
  "Scale",
  "Calcio",
  "Basket",
  "Pickleball",
];
const PHYSICAL_ACTIVITY_SEARCH_TRANSLATIONS = {
  allenamento: ["training"],
  ballo: ["dancing"],
  bici: ["bicycling"],
  bicicletta: ["bicycling"],
  calcetto: ["soccer"],
  calcio: ["soccer"],
  camminare: ["walking"],
  camminata: ["walking"],
  casa: ["home"],
  ciclismo: ["bicycling"],
  corsa: ["running"],
  correre: ["running"],
  danza: ["dancing"],
  faccende: ["cleaning"],
  forza: ["resistance"],
  leggera: ["light"],
  lento: ["slow"],
  lenta: ["slow"],
  moderata: ["moderate"],
  moderato: ["moderate"],
  nuotare: ["swimming"],
  nuoto: ["swimming"],
  palestra: ["exercise"],
  passeggiata: ["walking"],
  pesi: ["resistance"],
  pilates: ["pilates"],
  piscina: ["swimming"],
  pulire: ["cleaning"],
  pulizie: ["cleaning"],
  veloce: ["brisk"],
  vigorosa: ["vigorous"],
  vigoroso: ["vigorous"],
  yoga: ["yoga"],
};
const physicalActivityCatalogRuntime = {
  activeKey: "",
  loadPromise: null,
  isLoading: false,
  errorMessage: "",
};

// Core date and range helpers shared across modules.
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

function getSelectedNutritionDateKey() {
  if (!appState.nutrition || typeof appState.nutrition !== "object") {
    appState.nutrition = {};
  }

  if (!isValidDateKey(appState.nutrition.selectedDate)) {
    appState.nutrition.selectedDate = getTodayDateKey();
  }

  return appState.nutrition.selectedDate;
}

function createLocalDateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftDateKey(dateKey, offsetDays) {
  const date = createLocalDateFromKey(dateKey);

  if (Number.isNaN(date.getTime())) {
    return getTodayDateKey();
  }

  date.setDate(date.getDate() + offsetDays);
  return formatDateKey(date);
}

function formatNutritionDateLabel(dateKey) {
  const todayKey = getTodayDateKey();

  if (dateKey === todayKey) {
    return "Oggi";
  }

  if (dateKey === shiftDateKey(todayKey, -1)) {
    return "Ieri";
  }

  if (dateKey === shiftDateKey(todayKey, 1)) {
    return "Domani";
  }

  const date = createLocalDateFromKey(dateKey);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatNutritionDateSubtitle(dateKey) {
  const date = createLocalDateFromKey(dateKey);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMealsSectionTitle(dateKey) {
  const todayKey = getTodayDateKey();

  if (dateKey === todayKey) {
    return "Pasti di oggi";
  }

  if (dateKey === shiftDateKey(todayKey, -1)) {
    return "Pasti di ieri";
  }

  if (dateKey === shiftDateKey(todayKey, 1)) {
    return "Pasti di domani";
  }

  return `Pasti del ${formatNutritionDateLabel(dateKey)}`;
}

function getProgressRangeDays() {
  return appState.progress.selectedRange === "month" ? 30 : 7;
}

function getRecentDateKeys(days) {
  return Array.from({ length: days }, (_, index) => getRelativeDateKey(index - (days - 1)));
}

// Shared form validation helpers used by section modules.
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

// Shared nutrition and state helpers used across nutrition, progress, profile, and devices.
function createNutritionSnapshot(values = {}) {
  return {
    calories: roundMacroValue(normalizeNumber(values.calories) || 0),
    protein: roundMacroValue(normalizeNumber(values.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(values.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(values.fats) || 0),
  };
}

function normalizeUserEntryMode(value) {
  const normalizedValue = String(value || "").trim();
  return ["manual", "ai_assisted", "external_lookup", "imported", "system_generated"].includes(normalizedValue)
    ? normalizedValue
    : "";
}

function inferUserEntryModeFromSource(entry = {}) {
  const explicitMode = normalizeUserEntryMode(entry.entryMode || entry.entry_mode || entry.inputMode);

  if (explicitMode) {
    return explicitMode;
  }

  const source = String(entry.source || entry.nutritionSource || entry.nutritionSourceLabel || "").toLowerCase();

  if (source.includes("ai") || source.includes("analysis") || source.includes("meal-description") || source.includes("stima")) {
    return "ai_assisted";
  }

  if (source.includes("openfoodfacts") || source.includes("barcode")) {
    return "external_lookup";
  }

  if (source.includes("recipes")) {
    return "system_generated";
  }

  if (source.includes("import")) {
    return "imported";
  }

  return "manual";
}

function resolveUserEntryMethod(entry = {}, fallback = "manual-form") {
  const explicitMethod = String(entry.entryMethod || entry.entry_method || entry.inputMethod || "").trim();

  if (explicitMethod) {
    return explicitMethod;
  }

  const source = String(entry.source || entry.nutritionSource || entry.nutritionSourceLabel || "").toLowerCase();

  if (source.includes("openfoodfacts")) {
    return "barcode-openfoodfacts";
  }

  if (source.includes("ai-image")) {
    return "ai-image-import";
  }

  if (source.includes("ai-generated")) {
    return "ai-generated-list";
  }

  if (source.includes("meal-description") || source.includes("analysis") || source.includes("stima")) {
    return "ai-meal-description-analysis";
  }

  if (source.includes("recipes")) {
    return "recipe-application";
  }

  return fallback;
}

// Heuristic meal profiling used for quick nutrition estimates.
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

function parseMetricQuantityLabel(value) {
  const matches = String(value || "").matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/gi);

  for (const match of matches) {
    const amount = normalizeNumber(match[1]);
    const unit = String(match[2] || "").toLowerCase();

    if (amount === null || amount <= 0) {
      continue;
    }

    const baseQuantity = convertQuantityToBaseUnit(amount, unit);

    if (baseQuantity.unit === "g" || baseQuantity.unit === "ml") {
      return baseQuantity;
    }
  }

  return null;
}

function getOpenFoodFactsNutritionBaseAmount(product) {
  if (!product) {
    return null;
  }

  if (product.macroBasis !== "serving") {
    return 100;
  }

  const servingQuantity = parseMetricQuantityLabel(product.serving) || parseMetricQuantityLabel(product.quantity);
  return servingQuantity?.value || null;
}

function scaleNutritionValues(values, factor) {
  return createNutritionSnapshot({
    calories: (normalizeNumber(values?.calories) || 0) * factor,
    protein: (normalizeNumber(values?.protein) || 0) * factor,
    carbs: (normalizeNumber(values?.carbs) || 0) * factor,
    fats: (normalizeNumber(values?.fats) || 0) * factor,
  });
}

function getScaledOpenFoodFactsNutritionDraft(product, consumedAmount) {
  const baseAmount = getOpenFoodFactsNutritionBaseAmount(product);
  const effectiveAmount = consumedAmount || baseAmount || null;
  const factor = effectiveAmount && baseAmount > 0 ? effectiveAmount / baseAmount : 1;

  return {
    ...scaleNutritionValues(product, factor),
    nutritionSource: "imported",
    nutritionSourceLabel: "Importato da OpenFoodFacts",
    consumedAmount: effectiveAmount,
    referenceAmount: baseAmount,
  };
}

function getNutritionDraftForMeal(name, options = {}) {
  // Quando un prodotto OpenFoodFacts è collegato al form, i macro del pasto
  // non vengono stimati dall'IA: prendiamo direttamente i nutrienti strutturati
  // già normalizzati dal lookup API/dataset e li scaliamo sulla quantità consumata.
  if (openFoodFactsRuntime.nutritionLookup) {
    return getScaledOpenFoodFactsNutritionDraft(openFoodFactsRuntime.nutritionLookup, options.consumedAmount);
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

function shouldAnalyzeMealDescription(name, linkedProduct) {
  const description = String(name || "").trim();

  if (!description) {
    return false;
  }

  return !linkedProduct || /[+;,\n]|\b(?:e|ed)\b/i.test(description) || description.length > 48;
}

function splitMealDescriptionIntoComponents(description) {
  return String(description || "")
    .split(/\s*(?:\+|;|,|\n|\b(?:e|ed)\b)\s*/gi)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function createFallbackMealAnalysis(description) {
  const items = splitMealDescriptionIntoComponents(description).map((component) => {
    const estimate = estimateNutritionFromMealName(component);

    return {
      rawText: component,
      name: component,
      quantity: "1 porzione",
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fats: estimate.fats,
      confidence: 0.35,
      source: "local-estimate",
    };
  });

  const effectiveItems = items.length > 0
    ? items
    : [
        {
          rawText: description,
          name: description,
          quantity: "1 porzione",
          ...estimateNutritionFromMealName(description),
          confidence: 0.35,
          source: "local-estimate",
        },
      ];
  const totals = effectiveItems.reduce(
    (result, item) => {
      result.calories += roundMacroValue(normalizeNumber(item.calories) || 0);
      result.protein += roundMacroValue(normalizeNumber(item.protein) || 0);
      result.carbs += roundMacroValue(normalizeNumber(item.carbs) || 0);
      result.fats += roundMacroValue(normalizeNumber(item.fats) || 0);
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    name: description,
    items: effectiveItems,
    totals,
    confidence: 0.35,
    source: "local-fallback",
    reviewNote: "Stima locale: controlla le porzioni.",
  };
}

function normalizeMealAnalysisItem(item) {
  return {
    rawText: String(item?.rawText || item?.name || "").trim(),
    name: String(item?.name || item?.rawText || "Alimento").trim(),
    quantity: String(item?.quantity || "1 porzione").trim(),
    calories: roundMacroValue(normalizeNumber(item?.calories) || 0),
    protein: roundMacroValue(normalizeNumber(item?.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(item?.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(item?.fats) || 0),
    confidence: Math.max(0, Math.min(1, normalizeNumber(item?.confidence) ?? 0.45)),
    source: String(item?.source || "ai-estimate").trim(),
    nutritionReference: item?.nutritionReference && typeof item.nutritionReference === "object" ? item.nutritionReference : null,
  };
}

function normalizeMealAnalysisPayload(analysis, description) {
  const items = Array.isArray(analysis?.items)
    ? analysis.items.map(normalizeMealAnalysisItem).filter((item) => item.name)
    : [];

  if (items.length === 0) {
    return createFallbackMealAnalysis(description);
  }

  const totals = items.reduce(
    (result, item) => {
      result.calories += item.calories;
      result.protein += item.protein;
      result.carbs += item.carbs;
      result.fats += item.fats;
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    name: String(analysis?.name || description).trim(),
    items,
    totals,
    confidence: Math.max(0, Math.min(1, normalizeNumber(analysis?.confidence) ?? 0.45)),
    source: String(analysis?.source || "ai-meal-analysis").trim(),
    reviewNote: String(analysis?.reviewNote || "").trim(),
  };
}

async function requestMealNutritionAnalysis(description) {
  const response = await fetch(window.NutriTrackBootstrap.buildNutriTrackApiPath("/api/nutrition/analyze-meal"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description,
      state: buildServerNutriTrackState(appState),
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Analisi del pasto non disponibile.");
  }

  const payload = await response.json();
  return normalizeMealAnalysisPayload(payload.analysis, description);
}

async function requestMealPhotoDescription(file) {
  if (typeof compressImageForPantryImport !== "function") {
    throw new Error("Compressione immagine non disponibile.");
  }

  const imageDataUrl = await compressImageForPantryImport(file);
  const response = await fetch(window.NutriTrackBootstrap.buildNutriTrackApiPath("/api/nutrition/describe-meal-image"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: {
        dataUrl: imageDataUrl,
      },
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      window.handleNutriTrackUnauthorized?.();
    }

    throw new Error(payload?.error || "Riconoscimento foto non riuscito.");
  }

  const description = String(payload?.description || "").trim();

  if (!description) {
    throw new Error("Nessun alimento riconoscibile nella foto.");
  }

  return {
    description,
    reviewNote: String(payload?.reviewNote || "").trim(),
  };
}

function buildMealAnalysisSourceNote(analysis) {
  const itemLines = Array.isArray(analysis?.items)
    ? analysis.items
        .map((item) => `${item.name}${item.quantity ? ` (${item.quantity})` : ""}: ${item.calories} kcal`)
        .slice(0, 8)
    : [];

  return itemLines.length > 0 ? itemLines.join("; ") : String(analysis?.reviewNote || "").trim();
}

// Shared draft and totals helpers for nutrition and progress snapshots.
function clearNutritionDraft() {
  openFoodFactsRuntime.nutritionLookup = null;
  openFoodFactsRuntime.nutritionDraft = null;
  nutritionEntryRuntime.entryMode = "";
  nutritionEntryRuntime.entryMethod = "";
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

function normalizePhysicalActivityText(value) {
  return String(value || "")
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPhysicalActivitySearchText(activity) {
  return normalizePhysicalActivityText([
    activity?.label,
    activity?.displayLabel,
    activity?.category,
    activity?.description,
    ...(Array.isArray(activity?.aliases) ? activity.aliases : []),
  ].join(" "));
}

function getPhysicalActivityQueryTokens(value) {
  return normalizePhysicalActivityText(value)
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => PHYSICAL_ACTIVITY_SEARCH_TRANSLATIONS[token] || [token]);
}

function getPhysicalActivityIntensityFromMet(met) {
  if (met < 3) {
    return "leggera";
  }

  if (met < 6) {
    return "moderata";
  }

  return "vigorosa";
}

function buildPhysicalActivityDisplayLabel(description, category) {
  const text = normalizePhysicalActivityText(description);
  const normalizedCategory = normalizePhysicalActivityText(category);

  if (text.includes("resistance") || text.includes("weight training") || text.includes("weight lifting")) {
    return "Allenamento forza";
  }

  if (text.includes("calisthenics")) {
    return "Corpo libero";
  }

  if (text.includes("circuit training")) {
    return "Circuit training";
  }

  if (text.includes("elliptical")) {
    return "Ellittica";
  }

  if (text.includes("rowing") || text.includes("rower")) {
    return "Vogatore";
  }

  if (text.includes("kettle bell") || text.includes("kettlebell")) {
    return "Kettlebell";
  }

  if (text.includes("health club")) {
    return "Palestra";
  }

  if (text.includes("yoga")) {
    return text.includes("chair") ? "Yoga su sedia" : "Yoga";
  }

  if (text.includes("tai chi")) {
    return text.includes("chair") ? "Tai Chi su sedia" : "Tai Chi";
  }

  if (text.includes("pilates")) {
    return "Pilates";
  }

  if (normalizedCategory.includes("walking") || text.includes("walking")) {
    if (text.includes("stair") || text.includes("stairs")) {
      return "Scale";
    }

    if (text.includes("brisk") || text.includes("very brisk")) {
      return "Camminata veloce";
    }

    if (text.includes("slow") || text.includes("strolling")) {
      return "Camminata lenta";
    }

    return "Camminata";
  }

  if (normalizedCategory.includes("running") || text.includes("running") || text.includes("jogging")) {
    return text.includes("jogging") ? "Jogging" : "Corsa";
  }

  if (normalizedCategory.includes("bicycling") || text.includes("bicycling") || text.includes("e bike")) {
    return text.includes("stationary") ? "Cyclette" : "Bicicletta";
  }

  if (normalizedCategory.includes("water") || text.includes("swimming")) {
    return "Nuoto";
  }

  if (normalizedCategory.includes("dancing") || text.includes("dance")) {
    return "Danza";
  }

  if (normalizedCategory.includes("home") || text.includes("cleaning")) {
    return "Attività domestica";
  }

  if (normalizedCategory.includes("lawn") || text.includes("gardening") || text.includes("garden")) {
    return "Giardinaggio";
  }

  if (text.includes("soccer") || text.includes("futsal")) {
    return "Calcio";
  }

  if (text.includes("basketball")) {
    return "Basket";
  }

  if (text.includes("pickleball")) {
    return "Pickleball";
  }

  return String(description || "").split(",")[0].trim() || String(category || "Attività fisica").trim();
}

function getPhysicalActivityDisplayLabel(activity) {
  return activity?.displayLabel || activity?.label || "Attività fisica";
}

function getPhysicalActivityPreferenceScore(activity) {
  const text = getPhysicalActivitySearchText(activity);
  let score = 0;

  if (text.includes("general")) score += 4;
  if (text.includes("multiple exercises")) score += 4;
  if (text.includes("self selected") || text.includes("self-selected")) score += 3;
  if (text.includes("moderate")) score += 2;
  if (text.includes("light")) score += 1;
  if (text.includes("vigorous")) score -= 2;
  if (text.includes("competitive")) score -= 3;
  if (text.includes("racing")) score -= 3;
  if (text.includes("power lifting") || text.includes("body building")) score -= 4;

  return score;
}

function parseCsvRows(csvText) {
  const rows = [];
  const current = [];
  let field = "";
  let isQuoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === "," && !isQuoted) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      current.push(field);
      field = "";

      if (current.some((value) => value.trim())) {
        rows.push(current.splice(0));
      } else {
        current.length = 0;
      }
      continue;
    }

    field += char;
  }

  if (field || current.length > 0) {
    current.push(field);

    if (current.some((value) => value.trim())) {
      rows.push(current);
    }
  }

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]))
  );
}

function getPhysicalActivityProfileAge() {
  return normalizeNumber(appState.profile?.personal?.age);
}

function shouldUseOlderAdultActivityDataset() {
  const age = getPhysicalActivityProfileAge();
  const threshold = normalizeNumber(PHYSICAL_ACTIVITY_DATASET_SOURCE.olderAdultAgeThreshold) ?? 60;
  return age != null && age >= threshold;
}

function getPhysicalActivityDatasetConfig() {
  const isOlderAdult = shouldUseOlderAdultActivityDataset();

  if (isOlderAdult) {
    return {
      key: "older_adult",
      label: "Compendium 60+ 2024",
      csvPath: PHYSICAL_ACTIVITY_DATASET_SOURCE.olderAdultCsvPath,
      sourceDocument: PHYSICAL_ACTIVITY_DATASET_SOURCE.olderAdultLocalSourceDocument,
      sourcePage: PHYSICAL_ACTIVITY_DATASET_SOURCE.olderAdultDatasetPage,
      citation: PHYSICAL_ACTIVITY_DATASET_SOURCE.olderAdultCitation,
      restingVo2MlKgMin: 2.7,
    };
  }

  return {
    key: "adult",
    label: "Compendium 2024",
    csvPath: PHYSICAL_ACTIVITY_DATASET_SOURCE.csvPath,
    sourceDocument: PHYSICAL_ACTIVITY_DATASET_SOURCE.localSourceDocument,
    sourcePage: PHYSICAL_ACTIVITY_DATASET_SOURCE.officialDatasetPage,
    citation: PHYSICAL_ACTIVITY_DATASET_SOURCE.citation,
    restingVo2MlKgMin: 3.5,
  };
}

function buildPhysicalActivityCatalogFromRows(rows, datasetConfig = getPhysicalActivityDatasetConfig()) {
  return rows
    .map((row) => {
      const code = String(row.activity_code || "").trim();
      const description = String(row.activity_description || "").trim();
      const met = normalizeNumber(row.met_value);
      const restingVo2 = normalizeNumber(row.resting_vo2_ml_kg_min) ?? datasetConfig.restingVo2MlKgMin;

      if (!code || !description || met == null || met <= 0) {
        return null;
      }

      return {
        id: `${datasetConfig.key}-${code}`,
        label: description,
        displayLabel: buildPhysicalActivityDisplayLabel(description, row.major_heading),
        aliases: [row.major_heading, description].filter(Boolean),
        category: String(row.major_heading || "").trim(),
        compendiumCode: code,
        met,
        restingVo2MlKgMin: restingVo2,
        intensity: getPhysicalActivityIntensityFromMet(met),
        description,
        sourcePage: String(row.source_page || "").trim(),
        sourceDocument: String(row.source_document || datasetConfig.sourceDocument || "").trim(),
        datasetKey: String(row.population || datasetConfig.key || "").trim(),
        datasetLabel: datasetConfig.label,
        datasetSourcePage: datasetConfig.sourcePage,
        metBasis: String(row.met_basis || "").trim(),
      };
    })
    .filter(Boolean);
}

function setPhysicalActivityCatalogEntries(entries) {
  physicalActivityCatalog.splice(0, physicalActivityCatalog.length, ...entries);
}

function getPhysicalActivityDatasetUrl(datasetConfig = getPhysicalActivityDatasetConfig()) {
  const csvPath = datasetConfig.csvPath;

  if (!csvPath) {
    return "";
  }

  return new URL(csvPath, document.baseURI).toString();
}

function loadPhysicalActivityCatalog() {
  const datasetConfig = getPhysicalActivityDatasetConfig();

  if (physicalActivityCatalogRuntime.activeKey === datasetConfig.key && physicalActivityCatalogRuntime.loadPromise) {
    return physicalActivityCatalogRuntime.loadPromise;
  }

  const datasetUrl = getPhysicalActivityDatasetUrl(datasetConfig);
  physicalActivityCatalogRuntime.activeKey = datasetConfig.key;
  physicalActivityCatalogRuntime.errorMessage = "";
  physicalActivityCatalogRuntime.isLoading = true;

  if (!datasetUrl || typeof fetch !== "function") {
    setPhysicalActivityCatalogEntries([]);
    physicalActivityCatalogRuntime.isLoading = false;
    physicalActivityCatalogRuntime.errorMessage = "Dataset attività non disponibile.";
    physicalActivityCatalogRuntime.loadPromise = Promise.resolve(physicalActivityCatalog);
    return physicalActivityCatalogRuntime.loadPromise;
  }

  physicalActivityCatalogRuntime.loadPromise = fetch(datasetUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Dataset attivita fisica non disponibile: ${response.status}`);
      }

      return response.text();
    })
    .then((csvText) => {
      const catalog = buildPhysicalActivityCatalogFromRows(parseCsvRows(csvText), datasetConfig);

      if (catalog.length === 0) {
        throw new Error("Dataset attivita fisica vuoto o non valido.");
      }

      if (physicalActivityCatalogRuntime.activeKey !== datasetConfig.key) {
        return physicalActivityCatalog;
      }

      setPhysicalActivityCatalogEntries(catalog);
      physicalActivityCatalogRuntime.isLoading = false;
      return physicalActivityCatalog;
    })
    .catch((error) => {
      console.warn("Dataset attivita fisica CSV non disponibile.", error);

      if (physicalActivityCatalogRuntime.activeKey !== datasetConfig.key) {
        return physicalActivityCatalog;
      }

      setPhysicalActivityCatalogEntries([]);
      physicalActivityCatalogRuntime.isLoading = false;
      physicalActivityCatalogRuntime.errorMessage =
        "Dataset attività non disponibile. Avvia il prototipo dal server locale per usare le stime automatiche.";

      return physicalActivityCatalog;
    });

  return physicalActivityCatalogRuntime.loadPromise;
}

function refreshPhysicalActivityCatalogUi() {
  renderPhysicalActivityDatalist();
  renderPhysicalActivityControl();
}

function ensurePhysicalActivityCatalogForCurrentProfile() {
  const datasetConfig = getPhysicalActivityDatasetConfig();

  if (physicalActivityCatalogRuntime.activeKey === datasetConfig.key) {
    return;
  }

  loadPhysicalActivityCatalog().then(refreshPhysicalActivityCatalogUi);
}

function findPhysicalActivityCatalogMatch(value) {
  const normalizedValue = normalizePhysicalActivityText(value);

  if (!normalizedValue) {
    return null;
  }

  const exactMatch = physicalActivityCatalog
    .filter((activity) => {
      const labels = [activity.label, activity.displayLabel, ...(Array.isArray(activity.aliases) ? activity.aliases : [])];
      return labels.some((label) => normalizePhysicalActivityText(label) === normalizedValue);
    })
    .sort((first, second) => getPhysicalActivityPreferenceScore(second) - getPhysicalActivityPreferenceScore(first))[0];

  if (exactMatch) {
    return exactMatch;
  }

  return getPhysicalActivityMatches(value, 1)[0] || null;
}

function getPhysicalActivityMatches(value, limit = PHYSICAL_ACTIVITY_MATCH_LIMIT) {
  const normalizedValue = normalizePhysicalActivityText(value);

  if (!normalizedValue) {
    return physicalActivityCatalog.slice(0, limit);
  }

  const tokens = getPhysicalActivityQueryTokens(value);

  return physicalActivityCatalog
    .map((activity) => {
      const searchText = getPhysicalActivitySearchText(activity);
      const score = tokens.reduce((result, token) => result + (searchText.includes(token) ? 1 : 0), 0);
      const exactBoost = [activity.label, activity.displayLabel].some(
        (label) => normalizePhysicalActivityText(label) === normalizedValue
      )
        ? 4
        : 0;
      return { activity, score: score + exactBoost, preferenceScore: getPhysicalActivityPreferenceScore(activity) };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.preferenceScore - first.preferenceScore ||
        getPhysicalActivityDisplayLabel(first.activity).localeCompare(getPhysicalActivityDisplayLabel(second.activity))
    )
    .filter(({ activity }, index, entries) => {
      const label = getPhysicalActivityDisplayLabel(activity);
      return entries.findIndex((entry) => getPhysicalActivityDisplayLabel(entry.activity) === label) === index;
    })
    .slice(0, limit)
    .map(({ activity }) => activity);
}

function getActivityEstimationWeight(dateKey) {
  const logWeight = normalizeNumber(getProgressLogByDate(dateKey)?.weightKg);
  const profileWeight = normalizeNumber(appState.profile?.personal?.currentWeightKg);
  return logWeight ?? profileWeight;
}

function estimatePhysicalActivityCalories(activity, durationMinutes, weightKg) {
  const met = normalizeNumber(activity?.met);
  const restingVo2 = normalizeNumber(activity?.restingVo2MlKgMin) ?? 3.5;
  const minutes = normalizeNumber(durationMinutes);
  const weight = normalizeNumber(weightKg);

  if (
    met == null ||
    minutes == null ||
    weight == null ||
    met <= 0 ||
    restingVo2 <= 0 ||
    minutes <= 0 ||
    weight <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.round((met * restingVo2 * weight * minutes) / 200));
}

function normalizePhysicalActivityEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const name = String(entry.name || entry.activityName || "").trim();
  const calories = Math.max(0, Math.round(normalizeNumber(entry.calories ?? entry.burnedCalories) || 0));

  if (!name || calories <= 0) {
    return null;
  }

  const durationMinutes = normalizeNumber(entry.durationMinutes ?? entry.minutes);
  const met = normalizeNumber(entry.met);
  const restingVo2 = normalizeNumber(entry.restingVo2MlKgMin);

  return {
    id: String(entry.id || crypto.randomUUID()),
    name,
    durationMinutes: durationMinutes == null ? null : Math.max(0, Math.round(durationMinutes)),
    calories,
    met,
    compendiumCode: String(entry.compendiumCode || "").trim(),
    category: String(entry.category || "").trim(),
    intensity: String(entry.intensity || "").trim(),
    source: String(entry.source || "manual").trim(),
    datasetSource: String(entry.datasetSource || "").trim(),
    datasetKey: String(entry.datasetKey || "").trim(),
    datasetLabel: String(entry.datasetLabel || "").trim(),
    sourceDocument: String(entry.sourceDocument || "").trim(),
    sourcePage: String(entry.sourcePage || "").trim(),
    metBasis: String(entry.metBasis || "").trim(),
    restingVo2MlKgMin: restingVo2,
    createdAt: String(entry.createdAt || new Date().toISOString()),
  };
}

function getPhysicalActivitiesForDate(dateKey) {
  const log = getProgressLogByDate(dateKey);
  return Array.isArray(log?.physicalActivities) ? log.physicalActivities.map(normalizePhysicalActivityEntry).filter(Boolean) : [];
}

function sumPhysicalActivityCalories(activities) {
  return (Array.isArray(activities) ? activities : []).reduce(
    (total, activity) => total + Math.max(0, Math.round(normalizeNumber(activity?.calories) || 0)),
    0
  );
}

function getBurnedCaloriesForDate(dateKey) {
  const activities = getPhysicalActivitiesForDate(dateKey);

  if (activities.length > 0) {
    return sumPhysicalActivityCalories(activities);
  }

  return Math.max(0, Math.round(normalizeNumber(getProgressLogByDate(dateKey)?.burnedCalories) || 0));
}

function shouldIncludeBurnedCaloriesInGoal() {
  return appState.profile?.goals?.includeBurnedCaloriesInGoal === true;
}

async function setIncludeBurnedCaloriesInGoal(shouldInclude) {
  appState.profile = appState.profile && typeof appState.profile === "object" ? appState.profile : {};
  appState.profile.goals = appState.profile.goals && typeof appState.profile.goals === "object" ? appState.profile.goals : {};
  appState.profile.goals.includeBurnedCaloriesInGoal = Boolean(shouldInclude);

  try {
    await saveProfilePatchToServer({
      goals: {
        includeBurnedCaloriesInGoal: Boolean(shouldInclude),
      },
    });
    renderNutrition();
    setPhysicalActivityStatus(
      shouldInclude
        ? "Le kcal spese aumentano l'obiettivo della giornata."
        : "Le kcal spese restano registrate senza aumentare l'obiettivo.",
      "success"
    );
  } catch (error) {
    console.error("Impossibile salvare la preferenza calorie bruciate.", error);
    setPhysicalActivityStatus(error.message || "Salvataggio non sincronizzato.", "error");
  }
}

function getMealDateKey(meal) {
  return isValidDateKey(meal?.date) ? meal.date : getTodayDateKey();
}

// Automatic daily snapshots bridging nutrition totals and progress history.
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

// Shared state normalization for persisted frontend data.
function normalizeNutritionMeal(meal) {
  const normalizedEntryMode = normalizeUserEntryMode(meal?.entryMode || meal?.entry_mode || meal?.inputMode);

  return {
    ...meal,
    date: isValidDateKey(meal?.date) ? meal.date : getTodayDateKey(),
    calories: roundMacroValue(normalizeNumber(meal?.calories) || 0),
    protein: roundMacroValue(normalizeNumber(meal?.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(meal?.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(meal?.fats) || 0),
    entryMode: normalizedEntryMode || inferUserEntryModeFromSource(meal),
    entryMethod: resolveUserEntryMethod(meal, "manual-meal-form"),
  };
}

function normalizeProgressLog(entry) {
  if (!isValidDateKey(entry?.date)) {
    return null;
  }

  const physicalActivities = Array.isArray(entry.physicalActivities)
    ? entry.physicalActivities.map(normalizePhysicalActivityEntry).filter(Boolean)
    : [];
  const burnedCalories = normalizeNumber(entry.burnedCalories);

  return {
    date: entry.date,
    weightKg: normalizeNumber(entry.weightKg),
    waterGlasses: normalizeNumber(entry.waterGlasses),
    calories: normalizeNumber(entry.calories),
    protein: normalizeNumber(entry.protein),
    burnedCalories: burnedCalories ?? (physicalActivities.length > 0 ? sumPhysicalActivityCalories(physicalActivities) : null),
    physicalActivities,
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

function getPersistedDevicesUiState(devicesState) {
  const savedDevicesState = devicesState && typeof devicesState === "object" ? devicesState : {};

  return {
    showPermissionsPanel: Boolean(savedDevicesState.showPermissionsPanel),
  };
}

function normalizeDevicesIntegrationsState(devicesState, options = {}) {
  const defaultIntegrationsState = getDefaultDevicesIntegrationsState();
  const savedDevicesState = devicesState && typeof devicesState === "object" ? devicesState : {};
  const sourceIntegrations = options.allowIntegrationState
    && savedDevicesState.integrations
    && typeof savedDevicesState.integrations === "object"
    ? savedDevicesState.integrations
    : {};
  const normalizedIntegrations = devicesCatalog.reduce((integrations, device) => {
    const savedIntegration = sourceIntegrations[device.id] && typeof sourceIntegrations[device.id] === "object"
      ? sourceIntegrations[device.id]
      : {};
    const defaultIntegration = defaultIntegrationsState[device.id];

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

  return normalizedIntegrations;
}

function normalizeDevicesState(devicesState, options = {}) {
  const defaultDevicesState = getDefaultDevicesState();
  const savedUiState = getPersistedDevicesUiState(devicesState);

  return {
    ...defaultDevicesState,
    ...savedUiState,
    showPermissionsPanel: false,
    integrations: normalizeDevicesIntegrationsState(devicesState, options),
  };
}

// Shared grocery/OpenFoodFacts normalization and comparison helpers.
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
  const normalizedEntryMode = normalizeUserEntryMode(item?.entryMode || item?.entry_mode || item?.inputMode);

  return {
    ...item,
    name: localizeSeedGroceryName(item.name),
    category: localizeGroceryCategory(item.category),
    expiryDate: String(item?.expiryDate || "").trim(),
    entryMode: normalizedEntryMode || inferUserEntryModeFromSource(item),
    entryMethod: resolveUserEntryMethod(item, "manual-pantry-form"),
  };
}

function sanitizeBarcode(value) {
  return String(value || "").replaceAll(/\D/g, "");
}

const ZXING_BROWSER_SCRIPT_SRC = "https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js";
const ZXING_BARCODE_FORMATS = ["EAN_13", "EAN_8", "UPC_A", "UPC_E"];

function stopZxingScanner(runtime) {
  if (runtime?.zxingControls?.stop) {
    runtime.zxingControls.stop();
  }

  if (runtime?.zxingReader?.reset) {
    runtime.zxingReader.reset();
  }

  if (runtime) {
    runtime.zxingControls = null;
    runtime.zxingReader = null;
  }
}

function loadZxingBrowserLibrary() {
  if (window.ZXingBrowser?.BrowserMultiFormatReader) {
    return Promise.resolve(window.ZXingBrowser);
  }

  if (window.NutriTrackZXingBrowserPromise) {
    return window.NutriTrackZXingBrowserPromise;
  }

  window.NutriTrackZXingBrowserPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ZXING_BROWSER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.ZXingBrowser?.BrowserMultiFormatReader) {
        resolve(window.ZXingBrowser);
      } else {
        reject(new Error("Decoder barcode non disponibile."));
      }
    };
    script.onerror = () => reject(new Error("Impossibile caricare il decoder barcode per Safari."));
    document.head.append(script);
  });

  return window.NutriTrackZXingBrowserPromise;
}

function configureZxingBarcodeFormats(reader, includeQrCode) {
  const barcodeFormat = window.ZXingBrowser?.BarcodeFormat;

  if (!barcodeFormat || !("possibleFormats" in reader)) {
    return;
  }

  const formatNames = includeQrCode ? [...ZXING_BARCODE_FORMATS, "QR_CODE"] : ZXING_BARCODE_FORMATS;
  const formats = formatNames
    .map((formatName) => barcodeFormat[formatName])
    .filter((format) => format !== undefined);

  if (formats.length > 0) {
    reader.possibleFormats = formats;
  }
}

async function startZxingVideoBarcodeDetection({ video, runtime, includeQrCode = false, onDetected }) {
  const zxingBrowser = await loadZxingBrowserLibrary();
  const reader = new zxingBrowser.BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 450,
    delayBetweenScanSuccess: 900,
  });

  configureZxingBarcodeFormats(reader, includeQrCode);
  runtime.zxingReader = reader;

  const controls = await reader.decodeFromVideoElement(video, (result) => {
    const rawValue = typeof result?.getText === "function" ? result.getText() : result?.text;
    const detectedBarcode = sanitizeBarcode(rawValue);

    if (detectedBarcode) {
      Promise.resolve(onDetected(detectedBarcode)).catch(() => {});
    }
  });

  runtime.zxingControls = controls;
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

// Structured OpenFoodFacts normalization and RAG record building.
function getComparableProductKey(product) {
  if (!product) {
    return "";
  }

  const barcode = sanitizeBarcode(product.barcode);
  return barcode ? `off:${barcode}` : "";
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
      acquisition: product.retrievalSource === "dataset" ? "dataset-backed-catalog" : "live-api",
      officialDatasetPage: source.officialDatasetPage,
      officialProjectPage: source.officialProjectPage,
      license: source.license,
      intendedPipeline: source.retrievalStrategy,
    },
    text: product.ragText,
  };
}

// Cached product lookup and grocery comparison state helpers.
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
  if (!productKey || !String(productKey).startsWith("off:")) {
    return null;
  }

  return getCachedOpenFoodFactsProduct(String(productKey).slice(4));
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

  if (!normalizedBarcode) {
    throw new Error("Barcode non valido.");
  }

  const cachedProduct = getCachedOpenFoodFactsProduct(normalizedBarcode);

  if (cachedProduct) {
    return cachedProduct;
  }

  const response = await fetch(
    window.NutriTrackBootstrap.buildNutriTrackApiPath(`/api/openfoodfacts/product/${normalizedBarcode}`)
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "OpenFoodFacts non raggiungibile.");
  }

  const payload = await response.json();

  const normalizedProduct = normalizeOpenFoodFactsProduct(payload.product, payload.source || "api");

  if (!normalizedProduct) {
    throw new Error("Risposta OpenFoodFacts incompleta.");
  }

  cacheOpenFoodFactsProduct(normalizedProduct);
  saveNutriTrackStateToLocalCache();
  return normalizedProduct;
}

// Shared lookup rendering and barcode scanner helpers used by nutrition and grocery.
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
  const showGroceryAction = container.matches("[data-off-grocery-result]");
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
      ${
        showGroceryAction
          ? `
            <button class="delete-btn lookup-result-dismiss" type="button" aria-label="Rimuovi prodotto scansionato" data-dismiss-grocery-lookup>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" /></svg>
            </button>
          `
          : ""
      }
      <strong>${escapeHtml(product.name)}</strong>
      <span>${escapeHtml(product.brand || "Brand non disponibile")} · ${escapeHtml(quantityLabel)}</span>
      <div class="lookup-chip-row">
        <span class="lookup-chip ${escapeHtml(getNutriscoreClassName(product.nutriscoreGrade))} nutriscore-chip">${escapeHtml(nutriscoreLabel)}</span>
        <span class="lookup-chip">${product.macroBasis === "serving" ? "Valori per porzione" : "Valori per 100 g/ml"}</span>
      </div>
      ${macroLine ? `<small>${escapeHtml(macroLine)}</small>` : `<small>Macronutrienti non completi nel dataset.</small>`}
      ${
        showGroceryAction
          ? `
            <div class="lookup-result-actions">
              <button class="primary-btn primary-btn-green pantry-barcode-add-btn" type="button" data-add-grocery-lookup-to-pantry>Aggiungi in dispensa</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

// Shared scanner modal state and feedback helpers.
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

// Shared scanner lifecycle helpers.
function closeBarcodeScannerModal() {
  const modal = getBarcodeScannerModal();
  const video = document.querySelector("[data-barcode-scanner-video]");

  if (barcodeScannerRuntime.detectionLoopId) {
    cancelAnimationFrame(barcodeScannerRuntime.detectionLoopId);
    barcodeScannerRuntime.detectionLoopId = null;
  }

  stopZxingScanner(barcodeScannerRuntime);

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

// Shared scanner result application for nutrition and grocery forms.
function applyProductToNutritionLookup(product) {
  const form = document.querySelector("[data-nutrition-form]");

  if (!form) {
    return;
  }

  openFoodFactsRuntime.nutritionLookup = product;
  openFoodFactsRuntime.nutritionDraft = createImportedNutritionDraft(product, "Importato da OpenFoodFacts");
  nutritionEntryRuntime.entryMode = "external_lookup";
  nutritionEntryRuntime.entryMethod = "barcode-openfoodfacts";
  form.elements.name.value = product.name;

  renderLookupResult("[data-off-nutrition-result]", product);
}

function applyProductToGroceryLookup(product, barcode) {
  openFoodFactsRuntime.groceryLookup = {
    ...product,
    barcode: product.barcode || barcode,
  };
  renderLookupResult("[data-off-grocery-result]", product);
}

// Shared live barcode lookup flow.
async function resolveScannedBarcode(barcode) {
  const target = barcodeScannerRuntime.target;

  if (!target || barcodeScannerRuntime.isResolving) {
    return;
  }

  barcodeScannerRuntime.isResolving = true;
  barcodeScannerRuntime.lastDetectedBarcode = barcode;
  setBarcodeScannerStatus("Prodotto rilevato. Recupero dati in corso...");

  try {
    const product = await fetchOpenFoodFactsProduct(barcode);

    if (target === "nutrition") {
      applyProductToNutritionLookup(product);
    } else if (target === "grocery") {
      applyProductToGroceryLookup(product, barcode);
    }

    setBarcodeScannerStatus(`Prodotto ${product.name} trovato. Compilazione completata.`);
    closeBarcodeScannerModal();
  } catch (error) {
    setBarcodeScannerStatus(error.message);

    if (target === "nutrition") {
      renderLookupResult("[data-off-nutrition-result]", null, error.message);
    } else if (target === "grocery") {
      renderLookupResult("[data-off-grocery-result]", null, error.message);
    }
  } finally {
    barcodeScannerRuntime.isResolving = false;
  }
}

// Shared live barcode scanning loop and bootstrap.
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

  barcodeScannerRuntime.isStarting = true;
  barcodeScannerRuntime.lastDetectedBarcode = "";
  openBarcodeScannerModal(target);

  if (!navigator.mediaDevices?.getUserMedia) {
    setBarcodeScannerStatus("La scansione live richiede una pagina servita da HTTPS o localhost.");
    barcodeScannerRuntime.isStarting = false;
    return;
  }

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
    video.srcObject = stream;
    await video.play();

    if ("BarcodeDetector" in window) {
      barcodeScannerRuntime.detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      setBarcodeScannerStatus("Centra il bar-code nel riquadro.");
      scheduleBarcodeScannerDetection();
    } else {
      barcodeScannerRuntime.detector = null;
      setBarcodeScannerStatus("Camera attiva. Carico decoder compatibile con Safari...");
      await startZxingVideoBarcodeDetection({
        video,
        runtime: barcodeScannerRuntime,
        onDetected: async (detectedBarcode) => {
          if (detectedBarcode !== barcodeScannerRuntime.lastDetectedBarcode) {
            await resolveScannedBarcode(detectedBarcode);
          }
        },
      });
      setBarcodeScannerStatus("Centra il bar-code nel riquadro.");
    }
  } catch (error) {
    stopZxingScanner(barcodeScannerRuntime);

    if (barcodeScannerRuntime.stream) {
      barcodeScannerRuntime.stream.getTracks().forEach((track) => track.stop());
      barcodeScannerRuntime.stream = null;
    }

    video.pause();
    video.srcObject = null;
    setBarcodeScannerStatus("Accesso alla camera non disponibile. Verifica permessi, HTTPS o localhost.");
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

// Shared biometric helper used by progress, profile, and devices.
function calculateBmi(heightCm, weightKg) {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;

  return weightKg / (heightMeters * heightMeters);
}

const nutritionEditorRuntime = {
  mealId: "",
  itemBaselines: [],
};

// Nutrition core rendering and setup remain here because they coordinate shared state.
function renderNutritionSummary() {
  const selectedDateKey = getSelectedNutritionDateKey();
  const totals = getNutritionTotalsForDate(selectedDateKey);
  const { goals } = appState.nutrition;

  Object.entries(totals).forEach(([key, value]) => {
    document.querySelectorAll(`[data-nutrition-total="${key}"]`).forEach((element) => {
      element.textContent = String(value);
    });
  });

  Object.entries(goals).forEach(([key, value]) => {
    document.querySelectorAll(`[data-nutrition-goal="${key}"]`).forEach((element) => {
      element.textContent = value == null || value === "" ? "-" : String(value);
    });

    const progressElement = document.querySelector(`[data-nutrition-progress="${key}"]`);
    const numericGoal = typeof value === "number" ? value : Number(value);
    const progress = Number.isFinite(numericGoal) && numericGoal > 0 ? Math.min((totals[key] / numericGoal) * 100, 100) : 0;

    if (progressElement) {
      progressElement.style.width = `${progress}%`;
    }
  });

  const numericCalorieGoal = normalizeNumber(goals.calories);
  const burnedCalories = getBurnedCaloriesForDate(selectedDateKey);
  const includedBurnedCalories = shouldIncludeBurnedCaloriesInGoal() ? burnedCalories : 0;
  const adjustedCalorieGoal = numericCalorieGoal == null ? null : numericCalorieGoal + includedBurnedCalories;
  const remainingCalories = adjustedCalorieGoal == null ? null : Math.max(0, roundMacroValue(adjustedCalorieGoal - totals.calories));
  const calorieProgress = numericCalorieGoal && numericCalorieGoal > 0
    ? Math.min((totals.calories / (adjustedCalorieGoal || numericCalorieGoal)) * 100, 100)
    : 0;

  document.querySelectorAll("[data-nutrition-remaining-calories]").forEach((element) => {
    element.textContent = remainingCalories == null ? "-" : String(remainingCalories);
  });

  document.querySelectorAll("[data-nutrition-calorie-ring]").forEach((element) => {
    element.style.setProperty("--nutrition-calorie-progress", `${calorieProgress}%`);
  });

  document.querySelectorAll("[data-nutrition-burned-calories]").forEach((element) => {
    element.textContent = String(burnedCalories);
  });

  document.querySelectorAll("[data-nutrition-selected-date-label]").forEach((element) => {
    element.textContent = formatNutritionDateLabel(selectedDateKey);
  });

  document.querySelectorAll("[data-nutrition-selected-date-subtitle]").forEach((element) => {
    element.textContent = formatNutritionDateSubtitle(selectedDateKey);
  });

  document.querySelectorAll("[data-nutrition-date-input]").forEach((element) => {
    element.value = selectedDateKey;
  });

  document.querySelectorAll("[data-nutrition-day-count]").forEach((element) => {
    element.textContent = totals.count === 1 ? "1 pasto registrato" : `${totals.count} pasti registrati`;
  });

  document.querySelectorAll("[data-meals-section-title]").forEach((element) => {
    element.textContent = formatMealsSectionTitle(selectedDateKey);
  });

  renderNutritionWaterControl();
  renderPhysicalActivityControl();
}

function renderNutritionWaterControl() {
  const selectedDateKey = getSelectedNutritionDateKey();
  const waterGlassesContainer = document.querySelector("[data-nutrition-water-glasses]");
  const waterSummary = document.querySelector("[data-nutrition-water-summary]");
  const waterVolumeSummary = document.querySelector("[data-nutrition-water-volume-summary]");
  const waterStatus = document.querySelector("[data-nutrition-water-status]");
  const waterGoalMenu = document.querySelector("[data-water-goal-menu]");
  const log = getProgressLogByDate(selectedDateKey);
  const waterGoal = getWaterGoal();
  const waterGlasses = Math.min(waterGoal, Math.max(0, Math.round(normalizeNumber(log?.waterGlasses) || 0)));

  if (waterSummary) {
    waterSummary.textContent = `${waterGlasses}/${waterGoal}`;
  }

  if (waterVolumeSummary) {
    waterVolumeSummary.textContent = formatWaterDrunkSummary(waterGlasses);
  }

  if (waterGlassesContainer) {
    waterGlassesContainer.innerHTML = Array.from({ length: waterGoal }, (_, index) => {
      const glassValue = index + 1;
      const isFilled = glassValue <= waterGlasses;

      return `
        <button
          class="meal-water-glass${isFilled ? " is-filled" : ""}"
          type="button"
          data-water-glass-value="${glassValue}"
          aria-label="Imposta acqua a ${formatWaterGlassCount(glassValue)}, ${formatWaterVolume(glassValue * WATER_GLASS_ML)}"
          aria-pressed="${isFilled}"
        >
          <span class="meal-water-fill"></span>
        </button>
      `;
    }).join("");
  }

  renderWaterGoalMenu(waterGoalMenu, waterGoal);

  if (waterStatus) {
    waterStatus.textContent = formatWaterGoalSummary(waterGoal);
    waterStatus.dataset.dateKey = selectedDateKey;
  }
}

function formatWaterGlassCount(value) {
  const glasses = Math.max(0, Math.round(normalizeNumber(value) || 0));
  return glasses === 1 ? "1 bicchiere" : `${glasses} bicchieri`;
}

function formatWaterVolume(valueMl) {
  const milliliters = Math.max(0, Math.round(normalizeNumber(valueMl) || 0));

  if (milliliters < 1000) {
    return `${milliliters} ml`;
  }

  const liters = (milliliters / 1000).toFixed(1).replace(".", ",");
  return `${liters} l`;
}

function formatWaterDrunkSummary(waterGlasses) {
  return `Totale bevuti: ${formatWaterGlassCount(waterGlasses)} = ${formatWaterVolume(waterGlasses * WATER_GLASS_ML)}`;
}

function formatWaterGoalSummary(waterGoal) {
  return `Totale acqua: ${formatWaterGlassCount(waterGoal)} = ${formatWaterVolume(waterGoal * WATER_GLASS_ML)}`;
}

function getWaterGoal() {
  const normalizedGoal = normalizeNumber(appState.profile?.goals?.water);

  if (normalizedGoal == null) {
    return 8;
  }

  return Math.min(WATER_GOAL_MAX, Math.max(WATER_GOAL_MIN, Math.round(normalizedGoal)));
}

function renderWaterGoalMenu(menu, selectedGoal = getWaterGoal()) {
  if (!menu) {
    return;
  }

  menu.innerHTML = Array.from({ length: WATER_GOAL_MAX - WATER_GOAL_MIN + 1 }, (_, index) => {
    const value = WATER_GOAL_MIN + index;

    return `
      <button
        class="meal-water-goal-option${value === selectedGoal ? " is-selected" : ""}"
        type="button"
        data-water-goal-value="${value}"
        aria-label="Obiettivo ${value} bicchieri"
        aria-pressed="${value === selectedGoal}"
      >${value}</button>
    `;
  }).join("");
}

function setWaterGoalMenuOpen(isOpen) {
  const toggle = document.querySelector("[data-water-goal-menu-toggle]");
  const menu = document.querySelector("[data-water-goal-menu]");

  if (!toggle || !menu) {
    return;
  }

  toggle.setAttribute("aria-expanded", String(isOpen));
  menu.hidden = !isOpen;
}

function persistWaterGoal(goalValue) {
  const waterGoal = Math.min(WATER_GOAL_MAX, Math.max(WATER_GOAL_MIN, Math.round(normalizeNumber(goalValue) ?? 8)));
  const profileWaterGoalInput = document.querySelector('[name="goalWater"]');

  appState.profile = appState.profile && typeof appState.profile === "object" ? appState.profile : {};
  appState.profile.goals = appState.profile.goals && typeof appState.profile.goals === "object" ? appState.profile.goals : {};
  appState.profile.goals.water = waterGoal;

  if (profileWaterGoalInput) {
    profileWaterGoalInput.value = waterGoal;
  }

  saveProfilePatchToServer({
    goals: {
      water: waterGoal,
    },
  })
    .then(() => {
      renderNutrition();
      setNutritionWaterStatus(formatWaterGoalSummary(waterGoal));
    })
    .catch((error) => {
      console.error("Impossibile salvare l'obiettivo acqua.", error);
      setNutritionWaterStatus(error.message || "Salvataggio non sincronizzato.");
    });
}

function setNutritionWaterStatus(message) {
  const waterStatus = document.querySelector("[data-nutrition-water-status]");

  if (waterStatus) {
    waterStatus.textContent = message || "";
    waterStatus.dataset.dateKey = getSelectedNutritionDateKey();
  }
}

async function persistNutritionWaterForDate(dateKey, rawValue) {
  if (!isValidDateKey(dateKey)) {
    return;
  }

  const normalizedWater = normalizeNumber(rawValue);
  const waterGlasses = normalizedWater == null ? null : Math.max(0, Math.round(normalizedWater));

  setProgressLogValuesForDate(dateKey, { waterGlasses });
  try {
    await saveProgressStateToServer({ autoSnapshots: false, selectedRange: false });
    renderProgress();
    renderNutritionWaterControl();
  } catch (error) {
    console.error("Impossibile salvare l'acqua.", error);
    setNutritionWaterStatus(error.message || "Salvataggio non sincronizzato.");
  }

  if (dateKey === getSelectedNutritionDateKey()) {
    setNutritionWaterStatus(formatWaterGoalSummary(getWaterGoal()));
  }
}

function renderPhysicalActivityDatalist() {
  const datalist = document.querySelector("[data-physical-activity-suggestions]");

  if (!datalist) {
    return;
  }

  const availableLabels = new Set(physicalActivityCatalog.map(getPhysicalActivityDisplayLabel));
  const commonOptions = PHYSICAL_ACTIVITY_COMMON_LABELS.filter((label) => availableLabels.has(label));
  const options = commonOptions.length > 0 ? commonOptions : [...availableLabels];
  datalist.innerHTML = options
    .map((label) => `<option value="${escapeHtml(label)}"></option>`)
    .join("");
}

function getPhysicalActivityEstimateContext(form) {
  const activityName = String(form?.elements.activityName?.value || "").trim();
  const durationMinutes = normalizeNumber(form?.elements.durationMinutes?.value);
  const match = findPhysicalActivityCatalogMatch(activityName);
  const weightKg = getActivityEstimationWeight(getSelectedNutritionDateKey());
  const estimatedCalories = estimatePhysicalActivityCalories(match, durationMinutes, weightKg);

  return {
    activityName,
    durationMinutes,
    match,
    weightKg,
    estimatedCalories,
  };
}

function renderPhysicalActivitySuggestionButton(activity) {
  return `
    <button class="activity-suggestion-chip" type="button" data-physical-activity-suggestion="${escapeHtml(activity.id)}">
      ${escapeHtml(getPhysicalActivityDisplayLabel(activity))}
    </button>
  `;
}

function renderPhysicalActivityEstimate(form = document.querySelector("[data-physical-activity-form]")) {
  const estimateBox = document.querySelector("[data-physical-activity-estimate]");

  if (!form || !estimateBox) {
    return;
  }

  const { activityName, durationMinutes, match, weightKg, estimatedCalories } = getPhysicalActivityEstimateContext(form);
  const matches = getPhysicalActivityMatches(activityName);

  if (physicalActivityCatalogRuntime.isLoading && physicalActivityCatalog.length === 0) {
    estimateBox.innerHTML = `
      <div class="physical-activity-estimate-empty">
        <strong>Carico il catalogo attività</strong>
        <span>Le stime automatiche saranno disponibili tra poco.</span>
      </div>
    `;
    return;
  }

  if (physicalActivityCatalogRuntime.errorMessage && physicalActivityCatalog.length === 0) {
    estimateBox.innerHTML = `
      <div class="physical-activity-estimate-empty">
        <strong>Catalogo attività non disponibile</strong>
        <span>${escapeHtml(physicalActivityCatalogRuntime.errorMessage)}</span>
      </div>
    `;
    return;
  }

  if (!activityName && !durationMinutes) {
    estimateBox.innerHTML = `
      <div class="physical-activity-estimate-empty">
        <strong>Stima kcal da attività fisica</strong>
        <span>Scrivi un'attività e la durata, oppure inserisci direttamente le kcal spese.</span>
      </div>
    `;
    return;
  }

  if (!match) {
    estimateBox.innerHTML = `
      <div class="physical-activity-estimate-empty">
        <strong>Attività non trovata nel catalogo</strong>
        <span>Puoi salvarla inserendo manualmente le kcal spese.</span>
      </div>
      ${matches.length > 0 ? `<div class="activity-suggestion-row">${matches.map(renderPhysicalActivitySuggestionButton).join("")}</div>` : ""}
    `;
    return;
  }

  estimateBox.innerHTML = `
    <div class="physical-activity-estimate-main">
      <span class="activity-source-chip">Stima automatica</span>
      <strong>${estimatedCalories == null ? "--" : estimatedCalories} kcal</strong>
      <span>${escapeHtml(getPhysicalActivityDisplayLabel(match))} · attività ${escapeHtml(match.intensity)}${weightKg ? ` · ${escapeHtml(weightKg)} kg` : ""}</span>
    </div>
    ${
      estimatedCalories == null
        ? `<p>Inserisci durata e peso corporeo per ottenere una stima automatica.</p>`
        : `<p>Stima basata su intensità media, durata e peso corporeo.</p>`
    }
    <div class="activity-suggestion-row">${matches.map(renderPhysicalActivitySuggestionButton).join("")}</div>
  `;
}

function renderPhysicalActivityControl() {
  const list = document.querySelector("[data-physical-activity-list]");
  const dateLabel = document.querySelector("[data-physical-activity-date-label]");
  const selectedDateKey = getSelectedNutritionDateKey();
  const activities = getPhysicalActivitiesForDate(selectedDateKey);
  const burnedCalories = getBurnedCaloriesForDate(selectedDateKey);

  if (dateLabel) {
    dateLabel.textContent = `${formatNutritionDateLabel(selectedDateKey)} · ${burnedCalories} kcal spese`;
  }

  document.querySelectorAll("[data-physical-activity-goal-toggle]").forEach((button) => {
    const isIncluded = shouldIncludeBurnedCaloriesInGoal();
    button.setAttribute("aria-pressed", String(isIncluded));
    button.dataset.toggleState = isIncluded ? "on" : "off";
    button.textContent = isIncluded ? "On" : "Off";
  });

  document.querySelectorAll("[data-physical-activity-goal-note]").forEach((element) => {
    element.textContent = shouldIncludeBurnedCaloriesInGoal()
      ? "Le kcal spese aumentano le kcal rimaste."
      : "Le kcal spese non modificano le kcal rimaste.";
  });

  renderPhysicalActivityEstimate();

  if (!list) {
    return;
  }

  if (activities.length === 0) {
    list.innerHTML = `
      <div class="physical-activity-empty">
        <strong>Nessuna attività registrata</strong>
        <span>Le kcal spese appariranno nel riepilogo della Dieta.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = activities
    .slice()
    .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)))
    .map(
      (activity) => `
        <article class="physical-activity-item">
          <div>
            <h4>${escapeHtml(activity.name)}</h4>
            <span>${activity.durationMinutes ? `${escapeHtml(activity.durationMinutes)} min · ` : ""}${escapeHtml(activity.source === "met_estimate" ? "stima automatica" : "inserimento manuale")}</span>
          </div>
          <strong>${escapeHtml(activity.calories)} kcal</strong>
          <button class="delete-btn" type="button" aria-label="Rimuovi attività" data-delete-physical-activity-id="${escapeHtml(activity.id)}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
            </svg>
          </button>
        </article>
      `
    )
    .join("");
}

function setPhysicalActivityStatus(message, type = "") {
  const status = document.querySelector("[data-physical-activity-status]");

  if (!status) {
    return;
  }

  status.textContent = message || "";
  status.dataset.statusType = type;
}

function buildPhysicalActivityFromForm(form, dateKey) {
  const { activityName, durationMinutes, match, weightKg, estimatedCalories } = getPhysicalActivityEstimateContext(form);
  const manualCalories = normalizeNumber(form.elements.calories.value);
  const calories = manualCalories ?? estimatedCalories;

  if (!activityName) {
    throw new Error("Inserisci il tipo di attività.");
  }

  if (calories == null || calories <= 0) {
    throw new Error("Inserisci le kcal spese oppure durata e peso per stimarle.");
  }

  return {
    id: crypto.randomUUID(),
    name: match ? getPhysicalActivityDisplayLabel(match) : activityName,
    durationMinutes: durationMinutes == null ? null : Math.max(0, Math.round(durationMinutes)),
    calories: Math.max(0, Math.round(calories)),
    met: match?.met ?? null,
    compendiumCode: match?.compendiumCode || "",
    category: match?.category || "",
    intensity: match?.intensity || "",
    source: manualCalories == null ? "met_estimate" : "manual",
    datasetSource: match?.datasetSourcePage || "",
    datasetKey: match?.datasetKey || "",
    datasetLabel: match?.datasetLabel || "",
    sourceDocument: match?.sourceDocument || "",
    sourcePage: match?.sourcePage || "",
    metBasis: match?.metBasis || "",
    restingVo2MlKgMin: match?.restingVo2MlKgMin ?? null,
    createdAt: new Date().toISOString(),
    date: dateKey,
    estimationWeightKg: weightKg,
  };
}

async function persistPhysicalActivitiesForDate(dateKey, activities) {
  const normalizedActivities = (Array.isArray(activities) ? activities : [])
    .map(normalizePhysicalActivityEntry)
    .filter(Boolean);

  setProgressLogValuesForDate(dateKey, {
    physicalActivities: normalizedActivities,
    burnedCalories: normalizedActivities.length > 0 ? sumPhysicalActivityCalories(normalizedActivities) : null,
  });
  try {
    await saveProgressStateToServer({ autoSnapshots: false, selectedRange: false });
    renderNutrition();
  } catch (error) {
    console.error("Impossibile salvare l'attivita fisica.", error);
    setPhysicalActivityStatus(error.message || "Salvataggio non sincronizzato.", "error");
  }
}

function addPhysicalActivityForDate(dateKey, activity) {
  return persistPhysicalActivitiesForDate(dateKey, [...getPhysicalActivitiesForDate(dateKey), activity]);
}

function removePhysicalActivityForDate(dateKey, activityId) {
  return persistPhysicalActivitiesForDate(
    dateKey,
    getPhysicalActivitiesForDate(dateKey).filter((activity) => activity.id !== activityId)
  );
}

// Sync profile goals into the nutrition dashboard summary.
function syncNutritionGoalsFromProfile() {
  const { calories, protein, carbs, fats } = appState.profile.goals;

  appState.nutrition = appState.nutrition && typeof appState.nutrition === "object" ? appState.nutrition : {};
  appState.nutrition.goals = {
    calories,
    protein,
    carbs,
    fats,
  };
}

// Render the list of meals currently tracked for the selected day.
function renderMeals() {
  const list = document.querySelector("[data-meals-list]");
  const selectedDateKey = getSelectedNutritionDateKey();
  const selectedMeals = appState.nutrition.meals.filter((meal) => getMealDateKey(meal) === selectedDateKey);

  if (!list) {
    return;
  }

  placeNutritionEditPanelNearMeal(null);

  if (selectedMeals.length === 0) {
    list.innerHTML = `
      <article class="panel empty-state">
        <h3>Nessun pasto inserito</h3>
        <p>Aggiungi il primo pasto per questa giornata.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = selectedMeals
    .slice()
    .sort((firstMeal, secondMeal) => firstMeal.time.localeCompare(secondMeal.time))
    .map(
      (meal) => `
        <article class="meal-card" data-meal-card-id="${escapeHtml(meal.id)}">
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
            ${renderMealItemsBreakdown(meal)}
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
  ensurePhysicalActivityCatalogForCurrentProfile();
  renderNutritionSummary();
  renderMeals();
  renderNutritionEditForm();
  renderProgress();
}

function renderMealItemsBreakdown(meal) {
  const items = Array.isArray(meal?.items) ? meal.items : [];

  if (items.length === 0 && !meal?.sourceNote) {
    return "";
  }

  if (items.length === 0) {
    return `<p class="meal-source-note">${escapeHtml(meal.sourceNote)}</p>`;
  }

  const itemMarkup = items
    .slice(0, 6)
    .map((item) => `<li>${escapeHtml(item.name)}${item.quantity ? ` <span>${escapeHtml(item.quantity)}</span>` : ""} <strong>${escapeHtml(item.calories)} kcal</strong></li>`)
    .join("");

  return `<ul class="meal-items-breakdown">${itemMarkup}</ul>`;
}

// Inline nutrition editor state and rendering helpers.
function normalizeEditableMealItem(item) {
  return {
    rawText: String(item?.rawText || item?.name || "").trim(),
    name: String(item?.name || item?.rawText || "Alimento").trim(),
    quantity: String(item?.quantity || "").trim(),
    calories: roundMacroValue(normalizeNumber(item?.calories) || 0),
    protein: roundMacroValue(normalizeNumber(item?.protein) || 0),
    carbs: roundMacroValue(normalizeNumber(item?.carbs) || 0),
    fats: roundMacroValue(normalizeNumber(item?.fats) || 0),
    confidence: Math.max(0, Math.min(1, normalizeNumber(item?.confidence) ?? 0.45)),
    source: String(item?.source || "ai-estimate").trim(),
    nutritionReference: item?.nutritionReference && typeof item.nutritionReference === "object" ? item.nutritionReference : null,
  };
}

function parseEditableQuantityLabel(value) {
  const metricQuantity = parseMetricQuantityLabel(value);

  if (metricQuantity) {
    return metricQuantity;
  }

  const match = String(value || "").match(/(\d+(?:[.,]\d+)?)/);
  const amount = normalizeNumber(match?.[1]);

  if (amount === null || amount <= 0) {
    return null;
  }

  return {
    value: amount,
    unit: "count",
  };
}

function getMealItemQuantityFactor(baseQuantity, nextQuantity) {
  const base = parseEditableQuantityLabel(baseQuantity);
  const next = parseEditableQuantityLabel(nextQuantity);

  if (!base || !next || base.unit !== next.unit || base.value <= 0 || next.value <= 0) {
    return null;
  }

  return next.value / base.value;
}

function createMealItemEditBaseline(item) {
  const normalizedItem = normalizeEditableMealItem(item);

  return {
    ...normalizedItem,
    baseQuantity: normalizedItem.quantity,
    baseNutrition: createNutritionSnapshot(normalizedItem),
  };
}

function scaleNutritionReferenceForQuantity(reference, quantityLabel) {
  const quantity = parseEditableQuantityLabel(quantityLabel);
  const nutrients = reference?.nutrientsPer100g;

  if (!quantity || !["g", "ml"].includes(quantity.unit) || !nutrients) {
    return null;
  }

  return createNutritionSnapshot({
    calories: (normalizeNumber(nutrients.calories) || 0) * (quantity.value / 100),
    protein: (normalizeNumber(nutrients.protein) || 0) * (quantity.value / 100),
    carbs: (normalizeNumber(nutrients.carbs) || 0) * (quantity.value / 100),
    fats: (normalizeNumber(nutrients.fats) || 0) * (quantity.value / 100),
  });
}

function recalculateMealItemFromInputs(baseline, values = {}, options = {}) {
  const quantity = String(values.quantity ?? baseline.quantity ?? "").trim();
  const quantityFactor = getMealItemQuantityFactor(baseline.baseQuantity, quantity);
  const referencedNutrition = scaleNutritionReferenceForQuantity(baseline.nutritionReference, quantity);
  const nutrition = referencedNutrition || (quantityFactor === null
    ? createNutritionSnapshot(baseline.baseNutrition)
    : scaleNutritionValues(baseline.baseNutrition, quantityFactor));
  const manualCalories = normalizeNumber(values.calories);

  if (options.useManualCalories !== false && manualCalories !== null) {
    nutrition.calories = roundMacroValue(manualCalories);
  }

  return {
    rawText: baseline.rawText,
    name: baseline.name,
    quantity: quantity || baseline.quantity || "1 porzione",
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fats: nutrition.fats,
    confidence: baseline.confidence,
    source: baseline.source,
    nutritionReference: baseline.nutritionReference || null,
  };
}

function calculateMealTotalsFromItems(items = []) {
  return items.reduce(
    (result, item) => {
      result.calories += roundMacroValue(normalizeNumber(item?.calories) || 0);
      result.protein += roundMacroValue(normalizeNumber(item?.protein) || 0);
      result.carbs += roundMacroValue(normalizeNumber(item?.carbs) || 0);
      result.fats += roundMacroValue(normalizeNumber(item?.fats) || 0);
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

function normalizeMealTitleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function replaceMealTitleQuantity(title, previousQuantity, nextQuantity) {
  const normalizedTitle = normalizeMealTitleText(title);
  const normalizedPreviousQuantity = normalizeMealTitleText(previousQuantity);
  const normalizedNextQuantity = normalizeMealTitleText(nextQuantity);

  if (!normalizedTitle || !normalizedPreviousQuantity || !normalizedNextQuantity || normalizedPreviousQuantity === normalizedNextQuantity) {
    return normalizedTitle;
  }

  const escapedQuantity = normalizedPreviousQuantity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const quantityPattern = new RegExp(escapedQuantity, "i");

  return normalizedTitle.replace(quantityPattern, normalizedNextQuantity);
}

function formatMealItemTitleFragment(item) {
  const quantity = normalizeMealTitleText(item?.quantity);
  const name = normalizeMealTitleText(item?.name).toLowerCase();

  return normalizeMealTitleText(`${quantity} ${name}`) || name || quantity;
}

function buildMealNameFromEditedItems(meal, items = [], baselines = []) {
  const originalName = normalizeMealTitleText(meal?.name);
  const updatedName = items.reduce((title, item, index) => {
    const baseline = baselines[index];

    return replaceMealTitleQuantity(title, baseline?.baseQuantity || baseline?.quantity, item.quantity);
  }, originalName);

  if (updatedName && updatedName !== originalName) {
    return updatedName;
  }

  const generatedName = items.map(formatMealItemTitleFragment).filter(Boolean).join(" e ");
  return generatedName || originalName;
}

function placeNutritionEditPanelNearMeal(meal) {
  const panel = document.querySelector("[data-nutrition-edit-panel]");
  const mealCard = meal?.id ? document.querySelector(`[data-meal-card-id="${CSS.escape(meal.id)}"]`) : null;
  const nutritionLayout = document.querySelector(".nutrition-layout");

  if (!panel) {
    return;
  }

  if (mealCard) {
    mealCard.insertAdjacentElement("afterend", panel);
    return;
  }

  nutritionLayout?.append(panel);
}

function renderNutritionEditItems(meal) {
  const container = document.querySelector("[data-nutrition-edit-items]");
  const items = Array.isArray(meal?.items) ? meal.items.map(normalizeEditableMealItem).filter((item) => item.name) : [];

  if (!container) {
    return;
  }

  nutritionEditorRuntime.itemBaselines = items.map(createMealItemEditBaseline);

  if (nutritionEditorRuntime.itemBaselines.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="meal-item-editor-head">
      <span>Alimenti riconosciuti</span>
      <small>Le modifiche aggiornano il totale del pasto.</small>
    </div>
    <div class="meal-item-editor-list">
      ${nutritionEditorRuntime.itemBaselines
        .map(
          (item, index) => `
            <article class="meal-item-editor-row" data-meal-item-row="${index}">
              <strong>${escapeHtml(item.name)}</strong>
              <label>
                <span>Quantità</span>
                <input type="text" value="${escapeHtml(item.quantity || "1 porzione")}" data-meal-item-quantity />
              </label>
              <label>
                <span>Kcal</span>
                <input type="number" min="0" step="1" value="${escapeHtml(item.calories)}" data-meal-item-calories />
              </label>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function readNutritionEditItemsFromForm(form, options = {}) {
  const baselines = nutritionEditorRuntime.itemBaselines;

  if (!form || baselines.length === 0) {
    return [];
  }

  return baselines.map((baseline, index) => {
    const row = form.querySelector(`[data-meal-item-row="${index}"]`);
    const quantityInput = row?.querySelector("[data-meal-item-quantity]");
    const isEditedQuantity = options.changedElement && options.changedElement === quantityInput;

    return recalculateMealItemFromInputs(baseline, {
      quantity: quantityInput?.value,
      calories: row?.querySelector("[data-meal-item-calories]")?.value,
    }, {
      useManualCalories: !isEditedQuantity,
    });
  });
}

function syncNutritionEditTotalsFromItems(form, changedElement = null) {
  const items = readNutritionEditItemsFromForm(form, { changedElement });

  if (items.length === 0) {
    return null;
  }

  const totals = calculateMealTotalsFromItems(items);

  form.elements.calories.value = totals.calories;
  form.elements.protein.value = totals.protein;
  form.elements.carbs.value = totals.carbs;
  form.elements.fats.value = totals.fats;

  items.forEach((item, index) => {
    const row = form.querySelector(`[data-meal-item-row="${index}"]`);
    const caloriesInput = row?.querySelector("[data-meal-item-calories]");

    if (caloriesInput && document.activeElement !== caloriesInput) {
      caloriesInput.value = item.calories;
    }
  });

  return { items, totals };
}

function getActiveNutritionEditMeal() {
  return appState.nutrition.meals.find((meal) => meal.id === nutritionEditorRuntime.mealId) || null;
}

function closeNutritionEditForm() {
  nutritionEditorRuntime.mealId = "";
  nutritionEditorRuntime.itemBaselines = [];
  renderNutritionEditForm();
}

function openNutritionEditForm(meal) {
  if (!meal) {
    return;
  }

  nutritionEditorRuntime.mealId = meal.id;
  renderNutritionEditForm();
}

function renderNutritionEditForm() {
  const panel = document.querySelector("[data-nutrition-edit-panel]");
  const form = document.querySelector("[data-nutrition-edit-form]");
  const title = document.querySelector("[data-nutrition-edit-title]");
  const meal = getActiveNutritionEditMeal();

  if (!panel || !form || !title) {
    return;
  }

  if (!meal) {
    panel.hidden = true;
    form.reset();
    resetFormValidationState(form);
    nutritionEditorRuntime.itemBaselines = [];
    renderNutritionEditItems(null);
    placeNutritionEditPanelNearMeal(null);
    return;
  }

  placeNutritionEditPanelNearMeal(meal);
  panel.hidden = false;
  title.textContent = `Correggi ${meal.name}`;
  form.elements.calories.value = meal.calories;
  form.elements.protein.value = meal.protein;
  form.elements.carbs.value = meal.carbs;
  form.elements.fats.value = meal.fats;
  renderNutritionEditItems(meal);
}

// Shared nutrition meal creation and mutation helpers used by the section wiring.
async function createNutritionMealFromForm(form, dateKey = getSelectedNutritionDateKey()) {
  const formData = new FormData(form);
  const linkedProduct = openFoodFactsRuntime.nutritionLookup;
  const description = String(formData.get("name") || "").trim();
  const resolvedDateKey = isValidDateKey(dateKey) ? dateKey : getTodayDateKey();
  const pendingEntryMode = normalizeUserEntryMode(nutritionEntryRuntime.entryMode);
  const pendingEntryMethod = String(nutritionEntryRuntime.entryMethod || "").trim();

  if (shouldAnalyzeMealDescription(description, linkedProduct)) {
    const analysis = await requestMealNutritionAnalysis(description).catch((error) => {
      console.warn("Analisi pasto AI non disponibile, uso fallback locale.", error);
      return createFallbackMealAnalysis(description);
    });

    return {
      id: crypto.randomUUID(),
      name: description,
      date: resolvedDateKey,
      time: String(formData.get("time") || "").trim(),
      calories: analysis.totals.calories,
      protein: analysis.totals.protein,
      carbs: analysis.totals.carbs,
      fats: analysis.totals.fats,
      barcode: "",
      source: "meal-description",
      brand: "",
      nutriscoreGrade: "",
      nutritionSource: analysis.source,
      nutritionSourceLabel: analysis.source === "local-fallback" ? "Stima locale" : "Analisi AI",
      sourceNote: buildMealAnalysisSourceNote(analysis),
      items: analysis.items,
      entryMode: pendingEntryMode || "ai_assisted",
      entryMethod: pendingEntryMethod || "ai-meal-description-analysis",
    };
  }

  const nutritionDraft = getNutritionDraftForMeal(formData.get("name"));
  const sourceNote =
    linkedProduct && nutritionDraft.consumedAmount
      ? `Base nutrizionale OpenFoodFacts: ${formatQuantityValue(nutritionDraft.referenceAmount || nutritionDraft.consumedAmount)} g/ml`
      : "";

  return {
    id: crypto.randomUUID(),
    name: description,
    date: resolvedDateKey,
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
    sourceNote,
    entryMode: pendingEntryMode || (linkedProduct ? "external_lookup" : "manual"),
    entryMethod: pendingEntryMethod || (linkedProduct ? "barcode-openfoodfacts" : "manual-meal-form"),
  };
}

function isNutritionMealValid(meal) {
  const hasInvalidNumber = ["calories", "protein", "carbs", "fats"].some((key) => {
    const value = meal[key];
    return Number.isNaN(value) || value < 0;
  });

  return Boolean(meal.name && meal.time && !hasInvalidNumber);
}

async function saveNutritionMealToServer(meal, method = "POST") {
  const apiPath = method === "POST"
    ? "/api/nutrition/meals"
    : `/api/nutrition/meals/${encodeURIComponent(meal.id)}`;
  const payload = await commitNutriTrackStateMutation(apiPath, {
    method,
    body: {
      meal,
    },
  });

  const savedMeal = payload?.meal || meal;
  captureProgressSnapshotForDate(getMealDateKey(savedMeal));
  await saveProgressStateToServer({ selectedRange: false });
  renderNutrition();
  return savedMeal;
}

async function deleteNutritionMealFromServer(mealId) {
  const payload = await commitNutriTrackStateMutation(`/api/nutrition/meals/${encodeURIComponent(mealId)}`, {
    method: "DELETE",
  });
  const deletedMeal = payload?.meal || null;

  captureProgressSnapshotForDate(deletedMeal ? getMealDateKey(deletedMeal) : getSelectedNutritionDateKey());
  await saveProgressStateToServer({ selectedRange: false });
  renderNutrition();
}

async function applyManualNutritionCorrection(meal, updatedValues) {
  const updatedMeal = {
    ...meal,
    ...updatedValues,
    nutritionSource: "manual-correction",
    nutritionSourceLabel: "Corretto manualmente",
  };

  await saveNutritionMealToServer(updatedMeal, "PUT");
}

async function removeNutritionMeal(mealId) {
  const mealToDelete = appState.nutrition.meals.find((meal) => meal.id === mealId);
  const mealDateKey = mealToDelete ? getMealDateKey(mealToDelete) : getTodayDateKey();

  if (nutritionEditorRuntime.mealId === mealId) {
    nutritionEditorRuntime.mealId = "";
  }

  await deleteNutritionMealFromServer(mealId);
  captureProgressSnapshotForDate(mealDateKey);
}

function setSelectedNutritionDate(dateKey) {
  if (!isValidDateKey(dateKey)) {
    return;
  }

  const currentDateKey = getSelectedNutritionDateKey();

  if (currentDateKey === dateKey) {
    renderNutrition();
    return;
  }

  captureProgressSnapshotForDate(currentDateKey);
  appState.nutrition.selectedDate = dateKey;

  const activeMeal = getActiveNutritionEditMeal();

  if (activeMeal && getMealDateKey(activeMeal) !== dateKey) {
    nutritionEditorRuntime.mealId = "";
  }

  saveNutriTrackStateToLocalCache();
  saveProgressStateToServer({ selectedRange: false }).catch((error) => {
    console.warn("Impossibile salvare lo snapshot progressi al cambio data.", error);
  });
  renderNutrition();
}

function resetNutritionFormAfterSubmit(form) {
  form.reset();
  resetFormValidationState(form);
  clearNutritionDraft();
  renderLookupResult("[data-off-nutrition-result]", null);
}

function setNutritionAnalysisStatus(message) {
  const status = document.querySelector("[data-nutrition-analysis-status]");

  if (status) {
    status.textContent = message || "";
  }
}

function setNutritionFormPendingState(form, isPending) {
  const submitButton = form?.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = isPending;
    submitButton.textContent = isPending ? "Analisi..." : "Aggiungi";
  }
}

function setMealPhotoPendingState(button, isPending) {
  if (!button) {
    return;
  }

  const label = button.querySelector(".action-label");
  button.disabled = isPending;

  if (label) {
    label.textContent = isPending ? "Riconosco..." : "Foto pasto";
  } else {
    button.textContent = isPending ? "Riconosco..." : "Foto pasto";
  }
}

function setMealPhotoMenuOpen(menu, button, isOpen) {
  if (!menu || !button) {
    return;
  }

  menu.hidden = !isOpen;
  button.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

// Nutrition section event binding and persistence flow.
function setupNutritionSection() {
  const form = document.querySelector("[data-nutrition-form]");
  const mealsList = document.querySelector("[data-meals-list]");
  const editForm = document.querySelector("[data-nutrition-edit-form]");
  const editCancelButton = document.querySelector("[data-nutrition-edit-cancel]");
  const mealPhotoButton = document.querySelector("[data-meal-photo-button]");
  const mealPhotoMenu = document.querySelector("[data-meal-photo-menu]");
  const mealPhotoCameraInput = document.querySelector("[data-meal-photo-camera-input]");
  const mealPhotoGalleryInput = document.querySelector("[data-meal-photo-gallery-input]");
  const mealPhotoInputs = [mealPhotoCameraInput, mealPhotoGalleryInput].filter(Boolean);
  const dateInput = document.querySelector("[data-nutrition-date-input]");
  const dateStepButtons = document.querySelectorAll("[data-nutrition-date-shift]");
  const waterGlassesContainer = document.querySelector("[data-nutrition-water-glasses]");
  const waterGoalMenuToggle = document.querySelector("[data-water-goal-menu-toggle]");
  const waterGoalMenu = document.querySelector("[data-water-goal-menu]");
  const physicalActivityForm = document.querySelector("[data-physical-activity-form]");
  const physicalActivityList = document.querySelector("[data-physical-activity-list]");

  if (!form || !mealsList || !editForm || !editCancelButton) {
    return;
  }

  bindFormValidationFeedback(form);
  bindFormValidationFeedback(editForm);
  renderPhysicalActivityDatalist();

  if (physicalActivityForm) {
    bindFormValidationFeedback(physicalActivityForm);
  }

  dateStepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const offsetDays = Number(button.dataset.nutritionDateShift);
      setSelectedNutritionDate(shiftDateKey(getSelectedNutritionDateKey(), Number.isFinite(offsetDays) ? offsetDays : 0));
    });
  });

  dateInput?.addEventListener("change", () => {
    setSelectedNutritionDate(dateInput.value);
  });

  waterGlassesContainer?.addEventListener("click", (event) => {
    const glassButton = event.target.closest("[data-water-glass-value]");

    if (!glassButton) {
      return;
    }

    const selectedDateKey = getSelectedNutritionDateKey();
    const currentWater = Math.round(normalizeNumber(getProgressLogByDate(selectedDateKey)?.waterGlasses) || 0);
    const nextWater = Number(glassButton.dataset.waterGlassValue);

    persistNutritionWaterForDate(selectedDateKey, currentWater === nextWater ? nextWater - 1 : nextWater);
  });

  waterGoalMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setWaterGoalMenuOpen(waterGoalMenuToggle.getAttribute("aria-expanded") !== "true");
  });

  waterGoalMenu?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-water-goal-value]");

    if (!option) {
      return;
    }

    persistWaterGoal(option.dataset.waterGoalValue);
    setWaterGoalMenuOpen(false);
  });

  physicalActivityForm?.addEventListener("input", (event) => {
    if (["activityName", "durationMinutes", "calories"].includes(event.target.name)) {
      renderPhysicalActivityEstimate(physicalActivityForm);
    }
  });

  physicalActivityForm?.addEventListener("click", (event) => {
    const suggestionButton = event.target.closest("[data-physical-activity-suggestion]");

    if (!suggestionButton) {
      return;
    }

    const activity = physicalActivityCatalog.find((item) => item.id === suggestionButton.dataset.physicalActivitySuggestion);

    if (!activity) {
      return;
    }

    physicalActivityForm.elements.activityName.value = getPhysicalActivityDisplayLabel(activity);
    renderPhysicalActivityEstimate(physicalActivityForm);
  });

  physicalActivityForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    markFormValidationAttempt(physicalActivityForm);

    if (!physicalActivityForm.checkValidity()) {
      return;
    }

    try {
      const selectedDateKey = getSelectedNutritionDateKey();
      const activity = buildPhysicalActivityFromForm(physicalActivityForm, selectedDateKey);
      await addPhysicalActivityForDate(selectedDateKey, activity);
      physicalActivityForm.reset();
      resetFormValidationState(physicalActivityForm);
      renderPhysicalActivityEstimate(physicalActivityForm);
      setPhysicalActivityStatus("Attività aggiunta alla giornata.", "success");
    } catch (error) {
      setPhysicalActivityStatus(error.message || "Non sono riuscito ad aggiungere l'attività.", "error");
    }
  });

  physicalActivityList?.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-physical-activity-id]");

    if (!deleteButton) {
      return;
    }

    await removePhysicalActivityForDate(getSelectedNutritionDateKey(), deleteButton.dataset.deletePhysicalActivityId);
    setPhysicalActivityStatus("Attività rimossa.", "success");
  });

  document.querySelectorAll("[data-physical-activity-goal-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setIncludeBurnedCaloriesInGoal(!shouldIncludeBurnedCaloriesInGoal());
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".meal-water-menu")) {
      setWaterGoalMenuOpen(false);
    }
  });

  mealPhotoButton?.addEventListener("click", (event) => {
    event.stopPropagation();

    if (mealPhotoButton.disabled) {
      return;
    }

    setMealPhotoMenuOpen(mealPhotoMenu, mealPhotoButton, mealPhotoMenu?.hidden !== false);
  });

  mealPhotoMenu?.addEventListener("click", (event) => {
    event.stopPropagation();

    const sourceButton = event.target.closest("[data-meal-photo-source]");

    if (!sourceButton) {
      return;
    }

    setMealPhotoMenuOpen(mealPhotoMenu, mealPhotoButton, false);

    const input = sourceButton.dataset.mealPhotoSource === "camera" ? mealPhotoCameraInput : mealPhotoGalleryInput;
    input?.click();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-meal-photo-choice]")) {
      setMealPhotoMenuOpen(mealPhotoMenu, mealPhotoButton, false);
    }
  });

  mealPhotoInputs.forEach((input) => {
    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setNutritionAnalysisStatus("Riconosco gli alimenti nella foto...");
      setMealPhotoPendingState(mealPhotoButton, true);

      try {
        const result = await requestMealPhotoDescription(file);
        form.elements.name.value = result.description;
        form.elements.name.dispatchEvent(new Event("input", { bubbles: true }));
        clearNutritionDraft();
        nutritionEntryRuntime.entryMode = "ai_assisted";
        nutritionEntryRuntime.entryMethod = "ai-meal-photo";
        renderLookupResult("[data-off-nutrition-result]", null);
        setNutritionAnalysisStatus(result.reviewNote || "Descrizione generata dalla foto. Controllala prima di aggiungere.");
      } catch (error) {
        console.error("Riconoscimento foto pasto non riuscito.", error);
        setNutritionAnalysisStatus(error.message || "Riconoscimento foto non riuscito.");
      } finally {
        setMealPhotoPendingState(mealPhotoButton, false);
        event.target.value = "";
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    if (!form.checkValidity()) {
      return;
    }

    setNutritionAnalysisStatus("Analizzo il pasto e stimo le porzioni...");
    setNutritionFormPendingState(form, true);

    try {
      const targetDateKey = getSelectedNutritionDateKey();
      const meal = await createNutritionMealFromForm(form, targetDateKey);

      if (!isNutritionMealValid(meal)) {
        return;
      }

      await saveNutritionMealToServer(meal, "POST");
      resetNutritionFormAfterSubmit(form);
      setNutritionAnalysisStatus("Pasto salvato sul server.");
    } catch (error) {
      console.error("Impossibile aggiungere il pasto.", error);
      setNutritionAnalysisStatus(error.message || "Impossibile analizzare il pasto.");
    } finally {
      setNutritionFormPendingState(form, false);
    }
  });

  mealsList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-meal-id]");
    const button = event.target.closest("[data-delete-meal-id]");

    if (editButton) {
      const meal = appState.nutrition.meals.find((entry) => entry.id === editButton.dataset.editMealId);

      if (!meal) {
        return;
      }

      openNutritionEditForm(meal);
      resetFormValidationState(editForm);
      return;
    }

    if (!button) {
      return;
    }

    try {
      await removeNutritionMeal(button.dataset.deleteMealId);
      setNutritionAnalysisStatus("Pasto rimosso dal server.");
    } catch (error) {
      console.error("Impossibile rimuovere il pasto.", error);
      setNutritionAnalysisStatus(error.message || "Salvataggio non sincronizzato.");
    }
  });

  editForm.addEventListener("input", (event) => {
    if (!event.target.closest("[data-meal-item-row]")) {
      return;
    }

    syncNutritionEditTotalsFromItems(editForm, event.target);
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    markFormValidationAttempt(editForm);

    const meal = getActiveNutritionEditMeal();

    if (!meal) {
      closeNutritionEditForm();
      return;
    }

    const itemResult = syncNutritionEditTotalsFromItems(editForm);
    const rawValues = {
      calories: normalizeNumber(editForm.elements.calories.value),
      protein: normalizeNumber(editForm.elements.protein.value),
      carbs: normalizeNumber(editForm.elements.carbs.value),
      fats: normalizeNumber(editForm.elements.fats.value),
    };
    const updatedValues = {
      calories: rawValues.calories === null ? null : roundMacroValue(rawValues.calories),
      protein: rawValues.protein === null ? null : roundMacroValue(rawValues.protein),
      carbs: rawValues.carbs === null ? null : roundMacroValue(rawValues.carbs),
      fats: rawValues.fats === null ? null : roundMacroValue(rawValues.fats),
    };

    const hasInvalidNumber = Object.values(updatedValues).some((value) => value === null || value < 0);

    if (hasInvalidNumber) {
      return;
    }

    if (itemResult) {
      updatedValues.items = itemResult.items;
      updatedValues.sourceNote = buildMealAnalysisSourceNote({ items: itemResult.items });
      updatedValues.name = buildMealNameFromEditedItems(meal, itemResult.items, nutritionEditorRuntime.itemBaselines);
    }

    try {
      await applyManualNutritionCorrection(meal, updatedValues);
      closeNutritionEditForm();
      setNutritionAnalysisStatus("Pasto aggiornato sul server.");
    } catch (error) {
      console.error("Impossibile aggiornare il pasto.", error);
      setNutritionAnalysisStatus(error.message || "Salvataggio non sincronizzato.");
    }
  });

  editCancelButton.addEventListener("click", () => {
    closeNutritionEditForm();
  });

  renderNutrition();
}

// Core app bootstrap kept in app.js as the shared entrypoint.
function startNutriTrackCore() {
  if (nutritrackCoreRuntime.started) {
    return;
  }

  nutritrackCoreRuntime.started = true;

  loadPhysicalActivityCatalog().then(refreshPhysicalActivityCatalogUi);
  syncNutritionGoalsFromProfile();
  setupBarcodeScanner();
  setupNutritionSection();
  setupProgressSection();
  hydrateNutriTrackStateFromApi()
    .then(() => {
      syncNutritionGoalsFromProfile();
      captureTodayProgressSnapshot();
      saveProgressStateToServer({ selectedRange: false }).catch((error) => {
        console.warn("Impossibile salvare lo snapshot progressi iniziale.", error);
      });
      renderNutrition();
    })
    .catch(() => {
      syncNutritionGoalsFromProfile();
      captureTodayProgressSnapshot();
      saveNutriTrackStateToLocalCache();
      renderNutrition();
    });
}

async function initializeNutriTrackApp() {
  if (initializeNutriTrackApp.hasRun) {
    return;
  }

  initializeNutriTrackApp.hasRun = true;

  const shouldStartApp = await window.bootstrapAuthenticationGate?.();

  if (shouldStartApp) {
    startNutriTrackCore();
  }
}

initializeNutriTrackApp.hasRun = false;
window.initializeNutriTrackApp = initializeNutriTrackApp;
