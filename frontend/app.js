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
  "NUTRITRACK_SYNC_DEBOUNCE_MS",
  "defaultRecipeTimestamp",
  "RECIPE_NUTRITION_SOURCE_LABEL",
  "RECIPE_TOKEN_STOPWORDS",
  "RECIPE_GENERIC_TOKENS",
  "nutritrackSyncRuntime",
  "recipeLibrary",
  "groceryComparisonCatalog",
  "groceryNameToCatalogId",
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

// Shared draft and totals helpers for nutrition and progress snapshots.
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

// Shared nutrition feedback for the diary section.
function setFeedback(message) {
  const feedback = document.querySelector("[data-nutrition-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

// Shared state normalization for persisted frontend data.
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

// Structured OpenFoodFacts normalization and RAG record building.
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

  if (!normalizedBarcode) {
    throw new Error("Barcode non valido.");
  }

  const cachedProduct = getCachedOpenFoodFactsProduct(normalizedBarcode);

  if (cachedProduct) {
    return cachedProduct;
  }

  const response = await fetch(`/api/openfoodfacts/product/${normalizedBarcode}`);

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
  saveState();
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

// Shared biometric helper used by progress, profile, and devices.
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

const nutritionEditorRuntime = {
  mealId: "",
};

// Nutrition core rendering and setup remain here because they coordinate shared state.
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

// Sync profile goals into the nutrition dashboard summary.
function syncNutritionGoalsFromProfile() {
  const { calories, protein, carbs, fats } = appState.profile.goals;

  appState.nutrition.goals = {
    calories,
    protein,
    carbs,
    fats,
  };
}

// Render the list of meals currently tracked for today.
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
  renderNutritionEditForm();
  renderProgress();
}

// Inline nutrition editor state and rendering helpers.
function getActiveNutritionEditMeal() {
  return appState.nutrition.meals.find((meal) => meal.id === nutritionEditorRuntime.mealId) || null;
}

function setNutritionEditFeedback(message) {
  const feedback = document.querySelector("[data-nutrition-edit-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function closeNutritionEditForm() {
  nutritionEditorRuntime.mealId = "";
  setNutritionEditFeedback("");
  renderNutritionEditForm();
}

function openNutritionEditForm(meal) {
  if (!meal) {
    return;
  }

  nutritionEditorRuntime.mealId = meal.id;
  setNutritionEditFeedback("");
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
    return;
  }

  panel.hidden = false;
  title.textContent = `Correggi ${meal.name}`;
  form.elements.calories.value = meal.calories;
  form.elements.protein.value = meal.protein;
  form.elements.carbs.value = meal.carbs;
  form.elements.fats.value = meal.fats;
}

// Shared nutrition meal creation and mutation helpers used by the section wiring.
function createNutritionMealFromForm(form) {
  const formData = new FormData(form);
  const linkedProduct = openFoodFactsRuntime.nutritionLookup;
  const nutritionDraft = getNutritionDraftForMeal(formData.get("name"));

  return {
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
}

function isNutritionMealValid(meal) {
  const hasInvalidNumber = ["calories", "protein", "carbs", "fats"].some((key) => {
    const value = meal[key];
    return Number.isNaN(value) || value < 0;
  });

  return Boolean(meal.name && meal.time && !hasInvalidNumber);
}

function persistNutritionMealChanges(dateKey) {
  captureProgressSnapshotForDate(dateKey);
  saveState();
  renderNutrition();
}

function applyManualNutritionCorrection(meal, updatedValues) {
  Object.assign(meal, updatedValues, {
    nutritionSource: "manual-correction",
    nutritionSourceLabel: "Corretto manualmente",
  });

  persistNutritionMealChanges(getMealDateKey(meal));
}

function removeNutritionMeal(mealId) {
  const mealToDelete = appState.nutrition.meals.find((meal) => meal.id === mealId);
  const mealDateKey = mealToDelete ? getMealDateKey(mealToDelete) : getTodayDateKey();

  if (nutritionEditorRuntime.mealId === mealId) {
    nutritionEditorRuntime.mealId = "";
    setNutritionEditFeedback("");
  }

  appState.nutrition.meals = appState.nutrition.meals.filter((meal) => meal.id !== mealId);
  persistNutritionMealChanges(mealDateKey);
}

function resetNutritionFormAfterSubmit(form) {
  form.reset();
  resetFormValidationState(form);
  clearNutritionDraft();
}

// Nutrition section event binding and persistence flow.
function setupNutritionSection() {
  const form = document.querySelector("[data-nutrition-form]");
  const mealsList = document.querySelector("[data-meals-list]");
  const editForm = document.querySelector("[data-nutrition-edit-form]");
  const editCancelButton = document.querySelector("[data-nutrition-edit-cancel]");

  if (!form || !mealsList || !editForm || !editCancelButton) {
    return;
  }

  bindFormValidationFeedback(form);
  bindFormValidationFeedback(editForm);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const meal = createNutritionMealFromForm(form);

    if (!isNutritionMealValid(meal)) {
      setFeedback("Completa almeno nome e orario con valori validi.");
      return;
    }

    appState.nutrition.meals.push(meal);
    persistNutritionMealChanges(getMealDateKey(meal));
    resetNutritionFormAfterSubmit(form);
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

      openNutritionEditForm(meal);
      resetFormValidationState(editForm);
      return;
    }

    if (!button) {
      return;
    }

    removeNutritionMeal(button.dataset.deleteMealId);
    setFeedback("Pasto rimosso.");
  });

  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(editForm);

    const meal = getActiveNutritionEditMeal();

    if (!meal) {
      closeNutritionEditForm();
      return;
    }

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
      setNutritionEditFeedback("Inserisci solo numeri validi per correggere i valori nutrizionali.");
      return;
    }

    applyManualNutritionCorrection(meal, updatedValues);
    closeNutritionEditForm();
    setFeedback("Valori nutrizionali aggiornati manualmente.");
  });

  editCancelButton.addEventListener("click", () => {
    closeNutritionEditForm();
    setFeedback("Correzione annullata.");
  });

  renderNutrition();
}

// Core app bootstrap kept in app.js as the shared entrypoint.
function initializeNutriTrackApp() {
  if (initializeNutriTrackApp.hasRun) {
    return;
  }

  initializeNutriTrackApp.hasRun = true;

  syncNutritionGoalsFromProfile();
  captureTodayProgressSnapshot();
  saveState();
  setupBarcodeScanner();
  setupNutritionSection();
  setupProgressSection();
  hydrateNutriTrackStateFromApi();
}

initializeNutriTrackApp.hasRun = false;
window.initializeNutriTrackApp = initializeNutriTrackApp;
